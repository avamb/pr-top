import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AdminGuard - Ensures user has superadmin role.
 * Non-superadmin users are redirected to /dashboard.
 * Must be used inside AuthGuard (expects user prop).
 */
export default function AdminGuard({ user, children }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (user.role !== 'superadmin') {
      navigate('/dashboard', { replace: true });
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
