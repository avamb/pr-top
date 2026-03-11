import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

function ActivityItem({ activity }) {
  const typeLabels = {
    diary_entry: 'Diary Entry',
    session: 'Session',
    sos_event: 'SOS Alert',
    note: 'Note'
  };

  const typeColors = {
    diary_entry: 'bg-blue-100 text-blue-700',
    session: 'bg-green-100 text-green-700',
    sos_event: 'bg-red-100 text-red-700',
    note: 'bg-amber-100 text-amber-700'
  };

  const typeIcons = {
    diary_entry: '\u{1F4D3}',
    session: '\u{1F3A7}',
    sos_event: '\u{1F6A8}',
    note: '\u{1F4DD}'
  };

  const clientName = activity.client_email || activity.client_telegram_id || `Client #${activity.client_id}`;
  const date = new Date(activity.created_at);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <span className="text-xl">{typeIcons[activity.type] || '\u{1F4CB}'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text truncate">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${typeColors[activity.type] || 'bg-gray-100 text-gray-700'}`}>
            {typeLabels[activity.type] || activity.type}
          </span>
          {activity.type === 'diary_entry' && `${activity.entry_type} entry from `}
          {activity.type === 'session' && `Session (${activity.status}) with `}
          {activity.type === 'sos_event' && `Alert (${activity.status}) from `}
          {activity.type === 'note' && 'Note for '}
          <span className="font-medium">{clientName}</span>
        </p>
      </div>
      <span className="text-xs text-secondary whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function SubscriptionBadge({ subscription }) {
  if (!subscription) return null;

  const planColors = {
    trial: 'bg-amber-100 text-amber-800 border-amber-200',
    basic: 'bg-blue-100 text-blue-800 border-blue-200',
    pro: 'bg-purple-100 text-purple-800 border-purple-200',
    premium: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };

  const planName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
  let statusInfo = '';

  if (subscription.plan === 'trial' && subscription.trial_ends_at) {
    const daysLeft = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)));
    statusInfo = ` \u00B7 ${daysLeft} days left`;
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${planColors[subscription.plan] || 'bg-gray-100 text-gray-800'}`}>
      {planName} Plan{statusInfo}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Fetch dashboard data from API
    fetchDashboardData(token);
  }, [navigate]);

  async function fetchDashboardData(token) {
    try {
      setLoading(true);
      setError(null);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch stats and activity in parallel
      const [statsRes, activityRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats`, { headers }),
        fetch(`${API_URL}/dashboard/activity`, { headers })
      ]);

      if (statsRes.status === 401 || activityRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      if (!statsRes.ok) {
        throw new Error(`Stats request failed: ${statsRes.status}`);
      }
      if (!activityRes.ok) {
        throw new Error(`Activity request failed: ${activityRes.status}`);
      }

      const statsData = await statsRes.json();
      const activityData = await activityRes.json();

      setStats(statsData);
      setActivities(activityData.activities || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">PsyLink Dashboard</h1>
          <div className="flex items-center gap-4">
            {stats?.subscription && <SubscriptionBadge subscription={stats.subscription} />}
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

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Failed to load dashboard data: {error}
          </div>
        )}

        {/* Quick Stats Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text mb-4">Quick Stats</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-12"></div>
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Clients"
                value={stats.clients}
                icon={'\u{1F465}'}
                color="bg-blue-50"
              />
              <StatCard
                label="Sessions"
                value={stats.sessions}
                icon={'\u{1F3A7}'}
                color="bg-green-50"
              />
              <StatCard
                label="Notes"
                value={stats.notes}
                icon={'\u{1F4DD}'}
                color="bg-amber-50"
              />
              <StatCard
                label="Active SOS"
                value={stats.active_sos}
                icon={'\u{1F6A8}'}
                color="bg-red-50"
              />
            </div>
          ) : null}
        </section>

        {/* Recent Activity Section */}
        <section>
          <h2 className="text-lg font-semibold text-text mb-4">Recent Activity</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div>
                {activities.map((activity, idx) => (
                  <ActivityItem key={`${activity.type}-${activity.id}-${idx}`} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-secondary text-lg mb-2">No recent activity</p>
                <p className="text-sm text-gray-400">
                  Activity from your clients will appear here. Invite clients to get started!
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
