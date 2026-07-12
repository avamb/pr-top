import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import i18n from './i18n';
import { LOCALES, PUBLIC_MARKETING_PATHS } from './seo/routes.mjs';
import AppLayout from './components/AppLayout';
import AuthGuard from './components/guards/AuthGuard';
import TherapistGuard from './components/guards/TherapistGuard';
import AdminGuard from './components/guards/AdminGuard';
import Landing from './pages/Landing';
import LandingConfirm from './pages/LandingConfirm';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import Subscription from './pages/Subscription';
import ClientDetail from './pages/ClientDetail';
import SessionDetail from './pages/SessionDetail';
import BulkUpload from './pages/BulkUpload';
import ExerciseLibrary from './pages/ExerciseLibrary';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminTherapists from './pages/AdminTherapists';
import AdminSettings from './pages/AdminSettings';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminSystemLogs from './pages/AdminSystemLogs';
import AdminAIUsage from './pages/AdminAIUsage';
import AdminAIModels from './pages/AdminAIModels';
import AdminCachedAnswers from './pages/AdminCachedAnswers';
import AdminAssistantAnalytics from './pages/AdminAssistantAnalytics';
import AdminAssistantConversations from './pages/AdminAssistantConversations';
import AdminViewerAnalytics from './pages/AdminViewerAnalytics';
import AdminPromos from './pages/AdminPromos';
import TherapistGuide from './pages/TherapistGuide';
import SecurityEncryption from './pages/SecurityEncryption';
import SecurityGDPR from './pages/SecurityGDPR';
import SecurityAuditLog from './pages/SecurityAuditLog';
import SecurityDataSovereignty from './pages/SecurityDataSovereignty';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CompareUpheal from './pages/CompareUpheal';
import AlternativesUpheal from './pages/AlternativesUpheal';
import CompareMentalyc from './pages/CompareMentalyc';
import AlternativesMentalyc from './pages/AlternativesMentalyc';
import BestAiAssistantForTherapists from './pages/BestAiAssistantForTherapists';
import AiSessionNotesForTherapists from './pages/AiSessionNotesForTherapists';
import AiPracticeManagement from './pages/AiPracticeManagement';
import ForCoaches from './pages/ForCoaches';
import SecurePracticeManagement from './pages/SecurePracticeManagement';
import TherapyDocumentationAi from './pages/TherapyDocumentationAi';
import TherapistAiAssistant from './pages/TherapistAiAssistant';
import HipaaAndGdprForTherapySoftware from './pages/HipaaAndGdprForTherapySoftware';
import CoachingSessionManagement from './pages/CoachingSessionManagement';
import ClientDiaryForTherapists from './pages/ClientDiaryForTherapists';
import VerifyLead from './pages/VerifyLead';
import SupervisionView from './pages/SupervisionView';
import NotFound from './pages/NotFound';
import InstallPrompt from './components/InstallPrompt';
import NotificationToast from './components/NotificationToast';

/**
 * GuardedLayout - Wraps content with AuthGuard + TherapistGuard + AppLayout.
 * Used for therapist dashboard routes.
 */
function GuardedLayout({ children }) {
  return (
    <AuthGuard>
      <TherapistGuard>
        <NotificationToast />
        <AppLayout>{children}</AppLayout>
      </TherapistGuard>
    </AuthGuard>
  );
}

/**
 * AdminLayout - Wraps content with AuthGuard + TherapistGuard + AdminGuard + AppLayout.
 * Used for superadmin routes.
 */
function AdminLayout({ children }) {
  return (
    <AuthGuard>
      <TherapistGuard>
        <AdminGuard>
          <AppLayout>{children}</AppLayout>
        </AdminGuard>
      </TherapistGuard>
    </AuthGuard>
  );
}

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
  { path: '/',                          element: <Landing /> },
  { path: '/security/encryption',       element: <SecurityEncryption /> },
  { path: '/security/gdpr',             element: <SecurityGDPR /> },
  { path: '/security/audit-log',        element: <SecurityAuditLog /> },
  { path: '/security/data-sovereignty', element: <SecurityDataSovereignty /> },
  { path: '/privacy',                   element: <PrivacyPolicy /> },
  { path: '/terms',                     element: <TermsOfService /> },
  // GEO comparison / alternatives pages — localized, mirrored under /ru|/uk|/es
  { path: '/compare/upheal',            element: <CompareUpheal /> },
  { path: '/alternatives/upheal',       element: <AlternativesUpheal /> },
  { path: '/compare/mentalyc',          element: <CompareMentalyc /> },
  { path: '/alternatives/mentalyc',     element: <AlternativesMentalyc /> },
  { path: '/best-ai-assistant-for-therapists', element: <BestAiAssistantForTherapists /> },
  { path: '/ai-session-notes-for-therapists',  element: <AiSessionNotesForTherapists /> },
  // W4 quick-win landings (batch 1) — 2026-07-12
  { path: '/ai-practice-management',            element: <AiPracticeManagement /> },
  { path: '/for-coaches',                       element: <ForCoaches /> },
  { path: '/secure-practice-management',        element: <SecurePracticeManagement /> },
  // W5 quick-win landings (batch 2) — 2026-07-12
  { path: '/therapy-documentation-ai',          element: <TherapyDocumentationAi /> },
  { path: '/therapist-ai-assistant',            element: <TherapistAiAssistant /> },
  { path: '/hipaa-and-gdpr-for-therapy-software', element: <HipaaAndGdprForTherapySoftware /> },
  { path: '/coaching-session-management',       element: <CoachingSessionManagement /> },
  { path: '/client-diary-for-therapists',       element: <ClientDiaryForTherapists /> },
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
  React.useEffect(() => {
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

    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('app_language')
      : null;
    if (stored && supported.includes(stored) && i18n.language !== stored) {
      i18n.changeLanguage(stored);
    }
  }, [location.pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <LocaleSync />
      <InstallPrompt />
      <Routes>
        {/* Public marketing routes at the root (English default). */}
        {PUBLIC_MARKETING_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}

        {/* Same public marketing tree mirrored under each locale prefix (F11). */}
        {LOCALES.flatMap((loc) =>
          PUBLIC_MARKETING_ROUTES.map((r) => (
            <Route
              key={localePrefixedPath(loc, r.path)}
              path={localePrefixedPath(loc, r.path)}
              element={r.element}
            />
          ))
        )}

        {/* /confirm landing page - 4 locale variants, outside AppLayout */}
        <Route path="/confirm" element={<LandingConfirm />} />
        <Route path="/ru/confirm" element={<LandingConfirm locale="ru" />} />
        <Route path="/es/confirm" element={<LandingConfirm locale="es" />} />
        <Route path="/uk/confirm" element={<LandingConfirm locale="uk" />} />

        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-lead" element={<VerifyLead />} />
        <Route path="/share/supervision/:token" element={<SupervisionView />} />

        {/* Authenticated therapist routes - AuthGuard + TherapistGuard + AppLayout */}
        <Route path="/dashboard" element={<GuardedLayout><Dashboard /></GuardedLayout>} />
        <Route path="/clients" element={<GuardedLayout><ClientList /></GuardedLayout>} />
        <Route path="/clients/:id" element={<GuardedLayout><ClientDetail /></GuardedLayout>} />
        <Route path="/sessions/bulk" element={<GuardedLayout><BulkUpload /></GuardedLayout>} />
        <Route path="/sessions/:id" element={<GuardedLayout><SessionDetail /></GuardedLayout>} />
        <Route path="/exercises" element={<GuardedLayout><ExerciseLibrary /></GuardedLayout>} />
        <Route path="/analytics" element={<GuardedLayout><Analytics /></GuardedLayout>} />
        <Route path="/settings" element={<GuardedLayout><Settings /></GuardedLayout>} />
        <Route path="/subscription" element={<GuardedLayout><Subscription /></GuardedLayout>} />
        <Route path="/subscription/success" element={<GuardedLayout><Subscription /></GuardedLayout>} />
        <Route path="/dashboard/guide" element={<GuardedLayout><TherapistGuide /></GuardedLayout>} />

        {/* Admin routes - AuthGuard + TherapistGuard + AdminGuard + AppLayout */}
        <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/therapists" element={<AdminLayout><AdminTherapists /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
        <Route path="/admin/logs" element={<AdminLayout><AdminAuditLogs /></AdminLayout>} />
        <Route path="/admin/system-logs" element={<AdminLayout><AdminSystemLogs /></AdminLayout>} />
        <Route path="/admin/ai-usage" element={<AdminLayout><AdminAIUsage /></AdminLayout>} />
        <Route path="/admin/ai-models" element={<AdminLayout><AdminAIModels /></AdminLayout>} />
        <Route path="/admin/cached-answers" element={<AdminLayout><AdminCachedAnswers /></AdminLayout>} />
        <Route path="/admin/assistant-analytics" element={<AdminLayout><AdminAssistantAnalytics /></AdminLayout>} />
        <Route path="/admin/assistant-conversations" element={<AdminLayout><AdminAssistantConversations /></AdminLayout>} />
        <Route path="/admin/viewer-analytics" element={<AdminLayout><AdminViewerAnalytics /></AdminLayout>} />
        <Route path="/admin/promos" element={<AdminLayout><AdminPromos /></AdminLayout>} />
        <Route path="/admin/*" element={<AdminLayout><AdminDashboard /></AdminLayout>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
