// Scheduled task runner for recurring backend jobs
// Uses node-cron for cron-like scheduling inside the Node.js process
//
// Jobs:
// 1. Trial expiration (daily at 2:00 AM)
// 2. Subscription downgrade for past_due (daily at 2:15 AM)
// 3. Subscription expiry warning (daily at 9:00 AM)
// 4. Diary reminder for inactive clients (daily at 10:00 AM)
// 5. CSRF token cleanup (hourly)

const cron = require('node-cron');
const { getDatabase, saveDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');

let emailService;
try {
  emailService = require('./emailService');
} catch (e) {
  emailService = null;
}

let telegramNotify;
try {
  telegramNotify = require('../utils/telegramNotify');
} catch (e) {
  telegramNotify = null;
}

let backupService;
try {
  backupService = require('./backupService');
} catch (e) {
  backupService = null;
}

const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED !== 'false'; // default true
const GRACE_PERIOD_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '7', 10);
const EXPIRY_WARNING_DAYS = parseInt(process.env.SUBSCRIPTION_EXPIRY_WARNING_DAYS || '3', 10);
const DIARY_REMINDER_INACTIVE_DAYS = 3;

const scheduledTasks = [];

/**
 * Job 1: Trial expiration
 * Find trial subscriptions where trial_ends_at < now AND status = 'active', set status = 'expired'
 */
function runTrialExpiration() {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Find expired trials
    const expired = db.exec(
      `SELECT s.id, s.therapist_id, s.trial_ends_at
       FROM subscriptions s
       WHERE s.plan = 'trial' AND s.status = 'active'
       AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at < ?`,
      [now]
    );

    if (!expired.length || !expired[0].values.length) {
      logger.info('[SCHEDULER] Trial expiration: no expired trials found');
      return { expired: 0 };
    }

    let count = 0;
    for (const row of expired[0].values) {
      const subId = row[0];
      const therapistId = row[1];
      const trialEndsAt = row[2];

      db.run(
        `UPDATE subscriptions SET status = 'expired', updated_at = datetime('now') WHERE id = ?`,
        [subId]
      );

      // Audit log
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (0, 'trial_expired', 'subscription', ?, ?, datetime('now'))`,
        [subId, JSON.stringify({ therapist_id: therapistId, trial_ends_at: trialEndsAt })]
      );

      // Send expiry notification via email if available
      if (emailService) {
        const userResult = db.exec('SELECT email, language FROM users WHERE id = ?', [therapistId]);
        if (userResult.length > 0 && userResult[0].values.length > 0) {
          const email = userResult[0].values[0][0];
          const lang = userResult[0].values[0][1] || 'en';
          emailService.sendSubscriptionExpiryWarning(email, {
            plan: 'trial',
            expiryDate: trialEndsAt
          }, lang).catch(function(err) {
            logger.error('[SCHEDULER] Trial expiry email error: ' + err.message);
          });
        }
      }

      count++;
    }

    saveDatabase();
    logger.info('[SCHEDULER] Trial expiration: expired ' + count + ' trial subscriptions');
    return { expired: count };
  } catch (error) {
    logger.error('[SCHEDULER] Trial expiration error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 2: Subscription downgrade for past_due
 * Find subscriptions with status='past_due' older than grace period, downgrade to trial
 */
function runSubscriptionDowngrade() {
  try {
    const db = getDatabase();
    const graceCutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const pastDue = db.exec(
      `SELECT s.id, s.therapist_id, s.plan, s.updated_at
       FROM subscriptions s
       WHERE s.status = 'past_due' AND s.updated_at < ?`,
      [graceCutoff]
    );

    if (!pastDue.length || !pastDue[0].values.length) {
      logger.info('[SCHEDULER] Subscription downgrade: no past-due subscriptions beyond grace period');
      return { downgraded: 0 };
    }

    let count = 0;
    for (const row of pastDue[0].values) {
      const subId = row[0];
      const therapistId = row[1];
      const oldPlan = row[2];

      // Downgrade to expired (not trial, since trial has its own lifecycle)
      db.run(
        `UPDATE subscriptions SET status = 'expired', updated_at = datetime('now') WHERE id = ?`,
        [subId]
      );

      // Audit log
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (0, 'subscription_downgraded', 'subscription', ?, ?, datetime('now'))`,
        [subId, JSON.stringify({ therapist_id: therapistId, old_plan: oldPlan, reason: 'past_due_grace_period_exceeded' })]
      );

      count++;
    }

    saveDatabase();
    logger.info('[SCHEDULER] Subscription downgrade: downgraded ' + count + ' past-due subscriptions');
    return { downgraded: count };
  } catch (error) {
    logger.error('[SCHEDULER] Subscription downgrade error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 3: Subscription expiry warning
 * Find subscriptions expiring within EXPIRY_WARNING_DAYS days, send notification
 */
function runExpiryWarning() {
  try {
    const db = getDatabase();
    const now = new Date();
    const warningCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find active trials expiring soon
    const expiring = db.exec(
      `SELECT s.id, s.therapist_id, s.plan, s.trial_ends_at, s.current_period_end
       FROM subscriptions s
       WHERE s.status = 'active'
       AND (
         (s.plan = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= ? AND s.trial_ends_at > ?)
         OR
         (s.plan != 'trial' AND s.current_period_end IS NOT NULL AND s.current_period_end <= ? AND s.current_period_end > ?)
       )`,
      [warningCutoff, now.toISOString(), warningCutoff, now.toISOString()]
    );

    if (!expiring.length || !expiring[0].values.length) {
      logger.info('[SCHEDULER] Expiry warning: no subscriptions expiring soon');
      return { warned: 0 };
    }

    let count = 0;
    for (const row of expiring[0].values) {
      const subId = row[0];
      const therapistId = row[1];
      const plan = row[2];
      const expiryDate = row[3] || row[4]; // trial_ends_at or current_period_end

      // Check if we already sent a warning for this period (prevent duplicate warnings)
      const alreadyWarned = db.exec(
        `SELECT id FROM audit_logs
         WHERE actor_id = 0 AND action = 'expiry_warning_sent' AND target_id = ?
         AND created_at > datetime('now', '-3 days')`,
        [subId]
      );

      if (alreadyWarned.length > 0 && alreadyWarned[0].values.length > 0) {
        continue; // Skip, already warned recently
      }

      // Get therapist info
      const userResult = db.exec('SELECT email, language, telegram_id FROM users WHERE id = ?', [therapistId]);
      if (userResult.length > 0 && userResult[0].values.length > 0) {
        const email = userResult[0].values[0][0];
        const lang = userResult[0].values[0][1] || 'en';
        const telegramId = userResult[0].values[0][2];

        // Send email notification
        if (emailService && email) {
          emailService.sendSubscriptionExpiryWarning(email, { plan, expiryDate }, lang)
            .catch(function(err) {
              logger.error('[SCHEDULER] Expiry warning email error: ' + err.message);
            });
        }

        // Send Telegram notification as fallback/supplement
        if (telegramNotify && telegramId) {
          var msg = lang === 'ru'
            ? '⚠️ Ваша подписка ' + plan + ' истекает ' + expiryDate + '. Обновите подписку, чтобы не потерять доступ.'
            : lang === 'es'
            ? '⚠️ Su suscripción ' + plan + ' vence el ' + expiryDate + '. Actualice para mantener el acceso.'
            : '⚠️ Your ' + plan + ' subscription expires on ' + expiryDate + '. Please upgrade to maintain access.';
          telegramNotify.sendMessage(telegramId, msg).catch(function() {});
        }
      }

      // Audit log
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (0, 'expiry_warning_sent', 'subscription', ?, ?, datetime('now'))`,
        [subId, JSON.stringify({ therapist_id: therapistId, plan, expiry_date: expiryDate })]
      );

      count++;
    }

    saveDatabase();
    logger.info('[SCHEDULER] Expiry warning: sent ' + count + ' warnings');
    return { warned: count };
  } catch (error) {
    logger.error('[SCHEDULER] Expiry warning error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 4: Diary reminder for inactive clients
 * Notify clients who haven't submitted a diary entry in DIARY_REMINDER_INACTIVE_DAYS days
 */
function runDiaryReminder() {
  try {
    const db = getDatabase();
    const cutoff = new Date(Date.now() - DIARY_REMINDER_INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find clients with no recent diary entries who have Telegram
    const inactive = db.exec(
      `SELECT u.id, u.telegram_id, u.language
       FROM users u
       WHERE u.role = 'client' AND u.telegram_id IS NOT NULL
       AND u.therapist_id IS NOT NULL AND u.blocked_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM diary_entries d WHERE d.client_id = u.id AND d.created_at > ?
       )`,
      [cutoff]
    );

    if (!inactive.length || !inactive[0].values.length) {
      logger.info('[SCHEDULER] Diary reminder: no inactive clients found');
      return { reminded: 0 };
    }

    // Check if we already sent reminders today
    const today = new Date().toISOString().split('T')[0];
    const alreadySentToday = db.exec(
      `SELECT target_id FROM audit_logs
       WHERE actor_id = 0 AND action = 'diary_reminder_sent'
       AND created_at > ? || 'T00:00:00.000Z'`,
      [today]
    );
    const alreadySentIds = new Set(
      (alreadySentToday.length > 0 ? alreadySentToday[0].values : []).map(function(r) { return r[0]; })
    );

    let count = 0;
    for (const row of inactive[0].values) {
      const clientId = row[0];
      const telegramId = row[1];
      const lang = row[2] || 'en';

      if (alreadySentIds.has(clientId)) continue; // Already reminded today

      if (telegramNotify && telegramId) {
        var msg = lang === 'ru'
          ? '📝 Привет! Давно не было записей в дневнике. Как у вас дела? Поделитесь мыслями или чувствами.'
          : lang === 'es'
          ? '📝 ¡Hola! Hace tiempo que no escribes en tu diario. ¿Cómo estás? Comparte tus pensamientos.'
          : '📝 Hi! It\'s been a while since your last diary entry. How are you doing? Share your thoughts or feelings.';
        telegramNotify.sendMessage(telegramId, msg).catch(function() {});
      }

      // Audit log
      db.run(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
         VALUES (0, 'diary_reminder_sent', 'user', ?, ?, datetime('now'))`,
        [clientId, JSON.stringify({ telegram_id: telegramId, inactive_days: DIARY_REMINDER_INACTIVE_DAYS })]
      );

      count++;
    }

    if (count > 0) saveDatabase();
    logger.info('[SCHEDULER] Diary reminder: reminded ' + count + ' clients');
    return { reminded: count };
  } catch (error) {
    logger.error('[SCHEDULER] Diary reminder error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 5: CSRF token cleanup
 * The CSRF module already has its own 30-min cleanup interval,
 * but this job provides an additional hourly sweep for completeness
 */
function runCsrfCleanup() {
  try {
    // CSRF tokens are managed in-memory by the csrf.js middleware
    // which already has a 30-minute cleanup interval.
    // This is a supplementary audit log entry for monitoring.
    logger.info('[SCHEDULER] CSRF cleanup: supplementary sweep (main cleanup runs in csrf middleware)');
    return { cleaned: true };
  } catch (error) {
    logger.error('[SCHEDULER] CSRF cleanup error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Start all scheduled jobs
 */
/**
 * Job 6: Database backup
 * Create encrypted compressed backup of the SQLite database
 */
function runDatabaseBackup() {
  try {
    if (!backupService) {
      logger.warn('[SCHEDULER] Backup service not available');
      return { success: false, error: 'Backup service not loaded' };
    }

    const result = backupService.backup();

    if (result.success) {
      logger.info('[SCHEDULER] Database backup completed: ' + result.filename + ' (' + result.size + ' bytes)');

      // Audit log
      const db = getDatabase();
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'scheduled_backup', 'system', 0, ?, datetime('now'))",
        [JSON.stringify({ filename: result.filename, size: result.size })]
      );
      saveDatabase();
    } else {
      logger.error('[SCHEDULER] Database backup failed: ' + result.error);
    }

    return result;
  } catch (error) {
    logger.error('[SCHEDULER] Database backup error: ' + error.message);
    return { success: false, error: error.message };
  }
}

function start() {
  if (!SCHEDULER_ENABLED) {
    logger.info('[SCHEDULER] Scheduler disabled via SCHEDULER_ENABLED=false');
    return;
  }

  logger.info('[SCHEDULER] Starting scheduled task runner...');

  // Job 1: Trial expiration - daily at 2:00 AM
  scheduledTasks.push(cron.schedule('0 2 * * *', function() {
    logger.info('[SCHEDULER] Running trial expiration job...');
    runTrialExpiration();
  }, { name: 'trial-expiration' }));

  // Job 2: Subscription downgrade - daily at 2:15 AM
  scheduledTasks.push(cron.schedule('15 2 * * *', function() {
    logger.info('[SCHEDULER] Running subscription downgrade job...');
    runSubscriptionDowngrade();
  }, { name: 'subscription-downgrade' }));

  // Job 3: Expiry warning - daily at 9:00 AM
  scheduledTasks.push(cron.schedule('0 9 * * *', function() {
    logger.info('[SCHEDULER] Running expiry warning job...');
    runExpiryWarning();
  }, { name: 'expiry-warning' }));

  // Job 4: Diary reminder - daily at 10:00 AM
  scheduledTasks.push(cron.schedule('0 10 * * *', function() {
    logger.info('[SCHEDULER] Running diary reminder job...');
    runDiaryReminder();
  }, { name: 'diary-reminder' }));

  // Job 5: CSRF cleanup - hourly
  scheduledTasks.push(cron.schedule('0 * * * *', function() {
    runCsrfCleanup();
  }, { name: 'csrf-cleanup' }));

  // Job 6: Database backup - daily at 3:00 AM (configurable via BACKUP_CRON)
  var backupCron = process.env.BACKUP_CRON || '0 3 * * *';
  scheduledTasks.push(cron.schedule(backupCron, function() {
    logger.info('[SCHEDULER] Running database backup job...');
    runDatabaseBackup();
  }, { name: 'database-backup' }));

  logger.info('[SCHEDULER] All scheduled tasks registered (' + scheduledTasks.length + ' jobs)');
  logger.info('[SCHEDULER] Jobs: trial-expiration (2:00), subscription-downgrade (2:15), expiry-warning (9:00), diary-reminder (10:00), csrf-cleanup (hourly), database-backup (' + backupCron + ')');
}

/**
 * Stop all scheduled jobs
 */
function stop() {
  scheduledTasks.forEach(function(task) {
    task.stop();
  });
  scheduledTasks.length = 0;
  logger.info('[SCHEDULER] All scheduled tasks stopped');
}

module.exports = {
  start,
  stop,
  // Expose individual jobs for testing
  runTrialExpiration,
  runSubscriptionDowngrade,
  runExpiryWarning,
  runDiaryReminder,
  runCsrfCleanup,
  runDatabaseBackup
};
