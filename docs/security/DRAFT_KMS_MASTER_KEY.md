# DRAFT — Master key out of `.env`: KMS/HSM with role separation

> **Status: draft / not scheduled.** Written 2026-07-14 by the project assistant at the owner's request.
> This is a design note for future implementation, NOT a backlog feature. Do not pick this up
> without an explicit owner decision — it touches key management for all Class A clinical data.

## Why this note exists

PR-TOP encrypts Class A data (diary entries, session notes, transcripts, therapist-entered
history) with AES-256-GCM at the application layer. Honest limitation, now stated publicly on
the site (R12/R32): **the master key lives in a server environment variable**
(`ENCRYPTION_MASTER_KEY`, read in `src/backend/src/services/encryption.js:14`), so anyone with
server/deploy access can derive every data key and decrypt everything alone.

True E2EE is off the table by product design (Telegram Bot API delivers plaintext; AI
transcription/summaries/search need server-side plaintext; the dashboard serves decrypted
content). The realistic hardening step is **envelope encryption with an external KMS and role
separation**: even a lone server admin cannot decrypt data, and every key use is independently
logged.

## Current state (verified 2026-07-14)

- `encryption.js`: `deriveKey(version) = PBKDF2(ENCRYPTION_MASTER_KEY, "prtop-key-v{version}", 100k, SHA-256)`.
- Key **versioning already exists** (`encryption_keys` table, `status='active'`, packed format
  `version:iv:authTag:ciphertext`) — this is the biggest migration asset: a new key version can
  be introduced without touching old rows, and `decrypt()` already routes by version.
- Rotation procedure exists conceptually (`keyMgmt` copy on the security page) but re-encryption
  of old rows is lazy/absent.
- Backups: `backupService.js` also uses the master key — must be covered by any migration.

## Target design (envelope encryption)

1. **Data keys (DEKs)** stay local per key-version (as today), but are generated randomly —
   not derived from a passphrase.
2. Each DEK is stored in `encryption_keys` **encrypted by a KMS-held key (KEK)**. Plaintext DEK
   exists only in process memory after a KMS `Decrypt` call at startup (or on first use, cached
   with a TTL).
3. **The KEK never leaves the KMS/HSM.** Server code holds only an API credential with
   `kms:Decrypt` on that one key.
4. **Role separation:** the person who administers the app server does not control the KMS key
   policy, and vice versa. Practically for a 2-person company: owner A holds cloud-KMS admin,
   owner B holds server/deploy; either alone can not decrypt the dataset. KMS audit log
   (CloudTrail/equivalent) records every Decrypt independently of the app's own audit log.
5. Optional later step: per-therapist DEKs (blast-radius reduction; enables per-practice
   crypto-shredding on account deletion).

## Provider options (EU-region requirement)

| Option | Fit | Notes |
|---|---|---|
| **AWS KMS (eu-central-1)** | Best default | Envelope pattern is native (GenerateDataKey/Decrypt); CloudTrail; ~$1/key/mo + $0.03/10k requests. Startup latency only (DEK cached). |
| GCP Cloud KMS (europe-west3) | Equivalent | Same pattern; pick if infra ever moves to GCP. |
| HashiCorp Vault (transit engine), self-hosted | No cloud dependency | But then Vault's unseal keys become the new root — real role separation needs Shamir shares split between the two owners; more ops burden on Dokploy. |
| Hetzner + external HSM | Overkill | Physical HSM not justified at current scale. |

Recommendation when the time comes: **AWS KMS, eu-central-1 (Frankfurt)** — cheapest path to
"admin alone cannot decrypt" with an independent audit trail, and Hetzner-hosted app keeps
working (KMS is an API call, data never leaves Hetzner).

## Migration path (uses the existing version machinery)

1. Add `kms_wrapped_dek` column to `encryption_keys`; introduce key version N+1 whose DEK is
   random and KMS-wrapped. New writes use N+1 (zero downtime — `decrypt()` already dispatches
   by version).
2. Keep versions ≤N readable via the legacy env-var derivation during transition (a
   `LEGACY_MASTER_KEY` fallback path, clearly marked deprecated).
3. Background re-encryption job walks old rows (diary, sessions, transcripts, backups),
   re-packs under N+1. Progress metric in admin panel.
4. When zero rows remain on ≤N: delete `ENCRYPTION_MASTER_KEY` from `.env`, remove the fallback
   path, revoke old versions in `encryption_keys`.
5. Update the public security copy (R12/R32 pages + assistant-KB `security-overview.md`): the
   "operator holds the key" sentence changes to the two-party/KMS description — **only after**
   step 4 actually completes (truth-before-copy).
6. Disaster recovery: document KMS key policy backup + break-glass procedure (both owners
   jointly); test restore of an encrypted backup before cutting over.

## Impact / risks

- **Startup dependency on KMS**: if KMS is unreachable, the app cannot decrypt — needs a cached
  DEK strategy (memory cache + graceful degradation to read-only error states) and monitoring.
- **Cost**: negligible (single-digit $/month at current scale).
- **Effort estimate**: ~2–4 dev-days for envelope path + migration job + docs, plus ops setup
  (IAM, CloudTrail, break-glass runbook). Testing on staging with a full backup/restore drill
  is the long pole.
- **What it does NOT give**: this is still not E2EE — the running server sees plaintext (AI and
  bot features require it). The claim it unlocks is precisely: *"no single administrator can
  decrypt stored data, and every decryption is independently logged."*

## Decision checklist for the owner (when picking this up)

- [ ] Choose provider (default: AWS KMS eu-central-1) and who of the two board members holds
      KMS admin vs server admin.
- [ ] Approve the transition window with the legacy fallback path.
- [ ] Schedule the backup/restore drill before cutover.
- [ ] Only then: create the implementation feature(s) in the AutoForge backlog and update the
      public security copy after completion.
