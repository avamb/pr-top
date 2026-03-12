import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatUserDateOnly } from '../utils/formatDate';

const API = 'http://localhost:3001/api';

function BarChart({ data, maxValue, label, color }) {
  if (!data || data.length === 0) return null;
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-1">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-stone-500 w-20 text-right truncate" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 bg-stone-100 rounded-full h-5 relative overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${color}`}
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-stone-700 w-8 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityTimeline({ dailyActivity, days }) {
  const { t } = useTranslation();
  if (!dailyActivity || dailyActivity.length === 0) return null;

  const maxTotal = Math.max(...dailyActivity.map(d => d.total), 1);
  // Show last N days in the chart
  const recentDays = dailyActivity.slice(-Math.min(days, 30));

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="flex items-end gap-px" style={{ height: '200px' }}>
        {recentDays.map((day, i) => {
          const height = (day.total / maxTotal) * 100;
          const diaryHeight = day.diary_entries > 0 ? (day.diary_entries / day.total) * height : 0;
          const sessionHeight = day.sessions > 0 ? (day.sessions / day.total) * height : 0;
          const noteHeight = day.notes > 0 ? (day.notes / day.total) * height : 0;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end group relative"
              title={`${day.date}\nDiary: ${day.diary_entries}\nSessions: ${day.sessions}\nNotes: ${day.notes}`}
            >
              {/* Tooltip on hover */}
              <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                <div className="font-medium">{day.date}</div>
                <div>Diary: {day.diary_entries}</div>
                <div>Sessions: {day.sessions}</div>
                <div>Notes: {day.notes}</div>
              </div>

              {/* Stacked bar */}
              {day.total > 0 ? (
                <div className="flex flex-col w-full">
                  {day.notes > 0 && (
                    <div
                      className="bg-amber-400 rounded-t-sm w-full"
                      style={{ height: `${noteHeight}%`, minHeight: '2px' }}
                    />
                  )}
                  {day.sessions > 0 && (
                    <div
                      className="bg-green-400 w-full"
                      style={{ height: `${sessionHeight}%`, minHeight: '2px' }}
                    />
                  )}
                  {day.diary_entries > 0 && (
                    <div
                      className="bg-blue-400 rounded-b-sm w-full"
                      style={{ height: `${diaryHeight}%`, minHeight: '2px' }}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-stone-100 rounded-sm w-full" style={{ height: '2px' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* X-axis labels - show every 7th day */}
      <div className="flex gap-px mt-1">
        {recentDays.map((day, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 7 === 0 ? (
              <span className="text-xs text-stone-400">{day.date.slice(5)}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-400" />
          <span className="text-xs text-stone-600">{t('analytics.diary')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-400" />
          <span className="text-xs text-stone-600">{t('analytics.sessions')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-400" />
          <span className="text-xs text-stone-600">{t('analytics.notes')}</span>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    fetchAnalytics();
  }, [days]);

  async function fetchAnalytics() {
    const token = localStorage.getItem('token');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/dashboard/analytics?days=${days}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">{t('analytics.title')}</h2>
            <p className="text-sm text-stone-500 mt-1">{t('analytics.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  days === d
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button onClick={fetchAnalytics} className="ml-2 underline">{t('analytics.retry')}</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-24 mb-2" />
                <div className="h-8 bg-stone-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : analytics ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-5">
                <p className="text-sm text-stone-500 mb-1">{t('analytics.totalActivity')}</p>
                <p className="text-3xl font-bold text-stone-800">{analytics.totals.total}</p>
                <p className="text-xs text-stone-400 mt-1">{t('analytics.lastDays', { days })}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-5">
                <p className="text-sm text-stone-500 mb-1">{t('analytics.diaryEntries')}</p>
                <p className="text-3xl font-bold text-blue-600">{analytics.totals.diary_entries}</p>
                <p className="text-xs text-stone-400 mt-1">{t('analytics.fromClients')}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-5">
                <p className="text-sm text-stone-500 mb-1">{t('analytics.sessions')}</p>
                <p className="text-3xl font-bold text-green-600">{analytics.totals.sessions}</p>
                <p className="text-xs text-stone-400 mt-1">{t('analytics.recorded')}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-5">
                <p className="text-sm text-stone-500 mb-1">{t('analytics.notes')}</p>
                <p className="text-3xl font-bold text-amber-600">{analytics.totals.notes}</p>
                <p className="text-xs text-stone-400 mt-1">{t('analytics.created')}</p>
              </div>
            </div>

            {/* Activity Timeline Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-8">
              <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('analytics.dailyActivity', { days })}</h3>
              {analytics.daily_activity.some(d => d.total > 0) ? (
                <ActivityTimeline dailyActivity={analytics.daily_activity} days={days} />
              ) : (
                <p className="text-stone-400 text-center py-12">{t('analytics.noActivityPeriod')}</p>
              )}
            </div>

            {/* Session Frequency */}
            {analytics.session_frequency && (
              <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-8">
                <h3 className="text-lg font-semibold text-stone-800 mb-4">
                  {t('analytics.sessionFrequency', 'Session Frequency')}
                </h3>

                {/* Session frequency summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-sm text-green-700 mb-1">{t('analytics.totalSessionsPeriod', 'Total Sessions')}</p>
                    <p className="text-2xl font-bold text-green-800">{analytics.session_frequency.total_sessions}</p>
                    <p className="text-xs text-green-600 mt-1">{t('analytics.lastDays', { days })}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-sm text-green-700 mb-1">{t('analytics.sessionsPerWeek', 'Sessions / Week')}</p>
                    <p className="text-2xl font-bold text-green-800">{analytics.session_frequency.sessions_per_week}</p>
                    <p className="text-xs text-green-600 mt-1">{t('analytics.average', 'average')}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-sm text-green-700 mb-1">{t('analytics.daysWithSessions', 'Days with Sessions')}</p>
                    <p className="text-2xl font-bold text-green-800">
                      {analytics.session_frequency.days_with_sessions}/{analytics.session_frequency.total_days}
                    </p>
                    <p className="text-xs text-green-600 mt-1">{t('analytics.daysRatio', 'days')}</p>
                  </div>
                </div>

                {/* Weekly session bar chart */}
                {analytics.session_frequency.weekly_breakdown.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-stone-600 mb-3">{t('analytics.weeklyBreakdown', 'Weekly Breakdown')}</h4>
                    <div className="flex items-end gap-2" style={{ height: '150px' }}>
                      {analytics.session_frequency.weekly_breakdown.map((week, i) => {
                        const maxWeekSessions = Math.max(
                          ...analytics.session_frequency.weekly_breakdown.map(w => w.sessions),
                          1
                        );
                        const height = (week.sessions / maxWeekSessions) * 100;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center justify-end group relative"
                          >
                            {/* Tooltip */}
                            <div className="hidden group-hover:block absolute bottom-full mb-2 bg-stone-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                              <div>{week.week_start} — {week.week_end}</div>
                              <div>{week.sessions} {week.sessions === 1 ? 'session' : 'sessions'}</div>
                            </div>
                            <div
                              className="bg-green-400 hover:bg-green-500 rounded-t w-full transition-colors"
                              style={{ height: `${Math.max(height, week.sessions > 0 ? 4 : 0)}%`, minHeight: week.sessions > 0 ? '4px' : '0' }}
                            />
                            <span className="text-xs text-stone-400 mt-1 truncate w-full text-center" title={week.week_start}>
                              {week.week_start.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Per-client session frequency */}
                {analytics.session_frequency.per_client.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-stone-600 mb-3">{t('analytics.perClientFrequency', 'Per-Client Session Frequency')}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-stone-50 border-b border-stone-200">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-stone-500 uppercase">{t('analytics.client', 'Client')}</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.sessions', 'Sessions')}</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.perWeek', 'Per Week')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.session_frequency.per_client.map(client => (
                            <tr
                              key={client.id}
                              className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
                              onClick={() => navigate(`/clients/${client.id}`)}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-teal-600 hover:underline">{client.name}</td>
                              <td className="px-4 py-3 text-sm text-right">
                                <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                  {client.sessions}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-stone-600">{client.sessions_per_week}/wk</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {analytics.session_frequency.total_sessions === 0 && (
                  <p className="text-stone-400 text-center py-8">{t('analytics.noSessionsPeriod', 'No sessions recorded in this period')}</p>
                )}
              </div>
            )}

            {/* Client Activity Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
              <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('analytics.clientBreakdown')}</h3>
              {analytics.client_activity.length > 0 ? (
                <div className="space-y-6">
                  {/* Horizontal bar chart for each client */}
                  <BarChart
                    data={analytics.client_activity.map(c => ({
                      label: c.name.split('@')[0],
                      value: c.total
                    }))}
                    color="bg-teal-500"
                    label="Total Activity"
                  />

                  {/* Detailed table */}
                  <div className="overflow-x-auto mt-6">
                    <table className="w-full">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-stone-500 uppercase">{t('analytics.client')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.diary')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.sessions')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.notes')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.total')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-stone-500 uppercase">{t('analytics.lastActive')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.client_activity.map(client => (
                          <tr
                            key={client.id}
                            className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/clients/${client.id}`)}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-teal-600 hover:underline">
                              {client.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-stone-600">
                              {client.diary_entries > 0 && (
                                <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                                  {client.diary_entries}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-stone-600">
                              {client.sessions > 0 && (
                                <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                  {client.sessions}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-stone-600">
                              {client.notes > 0 && (
                                <span className="inline-block bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">
                                  {client.notes}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-stone-800">
                              {client.total}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-stone-400">
                              {client.last_activity
                                ? formatUserDateOnly(client.last_activity)
                                : t('clientList.noActivity')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-stone-400 text-center py-12">{t('analytics.noClientsLinked')}</p>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
