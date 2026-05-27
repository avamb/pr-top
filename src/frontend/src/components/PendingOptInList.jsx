import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

/**
 * PendingOptInList
 * Shows clients who have been sent the session-reminders opt-in prompt
 * but haven't responded yet (session_reminders_asked_at IS NOT NULL,
 * session_reminders_enabled IS NULL).
 *
 * Provides a "Resend request" button that calls POST /api/clients/:id/resend-opt-in.
 * Rate-limited to 1 per 48h per client (backend enforces, UI surfaces the error).
 */
export default function PendingOptInList() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resendState, setResendState] = useState({}); // { [clientId]: { loading, success, error } }

  const fetchPendingClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/clients?filter=pending_optin&per_page=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('reminders.settings.pendingList.fetchError'));
      }
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPendingClients();
  }, [fetchPendingClients]);

  async function handleResend(clientId) {
    setResendState(prev => ({
      ...prev,
      [clientId]: { loading: true, success: null, error: null }
    }));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/clients/${clientId}/resend-opt-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setResendState(prev => ({
          ...prev,
          [clientId]: { loading: false, success: null, error: t('reminders.settings.pendingList.rateLimited') }
        }));
        return;
      }

      if (!res.ok) {
        setResendState(prev => ({
          ...prev,
          [clientId]: { loading: false, success: null, error: data.error || t('reminders.settings.pendingList.resendError') }
        }));
        return;
      }

      // Success: update state and remove client from list after brief delay
      setResendState(prev => ({
        ...prev,
        [clientId]: { loading: false, success: t('reminders.settings.pendingList.resendSuccess'), error: null }
      }));

      setTimeout(() => {
        // Refresh the list so the client no longer appears (asked_at was cleared)
        fetchPendingClients();
        setResendState(prev => {
          const next = { ...prev };
          delete next[clientId];
          return next;
        });
      }, 2000);
    } catch (err) {
      setResendState(prev => ({
        ...prev,
        [clientId]: { loading: false, success: null, error: t('reminders.settings.pendingList.resendError') }
      }));
    }
  }

  function getClientDisplayName(client) {
    const parts = [client.first_name, client.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    if (client.telegram_username) return `@${client.telegram_username}`;
    if (client.email) return client.email;
    return `Client #${client.id}`;
  }

  if (loading) {
    return (
      <div className="py-4 text-sm text-stone-400" data-testid="pending-optin-loading">
        {t('reminders.settings.pendingList.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-red-500" data-testid="pending-optin-error">
        {error}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="py-4 text-sm text-stone-400 italic" data-testid="pending-optin-empty">
        {t('reminders.settings.pendingList.empty')}
      </div>
    );
  }

  return (
    <div data-testid="pending-optin-list">
      <ul className="divide-y divide-gray-100">
        {clients.map(client => {
          const state = resendState[client.id] || {};
          const displayName = getClientDisplayName(client);

          return (
            <li key={client.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-sm font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{displayName}</p>
                  {client.session_reminders_asked_at && (
                    <p className="text-xs text-stone-400">
                      {t('reminders.settings.pendingList.askedAt', {
                        date: new Date(client.session_reminders_asked_at + (client.session_reminders_asked_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString()
                      })}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  {t('reminders.settings.pendingList.awaitingBadge')}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {state.success && (
                  <span className="text-xs text-green-600 font-medium">{state.success}</span>
                )}
                {state.error && (
                  <span className="text-xs text-red-500">{state.error}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleResend(client.id)}
                  disabled={state.loading || !!state.success}
                  data-testid={`resend-btn-${client.id}`}
                  className="px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {state.loading
                    ? t('reminders.settings.pendingList.resending')
                    : t('reminders.settings.pendingList.resendBtn')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
