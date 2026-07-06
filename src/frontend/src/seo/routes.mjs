/**
 * Shared public-route manifest — single source of truth for:
 *   - build-time sitemap.xml generation (scripts/generate-sitemap.mjs)
 *   - static prerender step (scripts/prerender.mjs)
 *   - App.jsx public routing cross-reference
 *   - App.jsx locale-prefix routing (F11)
 *
 * Only PUBLIC MARKETING routes belong here.
 * Explicitly EXCLUDED (per SEO Foundation spec F2):
 *   /login, /register, /confirm (and its locale variants /ru/confirm etc.),
 *   /dashboard/*, /clients/*, /sessions/*, /exercises, /analytics, /settings,
 *   /subscription/*, /admin/*, /verify-lead, /share/*, /forgot-password,
 *   /reset-password.
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
  },
  {
    path: '/security/encryption',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Encryption architecture',
    summary:
      'How PR-TOP encrypts diary entries, session transcripts and private notes at the application layer (Class A / Class B model).',
  },
  {
    path: '/security/gdpr',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'GDPR compliance',
    summary:
      'Data-controller / processor split, consent enforcement, subject-access and deletion workflows for EU therapists.',
  },
  {
    path: '/security/audit-log',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Immutable audit log',
    summary:
      'Append-only audit trail for every access to Class A client data — visible to therapists and superadmins.',
  },
  {
    path: '/security/data-sovereignty',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Data sovereignty',
    summary:
      'EU-only hosting (Hetzner), self-hosted analytics, no third-party trackers, and portable encrypted backups.',
  },
  {
    path: '/privacy',
    changefreq: 'yearly',
    priority: 0.5,
    title: 'Privacy policy',
    summary:
      'What data PR-TOP collects, why, how long it is retained, and how therapists and clients can exercise their rights.',
  },
  {
    path: '/terms',
    changefreq: 'yearly',
    priority: 0.5,
    title: 'Terms of service',
    summary:
      'Subscription tiers, acceptable use, therapist responsibilities and platform liability limits.',
  },
];

/**
 * F20 — English-only comparison / alternatives content.
 *
 * These GEO-targeted competitor pages ship in English first and are NOT
 * mirrored under /ru, /uk, /es (per the F20 spec: "EN-only in this wave.
 * Human reviews copy before dev->prod merge"). They still participate in
 * sitemap.xml, prerender, and llms.txt (Comparisons section) via
 * LOCALIZED_ROUTES below, but with `enOnly: true` so downstream generators
 * skip emitting hreflang alternates or locale-mirrored URLs for them.
 */
export const EN_ONLY_ROUTES = [
  {
    path: '/compare/upheal',
    changefreq: 'monthly',
    priority: 0.6,
    title: 'PR-TOP vs Upheal — comparison for therapists',
    summary:
      'Honest 2026 comparison: Upheal is an AI-native session-notes EHR; PR-TOP owns between-session continuity via a Telegram client channel.',
  },
  {
    path: '/alternatives/upheal',
    changefreq: 'monthly',
    priority: 0.6,
    title: 'Upheal alternatives (2026) — Mentalyc, Twofold, Heidi, Supanote, PR-TOP',
    summary:
      'Ranked list of Upheal alternatives for therapists, including AI note-takers (Mentalyc, Twofold, Heidi, Supanote) and PR-TOP for between-session continuity.',
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
  { heading: 'Comparisons', paths: ['/compare/upheal', '/alternatives/upheal'] },
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
 * Convenience Set of the exact public marketing paths (root, no locale prefix).
 * Used by <LocaleSync> in App.jsx to distinguish "public English marketing"
 * (URL wins, force EN) from authenticated app routes (localStorage wins).
 * F20: EN-only comparison / alternatives pages are also public marketing and
 * must force EN (they have no locale mirrors).
 */
export const PUBLIC_MARKETING_PATHS = new Set([
  ...PUBLIC_ROUTES.map((r) => r.path),
  ...EN_ONLY_ROUTES.map((r) => r.path),
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
 * PUBLIC_ROUTES, plus the English-only F20 comparison / alternatives routes
 * appended at the tail. Length is
 *   HREFLANG_LOCALES.length * PUBLIC_ROUTES.length + EN_ONLY_ROUTES.length
 * (4 * 7 + 2 = 30 with the current manifest).
 *
 * Entries carry an `enOnly` flag so generators (sitemap.xml, prerender.mjs,
 * generate-llms.mjs) know to skip hreflang alternates for them (there are no
 * /ru, /uk, /es mirrors — attempting to emit them would produce dead URLs).
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
  ...EN_ONLY_ROUTES.map(({ path, changefreq, priority }) => ({
    locale: 'en',
    basePath: path,
    path,
    changefreq,
    priority,
    enOnly: true,
  })),
];

export default PUBLIC_ROUTES;
