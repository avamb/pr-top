// SessionCalendar — T-02
// React calendar widget that highlights every date on which the client has
// at least one session ("точки на датах встреч") and lets the therapist click
// a date to open that session (if one exists). Built on top of react-day-picker
// per the T-02 spec ("использовать react-day-picker, не изобретать").
//
// Props:
//   sessions      — array of { id, meeting_date | scheduled_at | created_at }
//                   ONLY the date portion is used for matching, regardless of
//                   timezone (this is the calendar UX expected by therapists).
//   onSelectDate  — (Date, sessionsForDate) => void
//                   Fires when the user clicks a marked day. sessionsForDate
//                   is the subset of `sessions` whose date matches the click.
//                   For days with multiple sessions the caller decides what to
//                   do (typically: open the first / most recent).
//   onUnselectedDateClick — optional, fires when a non-marked day is clicked.
//                   Useful for "create a session on this date" flows.
//   locale        — i18n locale for the day names / month names. Accepts the
//                   same short codes the rest of the app uses ('en'|'ru'|'es'|'uk').
import React, { useMemo, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/src/style.css';

// Lazy-load locale objects from date-fns. We keep this map tiny — we only
// support the four locales the product ships with.
import { enUS, ru, es, uk } from 'date-fns/locale';

const LOCALE_MAP = {
  en: enUS,
  ru: ru,
  es: es,
  uk: uk
};

/**
 * Convert a session's date field into a YYYY-MM-DD key. We pick the first
 * available value in this order: meeting_date, scheduled_at, created_at.
 * Returns null if nothing parses.
 */
function sessionDateKey(session) {
  const raw = session && (session.meeting_date || session.scheduled_at || session.created_at);
  if (!raw) return null;
  // Accept either YYYY-MM-DD or full ISO timestamps. We always reduce to the
  // local-date YYYY-MM-DD so timezone shifts don't make Mar 31 23:00Z look
  // like Apr 1 in Vienna.
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  // For full datetimes treat as UTC and convert to local-day buckets.
  const isUtc = typeof raw === 'string' && (raw.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(raw));
  const dt = new Date(typeof raw === 'string' && !isUtc ? raw + 'Z' : raw);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convert a Date object to YYYY-MM-DD using local time. */
function dateToKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SessionCalendar({
  sessions = [],
  onSelectDate,
  onUnselectedDateClick,
  locale = 'en'
}) {
  // Build a lookup of session-by-date-key. A given date can have multiple
  // sessions (a therapist might record two short sessions on the same day),
  // so we map key -> array.
  const sessionsByDate = useMemo(() => {
    const map = new Map();
    for (const s of sessions || []) {
      const key = sessionDateKey(s);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [sessions]);

  // Convert keys to Date objects for react-day-picker's `modifiers`.
  const sessionDates = useMemo(() => {
    const out = [];
    for (const key of sessionsByDate.keys()) {
      const [y, m, d] = key.split('-').map(n => parseInt(n, 10));
      out.push(new Date(y, m - 1, d));
    }
    return out;
  }, [sessionsByDate]);

  const handleSelect = useCallback((date) => {
    if (!date) return;
    const key = dateToKey(date);
    const matched = sessionsByDate.get(key) || [];
    if (matched.length > 0) {
      if (typeof onSelectDate === 'function') onSelectDate(date, matched);
    } else if (typeof onUnselectedDateClick === 'function') {
      onUnselectedDateClick(date);
    }
  }, [sessionsByDate, onSelectDate, onUnselectedDateClick]);

  const dpLocale = LOCALE_MAP[locale] || enUS;

  return (
    <div data-testid="session-calendar" className="rdp-prtop-wrap">
      <DayPicker
        mode="single"
        onSelect={handleSelect}
        locale={dpLocale}
        modifiers={{
          hasSession: sessionDates
        }}
        modifiersClassNames={{
          hasSession: 'rdp-prtop-hasSession',
          today: 'rdp-prtop-today'
        }}
        showOutsideDays
        weekStartsOn={locale === 'en' ? 0 : 1}
      />
      {/* The dot under days with sessions is rendered via CSS injected by the
          parent page (see ClientDetail.jsx — the .rdp-prtop-hasSession rule).
          Inline style is intentionally avoided so the same calendar can be
          reused on /sessions later without duplicating decoration logic. */}
    </div>
  );
}

export { sessionDateKey, dateToKey };
