// Login-by-email-code helpers (wave 2, track 2B).
//
// Spec: docs/security/SPEC_ANTIBOT_WAVES.md §0 A7 —
//   6-digit code from crypto.randomInt, stored as sha256(code + PEPPER);
//   link token = 32 random bytes hex, stored the same way; TTL 10 min,
//   5 attempts. One `login_codes` row carries both secrets, so locking the
//   code (attempts) or consuming the link retires the other as well.
//
// Every function takes the sql.js handle explicitly. Writers persist via
// saveDatabaseAfterWrite() unless called with { save: false }, in which case
// the caller batches the save once per request. Nothing here ever logs a
// code, a token or a hash.
const crypto = require('crypto');
const { saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('./logger');

const PEPPER = process.env.LOGIN_CODE_PEPPER || process.env.JWT_SECRET || 'dev-login-code-pepper';
const TTL_MIN = (() => {
  const parsed = parseInt(process.env.LOGIN_CODE_TTL_MIN, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
})();
const MAX_ATTEMPTS = 5;

if (process.env.NODE_ENV === 'production' && !process.env.LOGIN_CODE_PEPPER) {
  logger.warn('[LOGIN_CODE] LOGIN_CODE_PEPPER is not set; falling back to JWT_SECRET as the code pepper. Set LOGIN_CODE_PEPPER in production.');
}

// sha256(value + PEPPER) as hex — used for both the code and the link token.
function hash(value) {
  return crypto.createHash('sha256').update(String(value) + PEPPER).digest('hex');
}

function generate() {
  return {
    code: String(crypto.randomInt(0, 1000000)).padStart(6, '0'),
    linkToken: crypto.randomBytes(32).toString('hex')
  };
}

// Constant-time comparison of two hex digests.
function digestsEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// sql.js: db.exec() returns [{ columns, values }]; map the first row to an object.
function selectOne(db, sql, params) {
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = {};
  result[0].columns.forEach((col, i) => { row[col] = result[0].values[0][i]; });
  return row;
}

function isExpired(row) {
  const expiresAt = Date.parse(row.expires_at);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function shouldSave(opts) {
  return !(opts && opts.save === false);
}

function retire(db, rowId) {
  db.run('UPDATE login_codes SET used = 1 WHERE id = ?', [rowId]);
}

/**
 * Issue a fresh code + link token for a user. Any earlier unused rows for the
 * same user are retired first so only the newest issuance is valid.
 * @returns {{ code: string, linkToken: string, expiresAt: string }} plaintext secrets for the email only
 */
function createFor(db, userId, ip, opts) {
  const { code, linkToken } = generate();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

  db.run('UPDATE login_codes SET used = 1 WHERE user_id = ? AND used = 0', [userId]);
  db.run(
    'INSERT INTO login_codes (user_id, code_hash, link_token_hash, expires_at, attempts, used, ip) VALUES (?, ?, ?, ?, 0, 0, ?)',
    [userId, hash(code), hash(linkToken), expiresAt, ip || null]
  );
  if (shouldSave(opts)) saveDatabaseAfterWrite();

  return { code, linkToken, expiresAt };
}

// Number of codes issued for this user within the last `minutes` (per-email throttle).
function countRecent(db, userId, minutes) {
  const window = Math.max(1, parseInt(minutes, 10) || 1);
  const row = selectOne(
    db,
    "SELECT COUNT(*) AS n FROM login_codes WHERE user_id = ? AND created_at >= datetime('now', ?)",
    [userId, `-${window} minutes`]
  );
  return row ? Number(row.n) || 0 : 0;
}

// Newest unused row for the user (the only one that can still be redeemed).
function findActive(db, userId) {
  return selectOne(
    db,
    'SELECT id, user_id, code_hash, link_token_hash, expires_at, attempts, used FROM login_codes WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1',
    [userId]
  );
}

/**
 * Check a 6-digit code for a user.
 * @returns {{ ok: true } | { ok: false, reason: 'none'|'expired'|'attempts'|'mismatch' }}
 *   mismatch  -> attempts incremented; when they reach MAX_ATTEMPTS the row is
 *                retired (used=1) and the reason is 'attempts' (locked).
 *   ok        -> row retired (used=1) so the code cannot be replayed.
 * Pass { save: false } to let the caller persist once per request.
 */
function verifyCode(db, userId, code, opts) {
  const save = shouldSave(opts);
  const row = findActive(db, userId);
  if (!row) return { ok: false, reason: 'none' };

  if (isExpired(row)) {
    retire(db, row.id);
    if (save) saveDatabaseAfterWrite();
    return { ok: false, reason: 'expired' };
  }

  if (Number(row.attempts) >= MAX_ATTEMPTS) {
    retire(db, row.id);
    if (save) saveDatabaseAfterWrite();
    return { ok: false, reason: 'attempts' };
  }

  if (!digestsEqual(hash(code), row.code_hash)) {
    const attempts = Number(row.attempts) + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    db.run('UPDATE login_codes SET attempts = ?, used = ? WHERE id = ?', [attempts, locked ? 1 : 0, row.id]);
    if (save) saveDatabaseAfterWrite();
    return { ok: false, reason: locked ? 'attempts' : 'mismatch' };
  }

  retire(db, row.id);
  if (save) saveDatabaseAfterWrite();
  return { ok: true };
}

/**
 * Redeem a magic-link token by its hash.
 * @returns {{ ok: true, userId: number } | { ok: false, reason: 'none'|'expired' }}
 *   A row that was already used (code redeemed, code locked, or link reused)
 *   is reported as 'none'. On success the row is retired (used=1).
 * Pass { save: false } to let the caller persist once per request.
 */
function verifyLink(db, linkTokenHash, opts) {
  const save = shouldSave(opts);
  const row = selectOne(
    db,
    'SELECT id, user_id, expires_at, used FROM login_codes WHERE link_token_hash = ? AND used = 0 ORDER BY id DESC LIMIT 1',
    [linkTokenHash]
  );
  if (!row) return { ok: false, reason: 'none' };

  if (isExpired(row)) {
    retire(db, row.id);
    if (save) saveDatabaseAfterWrite();
    return { ok: false, reason: 'expired' };
  }

  retire(db, row.id);
  if (save) saveDatabaseAfterWrite();
  return { ok: true, userId: row.user_id };
}

module.exports = {
  TTL_MIN,
  MAX_ATTEMPTS,
  hash,
  generate,
  createFor,
  countRecent,
  findActive,
  verifyCode,
  verifyLink
};
