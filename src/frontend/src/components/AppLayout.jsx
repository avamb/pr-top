import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext';

const API_URL = 'http://localhost:3001/api';

/**
 * AppLayout wraps authenticated pages with the Sidebar.
 * It reads the user from localStorage and redirects to /login if not authenticated.
 * Checks subscription status and redirects expired trials to /subscription.
 * Listens for cross-tab storage events to maintain session consistency.
 * The children receive the full viewport minus the sidebar width.
 */
export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  // Cross-tab session sync: listen for localStorage changes from other tabs
  const handleStorageChange = useCallback((e) => {
    // If token or user was removed in another tab, redirect to login
    if (e.key === 'token' && !e.newValue) {
      setUser(null);
      setChecked(false);
      navigate('/login');
      return;
    }
    if (e.key === 'user' && !e.newValue) {
      setUser(null);
      setChecked(false);
      navigate('/login');
      return;
    }
    // If user data was updated in another tab, sync the state
    if (e.key === 'user' && e.newValue) {
      try {
        const updatedUser = JSON.parse(e.newValue);
        setUser(updatedUser);
      } catch {
        // Ignore parse errors
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [handleStorageChange]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    let parsedUser;
    try {
      parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } catch {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }

    // Client role cannot access the web panel - redirect to login with error
    if (parsedUser.role === 'client') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login', { state: { accessDenied: true } });
      return;
    }

    // Therapist role cannot access admin pages - redirect to dashboard
    if (parsedUser.role !== 'superadmin' && location.pathname.startsWith('/admin')) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Check subscription status for therapists (not on subscription page itself)
    if (parsedUser.role === 'therapist' && !location.pathname.startsWith('/subscription')) {
      fetch(`${API_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.status === 402) {
          setSubscriptionExpired(true);
          navigate('/subscription', { state: { expired: true } });
        }
      }).catch(() => {
        // Don't block on network errors
      });
    }

    setChecked(true);
  }, [navigate, location.pathname]);

  if (!checked || !user) return null;

  return (
    <UnsavedChangesProvider>
      <div className="min-h-screen bg-background">
        <Sidebar user={user} />
        {/* Main content area offset by sidebar width */}
        <div className="ml-60">
          {typeof children === 'function' ? children({ user }) : children}
        </div>
      </div>
    </UnsavedChangesProvider>
  );
}
