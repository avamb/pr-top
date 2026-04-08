import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TimezoneDetectionBanner from './TimezoneDetectionBanner';
import AssistantChatButton from './AssistantChatButton';
import AssistantChatPanel from './AssistantChatPanel';
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext';
import { setupSessionExpiredHandler } from '../utils/fetchApi';
// Assistant chat state is now managed via Zustand store (stores/assistantStore.js)

const API_URL = '/api';

/**
 * AppLayout wraps authenticated pages with the Sidebar.
 * Auth/role checks are handled by route guards (AuthGuard, TherapistGuard, AdminGuard).
 * AppLayout handles: sidebar rendering, subscription status check, mobile hamburger.
 * Receives `user` prop from the guard chain.
 */
export default function AppLayout({ user, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const subscriptionCheckedRef = useRef(false);

  // Global handler: redirect to login when session expires (401 from any API call)
  useEffect(() => {
    return setupSessionExpiredHandler(navigate);
  }, [navigate]);

  // Check subscription status once per mount (not on every navigation)
  useEffect(() => {
    if (!user || user.role !== 'therapist') return;
    if (location.pathname.startsWith('/subscription')) return;
    if (subscriptionCheckedRef.current) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    subscriptionCheckedRef.current = true;

    fetch(`${API_URL}/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.status === 402) {
        navigate('/subscription', { state: { expired: true } });
      }
    }).catch(() => {
      // Don't block on network errors
    });
  }, [user, navigate, location.pathname]);

  // If user not passed yet (guards haven't resolved), show nothing
  if (!user) return null;

  return (
    <UnsavedChangesProvider>
      <div className="min-h-screen bg-background">
        <Sidebar user={user} isOpen={sidebarOpen} onToggle={setSidebarOpen} />

        {/* Hamburger button for mobile/tablet (below lg breakpoint) */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-20 lg:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
          <span className="ml-3 text-lg font-bold text-primary">PR-TOP</span>
        </div>

        {/* Main content area - offset by sidebar on lg+, top padding on mobile/tablet for hamburger bar */}
        <div className="lg:ml-60 pt-14 lg:pt-0">
          <TimezoneDetectionBanner user={user} />
          {typeof children === 'function' ? children({ user }) : children}
        </div>

        {/* Floating assistant chat button - visible on all authenticated pages */}
        <AssistantChatButton />

        {/* Assistant chat side panel */}
        <AssistantChatPanel />
      </div>
    </UnsavedChangesProvider>
  );
}
