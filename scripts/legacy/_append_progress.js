const fs = require('fs');
const entry = `
================================================================
Session 222 (2026-07-14) - Feature #474 PASSING (R22b end-to-end + SOS framing)
================================================================

Assigned: #474 R22b -- Vychistitj hvosty end-to-end i SOS-freyming iz prose how-to

IMPLEMENTATION:

1. "end-to-end" idiom replacements in docs/assistant-kb/:
   - client-management.md:2  heading "Client management end-to-end"
     -> "Managing clients: full lifecycle"
   - bulk-session-upload.md:90  "six minutes end-to-end, plus queue"
     -> "six minutes in total, plus queue"
   - client-bot-experience.md:73  "confirms the binding works end-to-end"
     -> "confirms the binding is working correctly"
   - faq-seed.json:79  "deletion requests are honored end-to-end"
     -> "deletion requests are fully honored across the platform"

2. SOS protocol framing added (R4/R16 compliant):
   - crisis-sos-workflow.md: Added framing box in intro -- SOS is part of
     agreed between-session protocol, a direct notification to therapist,
     NOT a call to emergency services or a crisis hotline
   - crisis-sos-workflow.md prerequisites: Clarified client briefing must
     cover that SOS notifies therapist within agreed protocol, not 911
   - crisis-sos.md intro: Added pre-agreed protocol framing
   - client-bot-experience.md /sos entry: Added "(notifies the therapist;
     does not contact emergency services)"
   - client-bot-experience.md first-open section: Added protocol framing
   - client-diary-telegram.md: SOS bullet clarified with pre-agreed
     protocol note (not an emergency service call)

3. Bug fix: _t_assistant_kb_audit.js spawnSync EINVAL on Windows
   - Added shell: true for npm.cmd spawnSync calls
   - This fixed the previously-failing R22c drift check
   - Audit now: 80 passed, 0 failed (was 79+1 failed)

VERIFICATION:
- grep docs/assistant-kb/ for end-to-end: only 3 hits, all negation context
  (security-overview.md x2, pricing.md x1 -- all say "is NOT end-to-end encrypted")
- node _t_assistant_kb_audit.js: 80 passed, 0 failed
- npm run docs:assistant:check: exits 0, no drift
- git commit: 563c205

Stats after session 222: #474 status: passing (473/475, 99.6%).
`;
fs.appendFileSync('C:/Projects/dev-psy-bot/claude-progress.txt', entry);
console.log('Progress notes appended.');
