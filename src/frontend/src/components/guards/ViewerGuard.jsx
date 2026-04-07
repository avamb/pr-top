import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ViewerGuard - Restricts viewer role to only landing page + assistant chat.
 * Viewers cannot access /dashboard/*, /admin/*, /clients/*, etc.
 * If viewer tries to access a protected route, redirect to landing page.
 * Must be used inside AuthGuard (expects user prop).
 */
export default function ViewerGuard({ user, children }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'viewer') {
      navigate('/', { replace: true });
      return;
    }

    setChecked(true);
  }, [user, navigate]);

  if (!checked) return null;

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
