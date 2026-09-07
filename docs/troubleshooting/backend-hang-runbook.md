# Runbook: backend hang / "login spinner never stops"

> Audience: whoever operates the Dokploy deployment. Internal — not indexed by
> the assistant knowledge base.

## Symptom

- `https://pr-top.com/` (the SPA) loads fine, but every `/api/*` call hangs:
  the login button spins forever, `curl https://pr-top.com/api/health` never
  returns.
- `docker ps` shows the backend container **Up … (unhealthy)** with a huge
  failing streak in `docker inspect --format '{{json .State.Health}}'`.
- `docker stats` shows the backend at ~100% CPU with a tiny RSS (the process
  has been swapped out) and the host has several GB of swap in use.
- The last backend log line is hours or days old; the scheduler (which logs
  every 5 minutes) has gone silent. The final line may be a bizarre SQLite
  error such as `unknown function: datetime()`.

## What actually happened (incident of 2026-09-05 → 09-07)

The API process (`node src/index.js`, Node 18, sql.js = SQLite compiled to
WebAssembly, whole database in memory) grew slowly over ~7 weeks of uptime,
then hit the point where V8 spends all its time in garbage collection. The
event loop blocked, so the container health check (an HTTP GET) timed out
forever — but **Docker only marks a container unhealthy; it never restarts
it**, and the host started swapping. The `datetime()` error was sql.js
failing to re-open its WASM handle inside `db.export()` once the WASM heap was
exhausted. Nobody noticed for two days because nothing restarted and nothing
alerted.

## Immediate fix (any time this recurs)

```bash
ssh lead-parser "docker restart -t 20 prtop-practice-ojpalv-backend-1"
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://pr-top.com/api/health
```

Restarting reloads the database from the last on-disk save. Writes are saved
to disk immediately after every mutation, so at most a few seconds of unsaved
data can be lost.

## Guard rails now in place (after this incident)

| Layer | Where | What it does |
|---|---|---|
| V8 heap cap | `src/backend/Dockerfile` (`NODE_OPTIONS=--max-old-space-size=768`) | A leak ends in a fast "heap out of memory" abort instead of hours of GC thrash. |
| Container memory limit | `docker-compose.yml` (`mem_limit`/`memswap_limit: 1536m`) | Hard ceiling; swap disabled for the container, so one leaking service can no longer drag the whole host into swap. |
| In-process watchdog | `src/backend/src/utils/memoryWatchdog.js` | Logs `[MEMORY] rss=… heap=…` hourly, exits with code 1 once RSS ≥ `MEMORY_WATCHDOG_MAX_RSS_MB` (default 1024). |
| Liveness route | `GET /api/health/live` | Cheap probe (event loop + `SELECT 1`), no Stripe / network call. |
| Healthcheck watchdog | `src/backend/healthcheck.sh` | After `HEALTHCHECK_MAX_FAILURES` (4) consecutive probe misses it SIGKILLs node; `restart: unless-stopped` brings it back. Never kills a process younger than `HEALTHCHECK_START_GRACE` (300 s). |
| `init: true` + direct `node` CMD | compose + Dockerfile | docker-init is PID 1, node is a normal child, so the kill above is honoured and `docker stop` delivers SIGTERM. |
| Graceful shutdown | `src/backend/src/index.js` | On SIGTERM/SIGINT: stop scheduler, flush DB to disk, close server. |
| Fatal export guard | `src/backend/src/db/connection.js` | If `db.export()` throws, the process exits immediately instead of running on a dangling SQLite handle. |
| Heap snapshot on demand | `NODE_OPTIONS=--heapsnapshot-signal=SIGUSR2` | `docker kill -s SIGUSR2 <backend>` writes `Heap.*.heapsnapshot` into `/app` for analysis. |

Net effect: worst case is now roughly one to two minutes of API downtime
followed by an automatic restart, and the memory trend is visible in the logs.

## Diagnosing memory growth (before it becomes an incident)

```bash
# Memory trend (one line per hour)
ssh lead-parser "docker logs --since 72h prtop-practice-ojpalv-backend-1 2>&1 | grep '\[MEMORY\]' | tail -80"

# Current numbers
ssh lead-parser "docker stats --no-stream prtop-practice-ojpalv-backend-1"

# Take a heap snapshot without restarting (writes /app/Heap.<date>.heapsnapshot)
ssh lead-parser "docker kill -s SIGUSR2 prtop-practice-ojpalv-backend-1"
ssh lead-parser "docker exec prtop-practice-ojpalv-backend-1 ls -la /app | grep heapsnapshot"
# Then: docker cp <container>:/app/Heap.<...>.heapsnapshot . and open it in Chrome DevTools → Memory.
```

Expected baseline right after start: RSS ≈ 120 MB, heap ≈ 25–40 MB. A steady
climb of tens of MB per day is the signature of the leak to hunt; compare two
snapshots taken a day apart ("Comparison" view in DevTools).

## Things that were ruled out during the incident

- Disk was 41% used; not the cause.
- The SQLite file is ~16 MB; database size is not the cause.
- sql.js `exec` / `VACUUM` / `export` loops were reproduced locally for
  thousands of iterations with no growth.
- Hammering `/api/health`, `/api/csrf-token`, `/api/features` locally (~4
  minutes, 4 parallel clients) left the V8 heap flat at ~24 MB.

So the growth is slow (weeks), most likely tied to real traffic or a specific
scheduler/bot code path. The hourly `[MEMORY]` log lines plus on-demand heap
snapshots are there to pin it down next time it starts climbing.

## Related

- Deployment layout: `docs/PROJECT_STATUS.md` (Dokploy on Hetzner, Cloudflare in front).
- Frontend proxy timeouts for `/api/`: `src/frontend/nginx.conf`.
