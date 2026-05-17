// T-25: Client engagement analytics panel (feature #383)
//
// Renders aggregate metrics over a client's assignment reports:
//   - KPI cards: total reports, avg length, consistency, span days
//   - Reports-per-day timeline (bar chart)
//   - Avg-length-per-day series (line on top of the timeline bars)
//   - Gaps + cadence breakdown
//
// Data: GET /api/clients/:id/engagement?window={days|all}
// Charts are hand-rolled SVG/CSS (no recharts dependency at runtime —
// the same lightweight approach Analytics.jsx already uses).

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatUserDateOnly } from '../utils/formatDate';

const API = '/api';

const WINDOW_OPTIONS = [
  { value: 30, key: 'windowDays30' },
  { value: 90, key: 'windowDays90' },
  { value: 180, key: 'windowDays180' },
  { value: 365, key: 'windowDays365' },
  { value: 'all', key: 'windowAll' },
];

function classifyScore(score) {
  if (score == null) return 'unknown';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function ConsistencyMeter({ score, label }) {
  const pct = score == null ? 0 : Math.round(score * 100);
  const cls = classifyScore(score);
  const color = cls === 'high' ? 'bg-emerald-500'
    : cls === 'medium' ? 'bg-amber-500'
      : cls === 'low' ? 'bg-rose-500'
        : 'bg-stone-300';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</span>
        <span className="text-2xl font-semibold text-stone-800" data-testid="engagement-consistency-score">
          {score == null ? '—' : pct + '%'}
        </span>
      </div>
      <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, testid }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-stone-800" data-testid={testid}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

/**
 * TimelineChart — stacked bars (text + voice) over time, with an overlaid
 * "average characters per day" line. Buckets are individual days; if the
 * range is wider than 60 days, days are grouped into weekly buckets so
 * the chart stays legible.
 */
function TimelineChart({ timeline, label, labelAvgChars }) {
  const { t } = useTranslation();
  const bucketed = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    if (timeline.length <= 60) return timeline.map((d) => ({ ...d, bucketKey: d.date }));
    // Group into weekly buckets (ISO Monday-start) when there are too many
    // days to render individually.
    const out = new Map();
    for (const d of timeline) {
      const dt = new Date(d.date + 'T00:00:00Z');
      if (Number.isNaN(dt.getTime())) continue;
      const dayIdx = dt.getUTCDay(); // 0..6, Sunday=0
      const offset = (dayIdx + 6) % 7; // 0..6, Monday=0
      const monday = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() - offset));
      const key = monday.toISOString().slice(0, 10);
      if (!out.has(key)) {
        out.set(key, { date: key, count: 0, text: 0, voice: 0, total_chars: 0 });
      }
      const b = out.get(key);
      b.count += d.count;
      b.text += d.text;
      b.voice += d.voice;
      b.total_chars += d.total_chars;
    }
    return Array.from(out.values())
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((b) => ({
        ...b,
        bucketKey: b.date,
        avg_chars: b.count > 0 ? Math.round(b.total_chars / b.count) : 0,
      }));
  }, [timeline]);

  if (bucketed.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-6 text-sm text-stone-500">
        {t('analytics.engagement.noData')}
      </div>
    );
  }

  const maxCount = Math.max(...bucketed.map((b) => b.count), 1);
  const maxAvg = Math.max(...bucketed.map((b) => b.avg_chars || 0), 1);

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-stone-700">{label}</h4>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-teal-500"></span>
            {t('analytics.engagement.legendText')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-400"></span>
            {t('analytics.engagement.legendVoice')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-amber-500"></span>
            {labelAvgChars}
          </span>
        </div>
      </div>

      <div className="relative" style={{ height: '200px' }}>
        <div className="flex items-end gap-px h-full">
          {bucketed.map((b, i) => {
            const totalH = (b.count / maxCount) * 100;
            const textH = b.count > 0 ? (b.text / b.count) * totalH : 0;
            const voiceH = b.count > 0 ? (b.voice / b.count) * totalH : 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end group relative min-w-[4px]"
                title={`${b.date} • ${t('analytics.engagement.reportsCount', { count: b.count })}`}
              >
                <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  <div className="font-medium">{b.date}</div>
                  <div>{t('analytics.engagement.legendText')}: {b.text}</div>
                  <div>{t('analytics.engagement.legendVoice')}: {b.voice}</div>
                  <div>{t('analytics.engagement.avgChars')}: {b.avg_chars || 0}</div>
                </div>
                <div
                  className="bg-indigo-400 transition-all duration-500"
                  style={{ height: `${voiceH}%` }}
                />
                <div
                  className="bg-teal-500 transition-all duration-500"
                  style={{ height: `${textH}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Overlay polyline for avg chars per day */}
        <svg
          className="absolute inset-0 pointer-events-none"
          viewBox={`0 0 ${bucketed.length} 100`}
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
            points={bucketed
              .map((b, i) => {
                const x = i + 0.5;
                const y = 100 - ((b.avg_chars || 0) / maxAvg) * 100;
                return `${x},${y}`;
              })
              .join(' ')}
          />
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-xs text-stone-400">
        <span>{bucketed[0].date}</span>
        <span>{bucketed[bucketed.length - 1].date}</span>
      </div>
    </div>
  );
}

/**
 * GapBarList — horizontal bars for the N largest gaps between consecutive
 * reports. Helps the therapist spot long silences.
 */
function GapBarList({ gaps, label }) {
  const { t } = useTranslation();
  const ranked = useMemo(() => {
    if (!gaps || gaps.length === 0) return [];
    return gaps
      .map((g, i) => ({ idx: i + 1, gap: g }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8);
  }, [gaps]);

  if (ranked.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-6 text-sm text-stone-500">
        {t('analytics.engagement.notEnoughGaps')}
      </div>
    );
  }

  const max = ranked[0].gap || 1;
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-stone-700 mb-3">{label}</h4>
      <div className="space-y-1">
        {ranked.map((r) => (
          <div key={r.idx} className="flex items-center gap-2">
            <span className="text-xs text-stone-500 w-10 text-right">#{r.idx}</span>
            <div className="flex-1 bg-stone-100 rounded-full h-4 relative overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-400"
                style={{ width: `${(r.gap / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-stone-700 w-20 text-right">
              {t('analytics.engagement.daysShort', { days: r.gap.toFixed(1) })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * EngagementPanel — top-level component mounted under the "Engagement" tab
 * in ClientDetail.
 *
 * Props:
 *   clientId: number — the client whose engagement to fetch.
 */
function EngagementPanel({ clientId }) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEngagement = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const param = windowDays === 'all' ? 'all' : String(windowDays);
      const res = await fetch(`${API}/clients/${clientId}/engagement?window=${encodeURIComponent(param)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body && body.error) msg = body.error;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || t('analytics.engagement.errorLoad'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, windowDays, t]);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  const summary = data && data.summary;
  const consistency = data && data.consistency;
  const timeline = (data && data.timeline) || [];

  return (
    <div className="space-y-6" data-testid="engagement-panel">
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-stone-800">
              {t('analytics.engagement.title')}
            </h3>
            <p className="text-sm text-stone-500 mt-1">
              {t('analytics.engagement.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-stone-500" htmlFor="engagement-window">
              {t('analytics.engagement.window')}
            </label>
            <select
              id="engagement-window"
              value={windowDays}
              onChange={(e) => {
                const v = e.target.value;
                setWindowDays(v === 'all' ? 'all' : parseInt(v, 10));
              }}
              className="px-3 py-1.5 border border-stone-300 rounded text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="engagement-window-select"
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`analytics.engagement.${o.key}`)}
                </option>
              ))}
            </select>
            <button
              onClick={fetchEngagement}
              className="px-3 py-1.5 text-sm rounded bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200"
              disabled={loading}
            >
              {loading ? t('analytics.engagement.loading') : t('analytics.engagement.refresh')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="mt-6 text-sm text-stone-500">{t('analytics.engagement.loading')}</div>
        )}

        {!loading && data && summary && summary.total_reports === 0 && (
          <div className="mt-6 p-6 bg-stone-50 rounded-lg text-sm text-stone-500 text-center">
            {t('analytics.engagement.empty')}
          </div>
        )}
      </div>

      {data && summary && summary.total_reports > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label={t('analytics.engagement.totalReports')}
              value={summary.total_reports}
              hint={t('analytics.engagement.acrossAssignments', { count: summary.unique_assignments })}
              testid="engagement-total-reports"
            />
            <StatCard
              label={t('analytics.engagement.avgChars')}
              value={summary.avg_chars}
              hint={t('analytics.engagement.totalChars', { count: summary.total_chars })}
              testid="engagement-avg-chars"
            />
            <StatCard
              label={t('analytics.engagement.activeDays')}
              value={summary.active_days}
              hint={summary.span_days > 0
                ? t('analytics.engagement.spanDays', { count: summary.span_days })
                : null}
              testid="engagement-active-days"
            />
            <StatCard
              label={t('analytics.engagement.lastReport')}
              value={summary.last_report_at
                ? formatUserDateOnly(summary.last_report_at)
                : '—'}
              hint={summary.first_report_at
                ? t('analytics.engagement.firstReport', {
                  date: formatUserDateOnly(summary.first_report_at),
                })
                : null}
              testid="engagement-last-report"
            />
          </div>

          {/* Consistency + type breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 bg-white border border-stone-200 rounded-lg p-4">
              <ConsistencyMeter
                score={consistency ? consistency.score : null}
                label={t('analytics.engagement.consistencyScore')}
              />
              <div className="mt-3 text-xs text-stone-500 space-y-1">
                <div>
                  <span className="font-medium text-stone-600">{t('analytics.engagement.meanGap')}:</span>{' '}
                  {consistency && consistency.gap_count > 0
                    ? t('analytics.engagement.daysShort', { days: consistency.mean_gap_days.toFixed(1) })
                    : '—'}
                </div>
                <div>
                  <span className="font-medium text-stone-600">{t('analytics.engagement.medianGap')}:</span>{' '}
                  {consistency && consistency.gap_count > 0
                    ? t('analytics.engagement.daysShort', { days: consistency.median_gap_days.toFixed(1) })
                    : '—'}
                </div>
                <div>
                  <span className="font-medium text-stone-600">{t('analytics.engagement.maxGap')}:</span>{' '}
                  {consistency && consistency.gap_count > 0
                    ? t('analytics.engagement.daysShort', { days: consistency.max_gap_days.toFixed(1) })
                    : '—'}
                </div>
                <div className="pt-2 text-stone-400 italic">
                  {t('analytics.engagement.consistencyHint')}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-white border border-stone-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-stone-700 mb-3">
                {t('analytics.engagement.typeBreakdown')}
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{t('analytics.engagement.legendText')}</span>
                    <span>{summary.text_reports} / {summary.total_reports}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-teal-500"
                      style={{ width: `${summary.total_reports > 0 ? (summary.text_reports / summary.total_reports) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{t('analytics.engagement.legendVoice')}</span>
                    <span>{summary.voice_reports} / {summary.total_reports}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-indigo-400"
                      style={{ width: `${summary.total_reports > 0 ? (summary.voice_reports / summary.total_reports) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{t('analytics.engagement.finalReports')}</span>
                    <span>{summary.final_reports} / {summary.total_reports}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${summary.total_reports > 0 ? (summary.final_reports / summary.total_reports) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline + gaps */}
          <TimelineChart
            timeline={timeline}
            label={t('analytics.engagement.reportsOverTime')}
            labelAvgChars={t('analytics.engagement.avgCharsLine')}
          />

          <GapBarList
            gaps={data.gaps_days || []}
            label={t('analytics.engagement.topGaps')}
          />
        </>
      )}
    </div>
  );
}

export default EngagementPanel;
