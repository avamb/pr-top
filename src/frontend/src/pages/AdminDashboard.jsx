import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-secondary">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    therapists: 0,
    clients: 0,
    sessions: 0,
    subscriptions: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Verify user is superadmin
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        if (data.user.role !== 'superadmin') {
          navigate('/dashboard');
          return;
        }
        setUser(data.user);
        loadStats(token);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      });
  }, [navigate]);

  const loadStats = async (token) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch admin stats
      const [therapistsRes, statsRes] = await Promise.allSettled([
        fetch(`${API_URL}/admin/therapists`, { headers }),
        fetch(`${API_URL}/admin/stats/users`, { headers })
      ]);

      let therapistCount = 0;
      if (therapistsRes.status === 'fulfilled' && therapistsRes.value.ok) {
        const data = await therapistsRes.value.json();
        therapistCount = data.therapists ? data.therapists.length : 0;
      }

      let userStats = {};
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        userStats = await statsRes.value.json();
      }

      setStats({
        therapists: therapistCount,
        clients: userStats.clients || 0,
        sessions: userStats.sessions || 0,
        subscriptions: userStats.subscriptions || 0
      });
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-secondary text-lg">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">PsyLink</h1>
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full uppercase">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-secondary">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-secondary hover:text-error transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation */}
      <nav aria-label="Admin navigation" className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3">
            <span className="text-primary font-medium border-b-2 border-primary pb-3 -mb-px">
              Overview
            </span>
            <Link to="/admin/therapists" className="text-secondary hover:text-primary transition-colors pb-3 -mb-px">
              Therapists
            </Link>
            <Link to="/admin/settings" className="text-secondary hover:text-primary transition-colors pb-3 -mb-px">
              Settings
            </Link>
            <Link to="/admin/logs" className="text-secondary hover:text-primary transition-colors pb-3 -mb-px">
              Audit Logs
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-text">Admin Dashboard</h2>
          <p className="text-secondary mt-1">Platform overview and management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Therapists"
            value={stats.therapists}
            icon="👨‍⚕️"
            color="bg-primary/10"
          />
          <StatCard
            label="Clients"
            value={stats.clients}
            icon="👥"
            color="bg-blue-50"
          />
          <StatCard
            label="Sessions"
            value={stats.sessions}
            icon="📋"
            color="bg-green-50"
          />
          <StatCard
            label="Subscriptions"
            value={stats.subscriptions}
            icon="💳"
            color="bg-amber-50"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-text mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/admin/therapists"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <p className="font-medium text-text">Manage Therapists</p>
              <p className="text-sm text-secondary mt-1">View, block, or unblock therapists</p>
            </Link>
            <Link
              to="/admin/settings"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <p className="font-medium text-text">Platform Settings</p>
              <p className="text-sm text-secondary mt-1">Configure trial, limits, pricing</p>
            </Link>
            <Link
              to="/admin/logs"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <p className="font-medium text-text">Audit Logs</p>
              <p className="text-sm text-secondary mt-1">Review security and activity logs</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
