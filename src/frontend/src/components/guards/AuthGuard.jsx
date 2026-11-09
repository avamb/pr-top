import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchCurrentUser, clearVerifiedUser } from '../../utils/authSession';

/**
 * AuthGuard - Checks the cookie session with GET /api/auth/me.
 * Redirects to /login when the server says the visitor is not authenticated.
 * (The JWT is an HttpOnly cookie: the SPA never sees or stores it.)
 * Handles cross-tab session sync via storage events on the cached `user`.
 * Passes the authenticated user object to children.
 */
export default function AuthGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  // Cross-tab session sync: listen for localStorage changes from other tabs
  const handleStorageChange = useCallback((e) => {
    if (e.key === 'user' && !e.newValue) {
      // Another tab logged out (or the session expired there)
      clearVerifiedUser();
      setUser(null);
      setChecked(false);
      navigate('/login');
      return;
    }
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
    let cancelled = false;
    fetchCurrentUser().then(({ user: me }) => {
      if (cancelled) return;
      if (!me) {
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      setUser(me);
      setChecked(true);
    });
    return () => { cancelled = true; };
  }, [navigate, location.pathname, location.search]);

  if (!checked || !user) return null;

  // Pass user to children - support both render prop and element patterns
  if (typeof children === 'function') {
    return children({ user });
  }
  return React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { user });
    }
    return child;
  });
}
