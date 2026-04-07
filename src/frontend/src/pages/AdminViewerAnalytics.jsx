import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

function StatCard({ label, value, icon, color, subtext }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-secondary">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
        {subtext && <p className="text-xs text-secondary mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-secondary">{label}</span>
        <span className="font-medium">{value} <span className="text-secondary text-xs">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className={`h-4 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function SimpleBarChart({ data, labelKey, valueKey, title, maxBars = 10 }) {
  if (!data || data.length === 0) return <p className="text-sm text-secondary italic">No data</p>;
  const maxVal = Math.max(...data.slice(0, maxBars).map(d => d[valueKey]));
  return (
    <div>
      {title && <h4 className="text-sm font-medium text-secondary mb-2">{title}</h4>}
      <div className="space-y-1.5">
        {data.slice(0, maxBars).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-secondary w-16 truncate" title={d[labelKey]}>{d[labelKey]}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 rounded-full bg-primary/70 transition-all"
                style={{ width: `${maxVal > 0 ? (d[valueKey] / maxVal * 100) : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium w-8 text-right">{d[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminViewerAnalytics() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_URL}/admin/stats/viewers?range=${range}`;
      if (range === 'custom' && customStart && customEnd) {
        url += `&start=${customStart}&end=${customEnd}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button onClick={fetchData} className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm">
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const funnel = data.conversionFunnel || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {t('viewerAnalytics.title', 'Viewer Analytics')}
          </h1>
          <p className="text-sm text-secondary mt-1">
            {t('viewerAnalytics.subtitle', 'Track anonymous visitors and conversion funnel')}
          </p>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {['today', '7d', '30d'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-secondary hover:bg-gray-200'
              }`}
            >
              {r === 'today' ? t('viewerAnalytics.today', 'Today') :
               r === '7d' ? t('viewerAnalytics.last7d', '7 Days') :
               t('viewerAnalytics.last30d', '30 Days')}
            </button>
          ))}
          <button
            onClick={() => setRange('custom')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              range === 'custom'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-secondary hover:bg-gray-200'
            }`}
          >
            {t('viewerAnalytics.custom', 'Custom')}
          </button>
          {range === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              />
              <span className="text-secondary">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('viewerAnalytics.totalSessions', 'Anonymous Sessions')}
          value={data.totalSessions}
          icon="👤"
          color="bg-blue-50"
        />
        <StatCard
          label={t('viewerAnalytics.registeredViewers', 'Registered Viewers')}
          value={data.totalViewers}
          icon="📧"
          color="bg-green-50"
        />
        <StatCard
          label={t('viewerAnalytics.therapistConversions', 'Therapist Conversions')}
          value={data.therapistConversions}
          icon="🎯"
          color="bg-purple-50"
        />
        <StatCard
          label={t('viewerAnalytics.aiCostPerSession', 'AI Cost / Session')}
          value={`$${data.costPerSession}`}
          icon="💰"
          color="bg-amber-50"
          subtext={`${t('viewerAnalytics.totalTokens', 'Total tokens')}: ${data.totalTokens.toLocaleString()}`}
        />
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-text mb-4">
          {t('viewerAnalytics.conversionFunnel', 'Conversion Funnel')}
        </h3>
        <FunnelBar
          label={t('viewerAnalytics.funnelAnonymous', 'Anonymous Sessions')}
          value={funnel.anonymous || 0}
          total={funnel.anonymous || 1}
          color="bg-blue-400"
        />
        <FunnelBar
          label={t('viewerAnalytics.funnelViewer', 'Registered Viewers (email)')}
          value={funnel.registered_viewer || 0}
          total={funnel.anonymous || 1}
          color="bg-green-400"
        />
        <FunnelBar
          label={t('viewerAnalytics.funnelTherapist', 'Therapist (trial)')}
          value={funnel.therapist || 0}
          total={funnel.anonymous || 1}
          color="bg-purple-400"
        />
        <div className="flex gap-6 mt-3 text-xs text-secondary">
          <span>{t('viewerAnalytics.anonToViewer', 'Anonymous → Viewer')}: <strong>{funnel.anonymous_to_viewer_rate || 0}%</strong></span>
          <span>{t('viewerAnalytics.viewerToTherapist', 'Viewer → Therapist')}: <strong>{funnel.viewer_to_therapist_rate || 0}%</strong></span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages per session */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-text mb-4">
            {t('viewerAnalytics.messagesPerSession', 'Messages per Session')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{data.avgMessagesAnon}</p>
              <p className="text-sm text-secondary mt-1">
                {t('viewerAnalytics.anonymous', 'Anonymous')}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{data.avgMessagesRegistered}</p>
              <p className="text-sm text-secondary mt-1">
                {t('viewerAnalytics.registered', 'Registered')}
              </p>
            </div>
          </div>
        </div>

        {/* Drop-off Points */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-text mb-4">
            {t('viewerAnalytics.dropoffPoints', 'Drop-off Points')}
          </h3>
          <p className="text-xs text-secondary mb-3">
            {t('viewerAnalytics.dropoffDesc', 'Which message # anonymous visitors leave on')}
          </p>
          <SimpleBarChart
            data={data.dropoffPoints}
            labelKey="messageNumber"
            valueKey="sessions"
          />
        </div>

        {/* Languages */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-text mb-4">
            {t('viewerAnalytics.popularLanguages', 'Popular Languages')}
          </h3>
          <SimpleBarChart
            data={data.languages}
            labelKey="language"
            valueKey="count"
          />
        </div>

        {/* Top Questions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-text mb-4">
            {t('viewerAnalytics.topQuestions', 'Top Questions')}
          </h3>
          {data.topQuestions && data.topQuestions.length > 0 ? (
            <div className="space-y-2">
              {data.topQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-xs font-mono text-secondary mt-0.5 w-6">{q.count}×</span>
                  <p className="text-sm text-text flex-1 line-clamp-2">{q.question}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary italic">{t('viewerAnalytics.noData', 'No data yet')}</p>
          )}
        </div>
      </div>

      {/* Daily Sessions Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-text mb-4">
          {t('viewerAnalytics.dailySessions', 'Daily Sessions (Last 30 Days)')}
        </h3>
        {data.dailyStats && data.dailyStats.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-40 min-w-[600px]">
              {data.dailyStats.map((d, i) => {
                const maxSessions = Math.max(...data.dailyStats.map(s => s.sessions));
                const height = maxSessions > 0 ? (d.sessions / maxSessions * 100) : 0;
                const regHeight = maxSessions > 0 ? (d.registered / maxSessions * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {d.date}: {d.sessions} sessions ({d.registered} registered)
                    </div>
                    <div className="w-full flex flex-col items-center" style={{ height: '120px' }}>
                      <div className="w-full flex-1" />
                      <div
                        className="w-full bg-primary/30 rounded-t relative"
                        style={{ height: `${height}%`, minHeight: d.sessions > 0 ? '4px' : '0' }}
                      >
                        {regHeight > 0 && (
                          <div
                            className="absolute bottom-0 w-full bg-green-400 rounded-t"
                            style={{ height: `${(d.registered / d.sessions) * 100}%`, minHeight: '2px' }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[9px] text-secondary transform -rotate-45 origin-top-left mt-1 whitespace-nowrap">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-primary/30" /> {t('viewerAnalytics.allSessions', 'All Sessions')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-400" /> {t('viewerAnalytics.registeredSessions', 'Registered')}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary italic">{t('viewerAnalytics.noData', 'No data yet')}</p>
        )}
      </div>
    </div>
  );
}
