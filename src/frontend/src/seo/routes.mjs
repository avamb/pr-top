/**
 * Shared public-route manifest — single source of truth for:
 *   - build-time sitemap.xml generation (scripts/generate-sitemap.mjs)
 *   - static prerender step (scripts/prerender.mjs)
 *   - App.jsx public routing cross-reference
 *   - App.jsx locale-prefix routing (F11)
 *
 * Only PUBLIC MARKETING routes belong here.
 * Explicitly EXCLUDED from PUBLIC_ROUTES (per SEO Foundation spec F2):
 *   /login, /register, /confirm (and its locale variants /ru/confirm etc.),
 *   /dashboard/*, /clients/*, /sessions/*, /exercises, /analytics, /settings,
 *   /subscription/*, /admin/*, /verify-lead, /share/*, /forgot-password,
 *   /reset-password.
 *
 * Auth routes ARE prerendered (NOINDEX_PRERENDER_ROUTES below) for W2 SEO
 * correctness — each gets its own static shell with its real title and
 * robots noindex,nofollow — but they are NOT included in sitemap.xml,
 * llms.txt, or hreflang alternate links.
 *
 * changefreq / priority follow standard sitemap conventions (advisory only).
 */
/**
 * `title` / `summary` are English-language, one-line labels used by the GEO
 * generators (F18 llms.txt and its companions). They deliberately do NOT
 * localize — the llmstxt.org format is a single English index that points AI
 * crawlers at the canonical marketing pages; per-locale routes are still
 * enumerated, but with their base title/summary so the index stays compact.
 */
export const PUBLIC_ROUTES = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: 1.0,
    title: 'PR-TOP — Therapist-controlled between-session assistant',
    summary:
      'Product landing: client diary, AI session notes, crisis alerts, Telegram bot — with therapist control and GDPR-grade encryption.',
    primaryKeyword: { en: 'AI assistant for therapists', ru: 'AI-ассистент', uk: 'AI-асистент', es: 'asistente IA' },
  },
  {
    path: '/security/encryption',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Encryption architecture',
    summary:
      'How PR-TOP encrypts diary entries, session transcripts and private notes at the application layer (Class A / Class B model).',
    primaryKeyword: { en: 'encryption', ru: 'шифрование', uk: 'шифрування', es: 'cifrado' },
  },
  {
    path: '/security/gdpr',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'GDPR compliance',
    summary:
      'Data-controller / processor split, consent enforcement, subject-access and deletion workflows for EU therapists.',
    primaryKeyword: { en: 'GDPR', ru: 'GDPR', uk: 'GDPR', es: 'GDPR' },
  },
  {
    path: '/security/audit-log',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Immutable audit log',
    summary:
      'Append-only audit trail for every access to Class A client data — visible to therapists and superadmins.',
    primaryKeyword: { en: 'audit', ru: 'аудит', uk: 'аудит', es: 'auditoría' },
  },
  {
    path: '/security/data-sovereignty',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Data sovereignty',
    summary:
      'EU-only hosting (Hetzner), self-hosted analytics, no third-party trackers, and portable encrypted backups.',
    primaryKeyword: { en: 'data sovereignty', ru: 'суверенитет данных', uk: 'суверенітет даних', es: 'soberanía' },
  },
  {
    path: '/privacy',
    changefreq: 'yearly',
    priority: 0.5,
    title: 'Privacy policy',
    summary:
      'What data PR-TOP collects, why, how long it is retained, and how therapists and clients can exercise their rights.',
    primaryKeyword: { en: 'privacy policy', ru: 'конфиденциальности', uk: 'конфіденційності', es: 'privacidad' },
  },
  {
    path: '/terms',
    changefreq: 'yearly',
    priority: 0.5,
    title: 'Terms of service',
    summary:
      'Subscription tiers, acceptable use, therapist responsibilities and platform liability limits.',
    primaryKeyword: { en: 'terms of service', ru: 'условия использования', uk: 'умови використання', es: 'términos' },
  },
  // GEO comparison / alternatives pages — fully localized since 2026-07-06
  // (content dictionaries live inside each page component).
  {
    path: '/compare/upheal',
    changefreq: 'monthly',
    priority: 0.6,
    title: 'PR-TOP vs Upheal — comparison for therapists',
    summary:
      'Honest 2026 comparison: Upheal is an AI-native session-notes EHR; PR-TOP owns between-session continuity via a Telegram client channel.',
    primaryKeyword: { en: 'PR-TOP vs Upheal', ru: 'Upheal', uk: 'Upheal', es: 'Upheal' },
  },
  {
    path: '/alternatives/upheal',
    changefreq: 'monthly',
    priority: 0.6,
    title: 'Upheal alternatives (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    summary:
      'Ranked list of Upheal alternatives for therapists, including AI note-takers (Mentalyc, Twofold, Heidi, Supanote) and PR-TOP for between-session continuity.',
    primaryKeyword: { en: 'Upheal alternatives', ru: 'Upheal', uk: 'Upheal', es: 'alternativas a Upheal' },
  },
  {
    path: '/compare/mentalyc',
    changefreq: 'monthly',
    priority: 0.6,
    title: 'PR-TOP vs Mentalyc — comparison for therapists',
    summary:
      'Honest 2026 comparison: Mentalyc is a privacy-first AI note-taker (anonymized transcripts, HIPAA); PR-TOP adds the between-session client channel via Telegram, EU-hosted and GDPR-first.',
    primaryKeyword: { en: 'PR-TOP vs Mentalyc', ru: 'Mentalyc', uk: 'Mentalyc', es: 'Mentalyc' },
  },
  {
    path: '/alternatives/mentalyc',
    changefreq: 'monthly',
    priority: 0.6,
    title: 'Mentalyc alternatives (2026) — Upheal, Twofold, Heidi, Supanote, PR-TOP',
    summary:
      'Ranked list of Mentalyc alternatives for therapists, including AI note-takers (Upheal, Twofold, Heidi, Supanote) and PR-TOP for between-session continuity.',
    primaryKeyword: { en: 'Mentalyc alternatives', ru: 'Mentalyc', uk: 'Mentalyc', es: 'alternativas a Mentalyc' },
  },
  {
    path: '/best-ai-assistant-for-therapists',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Best AI assistants for therapists (2026) — honest listicle',
    summary:
      'Best AI assistants for therapists (2026): honest picks across Upheal, Mentalyc, Twofold, Heidi, Supanote, Freed, Eleos, and PR-TOP — with a "best for" label on each entry.',
    primaryKeyword: { en: 'best AI assistant', ru: 'ИИ-ассистент', uk: 'ШІ-асистент', es: 'asistentes de IA' },
  },
  {
    path: '/ai-session-notes-for-therapists',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'AI session notes for therapists (2026) — full guide',
    summary:
      'How AI session notes work for therapists: Quill, Supanote and AutoNotes compared to PR-TOP, which adds a between-session Telegram channel, exercises, and crisis alerts on top of Whisper transcription.',
    primaryKeyword: { en: 'AI session notes for therapists', ru: 'AI-заметки к сессии для психологов', uk: 'AI-нотатки до сесії для психологів', es: 'notas de sesión con IA para terapeutas' },
  },
  // W4 quick-win landings (batch 1) — 2026-07-12
  {
    path: '/ai-practice-management',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'AI practice management for therapists — PR-TOP guide (2026)',
    summary:
      'PR-TOP for therapy practice management: client list, sessions, AI notes, analytics and a Telegram client channel. Honest scope — not a US-insurance EHR. Compared to SimplePractice and Jane App.',
    primaryKeyword: { en: 'AI practice management for therapists', ru: 'управление практикой психолога', uk: 'управління практикою психолога', es: 'gestión de consulta IA para terapeutas' },
  },
  {
    path: '/for-coaches',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'PR-TOP for coaches — between-session engagement software',
    summary:
      'PR-TOP for coaches: Telegram client bot for accountability check-ins, between-session homework, streaks, and session prep — without EHR complexity. Pricing as ROI.',
    primaryKeyword: { en: 'coaching practice software', ru: 'ПО для коучей', uk: 'ПЗ для коучів', es: 'software para coaches' },
  },
  {
    path: '/secure-practice-management',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Secure practice management for therapists — PR-TOP',
    summary:
      'How PR-TOP protects client data: application-layer AES encryption, EU-only hosting, GDPR consent enforcement, immutable audit log, and data sovereignty — all in one practice-management workspace.',
    primaryKeyword: { en: 'secure practice management for therapists', ru: 'безопасное управление практикой', uk: 'безпечне управління практикою', es: 'gestión segura de consulta para terapeutas' },
  },
];

/**
 * llmstxt.org grouping for the F18 llms.txt generator. Each entry lists
 * PUBLIC_ROUTES paths that belong under one Markdown section (##). Ordering
 * within a group follows the group definition; the group order below is the
 * top-to-bottom order emitted in dist/llms.txt.
 */
export const LLMS_SECTIONS = [
  { heading: 'Product', paths: ['/'] },
  {
    heading: 'Security',
    paths: [
      '/security/encryption',
      '/security/gdpr',
      '/security/audit-log',
      '/security/data-sovereignty',
    ],
  },
  { heading: 'Legal', paths: ['/privacy', '/terms'] },
  // F20 — GEO comparison / alternatives content (English-only).
  {
    heading: 'Comparisons',
    paths: [
      '/compare/upheal',
      '/alternatives/upheal',
      '/compare/mentalyc',
      '/alternatives/mentalyc',
      '/best-ai-assistant-for-therapists',
      '/ai-session-notes-for-therapists',
      '/ai-practice-management',
      '/for-coaches',
      '/secure-practice-management',
    ],
  },
];

/**
 * Non-English locales supported via URL prefix on the public marketing pages
 * (F11). English lives at the root ("/", "/privacy", ...); each locale below
 * gets a mirrored tree ("/ru", "/ru/privacy", ...) that forces i18n into that
 * language regardless of localStorage. The authenticated app and the /confirm
 * signup funnel handle their own locale detection.
 */
export const LOCALES = ['ru', 'uk', 'es'];

/**
 * Legacy export: routes that exist only in English. Empty since 2026-07-06 —
 * the comparison / alternatives pages are fully localized and live in
 * PUBLIC_ROUTES. Kept so older generator imports keep working.
 */
export const EN_ONLY_ROUTES = [];

/**
 * Convenience Set of the exact public marketing paths (root, no locale prefix).
 * Used by <LocaleSync> in App.jsx to distinguish "public English marketing"
 * (URL wins, force EN) from authenticated app routes (localStorage wins).
 */
export const PUBLIC_MARKETING_PATHS = new Set([
  ...PUBLIC_ROUTES.map((r) => r.path),
]);

/**
 * All hreflang locales including the default English root. English lives at
 * the root ("en" -> ""), each other locale mirrors the tree under a URL prefix.
 * This ordered list is the canonical iteration order for prerender.mjs,
 * generate-sitemap.mjs, and Seo.jsx.
 */
export const HREFLANG_LOCALES = ['en', ...LOCALES];

/**
 * Return the URL path for a public marketing route under a given hreflang locale.
 *
 *   localePathFor('en', '/')          -> '/'
 *   localePathFor('en', '/privacy')   -> '/privacy'
 *   localePathFor('ru', '/')          -> '/ru'
 *   localePathFor('ru', '/privacy')   -> '/ru/privacy'
 *
 * NOTE: locale roots do NOT get a trailing slash — this matches the App.jsx
 * router config and the dist/<loc>/index.html output layout.
 */
export function localePathFor(locale, routePath) {
  if (locale === 'en') return routePath;
  if (routePath === '/') return `/${locale}`;
  return `/${locale}${routePath}`;
}

/**
 * Full matrix of (locale, routePath) tuples spanning HREFLANG_LOCALES x
 * PUBLIC_ROUTES. Length is
 *   HREFLANG_LOCALES.length * PUBLIC_ROUTES.length
 * (4 * 12 = 48 with the current manifest). The `enOnly` flag is retained for
 * generator compatibility but is always false — every public marketing route
 * (including /compare/* and /alternatives/*) has all four locale variants.
 */
export const LOCALIZED_ROUTES = [
  ...HREFLANG_LOCALES.flatMap((locale) =>
    PUBLIC_ROUTES.map(({ path, changefreq, priority }) => ({
      locale,
      basePath: path,
      path: localePathFor(locale, path),
      changefreq,
      priority,
      enOnly: false,
    })),
  ),
];

/**
 * W2 — Auth routes that need their own prerendered static shell so crawlers
 * never see the homepage head on these pages. These routes are:
 *   - INCLUDED in prerender (scripts/prerender.mjs) — English only, no locale mirrors.
 *   - EXCLUDED from sitemap.xml, llms.txt, and hreflang alternate links.
 *   - Each page component already calls <Seo ... noindex /> (F3), so the
 *     prerendered HTML naturally carries robots noindex,nofollow and the
 *     page's own title / self-canonical.
 */
export const NOINDEX_PRERENDER_ROUTES = [
  { path: '/register',       title: 'Register — PR-TOP' },
  { path: '/login',          title: 'Sign in — PR-TOP' },
  { path: '/forgot-password', title: 'Forgot password — PR-TOP' },
  { path: '/reset-password', title: 'Reset password — PR-TOP' },
];

export default PUBLIC_ROUTES;
