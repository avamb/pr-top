import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API = '/api';

function formatTs(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) { return isoStr; }
}

function offsetLabel(offsetMinutes, t) {
  if (offsetMinutes === 0) return t('reminders.sessionDetail.timeline.atSessionTime', 'At session time');
  const absMin = Math.abs(offsetMinutes);
  if (absMin < 60) return t('reminders.sessionDetail.timeline.minutesBefore', '{{n}} min before', { n: absMin });
  const hours = Math.round(absMin / 60);
  if (hours === 24) return t('reminders.sessionDetail.timeline.dayBefore', 'Day before');
  return t('reminders.sessionDetail.timeline.hoursBefore', '{{n}}h before', { n: hours });
}

function EventRow({ event, t }) {
  if (event.type === 'reminder_dispatch') {
    const statusBg = {
      sent: 'bg-green-100 text-green-700',
      pending: 'bg-amber-100 text-amber-700',
      failed: 'bg-rose-100 text-rose-700',
      cancelled: 'bg-gray-100 text-gray-600',
    }[event.status] || 'bg-gray-100 text-gray-600';

    return (
      <div className="flex gap-3" data-testid={`timeline-event-${event.id}`}>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-teal-400 mt-1 shrink-0"></div>
          <div className="w-px flex-1 bg-gray-200 my-1"></div>
        </div>
        <div className="pb-4 min-w-0">
          <p className="text-sm text-stone-700">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${statusBg}`}>
              {t(`reminders.sessionDetail.timeline.dispatchStatus.${event.status}`, event.status)}
            </span>
            {t('reminders.sessionDetail.timeline.reminderVia', 'Reminder via {{channel}}', { channel: event.channel || '?' })}
            {' · '}
            <span className="text-stone-500">{offsetLabel(event.offset_minutes, t)}</span>
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {event.status === 'sent' && event.sent_at
              ? t('reminders.sessionDetail.timeline.sentAt', 'Sent at {{time}}', { time: formatTs(event.sent_at) })
              : t('reminders.sessionDetail.timeline.scheduledFor', 'Scheduled for {{time}}', { time: formatTs(event.scheduled_send_at) })}
          </p>
          {event.error && (
            <p className="text-xs text-rose-500 mt-0.5">{event.error}</p>
          )}
        </div>
      </div>
    );
  }

  // audit event
  const details = event.details || {};
  let description = '';
  let dotColor = 'bg-blue-400';

  switch (event.action) {
    case 'session_attendance_update':
    case 'session_attendance_update_by_client': {
      const who = event.action === 'session_attendance_update_by_client'
        ? t('reminders.sessionDetail.timeline.byClient', 'Client')
        : event.actor_email || t('reminders.sessionDetail.timeline.byTherapist', 'Therapist');
      description = t('reminders.sessionDetail.timeline.attendanceUpdated',
        '{{who}} marked attendance: {{status}}',
        {
          who,
          status: t(`reminders.sessionDetail.timeline.attendanceStatus.${details.new_status}`, details.new_status || '—')
        }
      );
      dotColor = details.new_status === 'attended' ? 'bg-emerald-500'
        : details.new_status === 'no_show' ? 'bg-red-500'
        : 'bg-blue-400';
      break;
    }
    case 'session_rescheduled': {
      description = t('reminders.sessionDetail.timeline.rescheduled',
        'Session rescheduled to {{newTime}}',
        { newTime: formatTs(details.new_scheduled_at) }
      );
      dotColor = 'bg-indigo-400';
      break;
    }
    case 'session_created': {
      description = t('reminders.sessionDetail.timeline.created', 'Session created');
      dotColor = 'bg-gray-400';
      break;
    }
    default:
      description = event.action;
  }

  return (
    <div className="flex gap-3" data-testid={`timeline-event-${event.id}`}>
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${dotColor} mt-1 shrink-0`}></div>
        <div className="w-px flex-1 bg-gray-200 my-1"></div>
      </div>
      <div className="pb-4 min-w-0">
        <p className="text-sm text-stone-700">{description}</p>
        <p className="text-xs text-stone-400 mt-0.5">{formatTs(event.timestamp)}</p>
        {details.reason && (
          <p className="text-xs text-stone-500 mt-0.5 italic">
            {t('reminders.sessionDetail.timeline.reason', 'Reason')}: {details.reason}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * AttendanceTimeline — vertical timeline of reminder dispatches and attendance events.
 * Props:
 *   sessionId: number | string
 */
export default function AttendanceTimeline({ sessionId }) {
  const { t } = useTranslation();
  const token = localStorage.getItem('token');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/sessions/${sessionId}/attendance-history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t('reminders.sessionDetail.timeline.fetchError', 'Could not load timeline.'));
        }
        const data = await res.json();
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [sessionId, token, t]);

  return (
    <section
      className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6"
      data-testid="attendance-timeline-section"
    >
      <h3 className="text-lg font-semibold text-stone-800 mb-4">
        {t('reminders.sessionDetail.timeline.title', 'Attendance & Reminder Timeline')}
      </h3>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-200 mt-1"></div>
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-rose-600 text-sm" data-testid="attendance-timeline-error">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-stone-400 text-sm" data-testid="attendance-timeline-empty">
          {t('reminders.sessionDetail.timeline.empty', 'No reminder or attendance events yet.')}
        </p>
      ) : (
        <div data-testid="attendance-timeline-list">
          {events.map((ev) => (
            <EventRow key={ev.id} event={ev} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}
