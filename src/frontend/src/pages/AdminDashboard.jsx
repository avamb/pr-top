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
  const [stats, setStats] = useState(null);
  const [subStats, setSubStats] = useState(null);

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

      const [statsRes, subStatsRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats/users`, { headers }),
        fetch(`${API_URL}/admin/stats/subscriptions`, { headers })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (subStatsRes.ok) {
        const data = await subStatsRes.json();
        setSubStats(data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-lg">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-text">Admin Dashboard</h2>
          <p className="text-secondary mt-1">Platform overview and management</p>
        </div>

        {/* User Statistics */}
        <h3 className="text-lg font-semibold text-text mb-4">User Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Therapists"
            value={stats?.therapists ?? 0}
            icon="👨‍⚕️"
            color="bg-primary/10"
          />
          <StatCard
            label="Clients"
            value={stats?.clients ?? 0}
            icon="👥"
            color="bg-blue-50"
          />
          <StatCard
            label="Blocked Therapists"
            value={stats?.blocked_therapists ?? 0}
            icon="🚫"
            color="bg-red-50"
          />
          <StatCard
            label="Audit Log Entries"
            value={stats?.audit_log_entries ?? 0}
            icon="📝"
            color="bg-gray-100"
          />
        </div>

        {/* Platform-wide Metrics */}
        <h3 className="text-lg font-semibold text-text mb-4">Platform Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Sessions"
            value={stats?.sessions ?? 0}
            icon="📋"
            color="bg-green-50"
          />
          <StatCard
            label="Diary Entries"
            value={stats?.diary_entries ?? 0}
            icon="📖"
            color="bg-indigo-50"
          />
          <StatCard
            label="Therapist Notes"
            value={stats?.therapist_notes ?? 0}
            icon="🗒️"
            color="bg-yellow-50"
          />
          <StatCard
            label="SOS Events"
            value={stats?.sos_events ?? 0}
            icon="🆘"
            color="bg-red-50"
          />
        </div>

        {/* Subscription Statistics */}
        <h3 className="text-lg font-semibold text-text mb-4">Subscription Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            label="Active Subscriptions"
            value={stats?.subscriptions ?? 0}
            icon="💳"
            color="bg-amber-50"
          />
          <StatCard
            label="Trial"
            value={stats?.subscription_breakdown?.trial ?? 0}
            icon="🆓"
            color="bg-gray-50"
          />
          <StatCard
            label="Basic"
            value={stats?.subscription_breakdown?.basic ?? 0}
            icon="⭐"
            color="bg-blue-50"
          />
          <StatCard
            label="Pro"
            value={stats?.subscription_breakdown?.pro ?? 0}
            icon="🚀"
            color="bg-purple-50"
          />
          <StatCard
            label="Premium"
            value={stats?.subscription_breakdown?.premium ?? 0}
            icon="💎"
            color="bg-amber-50"
          />
        </div>

        {/* Subscription & Payment Analytics */}
        {subStats && (
          <>
            <h3 className="text-lg font-semibold text-text mb-4">Revenue Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                label="Monthly Recurring Revenue"
                value={subStats.revenue?.mrr_formatted ?? '$0.00'}
                icon="💰"
                color="bg-green-50"
              />
              <StatCard
                label="Total Revenue"
                value={subStats.revenue?.total_revenue_formatted ?? '$0.00'}
                icon="📈"
                color="bg-emerald-50"
              />
              <StatCard
                label="Successful Payments"
                value={subStats.revenue?.total_payments ?? 0}
                icon="✅"
                color="bg-blue-50"
              />
              <StatCard
                label="Payment Success Rate"
                value={`${subStats.revenue?.success_rate ?? 100}%`}
                icon="📊"
                color="bg-teal-50"
              />
            </div>

            <h3 className="text-lg font-semibold text-text mb-4">Payment Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                label="Failed Payments"
                value={subStats.revenue?.failed_payments ?? 0}
                icon="❌"
                color="bg-red-50"
              />
              <StatCard
                label="Refunded Payments"
                value={subStats.revenue?.refunded_payments ?? 0}
                icon="↩️"
                color="bg-orange-50"
              />
              <StatCard
                label="Canceled Subscriptions"
                value={subStats.totals?.canceled ?? 0}
                icon="🚪"
                color="bg-gray-100"
              />
              <StatCard
                label="Past Due"
                value={subStats.totals?.past_due ?? 0}
                icon="⚠️"
                color="bg-yellow-50"
              />
            </div>

            {/* Plan Distribution Visual */}
            <h3 className="text-lg font-semibold text-text mb-4">Plan Distribution</h3>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="space-y-4">
                {[
                  { label: 'Trial', count: subStats.plan_distribution?.trial?.active ?? 0, color: 'bg-gray-400' },
                  { label: 'Basic', count: subStats.plan_distribution?.basic?.active ?? 0, color: 'bg-blue-500' },
                  { label: 'Pro', count: subStats.plan_distribution?.pro?.active ?? 0, color: 'bg-purple-500' },
                  { label: 'Premium', count: subStats.plan_distribution?.premium?.active ?? 0, color: 'bg-amber-500' },
                ].map(plan => {
                  const total = subStats.totals?.active || 1;
                  const pct = ((plan.count / total) * 100).toFixed(0);
                  return (
                    <div key={plan.label} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-stone-600 w-20">{plan.label}</span>
                      <div className="flex-1 bg-stone-100 rounded-full h-6 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${plan.color}`}
                          style={{ width: `${Math.max(plan.count > 0 ? 2 : 0, (plan.count / total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-stone-700 w-16 text-right">{plan.count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
                <span>Total active: <strong className="text-stone-800">{subStats.totals?.active ?? 0}</strong></span>
                {subStats.trials_expiring_soon > 0 && (
                  <span className="ml-4 text-amber-600">
                    ⚠ {subStats.trials_expiring_soon} trial(s) expiring within 7 days
                  </span>
                )}
              </div>
            </div>

            {/* Recent Payments */}
            {subStats.recent_payments && subStats.recent_payments.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-text mb-4">Recent Payments</h3>
                <div className="bg-white rounded-lg shadow-md p-6 mb-8 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Therapist</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-stone-500 uppercase">Plan</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">Amount</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-stone-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subStats.recent_payments.map(payment => (
                        <tr key={payment.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="px-4 py-3 text-sm text-stone-700">{payment.therapist_email}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="capitalize bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs font-medium">
                              {payment.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-stone-800">
                            ${(payment.amount / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              payment.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                              payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-stone-500">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

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
