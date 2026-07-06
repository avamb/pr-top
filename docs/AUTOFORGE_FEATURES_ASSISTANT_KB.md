# AutoForge Feature Breakdown — Assistant Knowledge Base security & docs pipeline

**Context:** Security review (2026-07-06) of the public "Ask about PR-TOP" chat found that the anonymous landing-page bot AND the authenticated user bot share ONE RAG index that includes raw backend source code (`src/backend/src/routes`, `src/backend/src/services` incl. encryption/auth, `src/bot/src`). No tools/actions are exposed, so injection cannot execute or destroy anything — the real risk is **information disclosure** (internal implementation details) plus no output filtering and unbounded token cost.

**Design goal (from owner):** the bot must genuinely help — a sales assistant on the landing page and a strong how-to assistant for logged-in therapists. Raw source was indexed to achieve that. The better way to keep answer quality AND close the risk: index **auto-generated user-facing documentation** instead of raw code, split by audience, regenerated on every release.

**Key repo facts for the executing agent:**
- KB indexer: `src/backend/src/services/assistantKnowledge.js` — `INDEX_SOURCES` (line ~425) defines what gets indexed; `reindex()` (line ~744) rebuilds; `search(query, k)` (used by both routes) returns top-k chunks. `PROJECT_ROOT` resolves to `/app/project-root` in Docker.
- Public bot route: `src/backend/src/routes/publicAssistant.js` (`POST /api/assistant/public-chat`, anonymous, 5-msg limit, `max_tokens: 1500`).
- Authenticated bot route: `src/backend/src/routes/assistant.js` (logged-in users) — **shares the same `assistantKnowledge.search()`**.
- Sanitizer: `src/backend/src/services/assistantSanitizer.js` — has `sanitizeInput`/`detectInjection` (regex, input-side only). Header claims "output guardrails" but NONE exist in code.
- Answer cache: `src/backend/src/services/assistantCache.js` — `storeCachedAnswer(q, a, hasRagContext)` skips storage when `hasRagContext` is falsy; both route call-sites currently pass only 2 args, so the cache never populates (latent bug, currently fail-safe).
- Reindex trigger: admin UI `/admin/ai-models` → button → `POST /admin/assistant/reindex`; also runs on backend startup (`src/backend/src/index.js:444`).

Implement in order S1→S5. Acceptance checks are local: run against a local reindex + a Node test script (no deployed site needed). Add a new audit `_t_assistant_kb_audit.js` at repo root (mirrors the style of `_t_geo_audit.js`).

---

## S1 — Remove raw backend source from the RAG index; index docs + safe surfaces only
**Description:** Rewrite `INDEX_SOURCES` in `assistantKnowledge.js` so the knowledge base indexes only user-facing, non-sensitive material: `docs/` (`.md`), `docs/assistant-kb/` (created in S4), `src/frontend/src/i18n` (UI labels/copy), and `README.md`. **Remove** the `api_route` (`src/backend/src/routes`), `service` (`src/backend/src/services`), `bot` (`src/bot/src`), and `ui_component` (`src/frontend/src/pages|components`) source groups. Keep `.env.example` out too (it's low-risk but adds no user value). Delete the now-moot `EXCLUDED_SOURCE_FILES` handling if it only referenced source code.
**Steps:**
1. Edit `INDEX_SOURCES` to the docs/i18n/README allowlist; drop the code source groups.
2. Reindex locally (run the reindex path or a small harness that calls `assistantKnowledge.reindex()` against a test DB).
3. Create `_t_assistant_kb_audit.js`: after reindex, query the `assistant_knowledge` table (or the store API) and assert NO chunk has `source_type` in `{api_route, service, bot, ui_component}` and NO `source_file` starts with `src/backend/` or `src/bot/`.
4. Assert the KB still contains chunks from `docs/` and i18n (coverage didn't drop to zero).

## S2 — Audience-scoped search (public vs authenticated)
**Description:** Give `assistantKnowledge.search(query, k, audience)` an `audience` param (`'public' | 'user'`). Tag each `INDEX_SOURCES` entry with an `audiences` array. Public search returns only chunks whose source is tagged `public` (marketing/feature/FAQ/security-overview docs); authenticated search may additionally include `user` how-to docs. `publicAssistant.js` calls `search(q, 3, 'public')`; `assistant.js` calls `search(q, 3, 'user')`.
**Steps:**
1. Add `audiences` tags to sources; add the `audience` filter to `search()` (default `'public'` for safety).
2. Update both route call-sites.
3. In `_t_assistant_kb_audit.js`: assert `search('how is data encrypted', 3, 'public')` returns zero chunks whose `source_file` is under `src/`; assert a known how-to doc is retrievable for `'user'`.

## S3 — Output guardrail: redact secret-shaped strings from replies
**Description:** Add `sanitizeOutput(text)` to `assistantSanitizer.js` that redacts anything resembling a credential before the reply is sent OR cached: OpenAI-style keys (`sk-[A-Za-z0-9]{20,}`), `Bearer <token>`, `AI_API_KEY=…`/`*_API_KEY=…` assignments, JWTs (`eyJ…\.…\.…`), and long hex/base64 blobs (≥32 chars). Apply in BOTH the SSE streaming path (redact each accumulated final text before the `done` event — or buffer+redact before send) and the non-SSE path in `publicAssistant.js` AND `assistant.js`.
**Steps:**
1. Implement `sanitizeOutput` + export it.
2. Wrap `assistantReply` with `sanitizeOutput()` before `res.write(done)` / `res.json()` and before any `storeCachedAnswer`.
3. Add a Node unit check in the audit: feed sample strings (`sk-abc…`, `Bearer x`, `AI_API_KEY=secret`, a fake JWT) → assert each is redacted; feed normal prose → assert unchanged.

## S4 — Auto-generated how-to docs pipeline (owner's idea)
**Description:** Create `scripts/generate-assistant-docs.mjs` that regenerates user-facing docs into `docs/assistant-kb/` on each release. Two layers: (a) **deterministic** — derive a feature/endpoint/setting map from `src/backend/src/routes` (route list), `src/frontend/src/i18n/en.json` (feature/UI labels), and pricing/plan data, written as structured Markdown; (b) **prose how-tos** — task-oriented "how to X" pages. For AutoForge, the deterministic layer is generated from code; the prose layer is authored/updated as Markdown (an LLM/agent may draft it, but it is committed as reviewed docs, NOT generated at index time). Add an npm script `docs:assistant` and document that it runs pre-release. Public-facing pages get a `<!-- audience: public -->` front-marker; how-to pages `<!-- audience: user -->` (consumed by S2 tagging).
**Steps:**
1. Implement the generator producing `docs/assistant-kb/*.md` with audience markers; wire `npm run docs:assistant`.
2. Seed initial how-to docs (getting started, uploading a session, client diary via Telegram, exercises, crisis/SOS, billing) as `user` audience; feature/security overviews as `public`.
3. Assert generated docs contain prose (low `require(`/`function ` density — e.g. <1 code-token per 200 words) so raw code isn't copied verbatim; assert every file has a valid audience marker.
4. Reindex; assert (S1/S2 audit) the new docs are indexed and retrievable per audience.

## S5 — Public-bot economics + cache fix (gated on S1–S3)
**Description:** (a) Lower `max_tokens` for the public bot from 1500 to ~600 (FAQ-length); keep 1500 only for authenticated `assistant.js`. (b) Add a per-session and per-lead message cost guard in addition to the existing IP rate limit. (c) Fix the latent cache bug: pass `hasRagContext` as the 3rd arg to `storeCachedAnswer` in both paths — but only ENABLE caching after S1–S3 are in, and run cached answers through `sanitizeOutput` (S3) before serving.
**Steps:**
1. Reduce public `max_tokens`; confirm authenticated path unchanged.
2. Add session/lead cost guard alongside IP limit.
3. Pass `hasRagContext` correctly; ensure cached replies are output-sanitized on both store and serve.
4. Audit: grep confirms public `max_tokens<=600`; a local test shows a cached answer is returned on the 2nd identical question and passes the secret-redaction check.

---

## Not for AutoForge (human)
- Review the auto-generated/seeded public-audience docs for marketing/security-claim accuracy before they go live (same gate as the comparison pages).
- Decide the pre-release trigger for `npm run docs:assistant` (CI step vs manual vs agent) once S4 lands.

## Ordering & rationale
S1 (remove code) is the single highest-impact change and unblocks the rest. S2 scopes by audience. S3 is a cheap safety net independent of the others. S4 restores/《improves》 answer quality via docs (the owner's idea) and must land before or with S1 so the `user` bot doesn't lose helpfulness. S5 is optimization + the cache fix, deliberately gated so caching only turns on once the index and output are safe.
