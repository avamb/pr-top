import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatUserDateOnly } from '../utils/formatDate';

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [subStats, setSubStats] = useState(null);
  const [utmStats, setUtmStats] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

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

      const [statsRes, subStatsRes, utmRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats/users`, { headers }),
        fetch(`${API_URL}/admin/stats/subscriptions`, { headers }),
        fetch(`${API_URL}/admin/stats/utm`, { headers })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (subStatsRes.ok) {
        const data = await subStatsRes.json();
        setSubStats(data);
      }
      if (utmRes.ok) {
        const data = await utmRes.json();
        setUtmStats(data);
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
        <p className="text-secondary text-lg">{t('admin.loadingAdmin')}</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-text">{t('admin.dashboardTitle')}</h2>
          <p className="text-secondary mt-1">{t('admin.dashboardSubtitle')}</p>
        </div>

        {/* User Statistics */}
        <h3 className="text-lg font-semibold text-text mb-4">{t('admin.userStats')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard label={t('admin.therapists')} value={stats?.therapists ?? 0} icon="👨‍⚕️" color="bg-primary/10" />
          <StatCard label={t('admin.clients')} value={stats?.clients ?? 0} icon="👥" color="bg-blue-50" />
          <StatCard label={t('admin.blockedTherapists')} value={stats?.blocked_therapists ?? 0} icon="🚫" color="bg-red-50" />
          <StatCard label={t('admin.auditLogEntries')} value={stats?.audit_log_entries ?? 0} icon="📝" color="bg-gray-100" />
        </div>

        {/* Platform-wide Metrics */}
        <h3 className="text-lg font-semibold text-text mb-4">{t('admin.platformMetrics')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard label={t('admin.sessions')} value={stats?.sessions ?? 0} icon="📋" color="bg-green-50" />
          <StatCard label={t('admin.diaryEntries')} value={stats?.diary_entries ?? 0} icon="📖" color="bg-indigo-50" />
          <StatCard label={t('admin.therapistNotes')} value={stats?.therapist_notes ?? 0} icon="🗒️" color="bg-yellow-50" />
          <StatCard label={t('admin.sosEvents')} value={stats?.sos_events ?? 0} icon="🆘" color="bg-red-50" />
        </div>

        {/* Subscription Statistics */}
        <h3 className="text-lg font-semibold text-text mb-4">{t('admin.subscriptionStats')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard label={t('admin.activeSubscriptions')} value={stats?.subscriptions ?? 0} icon="💳" color="bg-amber-50" />
          <StatCard label={t('admin.trial')} value={stats?.subscription_breakdown?.trial ?? 0} icon="🆓" color="bg-gray-50" />
          <StatCard label={t('admin.basic')} value={stats?.subscription_breakdown?.basic ?? 0} icon="⭐" color="bg-blue-50" />
          <StatCard label={t('admin.pro')} value={stats?.subscription_breakdown?.pro ?? 0} icon="🚀" color="bg-purple-50" />
          <StatCard label={t('admin.premium')} value={stats?.subscription_breakdown?.premium ?? 0} icon="💎" color="bg-amber-50" />
        </div>

        {/* Subscription & Payment Analytics */}
        {subStats && (
          <>
            <h3 className="text-lg font-semibold text-text mb-4">{t('admin.revenueMetrics')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard label={t('admin.mrr')} value={subStats.revenue?.mrr_formatted ?? '$0.00'} icon="💰" color="bg-green-50" />
              <StatCard label={t('admin.totalRevenue')} value={subStats.revenue?.total_revenue_formatted ?? '$0.00'} icon="📈" color="bg-emerald-50" />
              <StatCard label={t('admin.successfulPayments')} value={subStats.revenue?.total_payments ?? 0} icon="✅" color="bg-blue-50" />
              <StatCard label={t('admin.paymentSuccessRate')} value={`${subStats.revenue?.success_rate ?? 100}%`} icon="📊" color="bg-teal-50" />
            </div>

            <h3 className="text-lg font-semibold text-text mb-4">{t('admin.paymentAnalytics')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard label={t('admin.failedPayments')} value={subStats.revenue?.failed_payments ?? 0} icon="❌" color="bg-red-50" />
              <StatCard label={t('admin.refundedPayments')} value={subStats.revenue?.refunded_payments ?? 0} icon="↩️" color="bg-orange-50" />
              <StatCard label={t('admin.canceledSubscriptions')} value={subStats.totals?.canceled ?? 0} icon="🚪" color="bg-gray-100" />
              <StatCard label={t('admin.pastDue')} value={subStats.totals?.past_due ?? 0} icon="⚠️" color="bg-yellow-50" />
            </div>

            {/* Plan Distribution Visual */}
            <h3 className="text-lg font-semibold text-text mb-4">{t('admin.planDistribution')}</h3>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="space-y-4">
                {[
                  { label: t('admin.trial'), count: subStats.plan_distribution?.trial?.active ?? 0, color: 'bg-gray-400' },
                  { label: t('admin.basic'), count: subStats.plan_distribution?.basic?.active ?? 0, color: 'bg-blue-500' },
                  { label: t('admin.pro'), count: subStats.plan_distribution?.pro?.active ?? 0, color: 'bg-purple-500' },
                  { label: t('admin.premium'), count: subStats.plan_distribution?.premium?.active ?? 0, color: 'bg-amber-500' },
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
                <span>{t('admin.totalActive', { count: subStats.totals?.active ?? 0 })}</span>
                {subStats.trials_expiring_soon > 0 && (
                  <span className="ml-4 text-amber-600">
                    ⚠ {t('admin.trialsExpiring', { count: subStats.trials_expiring_soon })}
                  </span>
                )}
              </div>
            </div>

            {/* Recent Payments */}
            {subStats.recent_payments && subStats.recent_payments.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-text mb-4">{t('admin.recentPayments')}</h3>
                <div className="bg-white rounded-lg shadow-md p-6 mb-8 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-stone-500 uppercase">{t('admin.therapist')}</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-stone-500 uppercase">{t('admin.plan')}</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('admin.amount')}</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-stone-500 uppercase">{t('admin.status')}</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('admin.date')}</th>
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
                            {formatUserDateOnly(payment.created_at)}
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

        {/* UTM Attribution Analytics */}
        {utmStats && (
          <>
            <h3 className="text-lg font-semibold text-text mb-4">{t('admin.registrationAttribution')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard label={t('admin.totalRegistrations')} value={utmStats.total_therapists ?? 0} icon="📋" color="bg-indigo-50" />
              <StatCard label={t('admin.withUtm')} value={utmStats.with_utm_tracking ?? 0} icon="🏷️" color="bg-teal-50" />
              <StatCard label={t('admin.directNoUtm')} value={utmStats.without_utm_tracking ?? 0} icon="🔗" color="bg-gray-100" />
            </div>

            {/* Registration Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="text-md font-semibold text-text mb-4">{t('admin.registrationSources')}</h4>
                {utmStats.sources && utmStats.sources.length > 0 ? (
                  <div className="space-y-3">
                    {utmStats.sources.map((s, i) => {
                      const maxCount = utmStats.sources[0]?.count || 1;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-stone-600 w-24 truncate" title={s.source}>{s.source}</span>
                          <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                              style={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-stone-700 w-10 text-right">{s.count}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-stone-400 text-sm">{t('admin.noSourceData')}</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="text-md font-semibold text-text mb-4">{t('admin.utmCampaigns')}</h4>
                {utmStats.campaigns && utmStats.campaigns.length > 0 ? (
                  <div className="space-y-3">
                    {utmStats.campaigns.map((c, i) => {
                      const maxCount = utmStats.campaigns[0]?.count || 1;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-stone-600 w-24 truncate" title={c.campaign}>{c.campaign}</span>
                          <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-purple-500 transition-all duration-500"
                              style={{ width: `${Math.max((c.count / maxCount) * 100, c.count > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-stone-700 w-10 text-right">{c.count}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-stone-400 text-sm">{t('admin.noCampaignData')}</p>
                )}
              </div>
            </div>

            {/* Registration Trends Chart */}
            {utmStats.daily_trends && utmStats.daily_trends.some(d => d.total > 0) && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h4 className="text-md font-semibold text-text mb-4">{t('admin.registrationTrends')}</h4>
                <div className="flex items-end gap-px" style={{ height: '160px' }}>
                  {utmStats.daily_trends.map((day, i) => {
                    const maxTotal = Math.max(...utmStats.daily_trends.map(d => d.total), 1);
                    const height = (day.total / maxTotal) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col justify-end group relative"
                        title={`${day.date}: ${day.total} ${t('admin.registrations')}`}
                      >
                        <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          <div className="font-medium">{day.date}</div>
                          <div>{day.total} {t('admin.registrations')}</div>
                        </div>
                        <div
                          className="bg-indigo-400 hover:bg-indigo-500 rounded-t-sm w-full transition-colors"
                          style={{ height: `${Math.max(height, day.total > 0 ? 4 : 0)}%`, minHeight: day.total > 0 ? '4px' : '0' }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-px mt-1">
                  {utmStats.daily_trends.map((day, i) => (
                    <div key={i} className="flex-1 text-center">
                      {i % 7 === 0 ? (
                        <span className="text-xs text-stone-400">{day.date.slice(5)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-text mb-4">{t('admin.quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/admin/therapists"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <p className="font-medium text-text">{t('admin.manageTherapists')}</p>
              <p className="text-sm text-secondary mt-1">{t('admin.manageTherapistsDesc')}</p>
            </Link>
            <Link
              to="/admin/settings"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <p className="font-medium text-text">{t('admin.platformSettings')}</p>
              <p className="text-sm text-secondary mt-1">{t('admin.platformSettingsDesc')}</p>
            </Link>
            <Link
              to="/admin/logs"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <p className="font-medium text-text">{t('admin.auditLogs')}</p>
              <p className="text-sm text-secondary mt-1">{t('admin.auditLogsDesc')}</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
