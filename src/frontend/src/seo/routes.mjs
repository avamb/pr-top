/**
 * Shared public-route manifest — single source of truth for:
 *   - build-time sitemap.xml generation (scripts/generate-sitemap.mjs)
 *   - static prerender step (future)
 *   - App.jsx public routing cross-reference
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

export default PUBLIC_ROUTES;
