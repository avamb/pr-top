// Public attendance-link landing endpoint.
//
// Architecture §4.1 #3 + §6.2: the email reminder includes three signed-link
// CTA buttons (Confirm / Reschedule / Release). The corresponding URLs point
// here. We verify the HMAC token (utils/signedLinks.js), apply the requested
// attendance state change to the session, supersede pending reminder
// dispatches, write an audit log row, and render a mobile-friendly
// thank-you HTML page in the client's language.
//
// This is a PUBLIC endpoint: no auth, no CSRF (mounted before csrfProtection in
// index.js, like the other public token endpoints). Security comes from the HMAC
// signature on the token.
//
// GET only renders a confirmation page (mail scanners and prefetchers GET every
// link in an email); the page's button POSTs the token, and only that POST
// changes state.
//
// Mounted at: app.use('/api/public', router) — yielding GET and POST /api/public/attendance-link.

const express = require('express');
const router = express.Router();

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');
const { verifyAttendanceToken } = require('../utils/signedLinks');

// reminderService is optional at module load time (lazy-required below).
let reminderService = null;

function getReminderService() {
  if (reminderService !== null) return reminderService;
  try {
    reminderService = require('../services/reminderService');
  } catch (e) {
    reminderService = false;
  }
  return reminderService;
}

// ── Localised landing-page strings ─────────────────────────────────────────

const LOCALES = ['en', 'ru', 'es', 'uk'];

function pickLang(req, fallback) {
  const q = (req.query && req.query.lang) ? String(req.query.lang).slice(0, 5).toLowerCase() : '';
  if (LOCALES.includes(q)) return q;
  if (fallback && LOCALES.includes(fallback)) return fallback;
  // Best-effort Accept-Language sniff (very simple).
  const al = (req.headers && req.headers['accept-language']) ? String(req.headers['accept-language']) : '';
  for (const lang of LOCALES) {
    if (al.toLowerCase().includes(lang)) return lang;
  }
  return 'en';
}

const STRINGS = {
  // Outcome page headlines
  confirmed: {
    en: 'Thanks — we\'ve got your confirmation.',
    ru: 'Спасибо — мы зафиксировали ваше подтверждение.',
    es: 'Gracias — hemos registrado tu confirmación.',
    uk: 'Дякуємо — ми зафіксували ваше підтвердження.',
  },
  reschedule_requested: {
    en: 'Got it — your therapist will reach out to find a new time.',
    ru: 'Принято — терапевт свяжется с вами, чтобы согласовать новое время.',
    es: 'Entendido — tu terapeuta se pondrá en contacto para acordar un nuevo horario.',
    uk: 'Прийнято — терапевт зв\'яжеться з вами, щоб узгодити новий час.',
  },
  released: {
    en: 'Thanks for letting us know early — your therapist has been notified.',
    ru: 'Спасибо, что предупредили заранее — терапевту сообщено.',
    es: 'Gracias por avisar con tiempo — hemos notificado a tu terapeuta.',
    uk: 'Дякуємо, що попередили заздалегідь — терапевта повідомлено.',
  },
  optin_yes: {
    en: 'Thanks — you\'ll receive a gentle reminder the day before and on the day of each session.',
    ru: 'Спасибо — мы будем присылать короткое напоминание накануне и в день каждой встречи.',
    es: 'Gracias — recibirás un recordatorio el día antes y el día de cada sesión.',
    uk: 'Дякуємо — ви отримуватимете коротке нагадування напередодні та в день кожної зустрічі.',
  },
  optin_no: {
    en: 'OK — we won\'t send you session reminders. You can change your mind any time by asking your therapist.',
    ru: 'Хорошо — напоминания о сессиях присылать не будем. Если передумаете, скажите терапевту.',
    es: 'De acuerdo — no te enviaremos recordatorios de sesión. Si cambias de opinión, avisa a tu terapeuta.',
    uk: 'Гаразд — нагадування про сесії не надсилатимемо. Якщо передумаєте, скажіть терапевту.',
  },
  errors: {
    invalid: {
      en: 'This link is invalid or has been tampered with.',
      ru: 'Эта ссылка некорректна или была изменена.',
      es: 'Este enlace no es válido o ha sido alterado.',
      uk: 'Це посилання некоректне або було змінене.',
    },
    expired: {
      en: 'This link has expired. Please contact your therapist directly.',
      ru: 'Срок действия ссылки истёк. Свяжитесь с терапевтом напрямую.',
      es: 'Este enlace ha caducado. Por favor, contacta directamente con tu terapeuta.',
      uk: 'Термін дії посилання минув. Зв\'яжіться з терапевтом напряму.',
    },
    session_gone: {
      en: 'We couldn\'t find that session. It may have been cancelled or removed.',
      ru: 'Не удалось найти эту встречу. Возможно, она была отменена.',
      es: 'No pudimos encontrar esa sesión. Puede que haya sido cancelada.',
      uk: 'Не вдалося знайти цю зустріч. Можливо, її скасували.',
    },
    already_passed: {
      en: 'This session has already started or passed.',
      ru: 'Эта встреча уже началась или прошла.',
      es: 'Esta sesión ya ha comenzado o ha pasado.',
      uk: 'Ця зустріч вже почалася або відбулася.',
    },
    wrong_user: {
      en: 'This link doesn\'t match your account.',
      ru: 'Эта ссылка не соответствует вашему аккаунту.',
      es: 'Este enlace no corresponde a tu cuenta.',
      uk: 'Це посилання не відповідає вашому акаунту.',
    },
  },
  footer: {
    en: 'You can close this window now.',
    ru: 'Вы можете закрыть это окно.',
    es: 'Ya puedes cerrar esta ventana.',
    uk: 'Ви можете закрити це вікно.',
  },
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the public thank-you / error page. Mobile-friendly single-string HTML.
 */
function renderPage({ title, message, lang, isError, form }) {
  const safeTitle = escapeHtml(title || 'PR-TOP');
  const safeMsg   = escapeHtml(message || '');
  const langSafe  = LOCALES.includes(lang) ? lang : 'en';
  const footer    = escapeHtml(STRINGS.footer[langSafe] || STRINGS.footer.en);
  const color     = isError ? '#dc2626' : '#10b981';

  return `<!DOCTYPE html>
<html lang="${langSafe}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f9; color: #111827; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { max-width: 480px; width: 92%; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 32px; text-align: center; }
    .card h1 { margin: 0 0 16px; font-size: 22px; font-weight: 600; color: ${color}; }
    .card p { margin: 8px 0; font-size: 16px; line-height: 1.5; }
    .footer { margin-top: 24px; font-size: 13px; color: #9ca3af; }
    button { margin-top: 20px; padding: 12px 28px; font-size: 16px; font-weight: 600; color: #fff; background: #10b981; border: 0; border-radius: 8px; cursor: pointer; }
    .badge { display: inline-block; padding: 2px 10px; background: #f9fafb; border-radius: 999px; font-size: 12px; color: #6b7280; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeMsg}</p>
${form ? `    <form method="POST" action="/api/public/attendance-link?lang=${escapeHtml(langSafe)}">
      <input type="hidden" name="token" value="${escapeHtml(form.token)}">
      <button type="submit">${escapeHtml(form.button)}</button>
    </form>
` : ''}    <div class="footer">${footer}</div>
    <div class="badge">PR-TOP</div>
  </div>
</body>
</html>`;
}

function sendPage(res, statusCode, opts) {
  res.status(statusCode)
     .set('Content-Type', 'text/html; charset=utf-8')
     .set('X-Robots-Tag', 'noindex,nofollow')
     .send(renderPage(opts));
}

// ── Confirmation prompt (GET) ──────────────────────────────────────────────
// Mail scanners, link previewers and browser prefetchers open every URL in an
// email with a plain GET. So GET never changes state: it only verifies the token
// and renders a page with a button; the button POSTs the same token (below).

const PROMPTS = {
  confirm: {
    title:  { en: 'Confirm your attendance?', ru: 'Подтвердить ваше присутствие?', es: '¿Confirmar tu asistencia?', uk: 'Підтвердити вашу присутність?' },
    button: { en: 'Yes, I\'ll be there', ru: 'Да, буду', es: 'Sí, asistiré', uk: 'Так, буду' },
  },
  reschedule: {
    title:  { en: 'Ask to reschedule this session?', ru: 'Попросить перенести встречу?', es: '¿Pedir cambiar la sesión de fecha?', uk: 'Попросити перенести зустріч?' },
    button: { en: 'Ask to reschedule', ru: 'Хочу перенести', es: 'Quiero cambiarla', uk: 'Хочу перенести' },
  },
  release: {
    title:  { en: 'Release this time slot?', ru: 'Освободить это время?', es: '¿Liberar este horario?', uk: 'Звільнити цей час?' },
    button: { en: 'Release slot', ru: 'Не смогу прийти', es: 'Liberar horario', uk: 'Не зможу прийти' },
  },
  optin_yes: {
    title:  { en: 'Receive session reminders?', ru: 'Получать напоминания о встречах?', es: '¿Recibir recordatorios de sesión?', uk: 'Отримувати нагадування про зустрічі?' },
    button: { en: 'Yes, remind me', ru: 'Да, напоминайте', es: 'Sí, recuérdamelo', uk: 'Так, нагадуйте' },
  },
  optin_no: {
    title:  { en: 'Do not send session reminders?', ru: 'Не присылать напоминания о встречах?', es: '¿No enviar recordatorios de sesión?', uk: 'Не надсилати нагадування про зустрічі?' },
    button: { en: 'No reminders', ru: 'Не напоминайте', es: 'Sin recordatorios', uk: 'Не нагадуйте' },
  },
};

STRINGS.errors.already_recorded = {
  en: 'Your answer for this session has already been recorded and cannot be changed from an email link. Please contact your therapist directly.',
  ru: 'Ваш ответ по этой встрече уже записан и не может быть изменён по ссылке из письма. Свяжитесь с терапевтом напрямую.',
  es: 'Tu respuesta para esta sesión ya está registrada y no se puede cambiar desde un enlace de correo. Contacta directamente con tu terapeuta.',
  uk: 'Вашу відповідь щодо цієї зустрічі вже записано, і її не можна змінити за посиланням з листа. Зверніться до терапевта напряму.',
};

// Which current attendance_status values an email link may move away from.
// 'confirmed', 'cancelled_*', 'no_show' and 'attended' are final for email links
// (tokens are stateless, so single-use is not enforceable; guarding the
// transition gives the same safety: a stale or re-sent email can never undo a
// confirmation or a cancellation). Re-applying the SAME target is always an
// idempotent no-op.
const ALLOWED_FROM = {
  confirm:    [null, 'reschedule_requested'],
  reschedule: [null],
  release:    [null, 'reschedule_requested'],
};
const TARGET_STATUS = {
  confirm: 'confirmed',
  reschedule: 'reschedule_requested',
  release: 'cancelled_by_client',
};
const OK_KEY = { confirm: 'confirmed', reschedule: 'reschedule_requested', release: 'released' };

function normStatus(s) {
  return (s === undefined || s === null || s === '') ? null : s;
}

function pageOpts(res, status, key, lang, isError) {
  const e = STRINGS.errors[key] || STRINGS.errors.invalid;
  return sendPage(res, status, { title: e[lang] || e.en, message: '', lang, isError: isError !== false });
}

/**
 * Shared handler. commit=false (GET): validate + render the confirmation page,
 * NO writes. commit=true (POST): validate again, then apply the action.
 */
function handleAttendance(req, res, token, commit) {
  const lang = pickLang(req);

  const verify = verifyAttendanceToken(token);
  if (!verify.ok) {
    return pageOpts(res, 400, verify.reason === 'expired' ? 'expired' : 'invalid', lang);
  }

  const { session_id, client_id, action } = verify.payload;
  const db = getDatabase();

  const promptPage = (effLang) => {
    const p = PROMPTS[action];
    if (!p) return pageOpts(res, 400, 'invalid', effLang);
    return sendPage(res, 200, {
      title: p.title[effLang] || p.title.en,
      message: '',
      lang: effLang,
      isError: false,
      form: { token, lang: effLang, button: p.button[effLang] || p.button.en },
    });
  };

  try {
    // ── Opt-in / opt-out actions don't touch a session ──
    if (action === 'optin_yes' || action === 'optin_no') {
      const userRes = db.exec(
        `SELECT id, role, language, session_reminders_enabled FROM users WHERE id = ?`,
        [client_id]
      );
      if (!userRes.length || !userRes[0].values.length) {
        return pageOpts(res, 404, 'session_gone', lang);
      }
      const [, role, userLang] = userRes[0].values[0];
      if (role !== 'client') {
        return pageOpts(res, 400, 'wrong_user', lang);
      }
      const effLang = pickLang(req, userLang || 'en');
      if (!commit) return promptPage(effLang);

      const newVal = action === 'optin_yes' ? 1 : 0;
      db.run(
        `UPDATE users
            SET session_reminders_enabled = ?,
                session_reminders_asked_at = COALESCE(session_reminders_asked_at, datetime('now')),
                updated_at = datetime('now')
          WHERE id = ?`,
        [newVal, client_id]
      );
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (?, ?, 'user', ?, ?, datetime('now'))`,
        [client_id, 'session_reminder_optin_via_email', client_id,
         JSON.stringify({ choice: action, source: 'email_signed_link' })]
      );
      saveDatabaseAfterWrite();

      // If opted-in, immediately plan reminders for upcoming sessions.
      if (newVal === 1) {
        const rs = getReminderService();
        if (rs && typeof rs.planForSession === 'function') {
          try {
            const upcoming = db.exec(
              `SELECT id FROM sessions
                WHERE client_id = ? AND scheduled_at > datetime('now')`,
              [client_id]
            );
            if (upcoming.length && upcoming[0].values.length) {
              // Plan in background (fire-and-forget) so the response stays snappy.
              Promise.all(upcoming[0].values.map((row) => rs.planForSession(row[0])))
                .catch((e) => logger.warn(`[publicAttendance] post-optin planForSession: ${e.message}`));
            }
          } catch (e) {
            logger.warn(`[publicAttendance] post-optin scan failed: ${e.message}`);
          }
        }
      }

      const key = action === 'optin_yes' ? 'optin_yes' : 'optin_no';
      return sendPage(res, 200, {
        title: STRINGS[key][effLang] || STRINGS[key].en,
        message: '',
        lang: effLang,
        isError: false,
      });
    }

    // ── Session-bound actions: confirm / reschedule / release ──
    const newStatus = TARGET_STATUS[action];
    if (!newStatus) return pageOpts(res, 400, 'invalid', lang);

    const sessRes = db.exec(
      `SELECT s.id, s.client_id, s.scheduled_at, s.attendance_status, u.language
         FROM sessions s
         LEFT JOIN users u ON u.id = s.client_id
        WHERE s.id = ?`,
      [session_id]
    );
    if (!sessRes.length || !sessRes[0].values.length) {
      return pageOpts(res, 404, 'session_gone', lang);
    }
    const [, dbClientId, scheduledAt, rawStatus, clientLang] = sessRes[0].values[0];
    const currentStatus = normStatus(rawStatus);

    // Ownership: the token must match the client_id on the session row.
    if (dbClientId !== client_id) {
      return pageOpts(res, 403, 'wrong_user', lang);
    }
    const effLang = pickLang(req, clientLang || 'en');

    // Don't accept attendance changes after the session has started.
    if (scheduledAt) {
      const sched = new Date(String(scheduledAt).replace(' ', 'T') + (String(scheduledAt).match(/[zZ]|[+\-]\d/) ? '' : 'Z'));
      if (!isNaN(sched.getTime()) && sched.getTime() <= Date.now()) {
        return pageOpts(res, 410, 'already_passed', effLang);
      }
    }

    const okPage = () => sendPage(res, 200, {
      title: STRINGS[OK_KEY[action]][effLang] || STRINGS[OK_KEY[action]].en,
      message: '',
      lang: effLang,
      isError: false,
    });

    // Same target already recorded: idempotent success, no write, no button.
    if (currentStatus === newStatus) return okPage();

    // Transition guard (see ALLOWED_FROM).
    if (!ALLOWED_FROM[action].includes(currentStatus)) {
      return pageOpts(res, 409, 'already_recorded', effLang);
    }

    if (!commit) return promptPage(effLang);

    db.run(
      `UPDATE sessions
          SET attendance_status = ?,
              attendance_updated_at = datetime('now'),
              attendance_updated_by = ?
        WHERE id = ?`,
      [newStatus, client_id, session_id]
    );
    db.run(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
       VALUES (?, ?, 'session', ?, ?, datetime('now'))`,
      [
        client_id,
        newStatus === 'confirmed' ? 'attendance_confirmed'
          : newStatus === 'reschedule_requested' ? 'attendance_reschedule_requested'
          : 'attendance_release_requested',
        session_id,
        JSON.stringify({ source: 'email_signed_link', previous_status: currentStatus }),
      ]
    );

    // Supersede pending reminder dispatches for this session (cancel/reschedule).
    if (newStatus === 'reschedule_requested' || newStatus === 'cancelled_by_client') {
      const rs = getReminderService();
      if (rs && typeof rs.cancelPendingForSession === 'function') {
        try {
          rs.cancelPendingForSession(session_id, `via_email_${action}`);
        } catch (e) {
          logger.warn(`[publicAttendance] cancelPendingForSession failed: ${e.message}`);
        }
      }
    }
    saveDatabaseAfterWrite();
    return okPage();
  } catch (error) {
    logger.error(`[publicAttendance] handler error: ${error.message}`);
    return pageOpts(res, 500, 'invalid', lang);
  }
}

// Responses carry a bearer-ish token in the URL: keep them out of caches/referrers.
router.use('/attendance-link', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

/**
 * GET /api/public/attendance-link?token=...&lang=ru
 * Side-effect free: renders a confirmation page whose button POSTs the token.
 */
router.get('/attendance-link', (req, res) => {
  const token = req.query && req.query.token ? String(req.query.token) : '';
  return handleAttendance(req, res, token, false);
});

/**
 * POST /api/public/attendance-link  (form field or JSON key: token; optional lang)
 * Applies the action. Mounted before the CSRF middleware in index.js like the
 * other public token endpoints; the HMAC-signed token is the authorisation.
 */
router.post('/attendance-link', express.urlencoded({ extended: false, limit: '8kb' }), (req, res) => {
  const token = req.body && typeof req.body.token === 'string' ? req.body.token : '';
  return handleAttendance(req, res, token, true);
});

module.exports = router;
