<!-- audience: user -->
# PR-TOP REST API — endpoint reference

_This page is regenerated on every release by_ `npm run docs:assistant`.
_Do not edit by hand — edits will be overwritten._

The PR-TOP backend exposes a small Express REST API behind the reverse
proxy at `/api/*`. Each router module below groups a related set of
endpoints. This list is a human-readable summary, not a full OpenAPI
spec — request bodies and response shapes are documented in `docs/PRD.md`.

## admin — Super-admin: manage therapists, promo codes, platform stats

Mount prefix: `/api/admin`

- `GET /api/admin/therapists` — GET /api/admin/therapists - List all therapists
- `PUT /api/admin/therapists/:id/plan` — PUT /api/admin/therapists/:id/plan - Manually assign a plan to a therapist
- `DELETE /api/admin/therapists/:id/plan-override` — DELETE /api/admin/therapists/:id/plan-override - Remove manual override, revert to trial
- `PUT /api/admin/therapists/:id/block` — PUT /api/admin/therapists/:id/block - Block a therapist
- `PUT /api/admin/therapists/:id/unblock` — PUT /api/admin/therapists/:id/unblock - Unblock a therapist
- `GET /api/admin/stats/users` — GET /api/admin/stats/users - Platform user statistics
- `GET /api/admin/logs/audit/actions` — GET /api/admin/logs/audit/actions - Get distinct audit log action types
- `GET /api/admin/logs/audit` — GET /api/admin/logs/audit - View audit logs
- `GET /api/admin/logs/system` — GET /api/admin/logs/system - View system logs (from in-memory ring buffer)
- `GET /api/admin/settings` — GET /api/admin/settings - Get all platform settings
- `PUT /api/admin/settings` — PUT /api/admin/settings - Update platform settings
- `GET /api/admin/stats/subscriptions` — GET /api/admin/stats/subscriptions - Subscription and payment analytics
- `GET /api/admin/stats/utm` — GET /api/admin/stats/utm - UTM attribution analytics
- `POST /api/admin/backup` — POST /api/admin/backup - Trigger manual database backup
- `GET /api/admin/backups` — GET /api/admin/backups - List available backups
- `GET /api/admin/backup/status` — GET /api/admin/backup/status - Get backup status summary
- `POST /api/admin/restore` — POST /api/admin/restore - Restore from a specific backup
- `GET /api/admin/ai/usage` — GET /api/admin/ai/usage - Aggregated usage with optional grouping/filtering
- `GET /api/admin/ai/usage/summary` — GET /api/admin/ai/usage/summary - Summary for current month
- `GET /api/admin/ai/usage/daily` — GET /api/admin/ai/usage/daily - Daily cost/tokens for charts
- `GET /api/admin/ai/limits` — GET /api/admin/ai/limits - Get current spending limit settings and status
- `PUT /api/admin/ai/limits` — PUT /api/admin/ai/limits - Update spending limit settings
- `GET /api/admin/ai/models` — GET /api/admin/ai/models - Get available models grouped by provider
- `PUT /api/admin/ai/models` — PUT /api/admin/ai/models - Save selected AI models
- `GET /api/admin/ai/test` — GET /api/admin/ai/test - Test connection to a provider
- `GET /api/admin/settings/assistant-ai` — GET /api/admin/settings/assistant-ai - Get assistant AI provider/model config
- `PUT /api/admin/settings/assistant-ai` — PUT /api/admin/settings/assistant-ai - Update assistant AI provider/model config
- `POST /api/admin/assistant/reindex` — POST /api/admin/assistant/reindex - Trigger knowledge base re-indexing
- `GET /api/admin/assistant/knowledge-stats` — GET /api/admin/assistant/knowledge-stats - Get knowledge base statistics
- `GET /api/admin/assistant/cached-answers` — GET /api/admin/assistant/cached-answers - List cached answers (paginated)
- `PUT /api/admin/assistant/cached-answers/:id` — PUT /api/admin/assistant/cached-answers/:id - Edit a cached answer
- `DELETE /api/admin/assistant/cached-answers/:id` — DELETE /api/admin/assistant/cached-answers/:id - Delete a cached answer
- `POST /api/admin/assistant/seed-faq` — redeploy after editing the seed file. Startup runs the same seeder too.
- `GET /api/admin/assistant/analytics` — GET /api/admin/assistant/analytics - Aggregated assistant chat statistics
- `GET /api/admin/assistant/conversations` — GET /api/admin/assistant/conversations - Paginated conversation list
- `GET /api/admin/assistant/conversations/:id/messages` — GET /api/admin/assistant/conversations/:id/messages - Messages for a conversation
- `GET /api/admin/assistant/export` — GET /api/admin/assistant/export - Export conversation data as CSV or JSON
- `POST /api/admin/assistant/messages/:messageId/comments` — POST /api/admin/assistant/messages/:messageId/comments - Create a comment on an assistant message
- `GET /api/admin/assistant/messages/:messageId/comments` — GET /api/admin/assistant/messages/:messageId/comments - Get all comments for a message
- `PUT /api/admin/assistant/comments/:commentId` — PUT /api/admin/assistant/comments/:commentId - Update a comment
- `DELETE /api/admin/assistant/comments/:commentId` — DELETE /api/admin/assistant/comments/:commentId - Delete a comment
- `GET /api/admin/assistant/comments/export` — GET /api/admin/assistant/comments/export - Export all comments for training data
- `POST /api/admin/assistant/summary` — POST /api/admin/assistant/summary - Generate AI summary of assistant conversations
- `POST /api/admin/assistant/summary/export` — POST /api/admin/assistant/summary/export - Export summary as JSON
- `GET /api/admin/newsletter` — GET /api/admin/newsletter - List all newsletter subscribers
- `GET /api/admin/newsletter/stats` — GET /api/admin/newsletter/stats - Newsletter statistics
- `GET /api/admin/newsletter/export` — GET /api/admin/newsletter/export - Export subscribers as CSV
- `DELETE /api/admin/newsletter/:id` — DELETE /api/admin/newsletter/:id - Delete a subscriber
- `GET /api/admin/stats/viewers` — ══════════════════════════════════════════════════════════════════════════
- `POST /api/admin/promos` — POST /api/admin/promos - Create a new promo code
- `GET /api/admin/promos` — GET /api/admin/promos - List all promo codes with usage stats
- `GET /api/admin/promos/redemptions` — GET /api/admin/promos/redemptions - List all redemptions with therapist info
- `PUT /api/admin/promos/redemptions/:id/apply` — PUT /api/admin/promos/redemptions/:id/apply - Mark redemption as applied
- `GET /api/admin/promos/:id` — GET /api/admin/promos/:id - View single promo code with redemptions
- `PUT /api/admin/promos/:id/deactivate` — PUT /api/admin/promos/:id/deactivate - Deactivate a promo code
- `GET /api/admin/referrals` — GET /api/admin/referrals - Referral analytics: list referrals, summary stats, top referrers

## assignments — Assign exercises to clients between sessions

Mount prefix: `/api/assignments`

- `POST /api/assignments/:id/reports/:reportId/accept` — POST /api/assignments/:id/reports/:reportId/accept
- `POST /api/assignments/:id/reports/:reportId/return` — POST /api/assignments/:id/reports/:reportId/return

## assistant — Signed-in therapist assistant chatbot

Mount prefix: `/api/assistant`

- `POST /api/assistant/chat` — Supports SSE streaming when stream=true in body or Accept: text/event-stream header
- `POST /api/assistant/new` — POST /api/assistant/new - Start a new chat
- `GET /api/assistant/history` — GET /api/assistant/history - Get recent chat history list
- `GET /api/assistant/history/:id` — GET /api/assistant/history/:id - Get a specific conversation
- `DELETE /api/assistant/history/:id` — DELETE /api/assistant/history/:id - Soft-delete a conversation (verify ownership)
- `GET /api/assistant/conversations` — GET /api/assistant/conversations - List conversations (alias matching feature spec)
- `GET /api/assistant/conversations/:id/messages` — GET /api/assistant/conversations/:id/messages - Get messages for a specific conversation

## auth — Login, registration, password reset, session cookies

Mount prefix: `/api/auth`

- `POST /api/auth/register` — POST /api/auth/register
- `POST /api/auth/login` — POST /api/auth/login
- `POST /api/auth/register-viewer` — Creates a user with role='viewer', links anonymous session, migrates messages, issues JWT.
- `POST /api/auth/register-lead` — After registration, lead gets +10 messages in the chat. After email verification, +10 more.
- `GET /api/auth/verify-lead` — Verifies a lead's email, sets verified=true, adds extra messages
- `POST /api/auth/logout` — POST /api/auth/logout - Clear session cookie and invalidate token
- `GET /api/auth/me` — GET /api/auth/me
- `POST /api/auth/forgot-password` — POST /api/auth/forgot-password
- `POST /api/auth/reset-password` — POST /api/auth/reset-password

## bot — Telegram bot control surface (start/stop, health)

Mount prefix: `/api/bot`

- `POST /api/bot/register` — POST /api/bot/register - Register or update a Telegram user with role
- `GET /api/bot/user/:telegram_id` — GET /api/bot/user/:telegram_id - Get user by telegram_id
- `PUT /api/bot/profile/:telegram_id` — PUT /api/bot/profile/:telegram_id - Update user profile fields from bot
- `POST /api/bot/connect` — POST /api/bot/connect - Client enters invite code to connect with therapist
- `POST /api/bot/consent` — compatibility — defaults to version=0 / hash=null.
- `GET /api/bot/therapist-display/:id` — without exposing other PII. Restricted to bot via botAuth.
- `GET /api/bot/consent-status/:telegram_id` — the bot prompts the user to re-consent before accepting any other input.
- `POST /api/bot/revoke-consent` — POST /api/bot/revoke-consent - Client revokes consent and disconnects from therapist
- `POST /api/bot/diary` — POST /api/bot/diary - Client submits a diary entry
- `POST /api/bot/transcribe-diary/:entry_id` — POST /api/bot/transcribe-diary/:entry_id - Manually trigger transcription for a diary entry
- `POST /api/bot/diary/:entry_id/make-private` — Idempotent: re-calling on an already-private entry returns success.
- `GET /api/bot/diary/:telegram_id` — GET /api/bot/diary/:telegram_id - Get diary entries for a client
- `GET /api/bot/sessions/:telegram_id` — Defaults: limit = 5, max = 25.
- `POST /api/bot/sos` — POST /api/bot/sos - Client triggers SOS alert
- `GET /api/bot/exercises/:telegram_id` — GET /api/bot/exercises/:telegram_id - Get exercises sent to a client
- `POST /api/bot/exercises/:delivery_id/acknowledge` — POST /api/bot/exercises/:delivery_id/acknowledge - Client acknowledges exercise
- `POST /api/bot/exercises/:delivery_id/respond` — POST /api/bot/exercises/:delivery_id/respond - Client responds/completes exercise
- `GET /api/bot/assignments/:telegram_id` — GET /api/bot/assignments/:telegram_id — list active assignments for client
- `POST /api/bot/assignments/:assignment_id/complete` — client submits report -> therapist accepts -> assignment becomes completed.)
- `POST /api/bot/assignments/:assignment_id/reports` — reports, transcription kicks off asynchronously.
- `GET /api/bot/assignments/:assignment_id/reports` — fetches their own reports for an assignment (for the bot to render).
- `POST /api/bot/assignments/:assignment_id/reports/:report_id/attachments` — max 10MB per file, mime type must be a supported image type.
- `POST /api/bot/voice-query` — Gated to Pro/Premium subscription tiers
- `PUT /api/bot/settings/:telegram_id` — PUT /api/bot/settings/:telegram_id - Update therapist escalation settings from bot
- `POST /api/bot/session-attendance` — Returns: { ok: true, new_status: '...' }
- `POST /api/bot/session-reminders-optin` — Returns: { ok: true, new_status: 'opted_in'|'opted_out' }

## clients — Therapist client roster, detail, timeline, consent

Mount prefix: `/api/clients`

- `POST /api/clients/solo` — note (optional ≤2000 chars) is encrypted into therapist_notes for context.
- `GET /api/clients` — (session_reminders_enabled IS NULL).
- `GET /api/clients/:id` — GET /api/clients/:id - Get client detail
- `PUT /api/clients/:id` — null -> clear override, fall back to therapist's reminders_enabled_default
- `GET /api/clients/:id/diary` — GET /api/clients/:id/diary - Get diary entries for a client (decrypted)
- `DELETE /api/clients/:id/diary/:entryId` — DELETE /api/clients/:id/diary/:entryId - Delete a diary entry
- `POST /api/clients/:id/notes` — POST /api/clients/:id/notes - Create encrypted therapist note for a client
- `PUT /api/clients/:id/notes/:noteId` — PUT /api/clients/:id/notes/:noteId - Update an existing therapist note
- `GET /api/clients/:id/notes` — Supports ?search=keyword to filter notes by decrypted content
- `GET /api/clients/:id/context` — GET /api/clients/:id/context - Get client context (anamnesis, goals, AI instructions)
- `PUT /api/clients/:id/context` — PUT /api/clients/:id/context - Create or update client context (anamnesis, goals, etc.)
- `GET /api/clients/:id/timeline` — Supports pagination via page & per_page query params (default: page=1, per_page=50)
- `GET /api/clients/:id/sessions` — `inquiry_id=none` to fetch only sessions with no inquiry attached.
- `GET /api/clients/:id/exercises` — GET /api/clients/:id/exercises - Get exercise deliveries for a client
- `POST /api/clients/:id/exercises` — POST /api/clients/:id/exercises - Send an exercise to a client
- `POST /api/clients/link` — Normal therapists must use the proper flow: therapist shares invite code → client enters code → client consents → link created
- `GET /api/clients/:id/sos` — (client explicitly triggered the SOS, implying they want therapist attention)
- `PUT /api/clients/:id/sos/:sosId/acknowledge` — PUT /api/clients/:id/sos/:sosId/acknowledge - Therapist acknowledges SOS event
- `PUT /api/clients/:id/sos/:sosId/resolve` — PUT /api/clients/:id/sos/:sosId/resolve - Therapist resolves SOS event
- `POST /api/clients/:id/import`
- `GET /api/clients/:id/diary/export` — GET /clients/:id/diary/export - Export diary entries as JSON file
- `POST /api/clients/import-bulk`
- `GET /api/clients/:id/inquiries` — Optional filter: ?status=active|paused|closed
- `GET /api/clients/:id/inquiries/:inquiryId` — GET /api/clients/:id/inquiries/:inquiryId - get a single inquiry
- `POST /api/clients/:id/inquiries` — POST /api/clients/:id/inquiries - create a new inquiry
- `PUT /api/clients/:id/inquiries/:inquiryId` — PUT /api/clients/:id/inquiries/:inquiryId - update an inquiry
- `POST /api/clients/:id/inquiries/:inquiryId/close` — POST /api/clients/:id/inquiries/:inquiryId/close - close an inquiry
- `DELETE /api/clients/:id/inquiries/:inquiryId` — DELETE /api/clients/:id/inquiries/:inquiryId - permanently delete an inquiry
- `GET /api/clients/:id/assignments` — Optional filters: ?status=active|completed|abandoned, ?session_id=N|none
- `GET /api/clients/:id/assignments/:assignmentId` — GET /api/clients/:id/assignments/:assignmentId — single assignment
- `POST /api/clients/:id/assignments` — POST /api/clients/:id/assignments — create a new assignment for this client
- `PUT /api/clients/:id/assignments/:assignmentId` — PUT /api/clients/:id/assignments/:assignmentId — update assignment
- `POST /api/clients/:id/assignments/:assignmentId/abandon` — POST /api/clients/:id/assignments/:assignmentId/abandon — therapist abandons
- `DELETE /api/clients/:id/assignments/:assignmentId` — DELETE /api/clients/:id/assignments/:assignmentId
- `GET /api/clients/:id/assignments/:aid/reports` — GET /api/clients/:id/assignments/:aid/reports — chronological feed
- `POST /api/clients/:id/assignments/:aid/reports` — (catch-up notes / testing). Body: { content, is_final? }
- `GET /api/clients/:id/assignments/:aid/reports/:rid` — GET /api/clients/:id/assignments/:aid/reports/:rid — single report
- `PATCH /api/clients/:id/assignments/:aid/reports/:rid/acceptance` — it also flips the assignment state and emits the client-side push.
- `POST /api/clients/:id/assignments/:aid/reports/:rid/accept` — index.js mount point '/api/assignments').
- `POST /api/clients/:id/assignments/:aid/reports/:rid/return` — Body: { comment: string }.
- `DELETE /api/clients/:id/assignments/:aid/reports/:rid` — DELETE /api/clients/:id/assignments/:aid/reports/:rid — therapist removes
- `GET /api/clients/:id/assignments/:aid/reports/:rid/attachments` — → list attachment metadata (id, mime_type, size_bytes, created_at)
- `GET /api/clients/:id/assignments/:aid/reports/:rid/attachments/:attId/stream` — this verified route.
- `DELETE /api/clients/:id/assignments/:aid/reports/:rid/attachments/:attId` — → therapist removes an attachment (also unlinks the .enc file).
- `GET /api/clients/:id/engagement` — window: optional look-back in days (default 90). Pass 0 or 'all' for all-time.
- `GET /api/clients/:id/supervision-share` — GET /api/clients/:id/supervision-share - list all share links for this client
- `POST /api/clients/:id/supervision-share` — Body: { ttl: '1d'|'7d'|'30d', anonymize: boolean, note?: string }
- `DELETE /api/clients/:id/supervision-share/:linkId` — DELETE /api/clients/:id/supervision-share/:linkId - revoke (soft delete)
- `POST /api/clients/:id/resend-opt-in` — cron picks the client up again on its next run (same as a fresh opt-in).

## comments — Comments on session and diary items

Mount prefix: `/api/comments`

- `GET /api/comments` — entity, ordered by created_at ASC.
- `POST /api/comments` — Default visibility: therapist -> private, client -> shared.
- `PATCH /api/comments/:id` — may modify a comment.
- `DELETE /api/comments/:id` — Only the author (or a superadmin) may delete.

## dashboard — Dashboard stats and activity feed

Mount prefix: `/api/dashboard`

- `GET /api/dashboard/stats` — GET /api/dashboard/stats - Get dashboard quick stats
- `GET /api/dashboard/activity` — GET /api/dashboard/activity - Get recent activity feed
- `GET /api/dashboard/notifications` — GET /api/dashboard/notifications - Get unacknowledged SOS alerts and other notifications
- `GET /api/dashboard/analytics` — GET /api/dashboard/analytics - Get client activity analytics data for charts
- `GET /api/dashboard/upcoming-confirmations` — attendance_status, last reminder dispatch status, and client display info.

## diary — Client diary entries (text, voice, video)

Mount prefix: `/api/diary`

- `GET /api/diary/:id/stream` — GET /api/diary/:id/stream - Stream decrypted audio/video file for a diary entry
- `POST /api/diary/:id/retranscribe` — POST /api/diary/:id/retranscribe - Retry transcription for a diary entry (therapist/superadmin)

## encryption — Encryption key rotation and self-diagnostics

Mount prefix: `/api/encryption`

- `GET /api/encryption/keys` — List all encryption key versions
- `POST /api/encryption/rotate` — Rotate encryption key (create new version)
- `POST /api/encryption/encrypt` — Encrypt data (for testing/verification) - debug endpoint, dev-only or superadmin
- `POST /api/encryption/decrypt` — Decrypt data (for testing/verification) - debug endpoint, dev-only or superadmin
- `GET /api/encryption/active-version` — Get the current active encryption key version - debug endpoint, dev-only or superadmin

## exercises — Exercise library (built-in + custom)

Mount prefix: `/api/exercises`

- `GET /api/exercises` — GET /api/exercises - List all exercises, optionally filtered by category or filter=my
- `GET /api/exercises/categories` — GET /api/exercises/categories - List available categories
- `GET /api/exercises/:id` — GET /api/exercises/:id - Get single exercise by ID
- `POST /api/exercises` — POST /api/exercises - Create a custom exercise
- `PUT /api/exercises/:id` — PUT /api/exercises/:id - Update a custom exercise (own only)
- `DELETE /api/exercises/:id` — DELETE /api/exercises/:id - Delete a custom exercise (own only, no active deliveries)

## export — Export client history to PDF, JSON, CSV

Mount prefix: `/api/export`

- `GET /api/export/client/:id` — Full client data export with consent check and tier gating
- `GET /api/export/client/:id/notes` — Export therapist notes for a client
- `GET /api/export/analytics` — Export analytics data as CSV ZIP or PDF report

## inviteCode — Invite codes and Telegram deep-link binding

Mount prefix: `/api/invite-code`

- `GET /api/invite-code` — GET /api/invite-code - Get current invite code for the therapist
- `GET /api/invite-code/link` — GET /api/invite-code/link - Get invite deep link for Telegram bot
- `POST /api/invite-code/regenerate` — POST /api/invite-code/regenerate - Generate a new invite code

## kb — Knowledge-base admin: re-index, stats, diagnostics

Mount prefix: `/api/kb`

- `GET /api/kb` — Returns the therapist's KB document list, newest first.
- `POST /api/kb/upload` — field overrides the original filename (default).
- `DELETE /api/kb/:id` — Removes the document, its chunks, and its embeddings. Therapist-scoped.

## publicAssistant — Anonymous landing-page assistant chatbot

Mount prefix: `/api/public/assistant`

- `POST /api/public/assistant/public-chat` — POST /api/assistant/public-chat

## publicAttendance — Public event attendance (no auth)

Mount prefix: `/api/public/attendance`

- `GET /api/public/attendance/attendance-link`

## query — Natural-language search over client history

Mount prefix: `/api/query`

- `POST /api/query` — Body: { client_id: number, query: string, limit?: number }

## search — Vector semantic search (Pro/Premium tier)

Mount prefix: `/api/search`

- `POST /api/search` — POST /api/search - Semantic search across embedded client data
- `GET /api/search/embedding/:sourceType/:sourceId` — GET /api/search/embedding/:sourceType/:sourceId - Check if a specific source has an embedding
- `GET /api/search/stats` — GET /api/search/stats - Get vector store statistics

## sessions — Session upload, transcription, AI summarization

Mount prefix: `/api/sessions`

- `POST /api/sessions` — POST /api/sessions - Upload session audio
- `GET /api/sessions/:id` — GET /api/sessions/:id - Get session details
- `POST /api/sessions/:id/transcribe` — POST /api/sessions/:id/transcribe - Manually trigger transcription
- `POST /api/sessions/:id/summarize` — POST /api/sessions/:id/summarize - Manually trigger summary generation
- `GET /api/sessions/:id/summary` — GET /api/sessions/:id/summary - Get just the summary
- `GET /api/sessions/:id/transcript` — GET /api/sessions/:id/transcript - Get just the transcript
- `PATCH /api/sessions/:id` — here in the future without changing the API surface.
- `POST /api/sessions/:id/transcribe-voice-note` — the text to post_session_notes via PATCH.
- `POST /api/sessions/:id/select-speaker` — the unselected tracks are NOT retained.
- `DELETE /api/sessions/:id` — DELETE /api/sessions/:id - Delete a session and its associated files
- `GET /api/sessions/:id/stream` — GET /api/sessions/:id/stream - Stream decrypted audio/video file
- `POST /api/sessions/auto-match`
- `GET /api/sessions/:id/assignments` — GET /api/sessions/:id/assignments — list all assignments attached to a session
- `POST /api/sessions/:id/assignments` — POST /api/sessions/:id/assignments — create assignment attached to a session
- `POST /api/sessions/:id/attendance` — Viewer-role users are blocked by requireRole (not in allowed list → 403).
- `POST /api/sessions/:id/reschedule` — Viewer-role users are blocked by requireRole (not in allowed list → 403).
- `GET /api/sessions/:id/attendance-history` — Returns merged timeline of audit_log entries and session_reminder_dispatches for a session.

## settings — Therapist and platform settings

Mount prefix: `/api/settings`

- `GET /api/settings/profile` — GET /api/settings/profile - Get current user profile settings
- `PUT /api/settings/profile` — PUT /api/settings/profile - Update user profile settings
- `GET /api/settings/escalation` — GET /api/settings/escalation - Get escalation preferences
- `PUT /api/settings/escalation` — PUT /api/settings/escalation - Update escalation preferences
- `GET /api/settings/summary` — presets: [{id, description}] }
- `PATCH /api/settings/summary` — - custom_prompt_mode: 'append' | 'replace'
- `GET /api/settings/reminder-policy` — GET /api/settings/reminder-policy Returns the therapist's session reminder policy merged with system defaults. Requires Confirm, Basic, Pro,
- `PUT /api/settings/reminder-policy` — PUT /api/settings/reminder-policy Updates the therapist's session reminder policy. Accepts: { enabled, tone, allow_client_reschedule, allow_

## subscription — Stripe subscription tiers, plan changes, promo codes

Mount prefix: `/api/subscription`

- `GET /api/subscription/stripe-status` — Check if Stripe is configured (public endpoint for health checks)
- `POST /api/subscription/create-customer` — Create a Stripe customer for the authenticated user
- `GET /api/subscription/current` — Get current subscription for authenticated user
- `GET /api/subscription/payments` — Get payment history for authenticated user
- `POST /api/subscription/change-plan` — Upgrades take effect immediately. Downgrades are scheduled for end of current period.
- `GET /api/subscription/limits` — Get current plan limits and usage for the authenticated therapist
- `GET /api/subscription/plans` — Get available plans and pricing
- `POST /api/subscription/checkout` — Create a Stripe checkout session for plan upgrade
- `POST /api/subscription/cancel` — Cancel subscription - access continues until end of current billing period
- `POST /api/subscription/apply-promo` — POST /api/subscription/apply-promo - Validate and redeem a promo code
- `GET /api/subscription/my-promos` — GET /api/subscription/my-promos - List therapist's own promo redemptions

## supervisionShare — Share a client read-only with a supervising colleague

Mount prefix: `/api/supervision-share`

- `GET /api/supervision-share/supervision/:token` — GET /share/supervision/:token Returns the read-only supervisor view payload, or 404 when the link is unknown / revoked / expired.

## webhooks — Inbound Stripe / third-party webhooks

Mount prefix: `/api/webhooks`

- `POST /api/webhooks/stripe` — POST /api/webhooks/stripe Handle Stripe webhook events Note: This route needs raw body for signature verification

