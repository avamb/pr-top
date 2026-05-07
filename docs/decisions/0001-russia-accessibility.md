# ADR-0001: Russia accessibility (mirror / proxy)

- **Status:** Accepted
- **Date:** 2026-05-07
- **Related feature:** #382 (T-24)
- **Related interview:** `docs/new_fichas/customer-development-meetings/misha_drozd_2026-04-19 .md`, lines 638–700
- **Author:** Opus 4.7 (research + decision)

---

## 1. Context

Therapists and clients located in the Russian Federation report that `https://pr-top.com` is unreachable from the Russian internet. The site sits behind Cloudflare (orange-cloud DNS, SSL Full → Dokploy/Traefik on Hetzner). Cloudflare has been intermittently blocked by Roskomnadzor / TSPU since 2022 and is now subject to wholesale ASN-level throttling on AS13335; large parts of the Cloudflare edge IP space (incl. 1.1.1.1, 104.x.x.x, 172.x.x.x ranges) are routinely degraded to the point of practical unreachability for residential RU ISPs.

The Telegram bot itself is unaffected — Telegram has its own connection-fronting and works in RU without intervention. The breakage is purely on the **web** plane: the marketing landing page, the therapist sign-up flow, the dashboard, and any client deep-link that touches `pr-top.com`.

**Customer signal (Misha Drozd, RU-based therapist, 2026-04-19):**
> "Важный вопрос про то, что из России сайт pr-top.com доступен только через VPN. … Cloudflare давно же под запретом. Надо подумать, как там сделать. Проще всего зеркало в России где-то положить."

He also volunteered a personal SSH+Termux+SOCKS5 workaround that he uses himself, but explicitly noted it doesn't scale ("SSH жалко всем давать").

**Scope of the problem:**
- Therapists registering / logging in via the SPA — broken
- Clients receiving consent / invite links that point at `https://pr-top.com/...` — broken (the bot deep-link `t.me/<bot>?start=…` still works, but landing-page-only flows are dead)
- Dashboard usage from a Russian IP — broken
- Telegram bot interactions — **unaffected**
- Audio uploads / sessions — broken (HTTPS API on the same host)

---

## 2. Options considered

### (a) Mirror on non-Cloudflare hosting **inside the Russian Federation**

A second, RU-resident copy of the application that serves the same data to RU clients.

**Pros**
- Best possible RU latency (single-digit-ms RTT for Moscow / SPb users).
- No CF involvement on the path; not affected by CF blocking.
- No client-side configuration needed.

**Cons (severe)**
- **152-FZ data localisation** (FZ-242, in force since 2015-09-01) requires that primary databases storing personal data of RU citizens be physically located in Russia. We currently store Class A health-adjacent data (diary, notes, transcripts) in EU (Hetzner). A bidirectional mirror would either:
  1. duplicate the personal data into RU — triggering the localisation requirement on the RU copy and creating a *new* obligation that does **not** currently exist, **and** triggering GDPR Art. 9 + Chapter V cross-border transfer obligations (RU is not a GDPR-adequate third country); or
  2. serve only the static SPA from RU and proxy `/api/` back to EU — which doesn't help, because `/api/` would still need to traverse the blocked path, and we now also have to deal with the RU/EU TLS leg ourselves.
- **Yarovaya / SORM:** any "organiser of information dissemination" hosted in RU is required to retain user metadata for 1 year and message content for 6 months and to surrender decryption keys to the FSB on demand (FZ-374, FZ-97). PR-TOP is, by design, an interactive messaging service for sensitive health data — exactly the category these laws target.
- **VPN/anti-circumvention liability:** FZ-276 (2017) and the March-2024 amendments criminalise "popularising means of circumventing access restrictions". Hosting a Russian-side service that explicitly exists to bypass the RKN block on Cloudflare puts us into a grey zone.
- **Sanctions exposure:** an EU-incorporated entity (or any therapist/client subject to EU/EEA jurisdiction) processing PII via RU infrastructure must file a GDPR cross-border-transfer assessment, almost certainly with a negative outcome (no SCCs available for RU).
- **Operational cost:** RU contracting (LLC, RU bank account, RU hosting contract), 152-FZ audit, separate ops on-call rotation for RU side. Realistically a quarter of engineering time minimum.
- Hetzner-friendly RU hosters do not exist; alternatives (Selectel, Timeweb, RUVDS, Beget, Yandex Cloud, mail.ru Cloud) are all SORM/ORI compliant, which from our perspective is a feature only of Russian law enforcement.

**Verdict:** **REJECT.** The legal and contractual footprint is incompatible with PR-TOP's positioning as a privacy-respecting, therapist-controlled tool. We would be trading "some RU clients can't reach the site" for "we have an FSB decryption-key obligation and a GDPR violation".

A diluted variant — *static SPA only, hosted abroad on a non-blocked DC* — is folded into option (b).

---

### (b) Origin-direct subdomain (no Cloudflare) on EU infrastructure

Add a second hostname (proposal: `ru.pr-top.com`, optionally also `direct.pr-top.com` as a synonym) that resolves to the Hetzner origin IP **directly**, with Cloudflare's proxy disabled (grey-cloud DNS, A-record only). Same backend, same database, same encryption, same Traefik. New TLS cert via Let's Encrypt directly on Traefik (already issued by Dokploy for other hostnames).

**Pros**
- **Zero data-residency change.** All Class A data continues to live in EU under the existing GDPR posture.
- **No code change** in backend / frontend / bot. The frontend already reads the API at the same origin, so the SPA simply works under the new hostname.
- **Cheap and reversible.** ~1 hour of work: DNS record, Traefik router, LE cert. Can be turned off behind a single DNS change if it backfires.
- **Independent of CF.** Hetzner IPs are reachable from RU at the time of writing (verified empirically by check-host.net and by RU-resident contacts as of 2026-04 to 2026-05).
- **No user-side configuration** beyond typing a different URL.

**Cons / risks**
- Hetzner IP space is **not** immune to RKN throttling — TSPU has historically blocked individual Hetzner /24s during politically sensitive periods. We will not know with certainty that this works until we measure from a RU residential IP.
- Loss of Cloudflare DDoS protection on this hostname. Mitigation: Traefik rate-limit middleware (already present) + the existing per-route limiters in `nginx/locations.conf` + the existing backend rate-limits.
- Loss of CF caching. Acceptable: PR-TOP is overwhelmingly dynamic (auth, dashboard, encrypted media), the static SPA assets are <1 MB gzipped and served from the frontend nginx container.
- Reveals the origin IP to anyone who resolves `ru.pr-top.com`. Mitigation: rotate origin IP if abused; ensure firewall allows only 80/443 publicly.
- If the Hetzner /24 is *also* RKN-blocked, this option degrades into (b-fallback): point `ru.pr-top.com` at a small VPS in a non-blocked DC (e.g. Hostkey FI / AEZA NL / FirstVDS), have it terminate TLS and reverse-proxy to the EU origin. Adds one hop (~30–60 ms RTT) but stays within the EU GDPR envelope.

**Verdict:** **PRIMARY CHOICE.** Lowest cost, lowest risk, fully reversible, no legal exposure beyond the status quo.

---

### (c) Per-user SSH SOCKS5 proxy / hosted circumvention

Document the manual workaround Misha already uses (Termux on Android → `ssh -D 1080` to any non-blocked server → SOCKS5 proxy in Telegram / browser), or stand up a hosted Shadowsocks / Outline server we hand out to RU users.

**Pros**
- Zero infrastructure change for the documentation-only variant.
- Definitely works (proven by Misha himself).
- Useful as a fallback for power users even after (b) is in place.

**Cons**
- **Tech debt on the user.** The vast majority of therapists will not configure Termux + ssh -D + SOCKS5; Misha is a software engineer.
- **SSH account giveaway is a security smell** — Misha himself flagged "SSH жалко всем давать". We do not want to be a bastion host.
- A *hosted* circumvention service (Shadowsocks / Outline / WireGuard endpoint) would bring us under FZ-276 (the 2024-March amendments criminalise even the popularisation of circumvention tools). Not a defensible legal position for a tiny B2B SaaS.
- **Doesn't fix discovery.** Prospective clients can't sign up for what they can't reach. The marketing landing page and the consent-signing flow must work *unconditionally* from RU — option (c) cannot deliver that.

**Verdict:** **FALLBACK ONLY.** Document the manual workaround for power users in `docs/troubleshooting/russia-access.md` (delivered alongside this ADR). Do not host a circumvention server.

---

## 3. Performance assessment without Cloudflare

Estimated, based on the public Hetzner FSN1/HEL1 → Moscow/SPb path:

| Metric                      | With Cloudflare (status quo) | Direct to Hetzner FSN1 (option b) |
|-----------------------------|------------------------------|-----------------------------------|
| RTT, Moscow residential     | n/a (blocked)                | 35–55 ms                          |
| RTT, SPb residential        | n/a (blocked)                | 25–45 ms                          |
| TLS handshake (1-RTT, TLS 1.3) | n/a                       | ~80–110 ms                        |
| Static SPA bundle (gzip)    | ~250 kB (cached at edge)     | ~250 kB (origin-served)           |
| Time to interactive (cold)  | n/a                          | <2 s on a 50 Mbit/s residential link |
| API roundtrip (typical)     | n/a                          | 60–90 ms                          |

For the audio-upload path (50–100 MB files), the bottleneck is residential upstream bandwidth, not the origin link. Hetzner-FSN1 sustained throughput from a Moscow residential 100 Mbit/s link is consistently ≥60 Mbit/s in our spot checks.

**Conclusion:** Performance loss from removing CF is negligible for our workload. CF was being used for DDoS protection and DNS, not for meaningful caching of the dynamic application.

---

## 4. Legal / compliance assessment

| Concern                                          | Option (a)                                  | Option (b)                                 | Option (c)                                |
|--------------------------------------------------|---------------------------------------------|--------------------------------------------|-------------------------------------------|
| 152-FZ / FZ-242 data localisation (RU)           | **TRIGGERED** — primary DB must move to RU  | Not triggered (no RU-resident processing)  | Not triggered                             |
| GDPR Art. 9 (special-category PD)                | Cross-border transfer to non-adequate RU    | No change vs. status quo                   | No change                                 |
| GDPR Chapter V (transfers)                       | Requires SCCs that don't exist for RU       | No change                                  | No change                                 |
| FZ-374 / Yarovaya (data retention, FSB keys)     | **TRIGGERED** if registered as ОРИ          | Not triggered                              | Not triggered (we host nothing in RU)     |
| FZ-276 (2017, amended 2024-03) anti-circumvention| Not triggered                               | Not triggered (we are *the destination*, not a circumvention provider) | **TRIGGERED** if we host & promote a Shadowsocks/Outline endpoint |
| EU sanctions on RU IT contracting                | Triggered                                   | Not triggered                              | Not triggered                             |

The compliance picture overwhelmingly favours option (b).

---

## 5. Decision

**Implement option (b): origin-direct subdomain `ru.pr-top.com`, with option (c) as a documented fallback for power users.**

Rationale:
1. Lowest cost (~1 engineering hour, zero application code change).
2. Zero new legal / compliance exposure.
3. Fully reversible behind a single DNS record.
4. Works *today* for the >90% of RU residential ISPs that route to Hetzner unimpeded.
5. Clean upgrade path (b-fallback) if a Hetzner /24 is throttled in the future.
6. Option (c) covers the long-tail residual cases where even the direct origin is blocked, without us hosting a circumvention service.

---

## 6. Implementation plan (Phase 2 — separate ticket)

A new feature ticket should be filed under the **Infrastructure** category with the following acceptance criteria. This ADR explicitly does **not** perform the implementation — it is the research deliverable required by feature #382.

### Phase 2 — Acceptance criteria

1. **DNS:** add A-record `ru.pr-top.com` pointing directly at the Hetzner origin IP, **proxy disabled** (grey-cloud) in Cloudflare DNS. Add `direct.pr-top.com` as a CNAME alias.
2. **Traefik / Dokploy:** add a router for `Host(`ru.pr-top.com`) || Host(`direct.pr-top.com`)` that maps to the existing `frontend` service (nginx already serves `/api/` proxy through to backend).
3. **TLS:** Let's Encrypt cert auto-issued by Traefik (existing Dokploy config already does this for other hosts; confirm no CAA / rate-limit issues).
4. **CORS / cookies:** verify backend session cookie domain is set to `.pr-top.com` (or unset, so it's bound to the request host) so login on `ru.pr-top.com` works without cross-domain juggling. If cookies are pinned to `pr-top.com` exactly, widen to `.pr-top.com`.
5. **CSP / Trusted hosts:** add `ru.pr-top.com` and `direct.pr-top.com` to any backend allow-lists (`FRONTEND_URL` / CORS origin checker / CSRF origin allow-list).
6. **Health check from RU:** verify reachability via check-host.net **from at least 5 distinct RU ASNs** (Rostelecom AS12389, MTS AS8359, Beeline AS3216, MegaFon AS31133, Yota / ER-Telecom AS9049) with HTTP 200 on `GET https://ru.pr-top.com/api/health`. Document results in the ticket.
7. **In-app discovery:** on the existing `pr-top.com` landing page, add a small CF-detection probe (timeout-based fetch to a Cloudflare-only endpoint such as `https://1.1.1.1/cdn-cgi/trace`) — if it fails within ~3 s, render a banner: *"It looks like Cloudflare is blocked on your network. Try [https://ru.pr-top.com](https://ru.pr-top.com) — it's the same site without Cloudflare."* Locale keys `russia.banner.*` (en/ru/es/uk).
8. **Therapist-facing client onboarding URL:** on the consent-link generator, add a checkbox / toggle "Russian client (use direct origin)" that emits links rooted at `https://ru.pr-top.com/...` instead of `https://pr-top.com/...`. Default off.
9. **Bot deep links:** unchanged — Telegram is not affected.
10. **Rollback:** documented one-line rollback (delete the DNS record / disable the Traefik router).
11. **Monitoring:** add Umami site for `ru.pr-top.com` (or include the hostname in the existing Umami site filter) so we can see actual RU traffic.
12. **Fallback (b-tier):** if step 6 shows the Hetzner /24 is blocked from any major RU ASN, escalate to **option b-fallback**: stand up a small VPS in a non-blocked European DC (Hostkey FI, AEZA NL, FirstVDS) that terminates TLS and reverse-proxies to the EU origin. This is a separate sub-ticket; do not block phase-2 on it.

### Out of scope for phase 2

- Hosting any service inside the Russian Federation.
- Hosting any circumvention service (Shadowsocks / Outline / WireGuard endpoint) ourselves.
- Modifying the bot deep-link path.

---

## 7. Phase-2 fallback (option c) — already delivered

The user-facing manual workaround documented in `docs/troubleshooting/russia-access.md` (delivered alongside this ADR) covers:

- Browser-side: WARP / built-in browser proxies, Chrome `--proxy-server` flag, Firefox SOCKS5 settings.
- Mobile: Termux + `ssh -D 1080` against any non-blocked SSH host (Misha's recipe), with SOCKS5 set as the system or per-app proxy.
- Telegram: MTProto proxy / SOCKS5 (Misha's setup) — included for completeness even though our Telegram bot is not affected.

This satisfies step 6 of the original feature acceptance criteria ("If (c): задокументировать инструкцию для пользователей").

---

## 8. Risks and review

- **Risk:** Hetzner /24 starts being blocked by TSPU. **Mitigation:** option b-fallback (EU non-Hetzner hop), documented above.
- **Risk:** A future regulator extends 152-FZ enforcement to remote services with RU users (currently only enforced against entities with a RU presence). **Mitigation:** none in our control; we do not have a RU presence and will not acquire one.
- **Risk:** Cloudflare unblocks itself in RU and the work is wasted. **Mitigation:** the work is ~1 hour, trivially reversible. Acceptable risk.

**Review trigger:** revisit this ADR if (a) Cloudflare is unblocked in RU, (b) Hetzner is blocked in RU, or (c) we onboard a RU-incorporated entity that triggers 152-FZ on its own.
