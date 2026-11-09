# Runbook: rotating the encryption master key

> Audience: whoever operates the Dokploy deployment (superadmin). Internal,
> not indexed by the assistant knowledge base.

This runbook explains how to replace `ENCRYPTION_MASTER_KEY` with a new secret
and move every stored Class A value, backup and media file onto the new key,
then retire the old key. Done correctly, nothing becomes unreadable at any
point. The code is in `src/backend/src/services/encryption.js` (key ring),
`services/keyRotation.js` (re-encryption job) and `services/backupService.js`
(backup format).

## How keys work

- Every encrypted value carries a **key version** (`"<version>:<iv>:<tag>:<ct>"`).
  The version selects the key that decrypts it, so data under different
  versions can sit side by side.
- A key version is served by a **master secret**:

  | Env variable | Meaning |
  |---|---|
  | `ENCRYPTION_MASTER_KEY` | Current secret. Serves every version `>= ENCRYPTION_MASTER_KEY_VERSION`. All new data is written with it. |
  | `ENCRYPTION_MASTER_KEY_VERSION` | First version the current secret serves. Unset = 1 (one secret for every version, the pre-rotation behaviour). |
  | `ENCRYPTION_MASTER_KEY_PREVIOUS` | Old secret, **decrypt-only**. Serves versions from `ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION` (default 1) up to `ENCRYPTION_MASTER_KEY_VERSION - 1`. |
  | `ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION` | Only needed if the old secret did not serve every version from v1 (a second rotation before the first was retired). |

- From the secret of a version the backend derives separate keys: the field
  key for database values (PBKDF2, the same derivation as before wave 3), and
  HKDF purpose keys for backups (`backup`) and media files (`file`).
- **Key check.** For each version, `encryption_keys.key_check` stores a canary
  encrypted under that version. If the configured secret cannot open it (or,
  before a canary exists, cannot open any real value under that version), the
  dashboard shows **Wrong key**. For the active version, the backend then
  **refuses to write**: no new data is ever encrypted with a wrong secret.
- **Fingerprint.** The dashboard shows a short fingerprint per version. It is
  derived from the key (not the secret itself) and is safe to note down. The
  same secret always gives the same fingerprint for a version, so you can use
  it to confirm that `ENCRYPTION_MASTER_KEY_PREVIOUS` really is the old key.

Everything below is in the superadmin dashboard (`/admin`), under
**Encryption Keys**.

## Deploying the version that introduced this (audit wave 3): rollback

This release changes on-disk formats, and older code cannot read the new
ones:

- new backups use the `PRTOPBAK` GCM format; before wave 3 the backend only
  restores the old AES-CBC files;
- media files are upgraded from the legacy format to the chunked format
  lazily (and by the re-encryption job);
- the database gains `encryption_keys.key_check` and
  `encryption_rotation_jobs`. These are harmless to old code.

So rolling the code back after this deploy can leave backups and media that
the old code cannot open. **Before deploying, take a full snapshot of the
backend data volume** (`/app/data`, including `backups/`), for example a
Hetzner volume snapshot or a `tar` of the volume with the backend stopped.
Keep it until the release is confirmed good. A rollback then means restoring
that snapshot together with the old image. Don't run the old image against the
new data.

## Before you start

1. Open **Encryption Keys** and write down:
   - the **highest key version** in the table (call it `N`; on a deployment
     that was never rotated, `N = 1`);
   - the **fingerprint** of every version.
   Also check that every version shows **Key check OK**.
2. Create a backup (**Database Backups → Create Backup**). If
   `BACKUP_OFFSITE_COMMAND` is configured, wait until it has been copied
   off the host.
3. Put the current secret in your offline vault, labelled with
   "versions 1..N". Off-site backup copies made before the rotation will
   always need it.
4. Generate the new secret, for example `openssl rand -base64 48`. Store it in
   the vault too.

## Step 1: deploy the new key

In Dokploy, backend service, Environment:

```
ENCRYPTION_MASTER_KEY=<new secret>
ENCRYPTION_MASTER_KEY_VERSION=<N + 1>
ENCRYPTION_MASTER_KEY_PREVIOUS=<old secret>
```

Leave `ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION` unset unless the old secret
itself started above v1. Redeploy the backend.

The backend refuses to start if `ENCRYPTION_MASTER_KEY_PREVIOUS` is set
without a `ENCRYPTION_MASTER_KEY_VERSION` above it. This catches the most
dangerous mistake: changing the secret but forgetting the version, which
would make every old value unreadable.

## Step 2: verify the key ring

Under **Encryption Keys**, check:

- **Active key version** is `N + 1`, with **Key check OK**. The backend
  creates and activates the new version on first use.
- Versions `1..N` are **Served by: Previous key**, **Key check OK**, and
  their fingerprints are **identical** to the ones you noted down.
- **Still stored under an older key version** shows non-zero counts. This is
  expected: nothing has been moved yet.

If any version shows **Wrong key**, stop and fix the environment:

- an old version shows Wrong key: `ENCRYPTION_MASTER_KEY_PREVIOUS` is not the
  old secret;
- the active version shows Wrong key: `ENCRYPTION_MASTER_KEY_VERSION` is not
  above every existing version (it must be `N + 1`), or the secret is wrong.

The fail-closed check means nothing was written under a wrong key. Fix the
variables and redeploy. Never lower `ENCRYPTION_MASTER_KEY_VERSION` once data
has been written under the new version.

**Key check false positive (emergency only).** On the first start after
this feature ships, a version without a canary is verified against real
rows (newest first). If the logs show `Key check FAILED for key version vX`
and writes fail with `KEY_CHECK_FAILED` even though the key has not changed,
set `ENCRYPTION_KEY_CHECK=warn` to let writes through while you investigate.
This can happen if old rows were written with an earlier secret. Writes then
proceed with the configured key and the error is only logged. Remove the
override once the cause is understood.

## Step 3: run the re-encryption job

Click **Start re-encryption** and confirm. The job runs in the background:

1. **Database values.** It walks every Class A column: the maintained list
   `ENCRYPTED_COLUMNS` in `encryption.js`, plus any other text column found
   holding ciphertext. The dashboard warns about such unlisted columns; add
   them to the list. For each value below the active version it decrypts,
   re-encrypts, reads the new value back to verify it, and writes it. This
   happens in small batches inside a transaction, with a pause between
   batches so the API stays responsive.
2. **Backups.** Each backup that is a legacy AES-CBC file, has an envelope
   below the active version, or contains values below it, is re-encrypted.
   That covers the envelope **and** the database image inside, so a restore
   never needs the old key. The new file is verified before it atomically
   replaces the old one.
3. **Media files.** Session recordings (`data/sessions`) and diary/report
   media (`data/diary_files`) are processed one file at a time. Every
   legacy-format file and every chunked file below the active version is
   re-encrypted in place by `fileCrypto.reencryptFile`. That call holds the
   file's lock, writes a `*.rewrite.part` copy, verifies that it decrypts to
   the same bytes, and only then replaces the original. The file name, and so
   every database reference, stays the same. Temp leftovers and upload staging
   files (`*.part`, `*.rewrite.part`, `*.upload.enc`, `*.tmp`) are skipped and
   are not counted; the backend's media housekeeping removes stale ones. A file
   that was replaced during the rewrite (`SOURCE_CHANGED`) or briefly locked is
   retried once. Any other failure is recorded and the job moves on to the
   next file.

You can **Pause** at any time; **Resume** continues from the stored cursor.
If the backend restarts while the job runs, the job shows **Interrupted
(server restarted)**. Click **Resume**. Re-running is always safe: only
values below the active version are touched.

While the job runs, restoring a backup is refused. Pause the job first.

## Step 4: check the result

The job ends as **Completed** or **Completed with errors**.

- **Values that could not be re-encrypted** are listed as `table.column
  #rowid (vX): error` and left byte-for-byte unchanged. Usually they were
  already corrupt (they cannot be opened with the old key either). Inspect
  them, then delete or repair the rows and click **Resume** / **Start** again.
- **Backups** still on an old version: a backup whose re-encryption failed
  keeps its original file. Check the backend log (`[BACKUP] Re-encrypted …` /
  `[KEY-ROTATION] …`).
- **Media files** that failed are listed as `<dir>:<file name> (vX): error`
  (dir 0 = `data/sessions`, 1 = `data/diary_files`); the original file is
  unchanged. A failure such as `CORRUPT` / `DECRYPT_FAILED` usually means the file
  was already damaged; `KEY_UNAVAILABLE` means no configured key serves its
  version. Fix or remove it and run the job again.
- **Unrecognised files** are files in the media directories that are neither
  encrypted format. Hover the count to see up to 20 names. They block "safe to
  retire" until you have checked them: plaintext leftovers from old crashes
  should be deleted.

Repeat until the banner reads **"Nothing uses an older key version. The
previous master key can be removed from the server environment."** At that
point the job marks the old versions **Retired**.

Then create a fresh backup and confirm in `GET /api/admin/backups` that it
reports `format: "gcm-v1"`, `key_version: N + 1` and
`data_key_version_min: N + 1`.

## Step 5: retire the old key

In Dokploy, remove `ENCRYPTION_MASTER_KEY_PREVIOUS` (and
`ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION` if set). Keep
`ENCRYPTION_MASTER_KEY_VERSION=<N + 1>`: never remove or lower it. Redeploy.

Verify:

- versions `1..N` show **Served by: No key** and status **Retired**;
- the active version shows **Key check OK**;
- open a client's diary, a session summary and a therapist note: they read
  normally.

Keep the old secret in the vault. The job re-encrypts the backups **on this
host** only. It does **not** re-send them through `BACKUP_OFFSITE_COMMAND`,
so every off-site copy made before the rotation keeps the old key (and, for
copies older than this release, the old AES-CBC format). Archive the old
secret together with a note of which off-site copies need it, and keep it for
as long as those copies are retained.

## Restoring an old backup after the old key was retired

A backup made before the rotation and never re-encrypted (an off-site copy,
for example) needs the old key:

1. Temporarily set `ENCRYPTION_MASTER_KEY_PREVIOUS=<old secret>` again (same
   `ENCRYPTION_MASTER_KEY_VERSION`), redeploy.
2. Restore the backup. The restored database becomes active under version
   `N + 1` automatically.
3. Run the re-encryption job until the banner is green, then remove
   `ENCRYPTION_MASTER_KEY_PREVIOUS` again.

The restore error `Backup is encrypted with key version X, which no
configured master key serves` means exactly this situation.

## Derived-key rotation without a new secret

`POST /api/encryption/rotate` (superadmin) creates version `N + 1` from the
**same** secret. Then run the job as in step 3. This replaces the derived keys
but not the secret, so it does not help if the secret itself leaked. For a
leaked secret, follow the full procedure above.

## Moving off a default / weak key

If production data was encrypted with the development default key (the
`ALLOW_INSECURE_DEFAULT_SECRETS` escape hatch in `utils/secretsGuard.js`),
follow this runbook with the default key as `ENCRYPTION_MASTER_KEY_PREVIOUS`.
The secrets guard only checks `ENCRYPTION_MASTER_KEY`, so the backend starts
normally. Once the old key is retired, unset `ALLOW_INSECURE_DEFAULT_SECRETS`.

## API reference (superadmin)

- `GET /api/encryption/rotation/status`: key ring (no secrets), key versions
  with source / key check / fingerprint, job progress, and what is still on
  an older version (database values per column, backups, media files), plus
  `safe_to_retire_previous`.
- `POST /api/encryption/rotation/start`: start, or resume a paused /
  interrupted / failed job. Returns 409 if the active key fails its key check.
- `POST /api/encryption/rotation/pause`: stop after the current batch.
- `GET /api/encryption/keys`, `POST /api/encryption/rotate`: key versions,
  derived-key rotation.

Every start, resume, pause request and completion is written to the audit log
(`key_rotation_*`).
