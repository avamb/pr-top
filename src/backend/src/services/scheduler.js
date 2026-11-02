// Scheduled task runner for recurring backend jobs
// Uses node-cron for cron-like scheduling inside the Node.js process
//
// Jobs:
// 1. Trial expiration (daily at 2:00 AM)
// 2. Subscription downgrade for past_due (daily at 2:15 AM)
// 3. Subscription expiry warning (daily at 9:00 AM)
// 4. Diary reminder for inactive clients (daily at 10:00 AM)
// 5. CSRF token cleanup (hourly)
// 6-10. Database backup, reminder-service jobs (see start())
// 11. Unverified-therapist cleanup (daily at 3:30 AM) — wave 2, track 2A
// 12. Login-code cleanup (daily at 2:15 AM, same slot as job 2) — wave 2, track 2A
// 13. Data retention purge (daily at 4:00 AM) — services/retentionService.js

const cron = require('node-cron');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
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

let reminderService;
try {
  reminderService = require('./reminderService');
} catch (e) {
  reminderService = null;
}

let retentionService;
try {
  retentionService = require('./retentionService');
} catch (e) {
  retentionService = null;
}

const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED !== 'false'; // default true
const GRACE_PERIOD_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '7', 10);
const EXPIRY_WARNING_DAYS = parseInt(process.env.SUBSCRIPTION_EXPIRY_WARNING_DAYS || '3', 10);
const DIARY_REMINDER_INACTIVE_DAYS = 3;
const UNVERIFIED_CLEANUP_DEFAULT_DAYS = 7;

const scheduledTasks = [];

/**
 * Job 1: Trial expiration
 * Find trialing subscriptions where trial_ends_at < now, set status = 'expired'.
 *
 * Plan-agnostic: we key off status='trialing' (Stripe-aligned) rather than
 * plan='trial'. The T-28 migration backfills legacy rows, so this query
 * catches both old and new trials without knowing about specific plan names.
 * Backwards-compatible OR fallback retained for safety during upgrade window.
 */
function runTrialExpiration() {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Find expired trials (plan-agnostic: status='trialing' per T-28 refactor).
    // OR fallback handles any legacy rows not yet backfilled by the migration.
    // Rows with a real Stripe subscription (sub_...) are paid: Stripe webhooks own
    // their lifecycle, even if a legacy row still says plan='trial'.
    const expired = db.exec(
      `SELECT s.id, s.therapist_id, s.trial_ends_at
       FROM subscriptions s
       WHERE (s.status = 'trialing' OR (s.plan = 'trial' AND s.status = 'active'))
       AND (s.stripe_subscription_id IS NULL OR substr(s.stripe_subscription_id, 1, 4) <> 'sub_')
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

    saveDatabaseAfterWrite();
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

    saveDatabaseAfterWrite();
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

    saveDatabaseAfterWrite();
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

    // Find clients with no recent diary entries who have Telegram.
    // T-16: Reminders are opt-in per-therapist (reminders_enabled_default) with
    // an optional per-client override (reminders_enabled). The effective flag is:
    //   client.reminders_enabled IS NOT NULL  -> use client value (force on/off)
    //   client.reminders_enabled IS NULL      -> inherit therapist's default
    const inactive = db.exec(
      `SELECT u.id, u.telegram_id, u.language
       FROM users u
       JOIN users t ON t.id = u.therapist_id AND t.role = 'therapist'
       WHERE u.role = 'client' AND u.telegram_id IS NOT NULL
       AND u.therapist_id IS NOT NULL AND u.blocked_at IS NULL
       AND (
         (u.reminders_enabled IS NOT NULL AND u.reminders_enabled = 1)
         OR (u.reminders_enabled IS NULL AND COALESCE(t.reminders_enabled_default, 0) = 1)
       )
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

    if (count > 0) saveDatabaseAfterWrite();
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

// ── Reminder-service jobs (Feature #406) ──────────────────────────────────

/**
 * Job 7: Plan reminders — every 15 min (cron: every-15 every-hour every-day)
 * Select sessions with scheduled_at in [now, now+72h] where the client has
 * session_reminders_enabled=1 and call reminderService.planForSession for each.
 * planForSession is idempotent via the uq_srd_session_offset_channel unique index.
 */
function runPlanReminders() {
  if (!reminderService) {
    logger.warn('[SCHEDULER] plan-reminders: reminderService not loaded, skipping');
    return { planned: 0, error: 'reminderService_not_loaded' };
  }
  try {
    const db = getDatabase();
    const nowIso = new Date().toISOString();
    const plusIso = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const candidates = db.exec(
      `SELECT s.id
         FROM sessions s
         JOIN users u ON u.id = s.client_id
        WHERE s.scheduled_at > ? AND s.scheduled_at < ?
          AND u.session_reminders_enabled = 1
          AND u.blocked_at IS NULL`,
      [nowIso, plusIso]
    );

    if (!candidates.length || !candidates[0].values.length) {
      logger.info('[SCHEDULER] plan-reminders: no eligible sessions in next 72h');
      return { planned: 0 };
    }

    const ids = candidates[0].values.map(function(r) { return r[0]; });
    // Fire-and-forget — planForSession is async but the cron job doesn't await it.
    Promise.all(ids.map(function(id) {
      return reminderService.planForSession(id);
    })).then(function(results) {
      const total = results.reduce(function(acc, r) { return acc + (r && r.planned ? r.planned : 0); }, 0);
      logger.info('[SCHEDULER] plan-reminders: planned ' + total + ' dispatch row(s) across ' + ids.length + ' session(s)');
    }).catch(function(err) {
      logger.error('[SCHEDULER] plan-reminders async error: ' + err.message);
    });

    logger.info('[SCHEDULER] plan-reminders: kicked off planning for ' + ids.length + ' session(s)');
    return { kicked: ids.length };
  } catch (error) {
    logger.error('[SCHEDULER] plan-reminders error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 8: Dispatch opt-in notices — every 10 min (cron: every-10 every-hour every-day)
 * Calls reminderService.dispatchOptInNotices to send pending opt-in invitations.
 */
function runDispatchOptInNotices() {
  if (!reminderService) {
    logger.warn('[SCHEDULER] dispatch-opt-in-notices: reminderService not loaded, skipping');
    return { dispatched: 0, error: 'reminderService_not_loaded' };
  }
  try {
    reminderService.dispatchOptInNotices().then(function(result) {
      logger.info('[SCHEDULER] dispatch-opt-in-notices: ' + JSON.stringify(result));
    }).catch(function(err) {
      logger.error('[SCHEDULER] dispatch-opt-in-notices async error: ' + err.message);
    });
    return { kicked: true };
  } catch (error) {
    logger.error('[SCHEDULER] dispatch-opt-in-notices error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 9: Dispatch due reminders — every 5 min (cron: every-5 every-hour every-day)
 * Calls reminderService.dispatchDue to send reminders that are now due.
 */
function runDispatchDueReminders() {
  if (!reminderService) {
    logger.warn('[SCHEDULER] dispatch-due-reminders: reminderService not loaded, skipping');
    return { dispatched: 0, error: 'reminderService_not_loaded' };
  }
  try {
    reminderService.dispatchDue().then(function(result) {
      logger.info('[SCHEDULER] dispatch-due-reminders: ' + JSON.stringify(result));
    }).catch(function(err) {
      logger.error('[SCHEDULER] dispatch-due-reminders async error: ' + err.message);
    });
    return { kicked: true };
  } catch (error) {
    logger.error('[SCHEDULER] dispatch-due-reminders error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 10: Mark no-shows (hourly, 0 * * * *)
 * Calls reminderService.markNoShows to mark sessions as no_show after grace period.
 */
function runMarkNoShows() {
  if (!reminderService) {
    logger.warn('[SCHEDULER] mark-no-shows: reminderService not loaded, skipping');
    return { marked: 0, error: 'reminderService_not_loaded' };
  }
  try {
    const result = reminderService.markNoShows();
    logger.info('[SCHEDULER] mark-no-shows: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error('[SCHEDULER] mark-no-shows error: ' + error.message);
    return { error: error.message };
  }
}

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
      saveDatabaseAfterWrite();
    } else {
      logger.error('[SCHEDULER] Database backup failed: ' + result.error);
    }

    return result;
  } catch (error) {
    logger.error('[SCHEDULER] Database backup error: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ── Wave 2 (track 2A) jobs ────────────────────────────────────────────────

function unverifiedCleanupDays() {
  const n = parseInt(process.env.UNVERIFIED_CLEANUP_DAYS || String(UNVERIFIED_CLEANUP_DEFAULT_DAYS), 10);
  return Number.isFinite(n) && n > 0 ? n : UNVERIFIED_CLEANUP_DEFAULT_DAYS;
}

/**
 * Job 11: Unverified-therapist cleanup (daily at 3:30 AM)
 * Purge therapist accounts that never confirmed their email, are older than
 * UNVERIFIED_CLEANUP_DAYS (default 7) and show no sign of a real person:
 * no clients, no Stripe customer, no login / login-code audit entry, and
 * created AFTER platform_settings.email_verification_enabled_at (accounts
 * from before the wave-2 deploy never got a verification email — without
 * the marker the job does nothing and warns).
 * Their subscriptions, login_codes and password_reset_tokens go with them;
 * their own audit_logs rows are kept but detached (actor_id -> NULL, FK).
 * One audit row per purge: actor NULL, action 'unverified_user_purged',
 * details { email, user_id, created_at }.
 * UNVERIFIED_CLEANUP_DRY_RUN=true only logs the candidates.
 */
function runUnverifiedCleanup() {
  try {
    const db = getDatabase();
    const days = unverifiedCleanupDays();
    const dryRun = process.env.UNVERIFIED_CLEANUP_DRY_RUN === 'true';

    const markerRes = db.exec("SELECT value FROM platform_settings WHERE key = 'email_verification_enabled_at'");
    const enabledAt = markerRes.length && markerRes[0].values.length ? markerRes[0].values[0][0] : null;
    if (!enabledAt) {
      logger.warn('[SCHEDULER] Unverified cleanup: platform_settings.email_verification_enabled_at is missing — no candidates considered');
      return { candidates: 0, purged: 0, dry_run: dryRun, marker_missing: true };
    }

    const candidates = db.exec(
      `SELECT u.id, u.email, u.created_at
       FROM users u
       WHERE u.role = 'therapist'
         AND u.email_verified_at IS NULL
         AND u.created_at > ?
         AND u.created_at < datetime('now', ?)
         AND NOT EXISTS (SELECT 1 FROM users c WHERE c.therapist_id = u.id)
         AND NOT EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s.therapist_id = u.id AND s.stripe_customer_id IS NOT NULL AND s.stripe_customer_id != ''
         )
         AND NOT EXISTS (
           SELECT 1 FROM audit_logs a
           WHERE a.actor_id = u.id AND a.action IN ('login', 'login_code_success')
         )
       ORDER BY u.created_at ASC`,
      [enabledAt, '-' + days + ' days']
    );

    const rows = candidates.length ? candidates[0].values : [];
    if (!rows.length) {
      logger.info('[SCHEDULER] Unverified cleanup: no unverified therapists older than ' + days + ' days');
      return { candidates: 0, purged: 0, dry_run: dryRun };
    }

    if (dryRun) {
      rows.forEach(function(row) {
        logger.info('[SCHEDULER] Unverified cleanup (dry-run): would purge user id=' + row[0] + ' email=' + row[1] + ' created_at=' + row[2]);
      });
      logger.info('[SCHEDULER] Unverified cleanup (dry-run): ' + rows.length + ' candidate(s), nothing deleted');
      return { candidates: rows.length, purged: 0, dry_run: true };
    }

    let purged = 0;
    let skipped = 0;
    for (const row of rows) {
      const userId = row[0];
      const email = row[1];
      const createdAt = row[2];
      try {
        // One SAVEPOINT per user: a foreign-key hit on an unexpected table
        // rolls that user back and leaves the others untouched.
        db.run('SAVEPOINT purge_unverified');
        db.run('DELETE FROM subscriptions WHERE therapist_id = ?', [userId]);
        db.run('DELETE FROM login_codes WHERE user_id = ?', [userId]);
        db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
        db.run('UPDATE audit_logs SET actor_id = NULL WHERE actor_id = ?', [userId]);
        db.run('DELETE FROM users WHERE id = ?', [userId]);
        db.run(
          `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at)
           VALUES (NULL, 'unverified_user_purged', 'user', ?, ?, datetime('now'))`,
          [userId, JSON.stringify({ email: email, user_id: userId, created_at: createdAt })]
        );
        db.run('RELEASE SAVEPOINT purge_unverified');
        purged++;
        logger.info('[SCHEDULER] Unverified cleanup: purged user id=' + userId + ' (' + email + ', created ' + createdAt + ')');
      } catch (rowError) {
        try {
          db.run('ROLLBACK TO SAVEPOINT purge_unverified');
          db.run('RELEASE SAVEPOINT purge_unverified');
        } catch (e) {
          // savepoint already gone
        }
        skipped++;
        logger.warn('[SCHEDULER] Unverified cleanup: skipped user id=' + userId + ' (' + rowError.message + ')');
      }
    }

    if (purged > 0) saveDatabaseAfterWrite();
    logger.info('[SCHEDULER] Unverified cleanup: purged ' + purged + ' of ' + rows.length + ' candidate(s)' + (skipped ? ', skipped ' + skipped : ''));
    return { candidates: rows.length, purged: purged, skipped: skipped, dry_run: false };
  } catch (error) {
    logger.error('[SCHEDULER] Unverified cleanup error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 12: Login-code cleanup (runs in the 2:15 AM slot with job 2)
 * Codes live 10 minutes; anything older than a day is dead weight.
 * Guarded: the table exists since wave 1, but never let this break job 2.
 */
function runLoginCodesCleanup() {
  try {
    const db = getDatabase();
    db.run("DELETE FROM login_codes WHERE created_at < datetime('now', '-1 day')");
    const deleted = db.getRowsModified();
    if (deleted > 0) saveDatabaseAfterWrite();
    logger.info('[SCHEDULER] Login-codes cleanup: deleted ' + deleted + ' stale login codes');
    return { deleted: deleted };
  } catch (error) {
    logger.error('[SCHEDULER] Login-codes cleanup error: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Job 13: Data retention purge - daily at 4:00 AM (after the 3:00 backup and the
 * 3:30 unverified-account cleanup). Windows and RETENTION_DRY_RUN come from env;
 * see services/retentionService.js and .env.example.
 */
async function runRetentionCleanup() {
  if (!retentionService) {
    logger.warn('[SCHEDULER] retention: retentionService not loaded, skipping');
    return { error: 'retentionService_not_loaded' };
  }
  try {
    return await retentionService.runRetention();
  } catch (error) {
    logger.error('[SCHEDULER] Retention cleanup error: ' + error.message);
    return { error: error.message };
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
  // Job 12: Login-code cleanup shares this slot (wave 2, track 2A)
  scheduledTasks.push(cron.schedule('15 2 * * *', function() {
    logger.info('[SCHEDULER] Running subscription downgrade job...');
    runSubscriptionDowngrade();
    logger.info('[SCHEDULER] Running login-codes cleanup job...');
    runLoginCodesCleanup();
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

  // Job 7: Plan reminders — every 15 minutes
  scheduledTasks.push(cron.schedule('*/15 * * * *', function() {
    logger.info('[SCHEDULER] Running plan-reminders job...');
    runPlanReminders();
  }, { name: 'plan-reminders' }));

  // Job 8: Dispatch opt-in notices — every 10 minutes
  scheduledTasks.push(cron.schedule('*/10 * * * *', function() {
    logger.info('[SCHEDULER] Running dispatch-opt-in-notices job...');
    runDispatchOptInNotices();
  }, { name: 'dispatch-opt-in-notices' }));

  // Job 9: Dispatch due reminders — every 5 minutes
  scheduledTasks.push(cron.schedule('*/5 * * * *', function() {
    logger.info('[SCHEDULER] Running dispatch-due-reminders job...');
    runDispatchDueReminders();
  }, { name: 'dispatch-due-reminders' }));

  // Job 10: Mark no-shows — hourly
  scheduledTasks.push(cron.schedule('0 * * * *', function() {
    logger.info('[SCHEDULER] Running mark-no-shows job...');
    runMarkNoShows();
  }, { name: 'mark-no-shows' }));

  // Job 11: Unverified-therapist cleanup - daily at 3:30 AM (wave 2, track 2A)
  scheduledTasks.push(cron.schedule('30 3 * * *', function() {
    logger.info('[SCHEDULER] Running unverified-cleanup job...');
    runUnverifiedCleanup();
  }, { name: 'unverified-cleanup' }));

  // Job 13: Data retention purge - daily at 4:00 AM
  scheduledTasks.push(cron.schedule('0 4 * * *', function() {
    logger.info('[SCHEDULER] Running retention cleanup job...');
    runRetentionCleanup(); // async; never rejects (errors are caught inside)
  }, { name: 'retention-cleanup' }));

  logger.info('[SCHEDULER] All scheduled tasks registered (' + scheduledTasks.length + ' jobs)');
  logger.info('[SCHEDULER] Jobs: trial-expiration (2:00), subscription-downgrade (2:15), login-codes-cleanup (2:15), expiry-warning (9:00), diary-reminder (10:00), csrf-cleanup (hourly), database-backup (' + backupCron + '), plan-reminders (*/15), dispatch-opt-in-notices (*/10), dispatch-due-reminders (*/5), mark-no-shows (hourly), unverified-cleanup (3:30, ' + unverifiedCleanupDays() + 'd' + (process.env.UNVERIFIED_CLEANUP_DRY_RUN === 'true' ? ', dry-run' : '') + '), retention-cleanup (4:00' + (process.env.RETENTION_DRY_RUN === 'true' ? ', dry-run' : '') + ')');
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
  runDatabaseBackup,
  // Reminder service jobs (Feature #406)
  runPlanReminders,
  runDispatchOptInNotices,
  runDispatchDueReminders,
  runMarkNoShows,
  // Wave 2 (track 2A) jobs
  runUnverifiedCleanup,
  runLoginCodesCleanup,
  // Data retention
  runRetentionCleanup,
};
