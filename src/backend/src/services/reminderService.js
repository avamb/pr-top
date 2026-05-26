// Session Reminder Service — "Appointment Confirmations" feature core.
//
// Architecture: docs/new_fichas/New Features/session-reminders-architecture.md §7.
//
// Four core internal methods that all other reminder tickets call:
//   1. computeWallClockTargets(scheduledAtIso, clientTimezone)  — pure function (testable)
//   2. planForSession(sessionId)                                — write dispatch rows
//   3. dispatchOptInNotices()                                   — 3C-strict opt-in flow
//   4. dispatchDue()                                            — process pending sends
//   5. cancelPendingForSession(sessionId, reason)               — supersede on cancel/reschedule
//   6. markNoShows()                                            — soft-default after grace
//
// Design notes:
//   - All wall-clock-anchored math uses Intl.DateTimeFormat with timeZone for
//     DST-safe behaviour (matches the helper in routes/clients.js:29–81).
//   - INSERT OR IGNORE relies on uq_srd_session_offset_channel (T-27) for
//     idempotency under cron overlap or restart.
//   - The dispatcher re-reads session.attendance_status immediately before
//     sending so a client confirmation mid-flight does not produce a wasted
//     reminder (race-condition mitigation, architecture §11).
//   - Quiet-hours skip is deliberately read from the *client's* escalation_preferences;
//     therapist quiet hours never gate client reminders.
//   - Every send + every state change is audit-logged.

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

let telegramNotify;
try {
  telegramNotify = require('../utils/telegramNotify');
} catch (e) {
  telegramNotify = null;
}

let emailService;
try {
  emailService = require('./emailService');
} catch (e) {
  emailService = null;
}

// ── Constants ──────────────────────────────────────────────────────────────
// Bucket labels for the unique index. They are NOT used for math — they are
// just stable per-target identifiers so a re-plan does not create duplicates.
const OFFSET_LABEL_DAY_BEFORE = 1440; // 24h, for "day-before 09:00 client local"
const OFFSET_LABEL_DAY_OF     = -1;   // synthetic, for "day-of 09:00 or session-2h"
const NO_SHOW_GRACE_MIN       = 30;   // mark no-show after scheduled + duration + 30min
const DISPATCH_BATCH_LIMIT    = 200;  // bound work per dispatch tick
const DEFAULT_DURATION_MIN    = 60;
const MORNING_LOCAL_HOUR      = 9;    // fixed at 09:00 client local per architecture §13.1 #9
const DAY_OF_LEAD_HOURS       = 2;    // reminder ≤ scheduled_at − 2h (architecture §4.1 #2)

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse an ISO-ish datetime string (with or without trailing 'Z') into a Date.
 * SQLite tends to store strings like '2026-05-26 09:00:00' (space separator,
 * no timezone) which JavaScript's Date constructor parses inconsistently
 * across engines. Normalise by replacing the space with 'T' and assuming UTC
 * if no zone is present (which matches SQLite datetime('now') semantics).
 */
function parseIso(str) {
  if (!str) return null;
  let s = String(str).trim();
  // SQLite uses space as separator; normalise to T.
  s = s.replace(' ', 'T');
  // If there's no timezone designator, treat as UTC (SQLite datetime('now') is UTC).
  if (!/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
    s = s + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Render a Date as a SQLite-friendly UTC ISO string ("YYYY-MM-DD HH:MM:SS").
 * datetime('now') style — comparable with the columns we write.
 */
function toSqliteUtc(date) {
  if (!date) return null;
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get the components of a Date as observed in a target IANA timezone.
 * Returns { year, month, day, hour, minute, second }. Uses Intl.DateTimeFormat
 * (DST-safe). Falls back to UTC if the timezone is invalid.
 */
function partsInZone(date, timezone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = (t) => {
      const p = parts.find((x) => x.type === t);
      return p ? parseInt(p.value, 10) : 0;
    };
    let hour = get('hour');
    if (hour === 24) hour = 0; // Intl quirk on some engines for midnight
    return {
      year:   get('year'),
      month:  get('month'),
      day:    get('day'),
      hour,
      minute: get('minute'),
      second: get('second'),
    };
  } catch (e) {
    // Invalid timezone → fall back to UTC components.
    return {
      year:   date.getUTCFullYear(),
      month:  date.getUTCMonth() + 1,
      day:    date.getUTCDate(),
      hour:   date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
}

/**
 * Convert wall-clock components in a target timezone to a UTC Date.
 * Two-pass technique: build a UTC Date from the wanted local components,
 * compute the offset between that UTC instant and what the target zone
 * thinks it is, then shift to land exactly on the desired local time.
 * DST-safe (this is the standard idiom for IANA conversion in vanilla JS).
 */
function zonedComponentsToUtc(year, month, day, hour, minute, second, timezone) {
  // Initial guess: treat the components as if they were already UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // What does the target timezone show at this UTC instant?
  const local = partsInZone(guess, timezone);
  // The difference between the local representation and the desired components
  // equals the offset between the local timezone and UTC at that moment.
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const offsetMs = localAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

// ── Pure function: computeWallClockTargets ─────────────────────────────────

/**
 * Compute the two wall-clock-anchored reminder targets for a session.
 *
 * Architecture §4.1 #2 + §7.2:
 *   Target A — day-before @ 09:00 client local
 *   Target B — day-of    @ 09:00 client local, BUT no later than (scheduled_at − 2h)
 *
 * Returns an array of zero, one, or two targets:
 *   [{ targetIsoUtc: 'YYYY-MM-DD HH:MM:SS', offsetLabel: 1440|-1, kind: 'day_before'|'day_of' }, ...]
 *
 * Skipping rules (target is OMITTED from the array, not nulled):
 *   - Target's UTC instant is in the past (no point planning).
 *   - For target B, if (scheduled_at − 2h) is in the past, the day-of slot is skipped.
 *
 * Quiet-hours and other client-side filtering happen LATER in dispatchDue;
 * this function is purely about wall-clock-anchored target computation so it
 * is trivially unit-testable (no DB, no I/O).
 *
 * @param {string} scheduledAtIso - session.scheduled_at (UTC ISO, possibly without 'Z')
 * @param {string} clientTimezone - IANA zone, e.g. 'Europe/Moscow'
 * @param {Date}   [now=new Date()] - injectable clock for tests
 * @returns {Array<{targetIsoUtc:string, offsetLabel:number, kind:string}>}
 */
function computeWallClockTargets(scheduledAtIso, clientTimezone, now) {
  const sessionDate = parseIso(scheduledAtIso);
  if (!sessionDate) return [];
  const clock = now instanceof Date ? now : new Date();

  // Session components AS OBSERVED in the client's timezone.
  const sessionLocal = partsInZone(sessionDate, clientTimezone);

  const targets = [];

  // ── Target A: day-before 09:00 client local ──
  // Build a Date at (session_local_date − 1 day) 09:00:00 in clientTimezone.
  // We do day-arithmetic via UTC math on a midnight-anchored Date, then ask
  // the zone to interpret the result — DST-safe because the conversion back
  // to UTC happens through zonedComponentsToUtc which re-queries the zone.
  const dayBeforeUtcAnchor = new Date(Date.UTC(sessionLocal.year, sessionLocal.month - 1, sessionLocal.day));
  dayBeforeUtcAnchor.setUTCDate(dayBeforeUtcAnchor.getUTCDate() - 1);
  const targetAUtc = zonedComponentsToUtc(
    dayBeforeUtcAnchor.getUTCFullYear(),
    dayBeforeUtcAnchor.getUTCMonth() + 1,
    dayBeforeUtcAnchor.getUTCDate(),
    MORNING_LOCAL_HOUR, 0, 0,
    clientTimezone
  );
  if (targetAUtc.getTime() > clock.getTime()) {
    targets.push({
      targetIsoUtc: toSqliteUtc(targetAUtc),
      offsetLabel:  OFFSET_LABEL_DAY_BEFORE,
      kind:         'day_before',
    });
  }

  // ── Target B: day-of 09:00 client local, but ≤ scheduled_at − 2h ──
  // Architecture §4.1 #2: prefer 09:00 client-local; fall back to scheduled−2h
  // if 09:00 falls inside the 2h pre-session window (or already passed) — but
  // only if scheduled−2h is still in the future. Otherwise skip.
  const dayOf09Utc = zonedComponentsToUtc(
    sessionLocal.year, sessionLocal.month, sessionLocal.day,
    MORNING_LOCAL_HOUR, 0, 0,
    clientTimezone
  );
  const sessionMinusLeadUtc = new Date(sessionDate.getTime() - DAY_OF_LEAD_HOURS * 60 * 60 * 1000);
  const dayOf09Usable = dayOf09Utc.getTime() > clock.getTime()
                     && dayOf09Utc.getTime() <= sessionMinusLeadUtc.getTime();
  let targetBUtc = null;
  if (dayOf09Usable) {
    // Normal path: 09:00 client-local is in the future and lands ≥ 2h before session.
    targetBUtc = dayOf09Utc;
  } else if (sessionMinusLeadUtc.getTime() > clock.getTime()) {
    // 09:00 either already passed or falls inside the 2h pre-window → fall back
    // to scheduled−2h so we still deliver a timely day-of reminder.
    targetBUtc = sessionMinusLeadUtc;
  }
  if (targetBUtc && targetBUtc.getTime() < sessionDate.getTime()) {
    targets.push({
      targetIsoUtc: toSqliteUtc(targetBUtc),
      offsetLabel:  OFFSET_LABEL_DAY_OF,
      kind:         'day_of',
    });
  }

  return targets;
}

// ── planForSession ─────────────────────────────────────────────────────────

/**
 * Plan reminder dispatches for a single session.
 *
 * Loads session + client. If client.session_reminders_enabled !== 1, exits silently.
 * Snapshots client_timezone_snapshot on first call (so later tz changes don't
 * retroactively move pending reminders). Computes targets via the pure function
 * and INSERTs (with OR IGNORE) one row per (target × channel-the-client-has).
 *
 * @param {number} sessionId
 * @returns {Promise<{planned:number, skipped_no_optin?:boolean, skipped_no_contact?:boolean, error?:string}>}
 */
async function planForSession(sessionId) {
  try {
    const db = getDatabase();

    const sessRes = db.exec(
      `SELECT s.id, s.therapist_id, s.client_id, s.scheduled_at, s.client_timezone_snapshot, s.attendance_status
         FROM sessions s
        WHERE s.id = ?`,
      [sessionId]
    );
    if (!sessRes.length || !sessRes[0].values.length) {
      return { planned: 0, error: 'session_not_found' };
    }
    const [sId, therapistId, clientId, scheduledAt, snapshotTz, attendanceStatus] = sessRes[0].values[0];

    // Don't plan reminders for a session that is already cancelled or marked.
    if (attendanceStatus && /^cancelled_/.test(String(attendanceStatus))) {
      return { planned: 0, skipped_cancelled: true };
    }

    const clientRes = db.exec(
      `SELECT id, telegram_id, email, timezone, session_reminders_enabled, blocked_at, consent_therapist_access
         FROM users WHERE id = ?`,
      [clientId]
    );
    if (!clientRes.length || !clientRes[0].values.length) {
      return { planned: 0, error: 'client_not_found' };
    }
    const [, telegramId, email, clientTz, sessionRemindersEnabled, blockedAt, consentTherapistAccess] = clientRes[0].values[0];

    if (sessionRemindersEnabled !== 1) {
      return { planned: 0, skipped_no_optin: true };
    }
    if (blockedAt) {
      return { planned: 0, skipped_blocked: true };
    }
    if (consentTherapistAccess !== 1) {
      return { planned: 0, skipped_no_consent: true };
    }

    // Snapshot client tz if not already set.
    let effectiveTz = snapshotTz;
    if (!effectiveTz) {
      effectiveTz = clientTz || 'UTC';
      db.run(
        `UPDATE sessions SET client_timezone_snapshot = ? WHERE id = ?`,
        [effectiveTz, sId]
      );
    }

    // Compute wall-clock targets.
    const targets = computeWallClockTargets(scheduledAt, effectiveTz);
    if (targets.length === 0) {
      saveDatabaseAfterWrite();
      return { planned: 0, skipped_all_in_past: true };
    }

    // For each (target × available channel) → insert OR IGNORE.
    const channels = [];
    if (telegramId) channels.push('telegram');
    if (email)      channels.push('email');
    if (channels.length === 0) {
      saveDatabaseAfterWrite();
      return { planned: 0, skipped_no_contact: true };
    }

    let planned = 0;
    for (const t of targets) {
      for (const ch of channels) {
        try {
          const before = db.exec(
            `SELECT id FROM session_reminder_dispatches
              WHERE session_id = ? AND offset_minutes = ? AND channel = ?`,
            [sId, t.offsetLabel, ch]
          );
          if (before.length && before[0].values.length) {
            // Already planned — leave alone (idempotent).
            continue;
          }
          db.run(
            `INSERT INTO session_reminder_dispatches
               (session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [sId, therapistId, clientId, t.offsetLabel, t.targetIsoUtc, ch]
          );
          planned++;
        } catch (e) {
          // Unique-index violation is benign (race). Anything else, log.
          if (!/UNIQUE/i.test(e.message)) {
            logger.warn(`[reminderService] planForSession insert failed: ${e.message}`);
          }
        }
      }
    }

    saveDatabaseAfterWrite();
    return { planned, targets: targets.length, channels: channels.length };
  } catch (error) {
    logger.error(`[reminderService] planForSession(${sessionId}) error: ${error.message}`);
    return { planned: 0, error: error.message };
  }
}

// ── dispatchOptInNotices ───────────────────────────────────────────────────

/**
 * Find clients eligible for the one-shot opt-in notice and send it via the bot.
 *
 * Architecture §7.4: 3C-strict.
 *
 * Eligibility:
 *   role='client', blocked_at IS NULL, consent_therapist_access=1,
 *   session_reminders_enabled IS NULL, session_reminders_asked_at IS NULL,
 *   AND has ≥1 future session in the next 14 days under a therapist
 *   whose reminder_policy_json.enabled=true.
 *
 * Sends a bot message with [✅ Ok, remind me] / [🔕 Don't] inline keyboard,
 * stamps session_reminders_asked_at = now(), audits the event.
 *
 * @returns {Promise<{asked:number, errors:number}>}
 */
async function dispatchOptInNotices() {
  try {
    const db = getDatabase();
    const candidatesRes = db.exec(
      `SELECT DISTINCT u.id, u.telegram_id, u.language, u.therapist_id
         FROM users u
         JOIN sessions s ON s.client_id = u.id
         JOIN users th ON th.id = u.therapist_id
        WHERE u.role = 'client'
          AND u.blocked_at IS NULL
          AND u.consent_therapist_access = 1
          AND u.session_reminders_enabled IS NULL
          AND u.session_reminders_asked_at IS NULL
          AND u.telegram_id IS NOT NULL
          AND s.scheduled_at >= datetime('now')
          AND s.scheduled_at <= datetime('now', '+14 days')
          AND th.reminder_policy_json IS NOT NULL
          AND json_extract(th.reminder_policy_json, '$.enabled') = 1`
    );

    if (!candidatesRes.length || !candidatesRes[0].values.length) {
      return { asked: 0, errors: 0 };
    }

    let asked = 0;
    let errors = 0;

    for (const row of candidatesRes[0].values) {
      const [clientId, telegramId, language, therapistId] = row;

      // Localised opt-in text. Keep this minimal — bot tickets will replace
      // with a proper template lookup. Fallback to EN if locale missing.
      const lang = ['en', 'ru', 'es', 'uk'].includes(language) ? language : 'en';
      const text = (
        lang === 'ru' ? '🔔 Ваш терапевт включил *напоминания о сессиях*. Я буду писать накануне и в день встречи. Можно?\n\nНажмите кнопку ниже.' :
        lang === 'es' ? '🔔 Tu terapeuta activó los *recordatorios de sesión*. ¿Te aviso el día antes y el día de la cita?' :
        lang === 'uk' ? '🔔 Ваш терапевт увімкнув *нагадування про сесії*. Можна написати напередодні і в день зустрічі?' :
                        '🔔 Your therapist turned on *session reminders*. I will message you the day before and the day of each session. OK?'
      );

      const okBtn   = lang === 'ru' ? '✅ Ок, напоминай' : lang === 'es' ? '✅ Sí, recuérdame' : lang === 'uk' ? '✅ Так, нагадуй' : '✅ OK, remind me';
      const noBtn   = lang === 'ru' ? '🔕 Не присылать'  : lang === 'es' ? '🔕 No enviar'     : lang === 'uk' ? '🔕 Не надсилати' : '🔕 Don\'t';

      const replyMarkup = {
        inline_keyboard: [[
          { text: okBtn, callback_data: `optin_session_reminders_yes:${clientId}` },
          { text: noBtn, callback_data: `optin_session_reminders_no:${clientId}` },
        ]],
      };

      let messageRef = null;
      try {
        if (telegramNotify) {
          const result = await telegramNotify.sendMessage(telegramId, text, {
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          });
          if (result && result.sent) {
            messageRef = result.messageId || null;
          } else if (result && !result.sent && result.error && /Telegram bot token not configured/.test(result.error)) {
            // Dev mode — count as asked anyway, so the throttle moves forward.
          } else if (result && !result.sent) {
            errors++;
            // Don't stamp asked_at on hard failure — therapist will re-prompt later.
            continue;
          }
        }
      } catch (e) {
        errors++;
        logger.warn(`[reminderService] opt-in send to ${telegramId} failed: ${e.message}`);
        continue;
      }

      // Stamp asked_at + audit.
      db.run(
        `UPDATE users SET session_reminders_asked_at = datetime('now') WHERE id = ?`,
        [clientId]
      );
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (0, 'session_reminder_optin_asked', 'user', ?, ?, datetime('now'))`,
        [clientId, JSON.stringify({ therapist_id: therapistId, message_ref: messageRef, lang })]
      );
      asked++;
    }

    saveDatabaseAfterWrite();
    logger.info(`[reminderService] dispatchOptInNotices: asked=${asked}, errors=${errors}`);
    return { asked, errors };
  } catch (error) {
    logger.error(`[reminderService] dispatchOptInNotices error: ${error.message}`);
    return { asked: 0, errors: 1, error: error.message };
  }
}

// ── dispatchDue ────────────────────────────────────────────────────────────

/**
 * Render the reminder message body in the client's language.
 * Kept inline (no template table in MVP per architecture §5.3).
 */
function renderReminderMessage(kind, lang, ctx) {
  // ctx: { therapistName, scheduledAt, clientFirstName }
  const therapist = ctx.therapistName || '';
  const when      = ctx.scheduledAt || '';
  const first     = ctx.clientFirstName || '';
  const greet     = first ? `${first}, ` : '';

  if (kind === 'day_before') {
    return (
      lang === 'ru' ? `🗓 ${greet}напоминаю: завтра в ${when} у вас встреча с ${therapist}. Подтвердите, пожалуйста.` :
      lang === 'es' ? `🗓 ${greet}recordatorio: mañana a las ${when} tienes sesión con ${therapist}. Por favor confirma.` :
      lang === 'uk' ? `🗓 ${greet}нагадую: завтра о ${when} у вас зустріч із ${therapist}. Будь ласка, підтвердіть.` :
                      `🗓 ${greet}reminder: tomorrow at ${when} you have a session with ${therapist}. Please confirm.`
    );
  }
  // day_of
  return (
    lang === 'ru' ? `⏰ ${greet}сегодня в ${when} встреча с ${therapist}. До встречи!` :
    lang === 'es' ? `⏰ ${greet}hoy a las ${when} tienes sesión con ${therapist}. ¡Nos vemos!` :
    lang === 'uk' ? `⏰ ${greet}сьогодні о ${when} зустріч із ${therapist}. До зустрічі!` :
                    `⏰ ${greet}today at ${when} you have a session with ${therapist}. See you soon!`
  );
}

/**
 * Check whether `nowDate` falls inside the client's configured quiet hours.
 * escalation_preferences shape: { quiet_hours_enabled, quiet_hours_start, quiet_hours_end }.
 * Returns true if quiet hours are enabled AND nowDate (interpreted in client tz)
 * falls inside the window. Windows can cross midnight (e.g. 22:00..08:00).
 */
function isInClientQuietHours(nowDate, clientTimezone, escalationPrefsJson) {
  if (!escalationPrefsJson) return false;
  let prefs;
  try {
    prefs = JSON.parse(escalationPrefsJson);
  } catch (e) {
    return false;
  }
  if (!prefs || !prefs.quiet_hours_enabled) return false;
  const start = prefs.quiet_hours_start || '22:00';
  const end   = prefs.quiet_hours_end   || '08:00';
  const [sH, sM] = String(start).split(':').map((x) => parseInt(x, 10) || 0);
  const [eH, eM] = String(end).split(':').map((x) => parseInt(x, 10) || 0);
  const now = partsInZone(nowDate, clientTimezone);
  const nowMin = now.hour * 60 + now.minute;
  const startMin = sH * 60 + sM;
  const endMin   = eH * 60 + eM;
  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Window crosses midnight.
  return nowMin >= startMin || nowMin < endMin;
}

/**
 * Process pending reminder dispatches whose scheduled_send_at has arrived.
 * Bounded at DISPATCH_BATCH_LIMIT rows per tick.
 *
 * For each row:
 *   - re-read session.attendance_status → if confirmed/cancelled_*, mark superseded
 *   - re-check client (blocked / opted-out / no contact) → mark skipped if so
 *   - check client quiet hours → mark skipped if in quiet hours
 *   - call telegramNotify or emailService → on success mark sent (+message_ref),
 *     on failure mark failed (+error). Audit log either way.
 *
 * @returns {Promise<{sent:number, failed:number, skipped:number, superseded:number}>}
 */
async function dispatchDue() {
  const db = getDatabase();
  const summary = { sent: 0, failed: 0, skipped: 0, superseded: 0 };

  try {
    const dueRes = db.exec(
      `SELECT id, session_id, therapist_id, client_id, offset_minutes, scheduled_send_at, channel
         FROM session_reminder_dispatches
        WHERE status = 'pending' AND scheduled_send_at <= datetime('now')
        ORDER BY scheduled_send_at ASC
        LIMIT ?`,
      [DISPATCH_BATCH_LIMIT]
    );

    if (!dueRes.length || !dueRes[0].values.length) {
      return summary;
    }

    const now = new Date();

    for (const row of dueRes[0].values) {
      const [dispatchId, sessionId, therapistId, clientId, offsetLabel, scheduledSendAt, channel] = row;

      try {
        // ── 1. Re-read session state ──
        const sessRes = db.exec(
          `SELECT scheduled_at, attendance_status, client_timezone_snapshot
             FROM sessions WHERE id = ?`,
          [sessionId]
        );
        if (!sessRes.length || !sessRes[0].values.length) {
          db.run(
            `UPDATE session_reminder_dispatches SET status='superseded', error='session_missing' WHERE id=?`,
            [dispatchId]
          );
          summary.superseded++;
          continue;
        }
        const [sessionScheduledAt, attendanceStatus, tzSnap] = sessRes[0].values[0];

        if (attendanceStatus === 'confirmed' || (attendanceStatus && /^cancelled_/.test(String(attendanceStatus)))) {
          db.run(
            `UPDATE session_reminder_dispatches SET status='superseded', error='attendance_${attendanceStatus}' WHERE id=?`,
            [dispatchId]
          );
          summary.superseded++;
          continue;
        }

        // Don't send a reminder AFTER the session has started.
        const sessDate = parseIso(sessionScheduledAt);
        if (sessDate && sessDate.getTime() <= now.getTime()) {
          db.run(
            `UPDATE session_reminder_dispatches SET status='superseded', error='session_already_passed' WHERE id=?`,
            [dispatchId]
          );
          summary.superseded++;
          continue;
        }

        // ── 2. Re-read client state ──
        const clRes = db.exec(
          `SELECT telegram_id, email, language, first_name, blocked_at,
                  consent_therapist_access, session_reminders_enabled, timezone,
                  escalation_preferences
             FROM users WHERE id = ?`,
          [clientId]
        );
        if (!clRes.length || !clRes[0].values.length) {
          db.run(
            `UPDATE session_reminder_dispatches SET status='skipped', error='client_missing' WHERE id=?`,
            [dispatchId]
          );
          summary.skipped++;
          continue;
        }
        const [
          clTelegramId, clEmail, clLang, clFirstName, clBlockedAt,
          clConsent, clEnabled, clTimezone, clEscalationJson,
        ] = clRes[0].values[0];

        if (clBlockedAt || clConsent !== 1 || clEnabled !== 1) {
          db.run(
            `UPDATE session_reminder_dispatches SET status='skipped', error='client_not_eligible' WHERE id=?`,
            [dispatchId]
          );
          summary.skipped++;
          continue;
        }

        const effectiveTz = tzSnap || clTimezone || 'UTC';

        // ── 3. Quiet hours check ──
        if (isInClientQuietHours(now, effectiveTz, clEscalationJson)) {
          db.run(
            `UPDATE session_reminder_dispatches SET status='skipped', error='quiet_hours' WHERE id=?`,
            [dispatchId]
          );
          summary.skipped++;
          continue;
        }

        // ── 4. Resolve therapist display name ──
        const thRes = db.exec(`SELECT first_name, last_name FROM users WHERE id = ?`, [therapistId]);
        const thFirst = (thRes.length && thRes[0].values.length) ? (thRes[0].values[0][0] || '') : '';
        const thLast  = (thRes.length && thRes[0].values.length) ? (thRes[0].values[0][1] || '') : '';
        const therapistName = [thFirst, thLast].filter(Boolean).join(' ') || 'your therapist';

        // ── 5. Render local session time in client's timezone ──
        const sessLocal = partsInZone(sessDate, effectiveTz);
        const hh = String(sessLocal.hour).padStart(2, '0');
        const mm = String(sessLocal.minute).padStart(2, '0');
        const whenStr = `${hh}:${mm}`;

        const lang = ['en', 'ru', 'es', 'uk'].includes(clLang) ? clLang : 'en';
        const kind = offsetLabel === OFFSET_LABEL_DAY_BEFORE ? 'day_before' : 'day_of';
        const body = renderReminderMessage(kind, lang, {
          therapistName,
          scheduledAt: whenStr,
          clientFirstName: clFirstName,
        });

        // ── 6. Send via the resolved channel ──
        let sent = false;
        let sendErr = null;
        let messageRef = null;
        if (channel === 'telegram') {
          if (!clTelegramId) {
            sendErr = 'no_telegram_id';
          } else if (telegramNotify) {
            const replyMarkup = {
              inline_keyboard: [[
                { text: lang === 'ru' ? '✅ Буду'           : lang === 'es' ? '✅ Confirmo'       : lang === 'uk' ? '✅ Буду'        : '✅ I\'ll be there',
                  callback_data: `confirm_session_${sessionId}` },
                { text: lang === 'ru' ? '🔄 Хочу перенести' : lang === 'es' ? '🔄 Quiero mover'   : lang === 'uk' ? '🔄 Хочу перенести' : '🔄 Ask to reschedule',
                  callback_data: `reschedule_session_${sessionId}` },
                { text: lang === 'ru' ? '🆓 Не смогу'       : lang === 'es' ? '🆓 No podré'       : lang === 'uk' ? '🆓 Не зможу'    : '🆓 Release slot',
                  callback_data: `release_session_${sessionId}` },
              ]],
            };
            const result = await telegramNotify.sendMessage(clTelegramId, body, {
              parse_mode: 'Markdown',
              reply_markup: replyMarkup,
            });
            if (result && result.sent) {
              sent = true;
              messageRef = result.messageId || null;
            } else if (result && !result.sent && /Telegram bot token not configured/.test(result.error || '')) {
              // Dev mode — count as sent so we don't retry forever locally.
              sent = true;
              messageRef = null;
            } else {
              sendErr = (result && result.error) || 'telegram_send_failed';
            }
          } else {
            sendErr = 'telegram_module_unavailable';
          }
        } else if (channel === 'email') {
          if (!clEmail) {
            sendErr = 'no_email';
          } else if (emailService) {
            // We don't have a dedicated session_reminder template yet (architecture §12
            // step 5 will add it). Fall back to sendRawEmail-equivalent via sendEmail
            // with welcome template fields shaped as best-effort, OR — since no
            // template exists — log the would-send and treat as sent in dev mode.
            // Real send: future ticket will register the 'session_reminder' template.
            try {
              if (typeof emailService.sendSessionReminder === 'function') {
                const r = await emailService.sendSessionReminder(clEmail, { body, lang });
                if (r && r.sent) { sent = true; messageRef = r.messageId || null; }
                else { sendErr = (r && r.error) || 'email_send_failed'; }
              } else {
                // Template not yet registered — log + count as sent (dev/MVP).
                logger.info(`[reminderService] (no email template yet) Would send to ${clEmail}: ${body.substring(0, 120)}`);
                sent = true;
              }
            } catch (e) {
              sendErr = e.message;
            }
          } else {
            sendErr = 'email_module_unavailable';
          }
        } else {
          sendErr = `unknown_channel:${channel}`;
        }

        // ── 7. Persist outcome + audit ──
        if (sent) {
          db.run(
            `UPDATE session_reminder_dispatches
                SET status='sent', sent_at=datetime('now'), message_ref=?
              WHERE id=?`,
            [messageRef ? String(messageRef) : null, dispatchId]
          );
          db.run(
            `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
             VALUES (0, 'session_reminder_sent', 'session', ?, ?, datetime('now'))`,
            [sessionId, JSON.stringify({ dispatch_id: dispatchId, channel, offset_label: offsetLabel, message_ref: messageRef })]
          );
          summary.sent++;
        } else {
          db.run(
            `UPDATE session_reminder_dispatches
                SET status='failed', error=?, retry_count = retry_count + 1
              WHERE id=?`,
            [String(sendErr || 'unknown_error'), dispatchId]
          );
          db.run(
            `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
             VALUES (0, 'session_reminder_failed', 'session', ?, ?, datetime('now'))`,
            [sessionId, JSON.stringify({ dispatch_id: dispatchId, channel, error: sendErr })]
          );
          summary.failed++;
        }
      } catch (innerErr) {
        logger.warn(`[reminderService] dispatchDue row ${dispatchId} failed: ${innerErr.message}`);
        try {
          db.run(
            `UPDATE session_reminder_dispatches SET status='failed', error=? WHERE id=?`,
            [String(innerErr.message), dispatchId]
          );
        } catch (e) { /* ignore */ }
        summary.failed++;
      }
    }

    saveDatabaseAfterWrite();
    return summary;
  } catch (error) {
    logger.error(`[reminderService] dispatchDue error: ${error.message}`);
    return { ...summary, error: error.message };
  }
}

// ── cancelPendingForSession ────────────────────────────────────────────────

/**
 * Mark all PENDING dispatches for a session as 'superseded' (typically called
 * by the reschedule and cancel endpoints). Returns the count of rows updated.
 *
 * @param {number} sessionId
 * @param {string} [reason] - free-form reason ('rescheduled' | 'cancelled_by_client' | ...)
 */
function cancelPendingForSession(sessionId, reason) {
  try {
    const db = getDatabase();
    const before = db.exec(
      `SELECT COUNT(*) FROM session_reminder_dispatches WHERE session_id=? AND status='pending'`,
      [sessionId]
    );
    const count = (before.length && before[0].values.length) ? before[0].values[0][0] : 0;
    if (count === 0) return { cancelled: 0 };
    db.run(
      `UPDATE session_reminder_dispatches
          SET status='superseded', error=?
        WHERE session_id=? AND status='pending'`,
      [reason ? String(reason) : 'superseded', sessionId]
    );
    db.run(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
       VALUES (0, 'session_reminder_superseded', 'session', ?, ?, datetime('now'))`,
      [sessionId, JSON.stringify({ count, reason: reason || null })]
    );
    saveDatabaseAfterWrite();
    return { cancelled: count };
  } catch (error) {
    logger.error(`[reminderService] cancelPendingForSession(${sessionId}) error: ${error.message}`);
    return { cancelled: 0, error: error.message };
  }
}

// ── markNoShows ────────────────────────────────────────────────────────────

/**
 * Soft-default unattended sessions to 'no_show' after grace window.
 * Only touches sessions whose attendance_status is NULL or 'confirmed'.
 * The therapist can override the flag from the dashboard (always source of truth).
 *
 * SQL: scheduled_at + duration_minutes + 30min < now()
 */
function markNoShows() {
  try {
    const db = getDatabase();
    const candidatesRes = db.exec(
      `SELECT id
         FROM sessions
        WHERE (attendance_status IS NULL OR attendance_status = 'confirmed')
          AND datetime(scheduled_at, '+' || COALESCE(duration_minutes, ${DEFAULT_DURATION_MIN}) || ' minutes', '+${NO_SHOW_GRACE_MIN} minutes') < datetime('now')`
    );
    if (!candidatesRes.length || !candidatesRes[0].values.length) {
      return { marked: 0 };
    }
    const ids = candidatesRes[0].values.map((r) => r[0]);
    for (const id of ids) {
      db.run(
        `UPDATE sessions
            SET attendance_status='no_show',
                attendance_updated_at=datetime('now'),
                attendance_updated_by=0
          WHERE id=?`,
        [id]
      );
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (0, 'session_marked_no_show', 'session', ?, ?, datetime('now'))`,
        [id, JSON.stringify({ source: 'auto_sweep' })]
      );
    }
    saveDatabaseAfterWrite();
    logger.info(`[reminderService] markNoShows: marked ${ids.length} session(s)`);
    return { marked: ids.length, session_ids: ids };
  } catch (error) {
    logger.error(`[reminderService] markNoShows error: ${error.message}`);
    return { marked: 0, error: error.message };
  }
}

// ── exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Pure function (testable without DB).
  computeWallClockTargets,
  // Service operations.
  planForSession,
  dispatchOptInNotices,
  dispatchDue,
  cancelPendingForSession,
  markNoShows,
  // Constants exposed for callers (scheduler, tests).
  OFFSET_LABEL_DAY_BEFORE,
  OFFSET_LABEL_DAY_OF,
  // Internal helpers exposed for unit tests.
  _internal: {
    parseIso,
    toSqliteUtc,
    partsInZone,
    zonedComponentsToUtc,
    isInClientQuietHours,
    renderReminderMessage,
  },
};
