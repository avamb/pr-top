import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, matchRoutes } from 'react-router-dom';
import i18n from './i18n';
import { LOCALES, PUBLIC_MARKETING_PATHS } from './seo/routes.mjs';
import { lazyRoute } from './utils/lazyRoute';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * H14 - Route-level code splitting.
 *
 * Every page (and the authenticated layouts) is its own lazy chunk, so the
 * entry bundle only carries React, the router, i18n and the shell. Public
 * marketing pages download just their own chunk; the dashboard, admin and
 * client-detail code never ships to a visitor of the landing page.
 *
 * `lazyRoute` renders synchronously once a chunk has been loaded, and
 * `preloadRoute(pathname)` (awaited by main.jsx before hydrateRoot) loads the
 * chunk of the page the browser is currently on. Together they keep hydration
 * of prerendered pages identical to the prerendered markup.
 */
const Landing = lazyRoute(() => import('./pages/Landing'));
const LandingConfirm = lazyRoute(() => import('./pages/LandingConfirm'));
const Register = lazyRoute(() => import('./pages/Register'));
const Login = lazyRoute(() => import('./pages/Login'));
const ForgotPassword = lazyRoute(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyRoute(() => import('./pages/ResetPassword'));
const Dashboard = lazyRoute(() => import('./pages/Dashboard'));
const ClientList = lazyRoute(() => import('./pages/ClientList'));
const Subscription = lazyRoute(() => import('./pages/Subscription'));
const ClientDetail = lazyRoute(() => import('./pages/ClientDetail'));
const SessionDetail = lazyRoute(() => import('./pages/SessionDetail'));
const BulkUpload = lazyRoute(() => import('./pages/BulkUpload'));
const ExerciseLibrary = lazyRoute(() => import('./pages/ExerciseLibrary'));
const Analytics = lazyRoute(() => import('./pages/Analytics'));
const Settings = lazyRoute(() => import('./pages/Settings'));
const AdminDashboard = lazyRoute(() => import('./pages/AdminDashboard'));
const AdminTherapists = lazyRoute(() => import('./pages/AdminTherapists'));
const AdminSettings = lazyRoute(() => import('./pages/AdminSettings'));
const AdminAuditLogs = lazyRoute(() => import('./pages/AdminAuditLogs'));
const AdminSystemLogs = lazyRoute(() => import('./pages/AdminSystemLogs'));
const AdminAIUsage = lazyRoute(() => import('./pages/AdminAIUsage'));
const AdminAIModels = lazyRoute(() => import('./pages/AdminAIModels'));
const AdminCachedAnswers = lazyRoute(() => import('./pages/AdminCachedAnswers'));
const AdminAssistantAnalytics = lazyRoute(() => import('./pages/AdminAssistantAnalytics'));
const AdminAssistantConversations = lazyRoute(() => import('./pages/AdminAssistantConversations'));
const AdminViewerAnalytics = lazyRoute(() => import('./pages/AdminViewerAnalytics'));
const AdminPromos = lazyRoute(() => import('./pages/AdminPromos'));
const TherapistGuide = lazyRoute(() => import('./pages/TherapistGuide'));
const SecurityEncryption = lazyRoute(() => import('./pages/SecurityEncryption'));
const SecurityGDPR = lazyRoute(() => import('./pages/SecurityGDPR'));
const SecurityAuditLog = lazyRoute(() => import('./pages/SecurityAuditLog'));
const SecurityDataSovereignty = lazyRoute(() => import('./pages/SecurityDataSovereignty'));
const AiTransparency = lazyRoute(() => import('./pages/AiTransparency'));
const PrivacyPolicy = lazyRoute(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazyRoute(() => import('./pages/TermsOfService'));
const CompareUpheal = lazyRoute(() => import('./pages/CompareUpheal'));
const AlternativesUpheal = lazyRoute(() => import('./pages/AlternativesUpheal'));
const CompareMentalyc = lazyRoute(() => import('./pages/CompareMentalyc'));
const AlternativesMentalyc = lazyRoute(() => import('./pages/AlternativesMentalyc'));
const BestAiAssistantForTherapists = lazyRoute(() => import('./pages/BestAiAssistantForTherapists'));
const AiSessionNotesForTherapists = lazyRoute(() => import('./pages/AiSessionNotesForTherapists'));
const AiPracticeManagement = lazyRoute(() => import('./pages/AiPracticeManagement'));
const ForCoaches = lazyRoute(() => import('./pages/ForCoaches'));
const SecurePracticeManagement = lazyRoute(() => import('./pages/SecurePracticeManagement'));
const TherapyDocumentationAi = lazyRoute(() => import('./pages/TherapyDocumentationAi'));
const TherapistAiAssistant = lazyRoute(() => import('./pages/TherapistAiAssistant'));
const HipaaAndGdprForTherapySoftware = lazyRoute(() => import('./pages/HipaaAndGdprForTherapySoftware'));
const CoachingSessionManagement = lazyRoute(() => import('./pages/CoachingSessionManagement'));
const ClientDiaryForTherapists = lazyRoute(() => import('./pages/ClientDiaryForTherapists'));
const PracticeManagementForTherapists = lazyRoute(() => import('./pages/PracticeManagementForTherapists'));
const VerifyLead = lazyRoute(() => import('./pages/VerifyLead'));
const VerifyEmail = lazyRoute(() => import('./pages/VerifyEmail'));
const SupervisionView = lazyRoute(() => import('./pages/SupervisionView'));
const NotFound = lazyRoute(() => import('./pages/NotFound'));
const InstallPrompt = lazyRoute(() => import('./components/InstallPrompt'), { fallback: null });

// The authenticated shells (guards + sidebar + notifications) are one chunk each.
const GuardedLayout = lazyRoute(() =>
  import('./components/AppLayouts').then((m) => ({ default: m.GuardedLayout })));
const AdminLayout = lazyRoute(() =>
  import('./components/AppLayouts').then((m) => ({ default: m.AdminLayout })));

/**
 * F11 — Locale-prefix routing for public marketing pages.
 *
 * Public marketing routes (Landing, Security/*, Privacy, Terms) render both at
 * the root ("/", "/privacy", ...) AND under an optional /ru, /uk, /es prefix.
 * URL wins over localStorage for these routes: hitting /ru/privacy always
 * displays Russian, even if the user's stored preference is English.
 *
 * Authenticated app routes (/dashboard, /clients, ...) intentionally keep the
 * legacy localStorage-based behavior. When the user leaves the public tree,
 * LocaleSync restores their stored language.
 *
 * Unknown locale prefixes ("/fr/privacy") don't match any Route below and
 * cascade to the catch-all NotFound at the bottom of the tree.
 */
const PUBLIC_MARKETING_ROUTES = [
  { path: '/',                          Page: Landing },
  { path: '/security/encryption',       Page: SecurityEncryption },
  { path: '/security/gdpr',             Page: SecurityGDPR },
  { path: '/security/audit-log',        Page: SecurityAuditLog },
  { path: '/security/data-sovereignty', Page: SecurityDataSovereignty },
  { path: '/security/ai-processing',   Page: AiTransparency },
  { path: '/privacy',                   Page: PrivacyPolicy },
  { path: '/terms',                     Page: TermsOfService },
  // GEO comparison / alternatives pages — localized, mirrored under /ru|/uk|/es
  { path: '/compare/upheal',            Page: CompareUpheal },
  { path: '/alternatives/upheal',       Page: AlternativesUpheal },
  { path: '/compare/mentalyc',          Page: CompareMentalyc },
  { path: '/alternatives/mentalyc',     Page: AlternativesMentalyc },
  { path: '/best-ai-assistant-for-therapists', Page: BestAiAssistantForTherapists },
  { path: '/ai-session-notes-for-therapists',  Page: AiSessionNotesForTherapists },
  // W4 quick-win landings (batch 1) — 2026-07-12
  { path: '/ai-practice-management',            Page: AiPracticeManagement },
  { path: '/for-coaches',                       Page: ForCoaches },
  { path: '/secure-practice-management',        Page: SecurePracticeManagement },
  // W5 quick-win landings (batch 2) — 2026-07-12
  { path: '/therapy-documentation-ai',          Page: TherapyDocumentationAi },
  { path: '/therapist-ai-assistant',            Page: TherapistAiAssistant },
  { path: '/hipaa-and-gdpr-for-therapy-software', Page: HipaaAndGdprForTherapySoftware },
  { path: '/coaching-session-management',       Page: CoachingSessionManagement },
  { path: '/client-diary-for-therapists',       Page: ClientDiaryForTherapists },
  { path: '/practice-management-for-therapists', Page: PracticeManagementForTherapists },
];

function localePrefixedPath(locale, routePath) {
  // "/" -> "/ru", "/privacy" -> "/ru/privacy"
  return routePath === '/' ? `/${locale}` : `/${locale}${routePath}`;
}

/**
 * Watches the URL and keeps i18n in sync with the effective language:
 *   - /ru/**, /uk/**, /es/**   -> force that locale (URL wins).
 *   - Public English marketing -> force 'en' (URL wins, even against
 *                                 a lingering localStorage preference).
 *   - Everything else (authenticated app, auth pages, ...)  ->
 *                                 restore from localStorage if present.
 */
function LocaleSync() {
  const location = useLocation();
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    const isFirstRun = firstRun.current;
    firstRun.current = false;
    const path = location.pathname;
    const supported = ['en', 'ru', 'es', 'uk'];

    const urlLocaleMatch = path.match(/^\/(ru|es|uk)(\/|$)/);
    if (urlLocaleMatch) {
      const target = urlLocaleMatch[1];
      if (i18n.language !== target) i18n.changeLanguage(target);
      return;
    }

    if (PUBLIC_MARKETING_PATHS.has(path)) {
      if (i18n.language !== 'en') i18n.changeLanguage('en');
      return;
    }

    // Stored preference wins. On the very first run only, also fall back to
    // the browser language (the same priority as i18n/index.js
    // getInitialLanguage()): main.jsx hydrates a prerendered page (/login,
    // ...) in the language it was prerendered in, and this effect then
    // switches to the visitor's own. Later navigations without a stored
    // preference keep the current language, as before.
    let stored = null;
    try { stored = typeof localStorage !== 'undefined' ? localStorage.getItem('app_language') : null; } catch (_) { /* storage blocked */ }
    const browser = (
      (typeof navigator !== 'undefined' ? (navigator.language || '') : '') || 'en'
    ).split('-')[0];
    let preferred = null;
    if (stored && supported.includes(stored)) preferred = stored;
    else if (isFirstRun) preferred = supported.includes(browser) ? browser : 'en';
    if (preferred && i18n.language !== preferred) i18n.changeLanguage(preferred);
  }, [location.pathname]);
  return null;
}

/**
 * R15 — PWA/update banner gating.
 *
 * InstallPrompt (PWA add-to-home-screen) and the SW update banner must only
 * appear inside the authenticated therapist/admin zone, never on public
 * marketing pages, the registration flow, or other public routes.
 *
 * Authenticated routes are those wrapped by GuardedLayout or AdminLayout:
 *   /dashboard, /clients, /sessions, /exercises, /analytics,
 *   /settings, /subscription, /admin
 *
 * Public routes (/, /register, /login, /security/*, /compare/*, etc.)
 * must NOT show the banner — it would confuse visitors and distract from
 * the marketing funnel.
 */
const AUTHENTICATED_PREFIXES = [
  '/dashboard',
  '/clients',
  '/sessions',
  '/exercises',
  '/analytics',
  '/settings',
  '/subscription',
  '/admin',
];

function GatedInstallPrompt() {
  const { pathname } = useLocation();
  const isInAuthenticatedZone = AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  return isInAuthenticatedZone ? <InstallPrompt /> : null;
}

/**
 * Route element helpers. Each lazy component carries its own <Suspense>
 * boundary (see utils/lazyRoute.jsx), so navigating between lazy routes
 * inside the dashboard keeps the sidebar/layout mounted and only the content
 * area shows the fallback - and a hydrated, preloaded page has no Suspense
 * boundary at all.
 */
function page(Page, props) {
  return <Page {...props} />;
}

function guarded(Page) {
  return <GuardedLayout><Page /></GuardedLayout>;
}

function admin(Page) {
  return <AdminLayout><Page /></AdminLayout>;
}

/**
 * Single route table for everything that is not a public marketing page.
 * `Layout` is the lazy layout wrapper (if any); `Page` the lazy page. The
 * table drives both <Routes> and preloadRoute().
 *
 * KEEP IN SYNC with the `$spa_known` allow-list in nginx.conf: a path that is
 * not prerendered and not matched there gets a real 404 (M30).
 */
const APP_ROUTES = [
  // /confirm landing page - 4 locale variants, outside AppLayout
  { path: '/confirm',    Page: LandingConfirm, props: {} },
  { path: '/ru/confirm', Page: LandingConfirm, props: { locale: 'ru' } },
  { path: '/es/confirm', Page: LandingConfirm, props: { locale: 'es' } },
  { path: '/uk/confirm', Page: LandingConfirm, props: { locale: 'uk' } },

  { path: '/register',        Page: Register },
  { path: '/login',           Page: Login },
  { path: '/forgot-password', Page: ForgotPassword },
  { path: '/reset-password',  Page: ResetPassword },
  { path: '/verify-lead',     Page: VerifyLead },
  { path: '/verify-email',    Page: VerifyEmail },
  { path: '/share/supervision/:token', Page: SupervisionView },

  // Authenticated therapist routes - AuthGuard + TherapistGuard + AppLayout
  { path: '/dashboard',            Page: Dashboard,       Layout: GuardedLayout },
  { path: '/clients',              Page: ClientList,      Layout: GuardedLayout },
  { path: '/clients/:id',          Page: ClientDetail,    Layout: GuardedLayout },
  { path: '/sessions/bulk',        Page: BulkUpload,      Layout: GuardedLayout },
  { path: '/sessions/:id',         Page: SessionDetail,   Layout: GuardedLayout },
  { path: '/exercises',            Page: ExerciseLibrary, Layout: GuardedLayout },
  { path: '/analytics',            Page: Analytics,       Layout: GuardedLayout },
  { path: '/settings',             Page: Settings,        Layout: GuardedLayout },
  { path: '/subscription',         Page: Subscription,    Layout: GuardedLayout },
  { path: '/subscription/success', Page: Subscription,    Layout: GuardedLayout },
  { path: '/dashboard/guide',      Page: TherapistGuide,  Layout: GuardedLayout },

  // Admin routes - AuthGuard + TherapistGuard + AdminGuard + AppLayout
  { path: '/admin',                         Page: AdminDashboard,              Layout: AdminLayout },
  { path: '/admin/therapists',              Page: AdminTherapists,             Layout: AdminLayout },
  { path: '/admin/settings',                Page: AdminSettings,               Layout: AdminLayout },
  { path: '/admin/logs',                    Page: AdminAuditLogs,              Layout: AdminLayout },
  { path: '/admin/system-logs',             Page: AdminSystemLogs,             Layout: AdminLayout },
  { path: '/admin/ai-usage',                Page: AdminAIUsage,                Layout: AdminLayout },
  { path: '/admin/ai-models',               Page: AdminAIModels,               Layout: AdminLayout },
  { path: '/admin/cached-answers',          Page: AdminCachedAnswers,          Layout: AdminLayout },
  { path: '/admin/assistant-analytics',     Page: AdminAssistantAnalytics,     Layout: AdminLayout },
  { path: '/admin/assistant-conversations', Page: AdminAssistantConversations, Layout: AdminLayout },
  { path: '/admin/viewer-analytics',        Page: AdminViewerAnalytics,        Layout: AdminLayout },
  { path: '/admin/promos',                  Page: AdminPromos,                 Layout: AdminLayout },
  { path: '/admin/*',                       Page: AdminDashboard,              Layout: AdminLayout },

  { path: '*', Page: NotFound },
];

// Every route (marketing at the root, marketing under each locale prefix, app
// routes) with the lazy components it needs, for matchRoutes()-based preloading.
const PRELOAD_TABLE = [
  ...PUBLIC_MARKETING_ROUTES.map((r) => ({ path: r.path, parts: [r.Page] })),
  ...LOCALES.flatMap((loc) =>
    PUBLIC_MARKETING_ROUTES.map((r) => ({ path: localePrefixedPath(loc, r.path), parts: [r.Page] }))),
  ...APP_ROUTES.map((r) => ({ path: r.path, parts: r.Layout ? [r.Layout, r.Page] : [r.Page] })),
];

/**
 * Load the lazy chunk(s) needed to render `pathname`. main.jsx awaits this
 * before hydrateRoot() so hydration sees real content, not a Suspense
 * fallback. Never rejects: on a network error the page simply boots through
 * the normal Suspense path.
 */
export async function preloadRoute(pathname) {
  try {
    const matches = matchRoutes(PRELOAD_TABLE.map((r) => ({ path: r.path, entry: r })), pathname);
    const last = matches && matches[matches.length - 1];
    if (last) await Promise.all(last.route.entry.parts.map((c) => c.preload()));
  } catch (_) { /* fall back to Suspense */ }
}

function App() {
  return (
    <BrowserRouter>
      <LocaleSync />
      <GatedInstallPrompt />
      <ErrorBoundary>
      <Routes>
        {/* Public marketing routes at the root (English default). */}
        {PUBLIC_MARKETING_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={page(r.Page)} />
        ))}

        {/* Same public marketing tree mirrored under each locale prefix (F11). */}
        {LOCALES.flatMap((loc) =>
          PUBLIC_MARKETING_ROUTES.map((r) => (
            <Route
              key={localePrefixedPath(loc, r.path)}
              path={localePrefixedPath(loc, r.path)}
              element={page(r.Page)}
            />
          ))
        )}

        {APP_ROUTES.map((r) => {
          let element;
          if (r.Layout === GuardedLayout) element = guarded(r.Page);
          else if (r.Layout === AdminLayout) element = admin(r.Page);
          else element = page(r.Page, r.props);
          return <Route key={`${r.path}|${(r.props && r.props.locale) || ''}`} path={r.path} element={element} />;
        })}
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
