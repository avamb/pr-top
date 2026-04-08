import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatUserDate } from '../utils/formatDate';

const API_URL = '/api';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  applied: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-600',
};

export default function AdminPromos() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('promos');
  const [promos, setPromos] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Referral state
  const [referrals, setReferrals] = useState([]);
  const [referralSummary, setReferralSummary] = useState(null);
  const [topReferrers, setTopReferrers] = useState([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralPagination, setReferralPagination] = useState({ page: 1, total_pages: 1, total: 0 });

  // Create form state
  const [form, setForm] = useState({
    code: '',
    plan: 'basic',
    duration_days: 30,
    max_uses: '',
    expires_at: '',
  });

  const token = localStorage.getItem('token');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const loadPromos = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/promos`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPromos(data.promos || []);
      }
    } catch (err) {
      console.error('Failed to load promos:', err);
    }
  };

  const loadRedemptions = async () => {
    try {
      const url = statusFilter
        ? `${API_URL}/admin/promos/redemptions?status=${statusFilter}`
        : `${API_URL}/admin/promos/redemptions`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setRedemptions(data.redemptions || []);
      }
    } catch (err) {
      console.error('Failed to load redemptions:', err);
    }
  };

  const loadReferrals = async (page = 1) => {
    setReferralLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/referrals?page=${page}&limit=20`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReferrals(data.referrals || []);
        setReferralSummary(data.summary || null);
        setTopReferrers(data.top_referrers || []);
        setReferralPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Failed to load referrals:', err);
    } finally {
      setReferralLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    Promise.all([loadPromos(), loadRedemptions()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    loadRedemptions();
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'referrals' && referrals.length === 0 && !referralLoading) {
      loadReferrals();
    }
  }, [activeTab]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body = {
        code: form.code,
        plan: form.plan,
        duration_days: parseInt(form.duration_days) || 30,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
      };
      const res = await fetch(`${API_URL}/admin/promos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(t('adminPromos.createSuccess'));
        setForm({ code: '', plan: 'basic', duration_days: 30, max_uses: '', expires_at: '' });
        loadPromos();
      } else {
        showError(data.error || 'Failed to create promo code');
      }
    } catch (err) {
      showError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (promoId) => {
    try {
      const res = await fetch(`${API_URL}/admin/promos/${promoId}/deactivate`, {
        method: 'PUT',
        headers,
      });
      if (res.ok) {
        showSuccess(t('adminPromos.deactivateSuccess'));
        loadPromos();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to deactivate');
      }
    } catch (err) {
      showError('Network error');
    }
  };

  const handleApplyRedemption = async (redemptionId) => {
    try {
      const res = await fetch(`${API_URL}/admin/promos/redemptions/${redemptionId}/apply`, {
        method: 'PUT',
        headers,
      });
      if (res.ok) {
        showSuccess(t('adminPromos.applySuccess'));
        loadRedemptions();
        loadPromos();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to apply redemption');
      }
    } catch (err) {
      showError('Network error');
    }
  };

  const getPromoStatus = (promo) => {
    if (!promo.is_active) return { label: t('adminPromos.inactive'), color: 'bg-gray-100 text-gray-600' };
    if (promo.is_expired) return { label: t('adminPromos.expired'), color: 'bg-red-100 text-red-700' };
    if (promo.is_maxed) return { label: t('adminPromos.maxed'), color: 'bg-amber-100 text-amber-800' };
    return { label: t('adminPromos.active'), color: 'bg-green-100 text-green-800' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const tabs = [
    { id: 'promos', label: t('adminPromos.tabPromos') },
    { id: 'referrals', label: t('adminPromos.tabReferrals') },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">{t('adminPromos.title')}</h1>

      {/* Success/Error Messages */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Promo Codes Tab */}
      {activeTab === 'promos' && (
        <div className="space-y-8">
          {/* Create Promo Code Form */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-lg font-semibold text-stone-700 mb-4">{t('adminPromos.createTitle')}</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">{t('adminPromos.code')}</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder={t('adminPromos.codePlaceholder')}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">{t('adminPromos.plan')}</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">{t('adminPromos.durationDays')}</label>
                <input
                  type="number"
                  value={form.duration_days}
                  onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                  min="1"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">{t('adminPromos.maxUses')}</label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  min="1"
                  placeholder={t('adminPromos.maxUsesPlaceholder')}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">{t('adminPromos.expiresAt')}</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? t('adminPromos.creating') : t('adminPromos.createBtn')}
                </button>
              </div>
            </form>
          </div>

          {/* Promo Codes Table */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-700">
                {t('adminPromos.code')}s ({promos.length})
              </h2>
            </div>
            {promos.length === 0 ? (
              <div className="p-8 text-center text-stone-500">{t('adminPromos.noPromos')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.code')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.plan')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.duration')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.maxUses')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.used')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.status')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.expiresAt')}</th>
                      <th className="px-4 py-3 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {promos.map((promo) => {
                      const status = getPromoStatus(promo);
                      return (
                        <tr key={promo.id} className="hover:bg-stone-50">
                          <td className="px-4 py-3 font-mono font-semibold text-stone-800">{promo.code}</td>
                          <td className="px-4 py-3">
                            <span className="capitalize bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                              {promo.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3">{promo.duration_days} {t('adminPromos.days')}</td>
                          <td className="px-4 py-3">{promo.max_uses ?? t('adminPromos.unlimited')}</td>
                          <td className="px-4 py-3">{promo.usage_count}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-500">
                            {promo.expires_at ? formatUserDate(promo.expires_at) : t('adminPromos.never')}
                          </td>
                          <td className="px-4 py-3">
                            {promo.is_active && (
                              <button
                                onClick={() => handleDeactivate(promo.id)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                {t('adminPromos.deactivate')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Redemptions Section */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-700">{t('adminPromos.allRedemptions')}</h2>
              <div className="flex gap-2">
                {['', 'pending', 'applied', 'expired'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === f
                        ? 'bg-primary text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {f === '' ? t('adminPromos.filterAll') : t(`adminPromos.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>
            {redemptions.length === 0 ? (
              <div className="p-8 text-center text-stone-500">{t('adminPromos.noRedemptions')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.therapist')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.currentPlan')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.promoCode')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.promoPlan')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.duration')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.redeemedAt')}</th>
                      <th className="px-4 py-3 text-left font-medium">{t('adminPromos.status')}</th>
                      <th className="px-4 py-3 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-800">
                            {r.therapist_first_name} {r.therapist_last_name}
                          </div>
                          <div className="text-xs text-stone-500">{r.therapist_email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                            {r.current_plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">{r.promo_code}</td>
                        <td className="px-4 py-3">
                          <span className="capitalize bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            {r.promo_plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">{r.duration_days} {t('adminPromos.days')}</td>
                        <td className="px-4 py-3 text-stone-500">{formatUserDate(r.redeemed_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                            {t(`adminPromos.${r.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleApplyRedemption(r.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                            >
                              {t('adminPromos.markApplied')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Referrals Tab */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          {referralLoading && !referralSummary ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              {referralSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
                    <div className="text-sm text-stone-500">{t('adminPromos.refTotalReferrals')}</div>
                    <div className="text-2xl font-bold text-stone-800 mt-1">{referralSummary.total_referrals}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
                    <div className="text-sm text-stone-500">{t('adminPromos.refThisMonth')}</div>
                    <div className="text-2xl font-bold text-stone-800 mt-1">{referralSummary.referrals_this_month}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
                    <div className="text-sm text-stone-500">{t('adminPromos.refPaidConversions')}</div>
                    <div className="text-2xl font-bold text-green-700 mt-1">{referralSummary.paid_conversions}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
                    <div className="text-sm text-stone-500">{t('adminPromos.refConversionRate')}</div>
                    <div className="text-2xl font-bold text-primary mt-1">{referralSummary.conversion_rate}%</div>
                  </div>
                </div>
              )}

              {/* Top Referrers */}
              {topReferrers.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-stone-100">
                    <h2 className="text-lg font-semibold text-stone-700">{t('adminPromos.refTopReferrers')}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50 text-stone-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">#</th>
                          <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refReferrer')}</th>
                          <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refReferralCount')}</th>
                          <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refPaidCount')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {topReferrers.map((ref, idx) => (
                          <tr key={ref.id} className="hover:bg-stone-50">
                            <td className="px-4 py-3 text-stone-400 font-medium">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-stone-800">
                                {ref.first_name} {ref.last_name}
                              </div>
                              <div className="text-xs text-stone-500">{ref.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                {ref.referral_count}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
                                {ref.paid_count}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Referrals Table */}
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100">
                  <h2 className="text-lg font-semibold text-stone-700">
                    {t('adminPromos.refAllReferrals')} ({referralPagination.total})
                  </h2>
                </div>
                {referrals.length === 0 ? (
                  <div className="p-8 text-center text-stone-500">{t('adminPromos.refNoReferrals')}</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-stone-600">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refReferredUser')}</th>
                            <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refReferrer')}</th>
                            <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refRegistrationDate')}</th>
                            <th className="px-4 py-3 text-left font-medium">{t('adminPromos.refCurrentPlan')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {referrals.map((r) => (
                            <tr key={r.id} className="hover:bg-stone-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-stone-800">
                                  {r.first_name} {r.last_name}
                                </div>
                                <div className="text-xs text-stone-500">{r.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-stone-800">
                                  {r.referrer_first_name} {r.referrer_last_name}
                                </div>
                                <div className="text-xs text-stone-500">{r.referrer_email}</div>
                              </td>
                              <td className="px-4 py-3 text-stone-500">
                                {formatUserDate(r.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="capitalize bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                                  {r.current_plan || 'trial'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {referralPagination.total_pages > 1 && (
                      <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-sm text-stone-500">
                          {t('adminPromos.refPage')} {referralPagination.page} / {referralPagination.total_pages}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadReferrals(referralPagination.page - 1)}
                            disabled={referralPagination.page <= 1}
                            className="px-3 py-1 text-sm rounded border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t('adminPromos.refPrev')}
                          </button>
                          <button
                            onClick={() => loadReferrals(referralPagination.page + 1)}
                            disabled={referralPagination.page >= referralPagination.total_pages}
                            className="px-3 py-1 text-sm rounded border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t('adminPromos.refNext')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
