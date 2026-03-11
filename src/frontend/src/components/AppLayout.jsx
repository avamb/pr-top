import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

/**
 * AppLayout wraps authenticated pages with the Sidebar.
 * It reads the user from localStorage and redirects to /login if not authenticated.
 * The children receive the full viewport minus the sidebar width.
 */
export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      navigate('/login');
      return;
    }
    try {
      setUser(JSON.parse(storedUser));
    } catch {
      navigate('/login');
      return;
    }
    setChecked(true);
  }, [navigate]);

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
