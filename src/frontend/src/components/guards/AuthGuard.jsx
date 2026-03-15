import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * AuthGuard - Checks for valid authentication token.
 * Redirects to /login if no token is found or token is invalid.
 * Handles cross-tab session sync via storage events.
 * Passes the authenticated user object to children.
 */
export default function AuthGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  // Cross-tab session sync: listen for localStorage changes from other tabs
  const handleStorageChange = useCallback((e) => {
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
    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setChecked(true);
    } catch {
      navigate('/login', { state: { from: location.pathname + location.search } });
    }
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
