import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const API = '/api';

/**
 * RescheduleModal — minimal modal for rescheduling a session.
 * Props:
 *   sessionId: number
 *   currentScheduledAt: ISO string or null
 *   onClose(): void
 *   onSuccess(newScheduledAt: string): void
 */
export default function RescheduleModal({ sessionId, currentScheduledAt, onClose, onSuccess }) {
  const { t } = useTranslation();
  const token = localStorage.getItem('token');

  // Default the picker to the current scheduled_at if it exists, else empty
  const defaultDatetime = currentScheduledAt
    ? new Date(currentScheduledAt).toISOString().slice(0, 16)
    : '';

  const [newDatetime, setNewDatetime] = useState(defaultDatetime);
  const [notifyClient, setNotifyClient] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!newDatetime) {
      setError(t('reminders.dashboard.rescheduleModal.errorRequired', 'Please select a date and time.'));
      return;
    }
    const newAt = new Date(newDatetime).toISOString();
    if (new Date(newAt) <= new Date()) {
      setError(t('reminders.dashboard.rescheduleModal.errorPast', 'Please select a time in the future.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/sessions/${sessionId}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ new_scheduled_at: newAt, notify_client: notifyClient })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('reminders.dashboard.rescheduleModal.errorFailed', 'Failed to reschedule session.'));
      }
      const data = await res.json();
      onSuccess(data.new_scheduled_at || newAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={t('reminders.dashboard.rescheduleModal.title', 'Reschedule Session')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">
          {t('reminders.dashboard.rescheduleModal.title', 'Reschedule Session')}
        </h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            {t('reminders.dashboard.rescheduleModal.newTimeLabel', 'New date & time')}
          </label>
          <input
            type="datetime-local"
            value={newDatetime}
            onChange={(e) => setNewDatetime(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="reschedule-datetime-input"
          />
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notifyClient}
            onChange={(e) => setNotifyClient(e.target.checked)}
            data-testid="reschedule-notify-checkbox"
            className="w-4 h-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-stone-700">
            {t('reminders.dashboard.rescheduleModal.notifyClient', 'Notify client via Telegram')}
          </span>
        </label>

        {error && (
          <p className="text-rose-600 text-sm mb-3" data-testid="reschedule-error">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            data-testid="reschedule-cancel-btn"
          >
            {t('reminders.dashboard.rescheduleModal.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            data-testid="reschedule-confirm-btn"
          >
            {saving
              ? t('reminders.dashboard.rescheduleModal.saving', 'Saving…')
              : t('reminders.dashboard.rescheduleModal.confirm', 'Reschedule')}
          </button>
        </div>
      </div>
    </div>
  );
}
