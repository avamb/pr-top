// Email notification service with SMTP/transactional provider support
// Supports HTML templates, localization (EN/RU/ES), and graceful fallback
// when SMTP is not configured.

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

// ── Configuration ──────────────────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'PR-TOP <noreply@prtop.app>';

// ── Rate Limiting ──────────────────────────────────────────────────────────
// Max 10 emails per minute per recipient
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map(); // email -> { count, windowStart }

function isRateLimited(recipientEmail) {
  const now = Date.now();
  const entry = rateLimitMap.get(recipientEmail);

  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(recipientEmail, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(email);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes

// ── SMTP Transport ─────────────────────────────────────────────────────────

let transporter = null;

/**
 * Check if SMTP email is configured and available
 */
function isConfigured() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/**
 * Get or create the nodemailer transporter
 */
function getTransporter() {
  if (transporter) return transporter;

  if (!isConfigured()) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  return transporter;
}

// ── HTML Template Engine ───────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'emails');

/**
 * Base HTML layout wrapper for all emails
 */
function baseLayout(bodyHtml, locale) {
  const footerText = locale === 'ru' ? 'Вы получили это письмо от PR-TOP.'
    : locale === 'es' ? 'Ha recibido este correo de PR-TOP.'
    : 'You received this email from PR-TOP.';

  return `<!DOCTYPE html>
<html lang="${locale || 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR-TOP</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f9; color: #333; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .email-header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px 32px; color: #fff; }
    .email-header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .email-body { padding: 32px; line-height: 1.6; }
    .email-body h2 { color: #6366f1; margin-top: 0; }
    .email-footer { padding: 16px 32px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 16px 0; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .alert-box.urgent { border-color: #f87171; background: #fef2f2; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-label { font-weight: 600; min-width: 140px; color: #6b7280; }
    .detail-value { color: #111827; }
    table.details { width: 100%; border-collapse: collapse; margin: 16px 0; }
    table.details td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    table.details td:first-child { font-weight: 600; color: #6b7280; width: 40%; }
  </style>
</head>
<body>
  <div style="padding: 20px;">
    <div class="email-container">
      <div class="email-header">
        <h1>PR-TOP</h1>
      </div>
      <div class="email-body">
        ${bodyHtml}
      </div>
      <div class="email-footer">
        ${footerText}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Email Templates ────────────────────────────────────────────────────────

/**
 * SOS Alert email template (urgent styling)
 */
function sosAlertTemplate(data, locale) {
  const l = locale || 'en';

  const titles = {
    en: 'SOS Alert - Immediate Attention Required',
    ru: 'SOS - Требуется немедленное внимание',
    es: 'Alerta SOS - Se requiere atención inmediata'
  };

  const bodies = {
    en: `
      <h2 style="color: #dc2626; margin-top: 0;">&#x1F6A8; SOS Alert</h2>
      <div class="alert-box urgent">
        <p style="margin: 0; font-weight: 600;">Your client has triggered an emergency alert and may need immediate support.</p>
      </div>
      <table class="details">
        <tr><td>Client</td><td>${data.clientIdentifier || 'Unknown'}</td></tr>
        <tr><td>Time</td><td>${data.timestamp || new Date().toISOString()}</td></tr>
        ${data.message ? `<tr><td>Message</td><td>${escapeHtml(data.message)}</td></tr>` : ''}
      </table>
      <p>Please check on your client as soon as possible. You can view the full alert details in your <a href="${data.dashboardUrl || '#'}">PR-TOP dashboard</a>.</p>
    `,
    ru: `
      <h2 style="color: #dc2626; margin-top: 0;">&#x1F6A8; SOS Тревога</h2>
      <div class="alert-box urgent">
        <p style="margin: 0; font-weight: 600;">Ваш клиент активировал экстренный сигнал и может нуждаться в немедленной поддержке.</p>
      </div>
      <table class="details">
        <tr><td>Клиент</td><td>${data.clientIdentifier || 'Неизвестен'}</td></tr>
        <tr><td>Время</td><td>${data.timestamp || new Date().toISOString()}</td></tr>
        ${data.message ? `<tr><td>Сообщение</td><td>${escapeHtml(data.message)}</td></tr>` : ''}
      </table>
      <p>Пожалуйста, свяжитесь с вашим клиентом как можно скорее. Подробности доступны в <a href="${data.dashboardUrl || '#'}">панели PR-TOP</a>.</p>
    `,
    es: `
      <h2 style="color: #dc2626; margin-top: 0;">&#x1F6A8; Alerta SOS</h2>
      <div class="alert-box urgent">
        <p style="margin: 0; font-weight: 600;">Su cliente ha activado una alerta de emergencia y puede necesitar apoyo inmediato.</p>
      </div>
      <table class="details">
        <tr><td>Cliente</td><td>${data.clientIdentifier || 'Desconocido'}</td></tr>
        <tr><td>Hora</td><td>${data.timestamp || new Date().toISOString()}</td></tr>
        ${data.message ? `<tr><td>Mensaje</td><td>${escapeHtml(data.message)}</td></tr>` : ''}
      </table>
      <p>Por favor, contacte a su cliente lo antes posible. Puede ver los detalles en su <a href="${data.dashboardUrl || '#'}">panel de PR-TOP</a>.</p>
    `
  };

  return {
    subject: titles[l] || titles.en,
    html: baseLayout(bodies[l] || bodies.en, l)
  };
}

/**
 * Registration welcome email template
 */
function welcomeTemplate(data, locale) {
  const l = locale || 'en';

  const titles = {
    en: 'Welcome to PR-TOP!',
    ru: 'Добро пожаловать в PR-TOP!',
    es: '¡Bienvenido a PR-TOP!'
  };

  const bodies = {
    en: `
      <h2>Welcome to PR-TOP!</h2>
      <p>Thank you for registering, <strong>${escapeHtml(data.email || '')}</strong>. Your therapist account is ready.</p>
      <div class="info-box">
        <p style="margin: 0; font-weight: 600;">Getting Started:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Set up your Telegram bot to connect with clients</li>
          <li>Create invite codes to share with your clients</li>
          <li>Configure your escalation and notification preferences</li>
          <li>Explore the therapist guide for best practices</li>
        </ul>
      </div>
      <p>Your trial period is active for <strong>${data.trialDays || 14} days</strong>.</p>
      <a href="${data.dashboardUrl || '#'}" class="btn">Go to Dashboard</a>
    `,
    ru: `
      <h2>Добро пожаловать в PR-TOP!</h2>
      <p>Спасибо за регистрацию, <strong>${escapeHtml(data.email || '')}</strong>. Ваш аккаунт терапевта готов.</p>
      <div class="info-box">
        <p style="margin: 0; font-weight: 600;">Начало работы:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Настройте Telegram бота для связи с клиентами</li>
          <li>Создайте коды приглашений для клиентов</li>
          <li>Настройте предпочтения по уведомлениям и эскалации</li>
          <li>Изучите руководство терапевта</li>
        </ul>
      </div>
      <p>Ваш пробный период активен <strong>${data.trialDays || 14} дней</strong>.</p>
      <a href="${data.dashboardUrl || '#'}" class="btn">Перейти в панель</a>
    `,
    es: `
      <h2>¡Bienvenido a PR-TOP!</h2>
      <p>Gracias por registrarse, <strong>${escapeHtml(data.email || '')}</strong>. Su cuenta de terapeuta está lista.</p>
      <div class="info-box">
        <p style="margin: 0; font-weight: 600;">Primeros pasos:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Configure su bot de Telegram para conectar con clientes</li>
          <li>Cree códigos de invitación para compartir con sus clientes</li>
          <li>Configure sus preferencias de notificación y escalamiento</li>
          <li>Explore la guía del terapeuta</li>
        </ul>
      </div>
      <p>Su período de prueba está activo por <strong>${data.trialDays || 14} días</strong>.</p>
      <a href="${data.dashboardUrl || '#'}" class="btn">Ir al Panel</a>
    `
  };

  return {
    subject: titles[l] || titles.en,
    html: baseLayout(bodies[l] || bodies.en, l)
  };
}

/**
 * Payment receipt email template
 */
function paymentReceiptTemplate(data, locale) {
  const l = locale || 'en';

  const amount = data.amount ? (data.amount / 100).toFixed(2) : '0.00';
  const currency = (data.currency || 'USD').toUpperCase();

  const titles = {
    en: `Payment Receipt - PR-TOP (${currency} ${amount})`,
    ru: `Квитанция об оплате - PR-TOP (${currency} ${amount})`,
    es: `Recibo de Pago - PR-TOP (${currency} ${amount})`
  };

  const bodies = {
    en: `
      <h2>Payment Receipt</h2>
      <p>Thank you for your payment. Here are the details:</p>
      <table class="details">
        <tr><td>Amount</td><td><strong>${currency} ${amount}</strong></td></tr>
        <tr><td>Plan</td><td>${escapeHtml(data.plan || 'Pro')}</td></tr>
        <tr><td>Date</td><td>${data.date || new Date().toISOString().split('T')[0]}</td></tr>
        ${data.nextBilling ? `<tr><td>Next Billing</td><td>${data.nextBilling}</td></tr>` : ''}
        ${data.paymentIntentId ? `<tr><td>Transaction ID</td><td style="font-family: monospace; font-size: 12px;">${escapeHtml(data.paymentIntentId)}</td></tr>` : ''}
      </table>
      <p>If you have any questions about this charge, please contact support.</p>
    `,
    ru: `
      <h2>Квитанция об оплате</h2>
      <p>Спасибо за оплату. Детали:</p>
      <table class="details">
        <tr><td>Сумма</td><td><strong>${currency} ${amount}</strong></td></tr>
        <tr><td>Тариф</td><td>${escapeHtml(data.plan || 'Pro')}</td></tr>
        <tr><td>Дата</td><td>${data.date || new Date().toISOString().split('T')[0]}</td></tr>
        ${data.nextBilling ? `<tr><td>Следующий платёж</td><td>${data.nextBilling}</td></tr>` : ''}
        ${data.paymentIntentId ? `<tr><td>ID транзакции</td><td style="font-family: monospace; font-size: 12px;">${escapeHtml(data.paymentIntentId)}</td></tr>` : ''}
      </table>
      <p>Если у вас есть вопросы по этому платежу, свяжитесь с поддержкой.</p>
    `,
    es: `
      <h2>Recibo de Pago</h2>
      <p>Gracias por su pago. Aquí están los detalles:</p>
      <table class="details">
        <tr><td>Monto</td><td><strong>${currency} ${amount}</strong></td></tr>
        <tr><td>Plan</td><td>${escapeHtml(data.plan || 'Pro')}</td></tr>
        <tr><td>Fecha</td><td>${data.date || new Date().toISOString().split('T')[0]}</td></tr>
        ${data.nextBilling ? `<tr><td>Próximo cobro</td><td>${data.nextBilling}</td></tr>` : ''}
        ${data.paymentIntentId ? `<tr><td>ID de transacción</td><td style="font-family: monospace; font-size: 12px;">${escapeHtml(data.paymentIntentId)}</td></tr>` : ''}
      </table>
      <p>Si tiene alguna pregunta sobre este cargo, contacte con soporte.</p>
    `
  };

  return {
    subject: titles[l] || titles.en,
    html: baseLayout(bodies[l] || bodies.en, l)
  };
}

/**
 * Subscription expiry warning email template
 */
function subscriptionExpiryTemplate(data, locale) {
  const l = locale || 'en';

  const titles = {
    en: 'Your PR-TOP subscription is expiring soon',
    ru: 'Ваша подписка PR-TOP скоро истекает',
    es: 'Su suscripción de PR-TOP está por vencer'
  };

  const bodies = {
    en: `
      <h2>Subscription Expiring Soon</h2>
      <div class="alert-box">
        <p style="margin: 0;">Your <strong>${escapeHtml(data.plan || 'trial')}</strong> subscription will expire on <strong>${data.expiryDate || 'soon'}</strong>.</p>
      </div>
      <p>To continue using PR-TOP without interruption, please upgrade or renew your subscription.</p>
      <a href="${data.upgradeUrl || '#'}" class="btn">Upgrade Now</a>
      <p style="font-size: 13px; color: #6b7280;">If you don't renew, you will lose access to premium features after the expiry date. Your data will be preserved.</p>
    `,
    ru: `
      <h2>Подписка скоро истекает</h2>
      <div class="alert-box">
        <p style="margin: 0;">Ваша подписка <strong>${escapeHtml(data.plan || 'trial')}</strong> истекает <strong>${data.expiryDate || 'скоро'}</strong>.</p>
      </div>
      <p>Чтобы продолжить использование PR-TOP без перерыва, обновите или продлите подписку.</p>
      <a href="${data.upgradeUrl || '#'}" class="btn">Обновить сейчас</a>
      <p style="font-size: 13px; color: #6b7280;">Если вы не продлите подписку, доступ к премиум-функциям будет ограничен после даты истечения. Ваши данные будут сохранены.</p>
    `,
    es: `
      <h2>Suscripción por vencer</h2>
      <div class="alert-box">
        <p style="margin: 0;">Su suscripción <strong>${escapeHtml(data.plan || 'trial')}</strong> vencerá el <strong>${data.expiryDate || 'pronto'}</strong>.</p>
      </div>
      <p>Para seguir usando PR-TOP sin interrupciones, actualice o renueve su suscripción.</p>
      <a href="${data.upgradeUrl || '#'}" class="btn">Actualizar ahora</a>
      <p style="font-size: 13px; color: #6b7280;">Si no renueva, perderá acceso a funciones premium después de la fecha de vencimiento. Sus datos se conservarán.</p>
    `
  };

  return {
    subject: titles[l] || titles.en,
    html: baseLayout(bodies[l] || bodies.en, l)
  };
}

// ── Utility ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Core Send Method ───────────────────────────────────────────────────────

/**
 * Send an email using SMTP
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML email body
 * @returns {Promise<{sent: boolean, messageId?: string, error?: string}>}
 */
async function sendRawEmail(to, subject, html) {
  if (!to) {
    logger.warn('[EMAIL] No recipient address provided, skipping');
    return { sent: false, error: 'No recipient address' };
  }

  // Rate limiting
  if (isRateLimited(to)) {
    logger.warn(`[EMAIL] Rate limit exceeded for ${to}, skipping`);
    return { sent: false, error: 'Rate limit exceeded' };
  }

  if (!isConfigured()) {
    // Graceful fallback: log to console when SMTP not configured
    logger.info(`[EMAIL] SMTP not configured. Would send to ${to}: "${subject}"`);
    logger.info(`[EMAIL] Email body logged to console (development mode)`);
    return { sent: false, error: 'SMTP not configured', logged: true };
  }

  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html
    });

    logger.info(`[EMAIL] Sent to ${to}: "${subject}" (messageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[EMAIL] Failed to send to ${to}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send an email using a named template
 * @param {string} to - Recipient email
 * @param {string} templateName - Template name ('sos_alert', 'welcome', 'payment_receipt', 'subscription_expiry')
 * @param {object} templateData - Data to pass to template
 * @param {string} [locale='en'] - Language code
 * @returns {Promise<{sent: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(to, templateName, templateData, locale) {
  const l = locale || 'en';

  let template;
  switch (templateName) {
    case 'sos_alert':
      template = sosAlertTemplate(templateData, l);
      break;
    case 'welcome':
      template = welcomeTemplate(templateData, l);
      break;
    case 'payment_receipt':
      template = paymentReceiptTemplate(templateData, l);
      break;
    case 'subscription_expiry':
      template = subscriptionExpiryTemplate(templateData, l);
      break;
    default:
      logger.warn(`[EMAIL] Unknown template: ${templateName}`);
      return { sent: false, error: `Unknown template: ${templateName}` };
  }

  return sendRawEmail(to, template.subject, template.html);
}

/**
 * Send SOS alert email to therapist
 * @param {string} therapistEmail - Therapist's email
 * @param {string} clientIdentifier - Client display name/ID
 * @param {string} [sosMessage] - Optional SOS message
 * @param {string} [locale='en'] - Language code
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendSosAlert(therapistEmail, clientIdentifier, sosMessage, locale) {
  return sendEmail(therapistEmail, 'sos_alert', {
    clientIdentifier,
    message: sosMessage,
    timestamp: new Date().toISOString(),
    dashboardUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  }, locale);
}

/**
 * Send welcome email to new therapist
 * @param {string} email - Therapist's email
 * @param {number} [trialDays=14] - Trial period in days
 * @param {string} [locale='en'] - Language code
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendWelcomeEmail(email, trialDays, locale) {
  return sendEmail(email, 'welcome', {
    email,
    trialDays: trialDays || 14,
    dashboardUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  }, locale);
}

/**
 * Send payment receipt email
 * @param {string} email - Therapist's email
 * @param {object} paymentData - { amount, currency, plan, paymentIntentId, nextBilling }
 * @param {string} [locale='en'] - Language code
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendPaymentReceipt(email, paymentData, locale) {
  return sendEmail(email, 'payment_receipt', {
    ...paymentData,
    date: new Date().toISOString().split('T')[0]
  }, locale);
}

/**
 * Send subscription expiry warning email
 * @param {string} email - Therapist's email
 * @param {object} data - { plan, expiryDate }
 * @param {string} [locale='en'] - Language code
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendSubscriptionExpiryWarning(email, data, locale) {
  return sendEmail(email, 'subscription_expiry', {
    ...data,
    upgradeUrl: (process.env.FRONTEND_URL || 'http://localhost:3000') + '/settings'
  }, locale);
}

module.exports = {
  isConfigured,
  sendEmail,
  sendSosAlert,
  sendWelcomeEmail,
  sendPaymentReceipt,
  sendSubscriptionExpiryWarning
};
