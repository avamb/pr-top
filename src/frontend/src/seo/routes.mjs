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
export const PUBLIC_ROUTES = [
  { path: '/',                            changefreq: 'weekly',  priority: 1.0 },
  { path: '/security/encryption',         changefreq: 'monthly', priority: 0.7 },
  { path: '/security/gdpr',               changefreq: 'monthly', priority: 0.7 },
  { path: '/security/audit-log',          changefreq: 'monthly', priority: 0.7 },
  { path: '/security/data-sovereignty',   changefreq: 'monthly', priority: 0.7 },
  { path: '/privacy',                     changefreq: 'yearly',  priority: 0.5 },
  { path: '/terms',                       changefreq: 'yearly',  priority: 0.5 },
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
 */
export const PUBLIC_MARKETING_PATHS = new Set(PUBLIC_ROUTES.map((r) => r.path));

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
 * PUBLIC_ROUTES. Length is HREFLANG_LOCALES.length * PUBLIC_ROUTES.length
 * (4 * 7 = 28 with the current manifest).
 */
export const LOCALIZED_ROUTES = HREFLANG_LOCALES.flatMap((locale) =>
  PUBLIC_ROUTES.map(({ path, changefreq, priority }) => ({
    locale,
    basePath: path,
    path: localePathFor(locale, path),
    changefreq,
    priority,
  })),
);

export default PUBLIC_ROUTES;
