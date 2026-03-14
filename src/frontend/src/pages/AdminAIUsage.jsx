import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

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

function DateRangePicker({ dateFrom, dateTo, onChange }) {
  const { t } = useTranslation();

  const presets = [
    { key: 'today', label: t('aiUsage.today', 'Today'), days: 0 },
    { key: '7days', label: t('aiUsage.last7Days', '7 days'), days: 7 },
    { key: '30days', label: t('aiUsage.last30Days', '30 days'), days: 30 },
    { key: '90days', label: t('aiUsage.last90Days', '90 days'), days: 90 },
  ];

  const applyPreset = (days) => {
    const to = new Date();
    const from = new Date();
    if (days === 0) {
      from.setHours(0, 0, 0, 0);
    } else {
      from.setDate(from.getDate() - days);
    }
    onChange(from.toISOString().split('T')[0], to.toISOString().split('T')[0]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button
          key={p.key}
          onClick={() => applyPreset(p.days)}
          className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 hover:bg-primary/10 hover:border-primary transition-colors"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={dateFrom}
          onChange={e => onChange(e.target.value, dateTo)}
          className="px-2 py-1.5 text-sm border border-stone-200 rounded-lg"
        />
        <span className="text-stone-400">-</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => onChange(dateFrom, e.target.value)}
          className="px-2 py-1.5 text-sm border border-stone-200 rounded-lg"
        />
      </div>
    </div>
  );
}

function CostChart({ daily }) {
  if (!daily || daily.length === 0) {
    return <p className="text-secondary text-sm py-8 text-center">No data for the selected period.</p>;
  }

  const maxCost = Math.max(...daily.map(d => d.total_cost_usd || 0), 0.001);

  return (
    <div className="flex items-end gap-1 h-48 px-2">
      {daily.map((d, i) => {
        const height = Math.max(2, ((d.total_cost_usd || 0) / maxCost) * 100);
        const label = d.period ? d.period.split('-').slice(1).join('/') : '';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex flex-col items-center justify-end" style={{ height: '160px' }}>
              <div
                className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-default"
                style={{ height: `${height}%`, minHeight: '2px', maxWidth: '32px' }}
                title={`${label}: $${(d.total_cost_usd || 0).toFixed(4)} | ${d.total_tokens || 0} tokens | ${d.call_count || 0} calls`}
              />
            </div>
            <span className="text-[10px] text-stone-400 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SpendingLimitBar({ spendingLimit, formatCost, t }) {
  if (!spendingLimit) return null;

  const { limit_usd, current_spend, percent_used, unlimited, warning, limit_reached, warning_percent } = spendingLimit;

  // Progress bar color
  let barColor = 'bg-green-500';
  if (limit_reached) barColor = 'bg-red-500';
  else if (warning) barColor = 'bg-amber-500';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-text mb-4">{t('aiUsage.spendVsLimit', 'Spend vs Limit')}</h2>

      {/* Alert banners */}
      {limit_reached && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <span>🚫</span>
            <span>{t('aiUsage.limitReached', 'AI Spending Limit Reached')}</span>
          </div>
          <p className="text-sm mt-1">{t('aiUsage.limitReachedDesc')}</p>
        </div>
      )}

      {warning && !limit_reached && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span>{t('aiUsage.limitWarning', 'AI Spending Warning')}</span>
          </div>
          <p className="text-sm mt-1">
            {t('aiUsage.limitWarningDesc', { percent: percent_used.toFixed(0), limit: limit_usd.toFixed(2) })}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-secondary">{t('aiUsage.currentMonthSpend', 'Current Month Spend')}</span>
        <span className="text-sm font-semibold text-text">
          {formatCost(current_spend)} / {unlimited ? t('aiUsage.unlimited', 'Unlimited') : formatCost(limit_usd)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-stone-100 rounded-full h-6 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: unlimited ? '0%' : `${Math.max(percent_used > 0 ? 2 : 0, Math.min(percent_used, 100))}%` }}
        />
        {/* Warning threshold marker */}
        {!unlimited && warning_percent > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-600/50"
            style={{ left: `${warning_percent}%` }}
            title={`${t('aiUsage.warningThreshold', 'Warning Threshold')}: ${warning_percent}%`}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-stone-400">$0</span>
        {!unlimited && (
          <>
            <span className="text-xs text-stone-400">{percent_used.toFixed(0)}%</span>
            <span className="text-xs text-stone-400">{formatCost(limit_usd)}</span>
          </>
        )}
        {unlimited && <span className="text-xs text-stone-400">{t('aiUsage.unlimited', 'Unlimited')}</span>}
      </div>
    </div>
  );
}

function SpendingLimitSettings({ spendingLimit, onSave, t }) {
  const [limitUsd, setLimitUsd] = useState('');
  const [warnPercent, setWarnPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (spendingLimit) {
      setLimitUsd(String(spendingLimit.limit_usd || 0));
      setWarnPercent(String(spendingLimit.warning_percent || 80));
    }
  }, [spendingLimit]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/ai/limits`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit_usd: parseFloat(limitUsd) || 0,
          warning_percent: parseInt(warnPercent, 10) || 80
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: t('aiUsage.limitsSaved', 'Spending limits updated successfully') });
        if (onSave) onSave(data);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-text mb-4">{t('aiUsage.spendingLimit', 'Spending Limit')}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t('aiUsage.monthlyLimit', 'Monthly Limit (USD)')}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={limitUsd}
            onChange={e => setLimitUsd(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            placeholder="0"
          />
          <p className="text-xs text-stone-400 mt-1">{t('aiUsage.setToZeroForUnlimited', 'Set to 0 for unlimited')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t('aiUsage.warningThreshold', 'Warning Threshold (%)')}
          </label>
          <input
            type="number"
            min="1"
            max="99"
            value={warnPercent}
            onChange={e => setWarnPercent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            placeholder="80"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? t('aiUsage.savingLimits', 'Saving...') : t('aiUsage.saveLimits', 'Save Limits')}
        </button>

        {message && (
          <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminAIUsage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState(null);
  const [spendingLimit, setSpendingLimit] = useState(null);

  useEffect(() => {
    // Default to last 30 days
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];
    setDateFrom(fromStr);
    setDateTo(toStr);
    loadData(fromStr, toStr);
  }, []);

  const loadData = async (from, to) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);

      const [summaryRes, dailyRes, limitsRes] = await Promise.all([
        fetch(`${API_URL}/admin/ai/usage/summary?${params}`, { headers }),
        fetch(`${API_URL}/admin/ai/usage/daily?${params}`, { headers }),
        fetch(`${API_URL}/admin/ai/limits`, { headers })
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
        // Also get spending limit from summary if present
        if (data.spending_limit) {
          setSpendingLimit(data.spending_limit);
        }
      }
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        setDaily(dailyData.daily || []);
      }
      if (limitsRes.ok) {
        const limitsData = await limitsRes.json();
        setSpendingLimit(limitsData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
    loadData(from, to);
  };

  const handleLimitSave = (data) => {
    // Update spending limit from save response
    setSpendingLimit({
      limit_usd: data.limit_usd,
      warning_percent: data.warning_percent,
      current_spend: data.current_spend,
      percent_used: data.percent_used,
      unlimited: data.unlimited,
      warning: data.warning,
      limit_reached: data.limit_reached
    });
  };

  const formatCost = (cost) => {
    if (cost == null) return '$0.00';
    if (cost < 0.01) return '$' + cost.toFixed(4);
    return '$' + cost.toFixed(2);
  };

  const formatTokens = (tokens) => {
    if (tokens == null) return '0';
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
    if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K';
    return tokens.toString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text">{t('aiUsage.title', 'AI Usage & Costs')}</h1>
        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Spending Limit Progress Bar */}
      <SpendingLimitBar
        spendingLimit={spendingLimit}
        formatCost={formatCost}
        t={t}
      />

      {/* Section 1: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('aiUsage.totalCost', 'Total Cost')}
          value={formatCost(summary?.total?.total_cost_usd)}
          icon="$"
          color="bg-green-100 text-green-700"
        />
        <StatCard
          label={t('aiUsage.totalTokens', 'Total Tokens')}
          value={formatTokens(summary?.total?.total_tokens)}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label={t('aiUsage.apiCalls', 'API Calls')}
          value={summary?.total?.total_calls || 0}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>}
          color="bg-purple-100 text-purple-700"
        />
        <StatCard
          label={t('aiUsage.mostUsedModel', 'Most Used Model')}
          value={summary?.most_used_model || '-'}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/></svg>}
          color="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Spending Limit Settings */}
      <SpendingLimitSettings spendingLimit={spendingLimit} onSave={handleLimitSave} t={t} />

      {/* Section 4: Daily Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-text mb-4">{t('aiUsage.dailyCost', 'Daily Cost')}</h2>
        <CostChart daily={daily} />
      </div>

      {/* Section 2: Cost by Model */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-text mb-4">{t('aiUsage.costByModel', 'Cost by Model')}</h2>
        {(!summary?.by_model || summary.by_model.length === 0) ? (
          <p className="text-secondary text-sm">{t('aiUsage.noData', 'No AI usage data yet.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-3 px-2 font-semibold text-secondary">{t('aiUsage.model', 'Model')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.calls', 'Calls')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.tokens', 'Tokens')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.cost', 'Cost')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.avgCost', 'Avg/Call')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_model.map((row, i) => (
                  <tr key={i} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-2 font-medium">{row.model}</td>
                    <td className="py-3 px-2 text-right">{row.call_count}</td>
                    <td className="py-3 px-2 text-right">{formatTokens(row.total_tokens)}</td>
                    <td className="py-3 px-2 text-right font-medium text-green-700">{formatCost(row.total_cost_usd)}</td>
                    <td className="py-3 px-2 text-right text-stone-500">
                      {row.call_count > 0 ? formatCost(row.total_cost_usd / row.call_count) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Cost by Therapist */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-text mb-4">{t('aiUsage.costByTherapist', 'Cost by Therapist')}</h2>
        {(!summary?.by_therapist || summary.by_therapist.length === 0) ? (
          <p className="text-secondary text-sm">{t('aiUsage.noData', 'No AI usage data yet.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-3 px-2 font-semibold text-secondary">{t('aiUsage.therapist', 'Therapist')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.calls', 'Calls')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.tokens', 'Tokens')}</th>
                  <th className="text-right py-3 px-2 font-semibold text-secondary">{t('aiUsage.cost', 'Cost')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_therapist.map((row, i) => (
                  <tr key={i} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-2 font-medium">{row.email || `Therapist #${row.therapist_id}`}</td>
                    <td className="py-3 px-2 text-right">{row.call_count}</td>
                    <td className="py-3 px-2 text-right">{formatTokens(row.total_tokens)}</td>
                    <td className="py-3 px-2 text-right font-medium text-green-700">{formatCost(row.total_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
