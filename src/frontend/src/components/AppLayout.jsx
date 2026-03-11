import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const API_URL = 'http://localhost:3001/api';

/**
 * AppLayout wraps authenticated pages with the Sidebar.
 * It reads the user from localStorage and redirects to /login if not authenticated.
 * Checks subscription status and redirects expired trials to /subscription.
 * The children receive the full viewport minus the sidebar width.
 */
export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      navigate('/login');
      return;
    }
    let parsedUser;
    try {
      parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } catch {
      navigate('/login');
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
    <div className="min-h-screen bg-background">
      <Sidebar user={user} />
      {/* Main content area offset by sidebar width */}
      <div className="ml-60">
        {typeof children === 'function' ? children({ user }) : children}
      </div>
    </div>
  );
}
