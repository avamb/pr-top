// Data retention service
//
// Daily job (registered in services/scheduler.js) that deletes operational data
// which has outlived its purpose, so the database - and the privacy surface of
// the public assistant - does not grow without bound.
//
// What is purged (all windows are configurable, see .env.example):
//   ASSISTANT_RETENTION_DAYS        (90)  public-chat assistant_messages (anonymous
//                                         and viewer-account conversations only;
//                                         therapists' own history is kept), the
//                                         admin comments on deleted messages,
//                                         anonymous (therapist_id = 0) conversations,
//                                         viewer conversations left with no messages,
//                                         and ANONYMOUS viewer_sessions (no email, no
//                                         user). Sessions that have an email / user feed
//                                         the conversion funnel in /admin/stats/viewers,
//                                         so those rows are kept and only their PII
//                                         (ip, user_agent, fingerprint) is nulled.
//   ASSISTANT_CACHE_RETENTION_DAYS  (180) assistant_cached_answers not used for
//                                         that long (updated_at is bumped on every
//                                         cache hit). Seeded FAQ rows (is_seed = 1) and
//                                         curated rows (source IS NOT NULL: admin
//                                         corrections / edits) are NEVER deleted.
//   AI_USAGE_RETENTION_DAYS         (400) ai_usage_log
//   AUDIT_LOG_RETENTION_DAYS        (730) audit_logs
//   STRIPE_WEBHOOK_EVENT_RETENTION_DAYS (90) stripe_webhook_events (idempotency
//                                         ledger; Stripe stops retrying after days)
//   RETENTION_DRY_RUN               (false) log what would be deleted, delete nothing
//
// Also always (not windowed): messages/comments of conversations whose owner user
// no longer exists, and those orphan conversations themselves.
//
// A window that is not a positive integer falls back to its default.
//
// Deletes run in bounded batches (DELETE ... WHERE rowid IN (SELECT rowid ... LIMIT n))
// and the job yields to the event loop between batches, so a large first run does
// not block requests. The database is persisted once at the end.

const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

const BATCH_SIZE = 5000;

const DEFAULTS = {
  ASSISTANT_RETENTION_DAYS: 90,
  ASSISTANT_CACHE_RETENTION_DAYS: 180,
  AI_USAGE_RETENTION_DAYS: 400,
  AUDIT_LOG_RETENTION_DAYS: 730,
  STRIPE_WEBHOOK_EVENT_RETENTION_DAYS: 90,
};

function envDays(name) {
  const raw = process.env[name];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULTS[name];
}

function getConfig() {
  return {
    assistantDays: envDays('ASSISTANT_RETENTION_DAYS'),
    cacheDays: envDays('ASSISTANT_CACHE_RETENTION_DAYS'),
    aiUsageDays: envDays('AI_USAGE_RETENTION_DAYS'),
    auditDays: envDays('AUDIT_LOG_RETENTION_DAYS'),
    stripeEventDays: envDays('STRIPE_WEBHOOK_EVENT_RETENTION_DAYS'),
    dryRun: String(process.env.RETENTION_DRY_RUN || '').toLowerCase() === 'true',
  };
}

// 'YYYY-MM-DD HH:MM:SS' (UTC) - same shape as SQLite datetime('now').
function cutoffString(days, now) {
  const ms = (now instanceof Date ? now.getTime() : Date.now()) - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

function tableExists(db, name) {
  const res = db.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [name]);
  return res.length > 0 && res[0].values.length > 0;
}

function countRows(db, table, whereSql, params) {
  const res = db.exec(`SELECT COUNT(*) FROM ${table} WHERE ${whereSql}`, params);
  return res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
}

// Delete in bounded batches, yielding between batches. `table` and `whereSql`
// are internal constants; every value goes through `params`.
async function deleteInBatches(db, table, whereSql, params) {
  let total = 0;
  for (;;) {
    db.run(
      `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${whereSql} LIMIT ${BATCH_SIZE})`,
      params
    );
    const n = db.getRowsModified();
    total += n;
    if (n < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return total;
}

// Same batching for UPDATEs (PII nulling).
async function updateInBatches(db, table, setSql, whereSql, params) {
  let total = 0;
  for (;;) {
    db.run(
      `UPDATE ${table} SET ${setSql} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${whereSql} LIMIT ${BATCH_SIZE})`,
      params
    );
    const n = db.getRowsModified();
    total += n;
    if (n < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return total;
}

/**
 * Run all retention purges once.
 * @param {object} [opts]
 * @param {Date}    [opts.now]    - clock override (tests)
 * @param {boolean} [opts.dryRun] - override RETENTION_DRY_RUN
 * @returns {Promise<{dryRun: boolean, counts: object, errors: object, cutoffs: object}>}
 */
async function runRetention(opts) {
  const options = opts || {};
  const cfg = getConfig();
  const dryRun = typeof options.dryRun === 'boolean' ? options.dryRun : cfg.dryRun;
  const db = getDatabase();

  const cutoffs = {
    assistant: cutoffString(cfg.assistantDays, options.now),
    cache: cutoffString(cfg.cacheDays, options.now),
    aiUsage: cutoffString(cfg.aiUsageDays, options.now),
    audit: cutoffString(cfg.auditDays, options.now),
    stripeEvents: cutoffString(cfg.stripeEventDays, options.now),
  };
  const result = { dryRun, counts: {}, errors: {}, cutoffs };

  // One purge step: dry-run counts, real run deletes. A failing step is logged and
  // reported but does not stop the other steps.
  async function step(name, fn) {
    try {
      result.counts[name] = await fn();
    } catch (err) {
      result.counts[name] = 0;
      result.errors[name] = err.message;
      logger.error(`[RETENTION] ${name} failed: ${err.message}`);
    }
    await yieldToEventLoop();
  }
  const del = (table, where, params) => (
    dryRun ? countRows(db, table, where, params) : deleteInBatches(db, table, where, params)
  );

  // Messages to purge: only public-chat traffic (anonymous therapist_id=0
  // conversations and viewer-account conversations) older than the window,
  // plus every message of an anonymous conversation that has itself gone
  // stale. A therapist's own assistant history is never purged.
  const viewerUsers = "SELECT id FROM users WHERE role = 'viewer'";
  const publicConvs = `SELECT id FROM assistant_conversations WHERE therapist_id = 0 OR therapist_id IN (${viewerUsers})`;
  const staleAnonConvs = 'SELECT id FROM assistant_conversations WHERE therapist_id = 0 AND last_message_at < ?';
  const msgWhere = `((created_at < ? AND conversation_id IN (${publicConvs})) OR conversation_id IN (${staleAnonConvs}))`;
  const msgParams = [cutoffs.assistant, cutoffs.assistant];

  // Conversations whose owner user was deleted (therapist_id 0 is the anonymous
  // sentinel, not an orphan).
  const orphanConvs = 'SELECT id FROM assistant_conversations WHERE therapist_id != 0 AND therapist_id NOT IN (SELECT id FROM users)';
  const orphanMsgWhere = `conversation_id IN (${orphanConvs})`;

  await step('assistant_admin_comments', () =>
    del('assistant_admin_comments',
      `message_id IN (SELECT id FROM assistant_messages WHERE ${msgWhere} OR ${orphanMsgWhere})`,
      msgParams));

  await step('assistant_messages', () => del('assistant_messages', `(${msgWhere} OR ${orphanMsgWhere})`, msgParams));

  await step('assistant_conversations_anonymous', () =>
    del('assistant_conversations', 'therapist_id = 0 AND last_message_at < ?', [cutoffs.assistant]));

  // Viewer-account conversations whose messages have all expired.
  await step('assistant_conversations_empty_viewer', () =>
    del('assistant_conversations',
      `therapist_id IN (${viewerUsers}) AND last_message_at < ? AND NOT EXISTS (SELECT 1 FROM assistant_messages m WHERE m.conversation_id = assistant_conversations.id)`,
      [cutoffs.assistant]));

  await step('assistant_conversations_orphan', () =>
    del('assistant_conversations', 'therapist_id != 0 AND therapist_id NOT IN (SELECT id FROM users)', []));

  // Keep message_count truthful for viewer conversations that lost some messages.
  await step('assistant_conversations_recounted', async () => {
    const where = `page_context = 'landing' AND therapist_id IN (${viewerUsers}) ` +
      'AND message_count != (SELECT COUNT(*) FROM assistant_messages m WHERE m.conversation_id = assistant_conversations.id)';
    if (dryRun) return countRows(db, 'assistant_conversations', where, []);
    return updateInBatches(db, 'assistant_conversations',
      'message_count = (SELECT COUNT(*) FROM assistant_messages m WHERE m.conversation_id = assistant_conversations.id)',
      where, []);
  });

  // Anonymous sessions (no email, no account) are deleted; sessions that carry an
  // email or user feed the conversion funnel, so they stay with PII removed.
  const oldSession = 'COALESCE(last_active, created_at) < ?';
  await step('viewer_sessions', () =>
    del('viewer_sessions', `${oldSession} AND (email IS NULL OR email = '') AND user_id IS NULL`, [cutoffs.assistant]));

  await step('viewer_sessions_pii_nulled', async () => {
    const where = `${oldSession} AND ((email IS NOT NULL AND email != '') OR user_id IS NOT NULL) ` +
      'AND (ip IS NOT NULL OR user_agent IS NOT NULL OR fingerprint IS NOT NULL)';
    if (dryRun) return countRows(db, 'viewer_sessions', where, [cutoffs.assistant]);
    return updateInBatches(db, 'viewer_sessions', 'ip = NULL, user_agent = NULL, fingerprint = NULL', where, [cutoffs.assistant]);
  });

  await step('assistant_cached_answers', () =>
    // Seeded FAQ rows and curated rows (admin corrections: source IS NOT NULL)
    // are never expired, whatever their age.
    del('assistant_cached_answers',
      "COALESCE(is_seed, 0) = 0 AND (source IS NULL OR source = '') AND COALESCE(updated_at, created_at) < ?",
      [cutoffs.cache]));

  await step('ai_usage_log', () => del('ai_usage_log', 'timestamp < ?', [cutoffs.aiUsage]));

  await step('stripe_webhook_events', () => (
    tableExists(db, 'stripe_webhook_events')
      ? del('stripe_webhook_events', 'received_at < ?', [cutoffs.stripeEvents])
      : 0
  ));

  await step('audit_logs', () => del('audit_logs', 'created_at < ?', [cutoffs.audit]));

  const total = Object.values(result.counts).reduce((a, b) => a + b, 0);

  if (dryRun) {
    logger.info(`[RETENTION] DRY RUN - would change ${total} rows: ${JSON.stringify(result.counts)}`);
    return result;
  }

  if (total > 0) {
    try {
      // Record the purge itself (counts only, no content). Written after the audit
      // purge so this row always survives the run that created it.
      db.run(
        "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'retention_purge', 'system', NULL, ?, datetime('now'))",
        [JSON.stringify({ counts: result.counts })]
      );
    } catch (err) {
      logger.warn('[RETENTION] could not write audit row: ' + err.message);
    }
    saveDatabaseAfterWrite();
  }
  logger.info(`[RETENTION] changed ${total} rows: ${JSON.stringify(result.counts)}`);
  return result;
}

module.exports = { runRetention, getConfig, cutoffString, DEFAULTS };
