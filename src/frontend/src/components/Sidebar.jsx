import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import LanguageSwitcher from './LanguageSwitcher';
import { useNotificationCount } from './NotificationToast';

/* ── SVG Icons ────────────────────────────────────────── */
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const ClientsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const ExercisesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const GuideIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
  </svg>
);

const SubscriptionIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const AdminOverviewIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
  </svg>
);

const AdminTherapistsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
);

const AdminSettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const AuditLogIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const SystemLogIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const AIUsageIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
  </svg>
);

const AIModelsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>
);

const CachedAnswersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
  </svg>
);

const UmamiAnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);

/* ── Nav Items by Role ────────────────────────────────── */
const therapistNavItems = [
  { key: 'dashboard', path: '/dashboard', icon: DashboardIcon, labelKey: 'nav.dashboard' },
  { key: 'clients', path: '/clients', icon: ClientsIcon, labelKey: 'nav.clients' },
  { key: 'exercises', path: '/exercises', icon: ExercisesIcon, labelKey: 'nav.exercises' },
  { key: 'analytics', path: '/analytics', icon: AnalyticsIcon, labelKey: 'nav.analytics' },
  { key: 'guide', path: '/dashboard/guide', icon: GuideIcon, labelKey: 'nav.guide' },
  { key: 'subscription', path: '/subscription', icon: SubscriptionIcon, labelKey: 'nav.subscription' },
  { key: 'settings', path: '/settings', icon: SettingsIcon, labelKey: 'nav.settings' },
];

const adminNavItems = [
  { key: 'admin-overview', path: '/admin', icon: AdminOverviewIcon, labelKey: 'nav.adminOverview', section: 'admin' },
  { key: 'admin-therapists', path: '/admin/therapists', icon: AdminTherapistsIcon, labelKey: 'nav.adminTherapists', section: 'admin' },
  { key: 'admin-settings', path: '/admin/settings', icon: AdminSettingsIcon, labelKey: 'nav.adminSettings', section: 'admin' },
  { key: 'admin-logs', path: '/admin/logs', icon: AuditLogIcon, labelKey: 'nav.adminLogs', section: 'admin' },
  { key: 'admin-system-logs', path: '/admin/system-logs', icon: SystemLogIcon, labelKey: 'nav.adminSystemLogs', section: 'admin' },
  { key: 'admin-ai-usage', path: '/admin/ai-usage', icon: AIUsageIcon, labelKey: 'nav.adminAIUsage', section: 'admin' },
  { key: 'admin-ai-models', path: '/admin/ai-models', icon: AIModelsIcon, labelKey: 'nav.adminAIModels', section: 'admin' },
  { key: 'admin-cached-answers', path: '/admin/cached-answers', icon: CachedAnswersIcon, labelKey: 'nav.adminCachedAnswers', section: 'admin' },
  { key: 'admin-umami', path: '__umami_external__', icon: UmamiAnalyticsIcon, labelKey: 'nav.adminUmami', section: 'admin', external: true },
];

/* ── Helper: is active? ───────────────────────────────── */
function isActive(itemPath, currentPath) {
  if (itemPath === '/dashboard' && currentPath === '/dashboard') return true;
  if (itemPath === '/admin' && currentPath === '/admin') return true;
  // For other items, match prefix but not the root paths
  if (itemPath !== '/dashboard' && itemPath !== '/admin') {
    return currentPath.startsWith(itemPath);
  }
  return false;
}

/* ═══════════════════════════════════════════════════════ */
/*                     Sidebar Component                   */
/* ═══════════════════════════════════════════════════════ */
export default function Sidebar({ user, isOpen, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { confirmNavigation } = useUnsavedChanges();
  const { count: notificationCount, clearCount: clearNotifications } = useNotificationCount();

  const safeNavigate = (path) => {
    if (path === location.pathname) return;
    if (!confirmNavigation()) return;
    navigate(path);
    // Close sidebar on mobile after navigation
    if (onToggle) onToggle(false);
  };

  const handleLogout = () => {
    if (!confirmNavigation()) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (onToggle) onToggle(false);
    navigate('/');
  };

  const isSuperadmin = user?.role === 'superadmin';

  // Build nav items
  const mainItems = therapistNavItems;
  const extraItems = isSuperadmin ? adminNavItems : [];

  return (
    <>
      {/* Overlay for mobile/tablet */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => onToggle && onToggle(false)}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Sidebar navigation"
        className={`fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-40 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-xl font-bold text-primary tracking-tight">{t('brand')}</span>
        {isSuperadmin && (
          <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase">
            Admin
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {mainItems.map(item => {
            const active = isActive(item.path, location.pathname);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  onClick={() => safeNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon />
                  <span className="flex-1">{t(item.labelKey)}</span>
                  {item.key === 'dashboard' && notificationCount > 0 && (
                    <span
                      className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1"
                      title={t('notifications.unreadCount', { count: notificationCount })}
                      onClick={(e) => { e.stopPropagation(); clearNotifications(); }}
                    >
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Admin section */}
        {extraItems.length > 0 && (
          <>
            <div className="my-4 border-t border-gray-100" />
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {t('nav.adminSection')}
            </p>
            <ul className="space-y-1">
              {extraItems.map(item => {
                const active = isActive(item.path, location.pathname);
                const Icon = item.icon;

                // External links (e.g., Umami dashboard) open in new tab
                if (item.external) {
                  const umamiUrl = window.__UMAMI_DASHBOARD_URL__ || 'https://app.pr-top.com';
                  return (
                    <li key={item.key}>
                      <a
                        href={umamiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                      >
                        <Icon />
                        {t(item.labelKey)}
                        <svg className="w-3.5 h-3.5 ml-auto text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
                    <button
                      onClick={() => safeNavigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                        active
                          ? 'bg-red-50 text-red-700'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon />
                      {t(item.labelKey)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-3 py-4 space-y-2">
        <div className="px-3 flex items-center justify-between">
          <span className="text-xs text-stone-500 truncate">{user?.email}</span>
          <LanguageSwitcher compact persistToServer dropUp />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        >
          <LogoutIcon />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
    </>
  );
}
