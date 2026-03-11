import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(storedUser));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">PsyLink Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-secondary">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-text transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Welcome, Therapist!</h2>
          <p className="text-secondary">
            Your dashboard is being set up. You are logged in as <strong>{user.email}</strong> with role <strong>{user.role}</strong>.
          </p>
          <div className="mt-4 p-4 bg-primary-50 rounded-md">
            <p className="text-sm text-primary-700">
              Your trial subscription is active. Explore PsyLink to manage your clients and sessions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
