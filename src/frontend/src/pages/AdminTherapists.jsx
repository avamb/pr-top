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
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.telegramId')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.inviteCode')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.registered')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {therapists.map(therapist => (
                <tr key={therapist.id} className={therapist.is_blocked ? 'bg-red-50/50' : ''}>
                  <td className="px-6 py-4 text-sm text-text">{therapist.id}</td>
                  <td className="px-6 py-4 text-sm text-text font-medium">{therapist.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-secondary">{therapist.telegram_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-secondary font-mono">{therapist.invite_code || '—'}</td>
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
                    {therapist.created_at ? formatUserDateOnly(therapist.created_at) : '—'}
                  </td>
                  <td className="px-6 py-4">
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
                  </td>
                </tr>
              ))}
              {therapists.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-secondary">
                    {t('admin.noTherapists')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
