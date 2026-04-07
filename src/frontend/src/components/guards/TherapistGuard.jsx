import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api';

/**
 * TherapistGuard - Ensures user has therapist or superadmin role.
 * Client role is blocked from web panel access.
 * Also checks subscription status for therapists (402 redirect).
 * Must be used inside AuthGuard (expects user prop).
 */
export default function TherapistGuard({ user, children }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Client role cannot access the web panel
    if (user.role === 'client') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login', { state: { accessDenied: true } });
      return;
    }

    // Viewer role can only access landing page + assistant chat, not dashboard
    if (user.role === 'viewer') {
      navigate('/', { replace: true });
      return;
    }

    // Must be therapist or superadmin
    if (user.role !== 'therapist' && user.role !== 'superadmin') {
      navigate('/login', { state: { accessDenied: true } });
      return;
    }

    setChecked(true);
  }, [user, navigate]);

  if (!checked) return null;

  // Pass user through to children
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
