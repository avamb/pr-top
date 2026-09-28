<!-- audience: user -->
# Anti-bot protection runbook

This page is for operators and platform admins managing PR-TOP in production. It describes how to read anti-bot logs, temporarily disable protection layers for debugging, verify the per-IP rate limiter is working, and where Cloudflare-side rules live.

## Reading anti-bot logs

Anti-bot events are logged to `stdout`/`stderr` in the backend container and appear in Docker logs.

### Turnstile failures

```
[ANTIBOT] reason=turnstile ip=1.2.3.4 email=user@example.com
```

This means the Turnstile verification step failed. The client saw error message:
**"Verification failed. Please disable ad blockers, reload the page and try again."**

Possible causes:
- Ad blocker or privacy extension blocked the Turnstile challenge.
- Network path interrupts the Cloudflare verification request (e.g., corporate proxy).
- Turnstile widget script failed to load.
- `TURNSTILE_SECRET` is missing or misconfigured on the backend.

### Honeypot or timing failures

```
[ANTIBOT] reason=honeypot ip=1.2.3.4 email=user@example.com
```

This means the honeypot field (hidden `website` input) was filled in. This is **not a real registration** — the response is a fake success that mirrors the real route (201 for register/lead/viewer, 200 for forgot-password), served after a short random delay. The bot should not be able to tell it was rejected. Only automation fills a hidden field, so there are no human false positives here.

```
[ANTIBOT] reason=timing ip=1.2.3.4 email=user@example.com
```

The form was submitted in less than `ANTIBOT_MIN_FORM_MS` milliseconds after page load. This is logged at `info` level and answered with an honest `400 { code: "FORM_TOO_FAST" }` ("Please take a moment and try again."). Humans can hit it (password-manager autofill); their retry succeeds because the form timer started at page load. A burst of these from one IP is bot traffic; occasional single ones are people.

### Registration rate limiting

```
[IP] register from 1.2.3.4
```

A registration was submitted from this IP. This is a temporary diagnostic log (to be removed in Wave 3). It confirms the IP detection (`CF-Connecting-IP` header or `req.ip` fallback) is working.

If the same IP appears many times in a short window, the rate limiter should have blocked it:

```
Error: Too many requests
Code: 429
```

A 429 response means `REGISTER_RATE_LIMIT_MAX` requests/hour (default 5) from that IP have been exceeded. The client sees:
**"Too many registration attempts from your network. Please try again in an hour."**

## Deploy coupling: backend secret and frontend site key

`TURNSTILE_SECRET` (backend) and `VITE_TURNSTILE_SITE_KEY` (frontend build arg) must be set **together or not at all**:

- Backend has `TURNSTILE_SECRET` but the frontend was built without `VITE_TURNSTILE_SITE_KEY` → the widget never renders, no token is sent, and **every human gets 403** (`[ANTIBOT] reason=turnstile … codes=missing-input-response`).
- Frontend has the site key but the backend secret is empty → the widget runs for nothing; harmless.

Because the frontend key is baked in at build time, wave 1 backend (track 1A) and wave 1 frontend (track 1B) must ship in the same deploy. If you see a wall of `missing-input-response` right after a deploy, clear `TURNSTILE_SECRET` on the backend and restart until the frontend image with the site key is live.

The backend also logs a startup warning in production while `ORIGIN_LOCKED` is not `true`: it is a reminder that `CF-Connecting-IP` is only trustworthy once the origin accepts traffic from Cloudflare exclusively (see "In production" below). Set `ORIGIN_LOCKED=true` after the firewall / Authenticated Origin Pulls are in place.

## Temporarily disabling protection layers

### Disable Turnstile verification

Set `TURNSTILE_SECRET` to an empty string:

```bash
# In Dokploy or docker-compose .env:
TURNSTILE_SECRET=
```

Restart the backend container. Turnstile verification is now skipped; the field is still sent by the frontend (but the backend ignores it).

### Disable honeypot and timing checks

Set `ANTIBOT_ENABLED` to `false`:

```bash
# In Dokploy or docker-compose .env:
ANTIBOT_ENABLED=false
```

Restart the backend container. Honeypot and timing checks are now skipped.

### Disable email verification gate

Set `EMAIL_VERIFICATION_GATE` to `false`:

```bash
# In Dokploy or docker-compose .env:
EMAIL_VERIFICATION_GATE=false
```

Restart the backend container. Unverified therapists can now call gated endpoints (create clients, upload sessions, etc.).

## Verifying the per-IP rate limiter

The per-IP limiter tracks registration attempts by `CF-Connecting-IP` header (set by nginx from Cloudflare) or `req.ip` as a fallback.

### Test with curl (development)

```bash
# Simulate requests from two different IPs
curl -H 'CF-Connecting-IP: 1.2.3.4' \
     -H 'Content-Type: application/json' \
     -d '{"email":"test1@example.com","password":"Test123!"}' \
     http://localhost:3001/api/auth/register

curl -H 'CF-Connecting-IP: 5.6.7.8' \
     -H 'Content-Type: application/json' \
     -d '{"email":"test2@example.com","password":"Test123!"}' \
     http://localhost:3001/api/auth/register
```

Both should succeed (201) if this is the first attempt from each IP.

Repeat the same IP 6+ times:

```bash
for i in {1..7}; do
  curl -H 'CF-Connecting-IP: 1.2.3.4' \
       -H 'Content-Type: application/json' \
       -d "{\"email\":\"test$i@example.com\",\"password\":\"Test123!\"}" \
       http://localhost:3001/api/auth/register
done
```

The 6th request should return 429 Too Many Requests. The 2nd IP should still succeed.

### In production

The `CF-Connecting-IP` header is only set by nginx when the request passes through Cloudflare. Verify:

1. Cloudflare is **enabled** for your domain (`pr-top.com`).
2. nginx `src/frontend/nginx.conf` includes:
   ```
   proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
   ```
3. The Hetzner host firewall **blocks direct access** to ports 80/443 (all traffic must flow through Cloudflare). See "Cloudflare-side rules" below.

If the Hetzner firewall is open to the internet, `CF-Connecting-IP` is unreliable — an attacker can spoof any IP. In that case, configure "Authenticated Origin Pulls" in Cloudflare to ensure only Cloudflare can reach your origin.

## Cloudflare-side rules

All Turnstile and anti-bot rules are configured **outside the backend**, in the Cloudflare dashboard, for this domain:

### Rate limiting rule

**Path:** Security → WAF → Rate limiting rules

- **Condition:** `POST` on `/api/auth/register*` (covers `/register`, `/register-lead`)
- **Action:** Block for 1 hour
- **Threshold:** 5 requests / 10 minutes per IP

This is a **Free plan rule** (only 1 available on Free tier). On higher tiers, you can add additional rules for `/forgot-password`, `/login-code/request`, etc.

### Bot Fight Mode

**Path:** Security → Bots → Bot Fight Mode

- **Status:** On
- **Automation:** Managed Challenge for suspected bots

This handles obvious bot User-Agents and script-based tools.

### Turnstile widget

**Path:** Security → Turnstile → Widgets

- **Domain:** `pr-top.com`
- **Mode:** Invisible
- **Type:** Managed
- **Keys:** Site and Secret are visible here. Copy them into backend env (`TURNSTILE_SECRET`) and frontend build arg (`VITE_TURNSTILE_SITE_KEY`).

## Testing Turnstile with dev keys

Cloudflare provides test keys for development:

- **Site key (dev, always passes):** `1x00000000000000000000AA`
- **Secret (dev, always passes):** `1x0000000000000000000000000000000AA`
- **Secret (dev, always fails):** `2x0000000000000000000000000000000AA`

In local development or testing:

```bash
# .env or docker-compose override
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET=1x0000000000000000000000000000000AA  # always pass
# or
TURNSTILE_SECRET=2x0000000000000000000000000000000AA  # always fail
```

Restart the backend and frontend. Test the registration form. With the "always fail" secret, any registration attempt will return 403 with the error message.

## Monitoring for false positives

After deployment, watch the logs for ~24 hours:

```bash
docker logs prtop-practice-ojpalv-backend-1 | grep ANTIBOT
docker logs prtop-practice-ojpalv-backend-1 | grep 'Too many requests'
```

**Red flag:** Legitimate users (gmail, corporate addresses, human timing) seeing "Verification failed" or "Too many registration attempts" frequently.

- If **<5% false-positive rate:** all is well.
- If **5–10%:** consider loosening `ANTIBOT_MIN_FORM_MS` or increasing `REGISTER_RATE_LIMIT_MAX`.
- If **>10%:** the protection is too strict; disable honeypot/timing or switch Turnstile to "Managed" (not "Invisible").

**Metric to track:** Compare registrations that pass all checks against total registrations. A sharp drop on deployment indicates over-blocking.

## Troubleshooting specific issues

### "Verification failed" on Safari or Firefox

Safari and Firefox sometimes handle the Turnstile widget differently. Ensure:

1. `VITE_TURNSTILE_SITE_KEY` is set (not empty).
2. Cloudflare is responding to the widget API (`https://challenges.cloudflare.com/turnstile/v0/api.js`).
3. Browser console is free of CSP errors (Content Security Policy should allow `challenges.cloudflare.com`).

### "Too many registration attempts" from a single office

The rate limiter is per IP. If an office shares one outbound IP (NAT), only the first user can register per hour. This is intentional — it prevents a single compromised network from flooding registrations. To allow more:

```bash
# Temporarily during office hours
REGISTER_RATE_LIMIT_MAX=20  # increase from 5
```

Then lower it back after the office's registrations are done.

### Rate limiter not working (requests succeed despite limit)

Verify:

1. `req.ip` is being read correctly. Temporarily add a log:
   ```js
   console.log('[IP] req.ip=' + req.ip + ', CF-Connecting-IP=' + req.headers['cf-connecting-ip']);
   ```
   Restart backend and check logs. Both should match the client's IP.

2. nginx is passing the header. Check `src/frontend/nginx.conf`:
   ```
   proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
   ```

3. The rate limiter is mounted on the route. In `src/backend/src/index.js`:
   ```js
   app.post('/api/auth/register', registerLimiter, …);
   ```

If `req.ip` is always the same (e.g., Traefik's internal IP), the limiter is ineffective against distributed attacks, but you cannot fix it without fixing the IP detection.
