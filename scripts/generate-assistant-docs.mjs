#!/usr/bin/env node
/**
 * Feature #437 — S4 Auto-generated assistant docs pipeline
 *
 * Regenerates the DETERMINISTIC layer of docs/assistant-kb/reference/*.md
 * on each release. Two layers of content live under docs/assistant-kb/:
 *
 *   (a) DETERMINISTIC  — this script writes docs/assistant-kb/reference/*.md
 *       derived from source-of-truth artefacts inside the repo:
 *
 *         * src/backend/src/routes/*.js  -> endpoints.md   (public)
 *         * src/frontend/src/i18n/en.json -> ui-labels.md  (user)
 *         * pricing/plan tiers (below)   -> pricing.md     (public)
 *
 *       These files are always in sync with code because they are rebuilt
 *       before every release ("npm run docs:assistant").
 *
 *   (b) PROSE how-tos   — task-oriented "how to X" pages authored / reviewed
 *       and committed to the repo under docs/assistant-kb/*.md. An LLM/agent
 *       may draft them, but they are NOT generated at index time. This
 *       script SEEDS the initial how-to files ONLY IF they do not yet
 *       exist — never overwriting human edits.
 *
 * Audience markers (consumed by S2 audience-scoped RAG):
 *   <!-- audience: public -->  marketing / feature / security overview
 *   <!-- audience: user   -->  how-to material for signed-in therapists
 *
 * Prose guardrail:
 *   Generated Markdown must have LOW code-token density so the assistant
 *   never regurgitates raw code back at users. Any file that hits >=1
 *   occurrence of `require(` or `function ` per 200 words is rejected by
 *   the audit script (_t_assistant_kb_audit.js).
 *
 * Usage:
 *   npm run docs:assistant      # regenerate deterministic + seed prose
 *   node scripts/generate-assistant-docs.mjs --check   # dry run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const KB_ROOT = join(PROJECT_ROOT, 'docs', 'assistant-kb');
const REF_ROOT = join(KB_ROOT, 'reference');

const AUDIENCE_PUBLIC = '<!-- audience: public -->';
const AUDIENCE_USER = '<!-- audience: user -->';

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');

function log(msg) { console.log('[assistant-docs] ' + msg); }

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Produce a minimal "unified-style" diff between two strings (line-level).
 * Capped at 50 changed lines to keep terminal output readable.
 */
function simpleDiff(oldText, newText, label) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const out = ['--- ' + label + '  (on disk)', '+++ ' + label + '  (generated)'];
  let diffCount = 0;
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const o = i < oldLines.length ? oldLines[i] : undefined;
    const n = i < newLines.length ? newLines[i] : undefined;
    if (o !== n) {
      if (o !== undefined) out.push('-' + o);
      if (n !== undefined) out.push('+' + n);
      diffCount++;
      if (diffCount >= 50) {
        out.push('... diff truncated after 50 changed lines — run: npm run docs:assistant');
        break;
      }
    }
  }
  return out.join('\n');
}

function writeIfChanged(absPath, contents) {
  ensureDir(dirname(absPath));
  const rel = relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
  if (existsSync(absPath)) {
    const cur = readFileSync(absPath, 'utf8');
    if (cur === contents) {
      log('unchanged  ' + rel);
      return false;
    }
    if (CHECK_ONLY) {
      log('DRIFT      ' + rel);
      console.log(simpleDiff(cur, contents, rel));
      return true;
    }
  } else if (CHECK_ONLY) {
    log('WOULD write ' + rel + '  (new file — run: npm run docs:assistant)');
    return true;
  }
  if (CHECK_ONLY) {
    // Should not reach here, but guard anyway.
    log('WOULD write ' + rel);
    return true;
  }
  writeFileSync(absPath, contents, 'utf8');
  log('wrote      ' + rel);
  return true;
}

function writeIfMissing(absPath, contents) {
  const rel = relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
  if (existsSync(absPath)) {
    log('kept       ' + rel + ' (already authored)');
    return false;
  }
  if (CHECK_ONLY) {
    log('WOULD seed ' + rel);
    return true;
  }
  ensureDir(dirname(absPath));
  writeFileSync(absPath, contents, 'utf8');
  log('seeded     ' + rel);
  return true;
}

// ---------------------------------------------------------------------------
// DETERMINISTIC generator (a): endpoint / feature reference
// ---------------------------------------------------------------------------
//
// Walks src/backend/src/routes/*.js and pulls (method, path, description)
// tuples from each Express router file. The description is the trailing
// // or /* comment that precedes the router.<verb>(...) call. Kept as a
// short human-readable list — NOT raw code.

const ROUTES_DIR = join(PROJECT_ROOT, 'src', 'backend', 'src', 'routes');

// Mount prefix per router file. Keep this table in sync with src/backend/src/index.js
// (documented mount points, not derived to avoid parsing the app entry).
const ROUTE_MOUNT_PREFIX = {
  'admin.js': '/api/admin',
  'assignments.js': '/api/assignments',
  'assistant.js': '/api/assistant',
  'auth.js': '/api/auth',
  'bot.js': '/api/bot',
  'clients.js': '/api/clients',
  'comments.js': '/api/comments',
  'dashboard.js': '/api/dashboard',
  'diary.js': '/api/diary',
  'encryption.js': '/api/encryption',
  'exercises.js': '/api/exercises',
  'export.js': '/api/export',
  'inviteCode.js': '/api/invite-code',
  'kb.js': '/api/kb',
  'publicAssistant.js': '/api/public/assistant',
  'publicAttendance.js': '/api/public/attendance',
  'query.js': '/api/query',
  'search.js': '/api/search',
  'sessions.js': '/api/sessions',
  'settings.js': '/api/settings',
  'subscription.js': '/api/subscription',
  'supervisionShare.js': '/api/supervision-share',
  'webhooks.js': '/api/webhooks',
};

// Human-readable descriptions of each router module.
const ROUTE_FILE_DESC = {
  'admin.js': 'Super-admin: manage therapists, promo codes, platform stats',
  'assignments.js': 'Assign exercises to clients between sessions',
  'assistant.js': 'Signed-in therapist assistant chatbot',
  'auth.js': 'Login, registration, password reset, session cookies',
  'bot.js': 'Telegram bot control surface (start/stop, health)',
  'clients.js': 'Therapist client roster, detail, timeline, consent',
  'comments.js': 'Comments on session and diary items',
  'dashboard.js': 'Dashboard stats and activity feed',
  'diary.js': 'Client diary entries (text, voice, video)',
  'encryption.js': 'Encryption key rotation and self-diagnostics',
  'exercises.js': 'Exercise library (built-in + custom)',
  'export.js': 'Export client history to PDF, JSON, CSV',
  'inviteCode.js': 'Invite codes and Telegram deep-link binding',
  'kb.js': 'Knowledge-base admin: re-index, stats, diagnostics',
  'publicAssistant.js': 'Anonymous landing-page assistant chatbot',
  'publicAttendance.js': 'Public event attendance (no auth)',
  'query.js': 'Natural-language search over client history',
  'search.js': 'Vector semantic search (Pro/Premium tier)',
  'sessions.js': 'Session upload, transcription, AI summarization',
  'settings.js': 'Therapist and platform settings',
  'subscription.js': 'Stripe subscription tiers, plan changes, promo codes',
  'supervisionShare.js': 'Share a client read-only with a supervising colleague',
  'webhooks.js': 'Inbound Stripe / third-party webhooks',
};

function extractCommentAbove(src, idx) {
  // Look at the 400 chars immediately before the route call and pick the
  // closest trailing // or /* ... */ comment. Same heuristic as the RAG
  // indexer so descriptions match what search will return.
  const start = Math.max(0, idx - 400);
  const pre = src.substring(start, idx);
  const m = pre.match(/(?:\/\/[^\n]+|\/\*[\s\S]*?\*\/)\s*$/);
  if (!m) return null;
  return m[0]
    .replace(/\/\*+|\*\/|\/\/|\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRoutesFromFile(fileName) {
  const abs = join(ROUTES_DIR, fileName);
  if (!existsSync(abs)) return [];
  const src = readFileSync(abs, 'utf8');
  const routes = [];
  const rx = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let m;
  const seen = new Set();
  while ((m = rx.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const routePath = m[2];
    const key = method + ' ' + routePath;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method, routePath, comment: extractCommentAbove(src, m.index) });
  }
  return routes;
}

function buildEndpointsMarkdown() {
  const files = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js')).sort();
  const lines = [];
  // Internal API surface (incl. admin route groups) — never expose it to the
  // anonymous public bot; signed-in therapists may still ask about it.
  lines.push(AUDIENCE_USER);
  lines.push('# PR-TOP REST API — endpoint reference');
  lines.push('');
  lines.push('_This page is regenerated on every release by_ `npm run docs:assistant`.');
  lines.push('_Do not edit by hand — edits will be overwritten._');
  lines.push('');
  lines.push('The PR-TOP backend exposes a small Express REST API behind the reverse');
  lines.push('proxy at `/api/*`. Each router module below groups a related set of');
  lines.push('endpoints. This list is a human-readable summary, not a full OpenAPI');
  lines.push('spec — request bodies and response shapes are documented in `docs/PRD.md`.');
  lines.push('');

  for (const file of files) {
    const prefix = ROUTE_MOUNT_PREFIX[file] || '/api';
    const desc = ROUTE_FILE_DESC[file] || 'Router module';
    const routes = parseRoutesFromFile(file);
    if (routes.length === 0) continue;
    lines.push('## ' + file.replace(/\.js$/, '') + ' — ' + desc);
    lines.push('');
    lines.push('Mount prefix: `' + prefix + '`');
    lines.push('');
    for (const r of routes) {
      const fullPath = (prefix + (r.routePath === '/' ? '' : r.routePath)).replace(/\/+$/, '') || '/';
      const summary = r.comment ? ' — ' + r.comment.substring(0, 140) : '';
      lines.push('- `' + r.method + ' ' + fullPath + '`' + summary);
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// DETERMINISTIC generator (a): UI labels from i18n/en.json
// ---------------------------------------------------------------------------

const I18N_EN = join(PROJECT_ROOT, 'src', 'frontend', 'src', 'i18n', 'en.json');

function collectLeafKeys(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const full = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectLeafKeys(v, full, out);
    } else if (typeof v === 'string') {
      out.push({ key: full, value: v });
    }
  }
}

function buildUiLabelsMarkdown() {
  const raw = readFileSync(I18N_EN, 'utf8');
  const en = JSON.parse(raw);
  const namespaces = Object.keys(en).sort();

  const lines = [];
  lines.push(AUDIENCE_USER);
  lines.push('# PR-TOP UI labels — English reference');
  lines.push('');
  lines.push('_This page is regenerated on every release by_ `npm run docs:assistant`.');
  lines.push('_Do not edit by hand — edits will be overwritten._');
  lines.push('');
  lines.push('The tables below list every top-level i18n namespace shipped in the');
  lines.push('React dashboard. Use them to look up the exact wording of a label,');
  lines.push('button, or hint that a therapist sees on-screen.');
  lines.push('');
  lines.push('_Sample keys are trimmed to a short summary per namespace to keep this');
  lines.push('page under the RAG chunk budget. The full i18n JSON is still the source');
  lines.push('of truth — see `src/frontend/src/i18n/en.json`._');
  lines.push('');

  for (const ns of namespaces) {
    const nsValue = en[ns];
    lines.push('## ' + ns);
    lines.push('');
    if (typeof nsValue !== 'object' || nsValue === null || Array.isArray(nsValue)) {
      lines.push('- `' + ns + '` = ' + JSON.stringify(nsValue));
      lines.push('');
      continue;
    }
    const leaves = [];
    collectLeafKeys(nsValue, ns, leaves);
    // cap at 20 sample keys per namespace to bound page size
    const sample = leaves.slice(0, 20);
    for (const { key, value } of sample) {
      const trimmed = value.length > 90 ? value.substring(0, 87) + '...' : value;
      lines.push('- `' + key + '` — ' + trimmed);
    }
    if (leaves.length > sample.length) {
      lines.push('- _+ ' + (leaves.length - sample.length) + ' more keys_');
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// DETERMINISTIC generator (a): pricing / plan tiers
// ---------------------------------------------------------------------------
//
// The plan matrix is documented in docs/PRD.md and reflected in the
// subscription route. Prices below are the USD monthly amounts sent to
// Stripe (basic=1900, pro=4900, premium=9900 cents) as of the current
// release. Update this table in one place when tiers change.

// Plan limits and prices are the SINGLE SOURCE OF TRUTH in the DB seed
// (src/backend/src/db/connection.js DEFAULT_SETTINGS). Read them from there so
// this doc never drifts from what the product actually enforces/charges.
// NOTE: an admin can override these at runtime in platform_settings; the doc
// reflects the shipped defaults. The FAQ seed additionally tells users to check
// Settings → Subscription for their live price.
function loadPlanDefaults() {
  const connPath = join(PROJECT_ROOT, 'src', 'backend', 'src', 'db', 'connection.js');
  const src = readFileSync(connPath, 'utf8');
  const num = (key, fallback) => {
    const m = src.match(new RegExp(`\\['${key}',\\s*'(\\d+)'\\]`));
    return m ? parseInt(m[1], 10) : fallback;
  };
  const price = (cents) => `$${Math.round(cents / 100)} / mo`;
  return {
    trial: { clients: num('trial_client_limit', 3), sessions: num('trial_session_limit', 5) },
    basic: { clients: num('basic_client_limit', 10), sessions: num('basic_session_limit', 20), price: price(num('basic_price_monthly', 1900)) },
    pro: { clients: num('pro_client_limit', 30), sessions: num('pro_session_limit', 60), price: price(num('pro_price_monthly', 4900)) },
    premium: { price: price(num('premium_price_monthly', 9900)) },
  };
}

const PD = loadPlanDefaults();

const PLAN_MATRIX = [
  {
    id: 'trial',
    label: 'Trial',
    priceMonthly: '$0 for 14 days',
    clients: PD.trial.clients,
    sessionsPerMonth: PD.trial.sessions,
    features: [
      'Client diary via Telegram bot',
      'Manual session notes',
      'Basic exercises library',
    ],
  },
  {
    id: 'basic',
    label: 'Basic',
    priceMonthly: PD.basic.price,
    clients: PD.basic.clients,
    sessionsPerMonth: PD.basic.sessions,
    features: [
      'Everything in Trial',
      'Audio session upload + AI transcription',
      'Automatic session summaries',
      'Email support',
    ],
  },
  {
    id: 'pro',
    label: 'Pro',
    priceMonthly: PD.pro.price,
    clients: PD.pro.clients,
    sessionsPerMonth: PD.pro.sessions,
    features: [
      'Everything in Basic',
      'Vector semantic search over client history',
      'Natural-language queries',
      'PDF / JSON / CSV export',
      'Assign custom exercises',
    ],
  },
  {
    id: 'premium',
    label: 'Premium',
    priceMonthly: PD.premium.price,
    clients: 'unlimited',
    sessionsPerMonth: 'unlimited',
    features: [
      'Everything in Pro',
      'Supervision share (read-only colleague access)',
      'SOS / crisis alert channels',
      'Priority support',
    ],
  },
];

function buildPricingMarkdown() {
  const lines = [];
  lines.push(AUDIENCE_PUBLIC);
  lines.push('# PR-TOP pricing and plan tiers');
  lines.push('');
  lines.push('_This page is regenerated on every release by_ `npm run docs:assistant`.');
  lines.push('_Do not edit by hand — edits will be overwritten._');
  lines.push('');
  lines.push('PR-TOP is offered as a monthly subscription with a free 14-day trial.');
  lines.push('There are four tiers. All plans include application-layer AES encryption');
  lines.push('of sensitive client data (diary entries, private notes, transcripts, and');
  lines.push('AI summaries) at rest; keys are held by the operator, not the therapist');
  lines.push('or client. PR-TOP is not end-to-end encrypted and is not zero-knowledge');
  lines.push('');
  lines.push('| Plan | Price | Clients | Sessions / mo |');
  lines.push('|------|-------|---------|---------------|');
  for (const p of PLAN_MATRIX) {
    lines.push('| ' + p.label + ' | ' + p.priceMonthly + ' | ' + p.clients + ' | ' + p.sessionsPerMonth + ' |');
  }
  lines.push('');
  for (const p of PLAN_MATRIX) {
    lines.push('## ' + p.label + ' — ' + p.priceMonthly);
    lines.push('');
    lines.push('- Client seats: **' + p.clients + '**');
    lines.push('- Sessions per month: **' + p.sessionsPerMonth + '**');
    lines.push('');
    lines.push('Included:');
    lines.push('');
    for (const f of p.features) lines.push('- ' + f);
    lines.push('');
  }
  lines.push('## Payment and cancellation');
  lines.push('');
  lines.push('Payments are processed by Stripe. Therapists can upgrade, downgrade,');
  lines.push('or cancel at any time from the dashboard under Settings → Subscription.');
  lines.push('Downgrades take effect at the end of the current billing period; the');
  lines.push('current tier remains active until then. Cancellation preserves data');
  lines.push('access until the paid period ends, after which the account reverts to');
  lines.push('read-only until a new plan is chosen.');
  lines.push('');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// PROSE how-to seeds (b): only written when the file does not exist.
// ---------------------------------------------------------------------------

const HOWTO_SEEDS = [
  {
    file: 'uploading-a-session.md',
    audience: 'user',
    body: [
      '# How to upload a session recording',
      '',
      'PR-TOP can transcribe and summarize an audio or video recording of a',
      'therapy session so that the notes you carry between sessions match what',
      'actually happened in the room. This how-to covers the upload flow on',
      'the Basic plan and above.',
      '',
      '## Prerequisites',
      '',
      '- Your client has consented in writing to session recording. PR-TOP',
      '  enforces the consent flag on their client record — without it, the',
      '  upload button is disabled.',
      '- You are on the Basic, Pro, or Premium plan. Trial accounts can',
      '  attach an audio file to a manual note, but transcription is gated to',
      '  paid tiers.',
      '- The file is under 100 MB and in a common audio or video container',
      '  (mp3, m4a, wav, mp4, webm).',
      '',
      '## Step-by-step',
      '',
      '1. Open the client page from Clients in the sidebar.',
      '2. Click **New session**. Enter the session date and (optionally) a short title.',
      '3. Choose **Attach recording** and pick your file.',
      '4. Confirm upload. The file is stored encrypted at rest with an opaque',
      '   identifier — even a server-side viewer cannot read it without the key.',
      '5. Wait for transcription to complete. Small files finish in under a',
      '   minute; a 60-minute session usually takes 3-6 minutes.',
      '6. Review the transcript. Redact anything you want removed by editing the',
      '   text — the encrypted version is rewritten on save.',
      '7. Trigger **Generate summary**. PR-TOP produces a short structured',
      '   summary (themes, homework, risk flags) that you can drop into your',
      '   own note.',
      '',
      '## Where the file lives',
      '',
      'Recordings are stored encrypted on the backend under a signed-access',
      'stream. They are never exposed at a guessable URL. If you delete the',
      'session, both the recording and its transcript are removed within the',
      'nightly cleanup window.',
      '',
      '## Troubleshooting',
      '',
      '- **Upload button greyed out** — check the client\'s consent switch is on.',
      '- **Transcription stuck at 0%** — the AI provider may be unreachable.',
      '  Check Settings → Assistant → Diagnostics to confirm the transcription',
      '  provider is healthy.',
      '- **Summary looks generic** — make sure the transcript is legible; the',
      '  quality of the summary depends on the transcript.',
    ],
  },
  {
    file: 'client-diary-telegram.md',
    audience: 'user',
    body: [
      '# How the client diary works over Telegram',
      '',
      'PR-TOP\'s between-session channel is a Telegram bot the client already',
      'has installed on their phone. This how-to explains what your client',
      'sees, what you see, and how privacy is enforced.',
      '',
      '## Connecting the client',
      '',
      '1. From the client page, tap **Invite via Telegram**. PR-TOP generates',
      '   a one-time invite code AND a deep link that opens the bot',
      '   pre-populated with that code.',
      '2. Share the deep link with the client through your usual channel',
      '   (email, WhatsApp). No client data is sent — only the link.',
      '3. The client opens the link, taps **Start** inside Telegram, and the',
      '   bot binds their Telegram user to your client record. Their status',
      '   flips from *Pending invite* to *Connected*.',
      '',
      '## What the client can send',
      '',
      '- Text diary entries.',
      '- Voice notes (transcribed automatically).',
      '- Short video notes.',
      '- Answers to exercises you have assigned.',
      '- **SOS** — a one-tap crisis button. See the crisis how-to for what',
      '  happens next.',
      '',
      'Every message is encrypted at rest before it lands in the database.',
      '',
      '## What you see on the dashboard',
      '',
      '- A running diary timeline on the client page.',
      '- Voice transcriptions inline with the audio.',
      '- Private therapist notes on the same page — visible only to you and,',
      '  if you enabled it, a supervising colleague on the Premium plan.',
      '',
      '## Privacy boundaries',
      '',
      '- The client cannot see your private notes.',
      '- The assistant chatbot cannot read the diary of any specific client;',
      '  it only knows about the platform.',
      '- A client can revoke consent at any time from inside the bot. When',
      '  they do, all future entries stop, and PR-TOP surfaces the revocation',
      '  on your client roster.',
    ],
  },
  {
    file: 'exercises.md',
    audience: 'user',
    body: [
      '# How to assign an exercise between sessions',
      '',
      'PR-TOP ships with a small library of pre-seeded, multilingual',
      'therapeutic exercises (EN, RU, ES, UK) that you can assign to a',
      'client through the Telegram bot. Pro and Premium accounts can also',
      'add custom exercises.',
      '',
      '## Pick from the library',
      '',
      '1. Open the client page and choose **Assign exercise**.',
      '2. Browse the library by category (grounding, cognitive',
      '   reframing, homework, journaling). Preview shows the client-side',
      '   wording in the client\'s selected language.',
      '3. Confirm. PR-TOP schedules a bot message that arrives on the',
      '   client\'s Telegram at the time you chose (immediately or on a',
      '   recurring cadence).',
      '',
      '## Author a custom exercise (Pro / Premium)',
      '',
      '1. Go to Exercises in the sidebar and choose **New exercise**.',
      '2. Fill in the title, category, and short description.',
      '3. Add at least one instructions field in the language(s) you offer',
      '   sessions in — PR-TOP validates that at least one is present.',
      '4. Save. The exercise now appears in the library, filterable by the',
      '   custom tag.',
      '',
      '## Follow up',
      '',
      'When the client responds — text, voice, or video — the response',
      'appears on the client\'s diary timeline under the exercise entry.',
      'You can pin high-signal responses so they show up in the next',
      'session\'s summary.',
    ],
  },
  {
    file: 'crisis-sos.md',
    audience: 'user',
    body: [
      '# How the crisis / SOS channel works',
      '',
      'PR-TOP includes a one-tap crisis trigger inside the Telegram bot so',
      'a client in acute distress can reach you between sessions. This',
      'how-to explains the flow from the client\'s tap to your response and',
      'the lifecycle tracking that keeps you accountable.',
      '',
      '## Client side',
      '',
      'The Telegram bot has a persistent **SOS** button. Tapping it:',
      '',
      '1. Asks the client to confirm (a mis-tap safety net).',
      '2. Sends an immediate acknowledgement message with your configured',
      '   crisis-line contact and, if enabled, national emergency numbers',
      '   in their locale.',
      '3. Opens a text field for optional context ("what is happening").',
      '',
      '## Therapist side',
      '',
      'PR-TOP notifies you across every channel you have configured:',
      '',
      '- Real-time dashboard alert (WebSocket, red banner).',
      '- Email to your account address.',
      '- Optional SMS or push notification, depending on your settings.',
      '',
      'The alert opens the client\'s SOS lifecycle timeline. From there you',
      'can mark states: *Acknowledged*, *Contacted*, *Resolved*, or',
      '*Escalated to emergency services*. Every state change is stored in',
      'the audit log with a timestamp.',
      '',
      '## Coverage and expectations',
      '',
      'PR-TOP is NOT a substitute for emergency services. The bot always',
      'reminds the client to call local emergency numbers if life is at',
      'risk. Set expectations up front with each client about your',
      'response window — PR-TOP surfaces your configured window inside the',
      'client\'s bot session.',
    ],
  },
  {
    file: 'billing.md',
    audience: 'user',
    body: [
      '# How billing works',
      '',
      'PR-TOP subscriptions are handled by Stripe. This how-to walks a',
      'therapist through the day-to-day of managing their plan.',
      '',
      '## Where to change plan',
      '',
      'Open **Settings → Subscription** on the dashboard. You will see:',
      '',
      '- Your current plan and its status (Trial, Active, Canceled, or',
      '  Expired).',
      '- The renewal date and the amount that will be charged.',
      '- The four available tiers (Trial, Basic, Pro, Premium) with the',
      '  plan limits documented on the pricing page.',
      '',
      'Click **Upgrade to Pro** (or any other tier) to be taken to Stripe',
      'Checkout. The upgrade is applied as soon as the payment succeeds.',
      'A downgrade is scheduled for the end of your current billing period,',
      'and you keep your existing tier until then.',
      '',
      '## Promo codes',
      '',
      'If you were issued a promo code by an event organizer or during a',
      'campaign, enter it in the **Have a promo code?** field. The code',
      'unlocks the associated plan for a fixed number of days once your',
      'redemption is approved.',
      '',
      '## Cancellation',
      '',
      'You can cancel from the same page. Cancellation keeps your access',
      'active until the end of the paid period and preserves your data.',
      'When the period ends, PR-TOP reverts your account to read-only —',
      'nothing is deleted. Resubscribing at any time restores full access.',
      '',
      '## Invoices and receipts',
      '',
      'Stripe emails a receipt for each successful payment to your account',
      'email address. You can also download PDF invoices from Stripe\'s',
      'customer portal, which is reachable from the same Subscription',
      'page.',
    ],
  },
];

const PUBLIC_SEEDS = [
  {
    file: 'feature-overview.md',
    audience: 'public',
    body: [
      '# PR-TOP feature overview',
      '',
      'PR-TOP is a therapist-controlled assistant that helps psychologists',
      'work deeper between sessions, preserve context across a long',
      'therapy arc, and reduce the double documentation burden of a busy',
      'private practice. The therapist runs the platform. Clients only',
      'interact with a Telegram bot on their phone.',
      '',
      '## Three surfaces',
      '',
      '- **Therapist dashboard** — a React web app for clients, sessions,',
      '  exercises, notes, and analytics. Localized in English, Russian,',
      '  Spanish, and Ukrainian.',
      '- **Backend API** — a Node.js REST service on an encrypted SQLite',
      '  database. Handles auth, uploads, transcription, AI summaries,',
      '  and Stripe billing.',
      '- **Telegram bot** — a long-polling bot the client uses for diary',
      '  entries (text, voice, video), assigned exercises, and the SOS',
      '  crisis trigger.',
      '',
      '## What PR-TOP does for you',
      '',
      '- Preserves the between-session context you would otherwise lose,',
      '  so the next session starts already caught up.',
      '- Transcribes and summarizes session recordings, cutting the time',
      '  you spend on notes.',
      '- Lets clients keep a diary in the messenger they already have,',
      '  rather than a new app they will forget to open.',
      '- Ships exercises directly to the client\'s phone with follow-up',
      '  responses coming back onto your dashboard timeline.',
      '- Surfaces a crisis alert path with a lifecycle you can audit.',
      '- Offers vector semantic search over a client\'s history on Pro',
      '  and Premium, so you can find that one story from six months ago',
      '  in seconds.',
      '',
      '## What PR-TOP is not',
      '',
      '- Not a replacement for emergency services in an acute crisis.',
      '- Not a shared social platform — clients never see one another.',
      '- Not an autonomous AI therapist — every AI output goes through',
      '  the therapist before it reaches the client.',
    ],
  },
  {
    file: 'security-overview.md',
    audience: 'public',
    body: [
      '# PR-TOP security overview',
      '',
      'PR-TOP is designed around therapist control of sensitive client',
      'data. This page summarizes the security model. For deeper detail',
      'see `docs/PRD.md` and the dedicated Security pages on the marketing',
      'site (`/security/encryption`, `/security/gdpr`, `/security/audit-log`,',
      '`/security/data-sovereignty`).',
      '',
      '## Data classes',
      '',
      '- **Class A** — the sensitive body of therapy work: diary entries,',
      '  private therapist notes, session transcripts, and AI summaries.',
      '  Class A is encrypted at the application layer with AES before it',
      '  is written to disk. Even a database dump is opaque without the key.',
      '- **Class B** — access-controlled plaintext: timestamps, identifiers,',
      '  role labels, and other metadata that must be indexable and',
      '  queryable for the product to function.',
      '',
      '## Transport and identity',
      '',
      '- All traffic is served over TLS via an nginx reverse proxy with',
      '  Let\'s Encrypt certificates.',
      '- Authentication uses short-lived JWTs delivered in an HttpOnly,',
      '  Secure cookie, plus a CSRF token bound to the session.',
      '- Passwords are stored as bcrypt hashes; login is rate-limited.',
      '- Every access to a client record is written to an append-only',
      '  audit log that the therapist can review from the dashboard.',
      '',
      '## The assistant chatbot',
      '',
      'The between-session assistant is answered from a hand-curated',
      'knowledge base (`docs/`, `docs/assistant-kb/`, and UI labels) — NOT',
      'from source code. Public queries and signed-in queries are scoped',
      'to different audiences. All assistant replies are passed through a',
      'redaction guardrail that strips secret-shaped strings before the',
      'reply is returned or cached.',
      '',
      '## Deployment',
      '',
      'PR-TOP runs as a Docker Compose stack (six services) behind an',
      'nginx reverse proxy, deployed via Dokploy on Hetzner. Encrypted',
      'daily backups run on a configurable retention schedule.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Prose guardrail (self-check)
// ---------------------------------------------------------------------------

function codeTokenDensity(text) {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const req = (text.match(/require\(/g) || []).length;
  const fn = (text.match(/function /g) || []).length;
  return { words, req, fn, per200: ((req + fn) * 200) / words };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  ensureDir(KB_ROOT);
  ensureDir(REF_ROOT);

  log(CHECK_ONLY ? 'DRY RUN — no files will be written' : 'writing docs to ' + relative(PROJECT_ROOT, KB_ROOT).replace(/\\/g, '/'));

  const referenceFiles = [
    { file: 'endpoints.md', build: buildEndpointsMarkdown },
    { file: 'ui-labels.md', build: buildUiLabelsMarkdown },
    { file: 'pricing.md', build: buildPricingMarkdown },
  ];

  let wroteAny = false;
  const allContents = [];

  for (const rf of referenceFiles) {
    const content = rf.build();
    allContents.push({ file: rf.file, content });
    wroteAny = writeIfChanged(join(REF_ROOT, rf.file), content) || wroteAny;
  }

  for (const seed of [...HOWTO_SEEDS, ...PUBLIC_SEEDS]) {
    const marker = seed.audience === 'public' ? AUDIENCE_PUBLIC : AUDIENCE_USER;
    const body = [marker, '', ...seed.body].join('\n') + '\n';
    allContents.push({ file: seed.file, content: body });
    wroteAny = writeIfMissing(join(KB_ROOT, seed.file), body) || wroteAny;
  }

  // Self-check: enforce prose guardrail on the content we just built so
  // we fail fast if a future edit accidentally slips raw code into a doc.
  let selfCheckFail = false;
  for (const { file, content } of allContents) {
    const d = codeTokenDensity(content);
    if (d.per200 >= 1) {
      selfCheckFail = true;
      log('GUARDRAIL FAIL ' + file + ' — ' + d.req + ' require(, ' +
        d.fn + ' function , ' + d.per200.toFixed(2) + ' per 200 words');
    }
  }
  if (selfCheckFail) {
    log('one or more generated files failed the prose guardrail');
    process.exit(1);
  }

  if (CHECK_ONLY && wroteAny) {
    log('DRIFT DETECTED — generated reference docs are out of date with source.');
    log('Fix: run  npm run docs:assistant  (in src/backend) then commit the updated files.');
    process.exit(1);
  }

  log('done. ' + (wroteAny ? 'files changed' : 'no changes'));
}

main();
