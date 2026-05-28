import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RescheduleModal from './RescheduleModal';

const API = '/api';

function attendanceBadge(status) {
  if (!status) return { label: 'pending', color: 'bg-amber-100 text-amber-800' };
  switch (status) {
    case 'confirmed':               return { label: 'confirmed',    color: 'bg-green-100 text-green-800' };
    case 'reschedule_requested':    return { label: 'reschedule',   color: 'bg-blue-100 text-blue-800' };
    case 'cancelled_by_client':     return { label: 'cancelled',    color: 'bg-rose-100 text-rose-800' };
    case 'cancelled_by_therapist':  return { label: 'cancelled',    color: 'bg-rose-100 text-rose-800' };
    case 'attended':                return { label: 'attended',     color: 'bg-emerald-100 text-emerald-800' };
    case 'no_show':                 return { label: 'no_show',      color: 'bg-red-100 text-red-800' };
    default:                        return { label: status,         color: 'bg-gray-100 text-gray-800' };
  }
}

function formatDatetime(isoStr, t) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) {
    return isoStr;
  }
}

export default function UpcomingConfirmationsWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // session_id being actioned
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // { session_id, scheduled_at }

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API}/dashboard/upcoming-confirmations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('reminders.dashboard.widget.fetchError', 'Could not load upcoming sessions.'));
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function handleMarkAttendance(sessionId, status) {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`${API}/sessions/${sessionId}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update attendance');
      }
      // Refresh widget
      await fetchSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  function handleRescheduleSuccess(sessionId) {
    setRescheduleTarget(null);
    fetchSessions();
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-text mb-3">
          {t('reminders.dashboard.widget.title', 'Upcoming — Confirmation Status')}
        </h3>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-text mb-3">
          {t('reminders.dashboard.widget.title', 'Upcoming — Confirmation Status')}
        </h3>
        <p className="text-rose-600 text-sm" data-testid="ucw-error">{error}</p>
        <button
          onClick={fetchSessions}
          className="mt-2 text-sm text-teal-600 hover:underline"
        >
          {t('reminders.dashboard.widget.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6" data-testid="upcoming-confirmations-widget">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text">
          {t('reminders.dashboard.widget.title', 'Upcoming — Confirmation Status')}
        </h3>
        <span className="text-xs text-secondary">
          {t('reminders.dashboard.widget.next7Days', 'Next 7 days')}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-secondary text-sm">
            {t('reminders.dashboard.widget.empty', 'No sessions scheduled in the next 7 days.')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-secondary border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">{t('reminders.dashboard.widget.colClient', 'Client')}</th>
                <th className="pb-2 pr-4 font-medium">{t('reminders.dashboard.widget.colWhen', 'When')}</th>
                <th className="pb-2 pr-4 font-medium">{t('reminders.dashboard.widget.colStatus', 'Status')}</th>
                <th className="pb-2 font-medium">{t('reminders.dashboard.widget.colActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const badge = attendanceBadge(s.attendance_status);
                const isBusy = actionLoading === s.session_id;
                return (
                  <tr
                    key={s.session_id}
                    className="border-b border-gray-50 last:border-b-0"
                    data-testid={`ucw-row-${s.session_id}`}
                  >
                    {/* Client */}
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => navigate(`/clients/${s.client_id}`)}
                        className="font-medium text-teal-700 hover:underline truncate max-w-[150px] inline-block text-left"
                        title={s.client_name}
                      >
                        {s.client_name}
                      </button>
                    </td>

                    {/* When */}
                    <td className="py-3 pr-4 whitespace-nowrap text-stone-600">
                      <button
                        onClick={() => navigate(`/sessions/${s.session_id}`)}
                        className="hover:underline text-left"
                      >
                        {formatDatetime(s.scheduled_at, t)}
                      </button>
                    </td>

                    {/* Attendance badge */}
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}
                        data-testid={`ucw-badge-${s.session_id}`}
                      >
                        {t(`reminders.dashboard.widget.status.${badge.label}`, badge.label)}
                      </span>
                      {s.last_reminder && (
                        <span className="ml-2 text-xs text-stone-400" title={s.last_reminder.sent_at || s.last_reminder.scheduled_send_at}>
                          {s.last_reminder.status === 'sent'
                            ? t('reminders.dashboard.widget.reminderSent', '✓ reminded')
                            : s.last_reminder.status === 'pending'
                            ? t('reminders.dashboard.widget.reminderPending', '⏳ reminder due')
                            : null}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => handleMarkAttendance(s.session_id, 'attended')}
                          disabled={isBusy}
                          data-testid={`ucw-attended-${s.session_id}`}
                          title={t('reminders.dashboard.widget.markAttended', 'Mark attended')}
                          className="px-2 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {t('reminders.dashboard.widget.markAttended', 'Attended')}
                        </button>
                        <button
                          onClick={() => handleMarkAttendance(s.session_id, 'no_show')}
                          disabled={isBusy}
                          data-testid={`ucw-noshow-${s.session_id}`}
                          title={t('reminders.dashboard.widget.markNoShow', 'Mark no-show')}
                          className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {t('reminders.dashboard.widget.markNoShow', 'No-show')}
                        </button>
                        <button
                          onClick={() => setRescheduleTarget({ session_id: s.session_id, scheduled_at: s.scheduled_at })}
                          disabled={isBusy}
                          data-testid={`ucw-reschedule-${s.session_id}`}
                          title={t('reminders.dashboard.widget.reschedule', 'Reschedule…')}
                          className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {t('reminders.dashboard.widget.reschedule', 'Reschedule…')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rescheduleTarget && (
        <RescheduleModal
          sessionId={rescheduleTarget.session_id}
          currentScheduledAt={rescheduleTarget.scheduled_at}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => handleRescheduleSuccess(rescheduleTarget.session_id)}
        />
      )}
    </div>
  );
}
