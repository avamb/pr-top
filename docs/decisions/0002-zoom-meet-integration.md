# ADR-0002: Zoom / Google Meet SDK integration

- **Status:** Accepted (no-go for current cycle, Phase-3 deferred)
- **Date:** 2026-05-07
- **Related feature:** #381 (T-23)
- **Related interview:** `docs/new_fichas/customer-development-meetings/fomkin 2026-04-20.md`, lines 181–213
- **Depends on:** T-07 (audio upload), T-19 (single-track recording), T-20 (auto-link by date/metadata) — all shipped
- **Author:** Opus 4.7 (research + decision)

---

## 1. Context

Алексей Фомкин (psychoanalyst, RU) suggested in the 2026-04-20 customer-development interview that the dashboard should let the therapist launch Zoom / Google Meet directly from inside PR-TOP, with the recording landing automatically into the corresponding session. Quoting the relevant turn (lines 181–193):

> "Да, если это возможно, то есть грубо говоря, когда ты говоришь через Zoom или Google Meet с клиентом, чтобы писать этот разговор и его как бы в системе, ну чтобы ты из окна системы, чтобы заходил бы, например, прямо в Google Meet или этот самый Zoom. … Чтобы изнутри окна ты зашел, у тебя открылось окно, ты ведешь сессию, и все там записалось, и все. Я изучу этот вопрос, как это сделать, потому что это как бы инструмент все в одном тогда будет."

Critically, in the **next** breath (lines 193–213) he himself proposes the alternative we already shipped in T-20 (auto-link by date / metadata):

> "Но с другой стороны, смотри, даже если вот такой интеграции невозможно, то все равно каким образом идет. Вот ты провел Zoom, у тебя появились там записи. … он по датам, по времени, он соединит одно к другому, то есть тебе не нужно будет отмечать, что вот это было с тем-то и так далее. Там метаданные есть в любом случае файлы, которые записаны, и этот файл присоединится к той сессии."

So the customer signal is: **the in-window recording experience is "would dramatically simplify life", but the post-hoc upload-and-auto-link path is acceptable.** The question for this ADR is whether the additional UX win is worth the engineering, licensing, and legal cost of a real-time SDK integration *in the current cycle*.

### Status of the dependencies (already merged)

- **T-07** (`feat: T-07 audio upload via admin web UI`, commit `fbf1117`): therapist drag-drops audio into the dashboard, the file is encrypted and attached to a `sessions` row, Whisper runs, AI summary runs.
- **T-19** (`feat: T-19 single-track therapist-only recording`, commit `327b850`): if the client did not consent, the upload is marked `recording_mode='single_track'` and a speaker-diarisation pass keeps **only the therapist's track** before transcription. Defends against "the client never agreed to be recorded but the therapist still wants their own notes" — the exact concern Алексей flagged at lines 860–872.
- **T-20** (`feat: T-20 auto-link audio by date/metadata`, commit `ea3161e`): bulk-drag of multiple recordings, system parses filename timestamps and `lastModified` mtime, auto-attaches each file to the right `sessions.meeting_date` slot for the right client, presents a conflict-resolution UI when ambiguous, falls back to "create a new session" when no match is found.

The combined T-07 + T-19 + T-20 chain is essentially the post-hoc workflow Алексей described in the 193–213 fallback. That is the **baseline** the SDK option must beat.

---

## 2. Options considered

### (a) Zoom **Meeting** SDK (client-side embed)

Embed the *standard Zoom client* inside our React dashboard via the Zoom Meeting SDK Web Embed Component (`@zoom/meetingsdk`). The therapist clicks "Start session" in PR-TOP, an iframe-like panel opens with the familiar Zoom UI, the call runs as if launched from `zoom.us`, and recording goes to **Zoom Cloud**. We then fetch the recording artefact via the Zoom REST API webhook (`recording.completed`), download the encrypted MP4/M4A, run it through our existing T-07 → T-19 → T-20 pipeline.

**Pros**
- The therapist gets the exact Zoom UX they already know; minimal user-side learning.
- The SDK itself is **free** (no per-minute Zoom charge); the therapist's existing Zoom Pro / Business subscription pays for hosting and recording.
- Recording is taken in Zoom Cloud, then pulled to our origin — we get the file once and immediately re-encrypt it under our existing AES Class A key.
- Zoom's own consent banner ("This meeting is being recorded") and audible chime are built-in and TOS-mandatory — we do not need to re-implement consent UX from scratch.

**Cons**
- **Hard dependency on the therapist owning a paid Zoom plan** (Pro $14.99/host/mo, Business $19.99/host/mo). PR-TOP cannot be the entry point for a therapist who isn't already paying Zoom; we cannot resell or proxy.
- **JWT app deprecated; SDK app required.** As of June 2024, Zoom requires a Server-to-Server OAuth or SDK-token app, with Marketplace review for production traffic. Approval is 1–4 weeks of back-and-forth on privacy & data-handling docs.
- **Zoom is a new sub-processor.** Today PR-TOP has zero third-party processors of Class A audio (Whisper runs through our configurable provider, end-to-end). Adding Zoom requires:
  - DPA execution with Zoom (US) under SCCs / EU-US DPF.
  - Updated processor list in our public privacy notice.
  - Updated consent text in the T-18 disclaimer ("Your audio may be processed by Zoom Video Communications, Inc. for the duration of the call and during cloud-recording transit").
  - 30-day notice / objection window per GDPR Art. 28(2).
- **Cloud-recording lag.** Zoom Cloud recordings are typically available 30–60 min after the meeting ends; the file is not real-time. T-07/T-19/T-20 already deliver "drop-and-go" UX immediately after the call — Cloud recording adds a delay rather than removing one.
- **Engineering cost: ~50–80 hours.** SDK embed component, Marketplace app + signed JWT/SDK tokens, OAuth handshake for the recording-fetch leg, webhook receiver (`recording.completed` + `meeting.ended`), download → decrypt → re-encrypt under our key, audit log, locale strings, end-to-end test.
- **Recording data egress is on Zoom's clock.** If a therapist deletes a recording in Zoom Cloud before our webhook fires, we lose the file. We need an idempotent "fetch ASAP and verify integrity" step.
- **Russian therapists effectively excluded.** Zoom restricted RU service in 2022; Zoom's own infrastructure is intermittently blocked / throttled in RU networks. Same problem T-24 just solved for our own domain — we'd be reintroducing it.

**Implementation outline (if go):**
1. Marketplace app, SDK type, scopes: `meeting:read`, `recording:read`, `webinar:read`.
2. `<ZoomEmbed>` React component mounting `embeddedClient.init() / .join()` with a JWT/SDK token minted by our backend per session.
3. `POST /api/zoom/webhook` (Zoom challenge–response) → dispatcher for `recording.completed`.
4. Worker: fetch recording → re-encrypt under PR-TOP key → INSERT into existing `sessions.audio_path` → invoke existing transcription pipeline.
5. Frontend: "Start Zoom session" button on `ClientDetail`, gated on therapist having connected their Zoom account via OAuth.
6. Locale keys `session.zoom.*` (en/ru/es/uk) and audit `action='session_zoom_recording_imported'`.

---

### (b) Zoom **Video** SDK (server-side white-label)

Build our own video conferencing UI on top of Zoom's lower-level Video SDK (PaaS, formerly the JWT-Video SDK). The therapist never sees Zoom branding — the call happens in a `<VideoRoom>` React component we own, server-side recording is enabled per-session via `recordingEnabled: true`, and the audio file lands in our storage at the end of the call.

**Pros**
- **Fully white-label**, no Zoom branding leaks into the PR-TOP product.
- **Pay-as-you-go** pricing, no per-host license; PaaS billing on minutes streamed and GB recorded.
- Recording is optional per session; we control the consent UX entirely; we control the recording chime.
- No Marketplace approval needed (PaaS, no Zoom App).

**Cons (severe)**
- **We become a video conferencing company.** Building a stable, accessible, multi-locale video UI is a 4–8 week effort minimum, including: tile layout, mute/unmute, screen share, network-loss handling, mobile Safari quirks, AV1/VP9 codec switching, TURN fallback, accessibility (keyboard, screen reader), reconnect logic, recording-failure recovery. PR-TOP is a between-sessions assistant — we do not have the muscle for this.
- **Costs at our volume are non-trivial.** Indicative pricing (Zoom Video SDK PaaS, 2026):
  - Audio: ~$0.74 / 1000 audio-minutes
  - Video: ~$0.74 / 1000 video-minutes
  - Cloud recording: ~$0.10 / GB
  - For a 50-minute session with 2 video participants: ~$0.074 audio + ~$0.074 video + ~$0.05 storage = **~$0.20 / session**. At 4 sessions/week × 4 weeks = ~**$3 / therapist / month**, manageable, but only after the engineering investment.
- **Therapist abandons their existing Zoom subscription** to use ours, losing waiting rooms, SSO, organisation-level admin — features they pay Zoom for. Many will refuse.
- **Familiarity tax.** Therapists are already comfortable with Zoom; learning a new video UI mid-session is a friction we don't need to introduce for a between-sessions tool.
- **Same Zoom-sub-processor issues as (a)** — Zoom is still the carrier — but **without** the upside of Zoom-native consent UX (which we'd have to re-implement from scratch).

**Verdict: REJECT for current cycle.** Engineering scope is XL+ even by AutoForge XL standards, and the customer ask is "I want my Zoom inside your window," not "I want a brand-new video conferencing tool." Re-evaluate only if we onboard an enterprise customer who explicitly requires white-label video.

---

### (c) Google Meet integration

Three sub-options exist:

- **(c.1) Embed Meet inside our app** — **NOT POSSIBLE.** Google does not publish a JavaScript SDK that embeds the Meet client into a third-party origin. The closest thing, the Workspace **Add-ons SDK**, runs *inside* Meet (a side panel during a Meet call), not the other way around. There is no equivalent to Zoom's Meeting SDK Web Embed.
- **(c.2) Schedule + post-fetch via Meet REST API** — possible. The Meet REST API (GA 2024) lets us create a meeting space, list participants, and read artefacts (recording + transcript) once the meeting ends. The therapist clicks "Start Meet session" in PR-TOP, a `meet.google.com/xxx-yyyy-zzz` URL opens in a new tab, the call happens in Meet (not in our window), recordings + transcripts come back via the API once Meet finalises them.
  - Cloud recording requires the **organiser** to have **Workspace Business Standard** or higher (~$12 / user / month) — recording is not available on the free Meet tier or on the cheapest Business Starter tier.
  - The "in-window" experience the customer asked for is **not delivered** — it's exactly the same tab-switching workflow as today, just with auto-fetch at the end.
- **(c.3) Meet Add-on for in-Meet PR-TOP panel** — possible but inverted: the user lives in Meet, with a PR-TOP side-panel pulled in via the Add-ons SDK. Solves a *different* problem (in-meeting note-taking) and requires the therapist to install our Workspace add-on per-account. Out of scope for #381.

**Verdict: REJECT (c.1 + c.3) on technical impossibility / wrong direction; (c.2) reduces to "T-20 with a webhook" which doesn't justify the eng cost.**

---

### (d) Recall.ai (third-party meeting bot)

Recall.ai is a managed service that joins Zoom / Google Meet / Microsoft Teams / Webex / Whereby meetings *as a participant bot*, records the meeting server-side, and returns the recording + transcript via webhook. One integration → all platforms. The bot appears in the participant list with a configurable name (e.g. "PR-TOP recorder").

**Pros**
- **Single integration covers all four major platforms.** The customer mentioned both Zoom and Meet; Recall.ai handles Teams and Webex for free as well.
- **Zero per-platform Marketplace approval.** Recall.ai handles Zoom Marketplace + Meet OAuth + Teams Graph internally.
- **Engineering cost: ~3–5 days.** REST: `POST /api/v1/bot { meeting_url }` → bot dials in → webhook on `bot.done` with `audio_url`. Plug audio_url into the existing T-07 pipeline.
- **No Zoom Pro requirement on the therapist's side** — Recall.ai's bot is a regular meeting participant. The therapist can stay on free Zoom.
- Excellent docs, SOC-2 Type II, BAA available for HIPAA, mature DPA.

**Cons (severe)**
- **Adds a fourth-party sub-processor with full audio access.** Recall.ai (US, Delaware, founded 2021) is a **new** processor of our Class A audio. Currently we have zero such processors. Onboarding requires:
  - DPA execution (Recall.ai publishes a standard one) + EU-US DPF / SCCs.
  - Update to public processor list, update T-18 consent text, 30-day GDPR Art. 28(2) notice.
  - Sub-processor risk review by any therapist who previously committed to clients that "no third party records or stores the audio."
- **Pricing destroys margins on lower tiers.** As of 2026:
  - Audio-only bot: ~$0.69 / hour
  - Audio + video: ~$0.99 / hour
  - For one therapist with 16 sessions/month × 50 min: 13.3 hours × $0.69 = **~$9.20 / therapist / month** in raw cost.
  - At a planned Basic tier of ~$15–20 / mo, that's ~50% gross-margin loss on Basic and ~30% on Pro. Premium tier could absorb it; Basic and Trial cannot.
- **The bot is visible to the client.** A new "PR-TOP recorder" / "Recall AI" participant joins the call. Most clients will ask "what is that?" — and the answer is "a third-party server in another country making a copy of this conversation." That is a **privacy regression** vs. the current setup, where the therapist records locally on their own device and uploads.
- **The bot is also visible to *paranoid* clients** — i.e. exactly the segment Алексей described as the reason we built T-06 Solo mode. The same therapists who told us "клиент в бот не придёт" (paranoia, ethics) will be even less able to use a third-party bot in the call.
- **Failure mode = silent data loss.** If the bot is rate-limited / blocked / fails to dial in, the recording is gone and the therapist learns about it post-hoc. Locally-recorded Zoom files do not have this failure mode.

**Verdict: REJECT for current cycle.** Best technical path *if* we ever go, but the privacy-positioning and cost-per-session math don't work at our current tier structure. Re-evaluate if (i) we add a Premium tier that can absorb the bot cost, AND (ii) we onboard customers (≥3 paying therapists) explicitly requesting it.

---

### (e) Status quo (T-07 + T-19 + T-20 chain) + small UX nudge

Do nothing on the SDK side. The post-call workflow Алексей himself sketched in lines 193–213 is already implemented:

1. Therapist holds the session in their existing Zoom / Meet / Teams / Whereby (whatever they already pay for).
2. Recording lands on the therapist's local drive (Zoom Local Recording is free; Meet's Workspace recording lands in Drive).
3. After the day's sessions, therapist drags 1..N files into the PR-TOP **Bulk Upload** page (T-07 / T-20 work, shipped).
4. T-20 auto-attaches each file to the right `sessions.meeting_date` slot via filename / mtime metadata, with a conflict-resolution dropdown when ambiguous.
5. T-19 single-track diarisation strips out the client's audio if the client did not consent.
6. Existing transcription + summary pipeline runs.

**Pros**
- **Already shipped.** Zero engineering cost, zero new legal / compliance footprint, zero new vendor.
- **Privacy-positive.** No third-party processor of audio. The recording lives on the therapist's machine until they explicitly upload it.
- **Platform-agnostic.** Works the same for Zoom, Meet, Teams, Webex, Whereby, FaceTime audio, in-person dictaphone — anything that can produce an audio file.
- **Customer-validated.** The interview itself prescribes this exact workflow as the acceptable fallback (lines 193–213).
- **Offline-friendly.** Therapists in poor connectivity (Алексей gave the in-person dictaphone scenario) are not penalised.

**Cons**
- **Tab-switching workflow remains.** The "all in one window" promise from lines 184–188 is unmet.
- **Therapist must remember to start Zoom Local Recording / Meet's record toggle**; if they forget, no recording exists. (Mitigation: add a one-paragraph "How to record in Zoom / Meet for upload" guide to the dashboard, point at it from the Bulk Upload page. Trivial doc work, no code.)
- **Recording lag of ~minutes** until the therapist drops the file. Acceptable for a between-sessions assistant; we are not a real-time tool.

**Verdict: ACCEPT as the chosen status quo.** This is the minimum-viable answer that satisfies Алексей's stated fallback and ships zero new code.

---

## 3. Cost comparison

Assumed workload: 1 therapist · 16 sessions / month · 50 min average. Engineering cost in eng-hours at AutoForge throughput.

| Option | Eng cost (build) | Per-therapist runtime cost | Per-therapist license dep. | Sub-processors added | Customer-facing UX win |
|---|---|---|---|---|---|
| (a) Zoom Meeting SDK | ~50–80 h | $0 (Zoom-Cloud included in their Pro) | Zoom Pro $14.99/mo (theirs) | +1 (Zoom) | High — single window |
| (b) Zoom Video SDK | ~150–250 h | ~$3 / mo | None (PaaS) | +1 (Zoom) | Medium — new white-label UI |
| (c.2) Meet REST API | ~30–50 h | $0–$12 / mo (Workspace Bus. Std for recording) | Workspace Bus. Std $12/mo (theirs) | +1 (Google) | Low — same tab-switch as today |
| (d) Recall.ai | ~25–40 h | ~$9.20 / mo | None | +1 (Recall.ai) | High — single trigger, multi-platform |
| (e) Status quo + doc | ~0 h (already built) | $0 | None (their existing Zoom/Meet) | 0 | Low — tab-switch workflow |

---

## 4. Legal / compliance assessment

| Concern | (a) Meeting SDK | (b) Video SDK | (c.2) Meet API | (d) Recall.ai | (e) Status quo |
|---|---|---|---|---|---|
| GDPR Art. 9 (special-category PD) | Re-disclose Zoom as processor; SCCs in place via DPF | Same as (a) | Re-disclose Google as processor | Re-disclose Recall.ai; new DPA | No change |
| GDPR Art. 28 (sub-processor notice + 30-day objection) | Triggered | Triggered | Triggered | Triggered | Not triggered |
| US two-party consent (CA, FL, IL, MD, MA, NV, PA, WA) | Zoom built-in chime + banner | We must build chime + banner | Meet built-in indicator | Visible bot serves as notice | Therapist's Zoom/Meet handles natively |
| HIPAA BAA available | Yes (Zoom HIPAA tier) | Yes (Zoom HIPAA tier) | Yes (Google Workspace HC+Life Sciences) | Yes | N/A — therapist's tool's BAA |
| RU accessibility (cf. ADR-0001) | Zoom partially RU-blocked | Zoom partially RU-blocked | Meet OK in RU | Bot dials in from US — fine | Unaffected |
| 152-FZ data localisation | Zoom processes outside RU | Zoom processes outside RU | Google processes outside RU | Recall.ai US | No change |
| Russian therapist segment usable | Reduced (Zoom unstable in RU) | Reduced | OK | OK | OK |
| FZ-374 Yarovaya | Not triggered (no RU-resident processing on our side) | Same | Same | Same | Same |

**Conclusion:** Every SDK option introduces at least one new data processor of Class A health audio. Status quo introduces none.

---

## 5. Decision

**No-go for current AutoForge cycle. Adopt option (e) — status quo (T-07 + T-19 + T-20 chain) + a small documentation nudge.**

**File a Phase-3 ticket (deferred) to revisit option (d) Recall.ai when re-evaluation triggers fire.**

Rationale:
1. **Customer signal is one therapist** (Алексей), and the same interview turn explicitly accepts the status-quo fallback.
2. **The dependency chain (T-07, T-19, T-20) ships the workflow already.** The remaining gap — "one window, no tab switching" — is a UX polish, not a missing capability.
3. **Every SDK option introduces a new sub-processor** of Class A health audio, regressing on the privacy posture that's a core differentiator for the psychoanalyst / paranoid-client segment Алексей himself flagged in the same interview (T-06 Solo mode rationale).
4. **Cost-per-session math doesn't work at current tier structure.** The cheapest viable SDK route (Recall.ai, ~$9.20/therapist/month) consumes 50% of the planned Basic-tier gross margin.
5. **Engineering opportunity cost** — 50–80 hours on Zoom Meeting SDK is 2–3 other shipped features at AutoForge throughput. Ship those first; the customer pain is "fish out of water," not "missing capability."
6. **Reversibility is high.** If the trigger conditions in section 6 fire, Recall.ai integration is a 3–5 day spike; we lose nothing by waiting.

---

## 6. Phase-3 deferred — re-evaluation triggers

A new feature ticket should be filed under the **Integration** category and parked in the backlog pending **all of**:

1. **Demand:** ≥ 3 paying therapists explicitly request Zoom/Meet auto-recording (not "nice to have" — "I will not subscribe without this").
2. **Tier headroom:** subscription product has a tier (current planned: Premium) whose unit economics absorb ~$10–15/therapist/month of bot-recording cost.
3. **Sub-processor capacity:** legal review can fund a new GDPR Art. 28 processor (DPA, 30-day notice, processor list update, T-18 consent text update). Estimated 8–12 hours of compliance work.

When all three fire, the implementation plan below is recommended.

### Phase-3 implementation outline (if all triggers fire)

**Recommended path: Recall.ai** (single integration, multi-platform, zero per-therapist license dependency).

1. **DPA + processor list:** Sign Recall.ai DPA (US, EU-US DPF). Update `docs/PRD.md` § Security to list Recall.ai as processor of Class A audio. Update T-18 consent text (`session.consent.disclaimer.*` keys) in en/ru/es/uk to add the third-party-recording-bot disclosure. Send GDPR Art. 28(2) sub-processor change notice via the existing email template (Nodemailer); start 30-day objection window.
2. **Backend:**
   - New env: `RECALL_AI_API_KEY`, `RECALL_AI_REGION` (`us-west-2` or `eu-central-1` for EU customers), `RECALL_AI_WEBHOOK_SECRET`.
   - `POST /api/sessions/:id/start-bot` (therapist-only, requires explicit per-call confirmation): body `{ meeting_url, bot_name }`; calls Recall.ai `POST /api/v1/bot`; persists `sessions.recall_bot_id`.
   - `POST /api/webhooks/recall` (HMAC-verified): on `bot.done`, fetch `audio_url` (HTTPS, expires in 12 h), download into a TempFileEncryptedStream, re-encrypt under PR-TOP AES key, INSERT into `sessions.audio_path`, mark `recording_mode='single_track'` (so T-19 diarisation runs and only the therapist's voice is kept unless the client consented), trigger existing transcription pipeline.
   - Audit: `action='session_recall_bot_started'` and `action='session_recall_bot_recording_imported'` on the existing audit_logs table.
3. **Frontend:**
   - On `ClientDetail` "Sessions" tab: button "Start auto-recording bot" (only enabled if therapist has connected an external meeting URL for this session).
   - Per-call confirmation modal recapping: "A bot named 'PR-TOP recorder' will join this meeting. Your client will see it. Have you informed them?" — checkbox + Cancel / Confirm.
   - Live status pill: `connecting` → `recording` → `processing` → `done` (polled or pushed via existing WebSocket layer).
4. **Failure handling:**
   - If bot fails to join (host lobby, password, etc.), surface error and fall back to manual upload UI (T-07).
   - If webhook does not fire within `bot.start_at + max_session_duration + 30 min`, automated retry of `GET /api/v1/bot/:id` to fetch artefact directly. After 24 h, mark session as "recording missing" and email therapist.
5. **Locale keys:** `session.recall.*` (en/ru/es/uk) — at least 25 keys (button labels, confirmation modal copy, status pill states, errors).
6. **i18n review of the consent disclaimer change** — add a sentence to the T-18 consent template explaining the bot. Re-prompt clients on next bot login (consent_version bump).
7. **Tier gate:** restrict `start-bot` endpoint to Premium tier only via the existing `requirePlan('premium')` middleware.
8. **Acceptance test:** end-to-end against Recall.ai's sandbox: schedule a Meet, fire `start-bot`, verify bot joins and webhook lands, verify audio file is present in session and transcribed.

### Out of scope for Phase-3 (firmly)

- Embedding any video UI inside PR-TOP (rejects (a), (b), (c.1), (c.3) above).
- Reselling Zoom / Meet / Workspace licenses to therapists.
- Building our own meeting-bot infrastructure (DIY headless Chrome — too much ops, no advantage over Recall.ai).
- Real-time transcription during the call (separate ticket if requested; not a between-sessions need).

---

## 7. Risks of doing nothing (status quo)

- **Risk:** A future paying therapist with no patience for tab-switching churns. **Mitigation:** the documentation nudge (one-paragraph "How to record in Zoom / Meet" link from the Bulk Upload page) directly addresses the largest sub-pain point. Track via support tickets / churn-reason annotations.
- **Risk:** A competitor ships a one-click Zoom integration. **Mitigation:** Phase-3 trigger #1 (demand) catches this; the implementation is a 3–5 day spike, recoverable inside one cycle.
- **Risk:** Алексей expects the integration based on his stated wish, doesn't see it land, perceives the product as ignoring feedback. **Mitigation:** include a brief reply in the next customer-development cycle pointing at the T-07/T-19/T-20 chain we shipped specifically in response to his interview, and explaining the privacy + cost reasoning behind deferring T-23.

---

## 8. Review trigger

Revisit this ADR if any of the following fire:

- Trigger 1 of section 6 fires (≥ 3 paying therapists request it).
- Recall.ai pricing drops below $0.30/hr (would put per-therapist cost under $4/month, viable on Pro tier).
- Zoom releases a self-hosted recording option (no Zoom Cloud egress) for the Meeting SDK — eliminates the sub-processor concern for option (a).
- We onboard an enterprise customer with a compliance-officer requirement for an integrated tool.
- Customer-development data shifts: in next cusdev round, > 50% of interviewees rank "in-window video" in their top three asks.

---

## 9. Changelog

- **2026-05-07** — initial draft, accepted no-go for current cycle.
