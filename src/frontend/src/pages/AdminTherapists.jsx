import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatUserDateOnly } from '../utils/formatDate';

const API_URL = '/api';

export default function AdminTherapists() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');
  const [planModal, setPlanModal] = useState(null); // therapist object or null
  const [planForm, setPlanForm] = useState({ plan: 'basic', reason: '', expires_at: '' });
  const [planLoading, setPlanLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    loadTherapists(token);
  }, []);

  const loadTherapists = async (token) => {
    try {
      const res = await fetch(`${API_URL}/admin/therapists`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTherapists(data.therapists || []);
      }
    } catch (err) {
      console.error('Failed to load therapists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async (therapistId) => {
    setActionLoading(therapistId);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/therapists/${therapistId}/block`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(t('admin.blockedSuccess', { id: therapistId }));
        await loadTherapists(token);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(t('admin.failedToBlock'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (therapistId) => {
    setActionLoading(therapistId);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/therapists/${therapistId}/unblock`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(t('admin.unblockedSuccess', { id: therapistId }));
        await loadTherapists(token);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(t('admin.failedToUnblock'));
    } finally {
      setActionLoading(null);
    }
  };

  const openPlanModal = (therapist) => {
    setPlanModal(therapist);
    setPlanForm({
      plan: therapist.plan || 'basic',
      reason: therapist.override_reason || '',
      expires_at: therapist.override_expires_at ? therapist.override_expires_at.split('T')[0] : ''
    });
  };

  const handleSetPlan = async () => {
    if (!planModal) return;
    setPlanLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/therapists/${planModal.id}/plan`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: planForm.plan,
          reason: planForm.reason || undefined,
          expires_at: planForm.expires_at || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(t('admin.planOverrideSuccess', { id: planModal.id, plan: planForm.plan }));
        setPlanModal(null);
        await loadTherapists(token);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(t('admin.failedToSetPlan'));
    } finally {
      setPlanLoading(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!planModal) return;
    if (!window.confirm(t('admin.removeOverrideConfirm'))) return;
    setPlanLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/therapists/${planModal.id}/plan-override`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(t('admin.overrideRemovedSuccess', { id: planModal.id }));
        setPlanModal(null);
        await loadTherapists(token);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(t('admin.failedToRemoveOverride'));
    } finally {
      setPlanLoading(false);
    }
  };

  const getPlanBadge = (therapist) => {
    const plan = therapist.plan || 'trial';
    const colors = {
      trial: 'bg-stone-100 text-stone-700',
      basic: 'bg-blue-100 text-blue-700',
      pro: 'bg-purple-100 text-purple-700',
      premium: 'bg-amber-100 text-amber-700'
    };
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[plan] || colors.trial}`}>
          {plan}
        </span>
        {therapist.is_manual_override && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
            {t('admin.manualBadge')}
          </span>
        )}
      </span>
    );
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text">{t('admin.therapistManagement')}</h2>
            <p className="text-secondary mt-1">{t('admin.therapistsRegistered', { count: therapists.length })}</p>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.startsWith('Error') ? 'bg-red-50 text-error border border-error' : 'bg-green-50 text-green-700 border border-green-300'}`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.id')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.email')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.firstName')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.lastName')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.plan')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.registered')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {therapists.map(therapist => (
                <React.Fragment key={therapist.id}>
                  <tr className={`${therapist.is_blocked ? 'bg-red-50/50' : ''} ${expandedId === therapist.id ? 'border-b-0' : ''}`}>
                    <td className="px-6 py-4 text-sm text-text">{therapist.id}</td>
                    <td className="px-6 py-4 text-sm text-text font-medium">{therapist.email || '\u2014'}</td>
                    <td className="px-6 py-4 text-sm text-text">{therapist.first_name || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</td>
                    <td className="px-6 py-4 text-sm text-text">{therapist.last_name || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openPlanModal(therapist)}
                        className="hover:opacity-80 cursor-pointer"
                        title={t('admin.managePlan')}
                      >
                        {getPlanBadge(therapist)}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {therapist.is_blocked ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {t('admin.blocked')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {t('admin.active')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary">
                      {therapist.created_at ? formatUserDateOnly(therapist.created_at) : '\u2014'}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        onClick={() => setExpandedId(expandedId === therapist.id ? null : therapist.id)}
                        className="text-sm px-3 py-1 bg-stone-100 text-stone-700 rounded-md hover:bg-stone-200 transition-colors"
                        title={expandedId === therapist.id ? t('admin.hideProfile') : t('admin.viewProfile')}
                      >
                        {expandedId === therapist.id ? t('admin.hideProfile') : t('admin.viewProfile')}
                      </button>
                      {therapist.is_blocked ? (
                        <button
                          onClick={() => handleUnblock(therapist.id)}
                          disabled={actionLoading === therapist.id}
                          className="text-sm px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === therapist.id ? t('admin.unblocking') : t('admin.unblock')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBlock(therapist.id)}
                          disabled={actionLoading === therapist.id}
                          className="text-sm px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === therapist.id ? t('admin.blocking') : t('admin.block')}
                        </button>
                      )}
                      <button
                        onClick={() => openPlanModal(therapist)}
                        className="text-sm px-3 py-1 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
                      >
                        {t('admin.managePlan')}
                      </button>
                    </td>
                  </tr>
                  {expandedId === therapist.id && (
                    <tr className={therapist.is_blocked ? 'bg-red-50/30' : 'bg-stone-50'}>
                      <td colSpan="8" className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-stone-500 font-medium">{t('admin.telegramId')}</span>
                            <p className="text-text mt-0.5">{therapist.telegram_id || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                          <div>
                            <span className="text-stone-500 font-medium">{t('admin.telegramUsername')}</span>
                            <p className="text-text mt-0.5">{therapist.telegram_username ? `@${therapist.telegram_username}` : <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                          <div>
                            <span className="text-stone-500 font-medium">{t('admin.phone')}</span>
                            <p className="text-text mt-0.5">{therapist.phone || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                          <div>
                            <span className="text-stone-500 font-medium">{t('admin.email')}</span>
                            <p className="text-text mt-0.5">{therapist.email || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                          <div>
                            <span className="text-stone-500 font-medium">{t('admin.firstName')}</span>
                            <p className="text-text mt-0.5">{therapist.first_name || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                          <div>
                            <span className="text-stone-500 font-medium">{t('admin.lastName')}</span>
                            <p className="text-text mt-0.5">{therapist.last_name || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-stone-500 font-medium">{t('admin.otherInfo')}</span>
                            <p className="text-text mt-0.5">{therapist.other_info || <span className="text-stone-400 italic">{t('admin.notProvided')}</span>}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {therapists.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-secondary">
                    {t('admin.noTherapists')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Plan Management Modal */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPlanModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-stone-900 mb-1">{t('admin.managePlanTitle')}</h3>
            <p className="text-sm text-stone-500 mb-4">{planModal.email} (ID: {planModal.id})</p>

            {/* Current plan info */}
            <div className="mb-4 p-3 bg-stone-50 rounded-lg text-sm">
              <span className="text-stone-600">{t('admin.currentPlanLabel')}: </span>
              {getPlanBadge(planModal)}
              {planModal.override_reason && (
                <div className="mt-1 text-stone-500">
                  {t('admin.overrideReasonLabel')}: {planModal.override_reason}
                </div>
              )}
              {planModal.override_expires_at && (
                <div className="mt-1 text-stone-500">
                  {t('admin.expiresAtLabel')}: {formatUserDateOnly(planModal.override_expires_at)}
                </div>
              )}
            </div>

            {/* Plan selector */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('admin.selectPlan')}</label>
                <select
                  value={planForm.plan}
                  onChange={e => setPlanForm({ ...planForm, plan: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('admin.overrideReason')}</label>
                <input
                  type="text"
                  value={planForm.reason}
                  onChange={e => setPlanForm({ ...planForm, reason: e.target.value })}
                  placeholder={t('admin.overrideReasonPlaceholder')}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t('admin.overrideExpiresAt')}</label>
                <input
                  type="date"
                  value={planForm.expires_at}
                  onChange={e => setPlanForm({ ...planForm, expires_at: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-stone-400 mt-1">{t('admin.expiresAtHint')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSetPlan}
                disabled={planLoading}
                className="flex-1 py-2 px-4 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors text-sm"
              >
                {planLoading ? t('admin.saving') : t('admin.setPlanBtn')}
              </button>
              {planModal.is_manual_override && (
                <button
                  onClick={handleRemoveOverride}
                  disabled={planLoading}
                  className="py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {t('admin.removeOverrideBtn')}
                </button>
              )}
              <button
                onClick={() => setPlanModal(null)}
                className="py-2 px-4 border border-stone-300 text-stone-600 rounded-lg font-medium hover:bg-stone-50 transition-colors text-sm"
              >
                {t('admin.cancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
