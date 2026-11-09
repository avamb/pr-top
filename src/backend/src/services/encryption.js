// Encryption Service
// Provides application-layer encryption with key versioning for key rotation.
// All sensitive data (Class A) is encrypted before storage using AES-256-GCM.
//
// Ciphertext layout (unchanged since v1): "<keyVersion>:<iv b64>:<tag b64>:<ct b64>".
// The key version inside every value selects the key that decrypts it, so data
// written under different versions coexists.
//
// Key ring (audit wave 3, M16). A key version maps to a MASTER SECRET:
//   ENCRYPTION_MASTER_KEY            current secret; used for every version
//                                    >= ENCRYPTION_MASTER_KEY_VERSION, and the
//                                    only secret new data is ever written with.
//   ENCRYPTION_MASTER_KEY_VERSION    first key version served by the current
//                                    secret (default 1 = the pre-rotation
//                                    behaviour: one secret for every version).
//   ENCRYPTION_MASTER_KEY_PREVIOUS   optional, DECRYPT-ONLY secret for versions
//                                    [ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION,
//                                     ENCRYPTION_MASTER_KEY_VERSION).
//   ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION  default 1.
// Field key for version v = PBKDF2(secret(v), "prtop-key-v<v>") — exactly the
// historical derivation, so every existing value still decrypts unchanged.
//
// Purpose sub-keys (backups, files) come from HKDF over a separate per-version
// root key, so they never equal the field key: deriveSubKey(v, 'backup' | 'file').
//
// Safety net: encryption_keys.key_check holds a canary encrypted under each
// version. A configured secret that does not open the canary (or, before a
// canary exists, any sampled real value) is a "mismatch": encrypt() then
// refuses to write rather than mixing two secrets under one version number.
// ENCRYPTION_KEY_CHECK=warn downgrades that refusal to a logged error (escape
// hatch for a false positive; the default is to enforce).
// Runbook: docs/troubleshooting/key-rotation-runbook.md

const crypto = require('crypto');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');
const { logger } = require('../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const DEV_MASTER_KEY = 'dev-master-key-change-in-production';
const SUBKEY_SALT = Buffer.from('prtop-subkey-salt-v1', 'utf8');

// Purposes for deriveSubKey(). Each yields an independent 256-bit key.
const KEY_PURPOSE = Object.freeze({ BACKUP: 'backup', FILE: 'file' });

// Strict form of the packed layout encrypt() produces (12-byte IV -> 16 b64
// chars, 16-byte tag -> 22 chars + "=="). Used to recognise ciphertext; decrypt()
// itself stays as lenient as before.
const PACKED_RE = /^(\d+):[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]*={0,2}$/;
// SQLite GLOB prefilter for the same layout (looser; confirm with PACKED_RE).
const PACKED_GLOB = '[0-9]*:????????????????:??????????????????????==:*';

// Every Class A column that holds encrypt() output. A column missing here
// would still be found by the rotation job's schema scan (services/keyRotation.js
// discovers any TEXT column holding ciphertext), but keep this list complete:
// it is what the key check samples and what the admin inventory names.
// keyIdColumn: the row metadata column that records the key id used (Class B,
// informational only — decryption always uses the version inside the value).
const ENCRYPTED_COLUMNS = Object.freeze([
  { table: 'diary_entries', column: 'content_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'diary_entries', column: 'transcript_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'diary_entries', column: 'file_ref', keyIdColumn: 'encryption_key_id' },
  { table: 'therapist_notes', column: 'note_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'sessions', column: 'transcript_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'sessions', column: 'summary_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'sessions', column: 'post_session_notes_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'client_context', column: 'anamnesis_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'client_context', column: 'current_goals_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'client_context', column: 'contraindications_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'client_context', column: 'ai_instructions_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'exercise_deliveries', column: 'response_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'sos_events', column: 'message_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'inquiries', column: 'title_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'inquiries', column: 'description_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'comments', column: 'content_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'assignments', column: 'title_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'assignments', column: 'description_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'assignment_reports', column: 'content_encrypted', keyIdColumn: 'encryption_key_id' },
  { table: 'assignment_reports', column: 'therapist_comment_encrypted', keyIdColumn: 'therapist_comment_key_id' },
  { table: 'users', column: 'custom_summary_prompt_encrypted', keyIdColumn: 'custom_summary_prompt_key_id' },
  // Search previews of client-derived embeddings (table created lazily by vectorStore).
  { table: 'vector_embeddings', column: 'text_preview', keyIdColumn: null },
  // Historically plaintext JSON despite the name; any ciphertext in it is covered.
  { table: 'audit_logs', column: 'details_encrypted', keyIdColumn: null },
]);

// ---------------------------------------------------------------------------
// Key ring
// ---------------------------------------------------------------------------

function parseVersionEnv(name, raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const n = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 1000000) {
    throw new Error(`${name} must be a positive integer (got an invalid value)`);
  }
  return n;
}

/**
 * Build the key ring from env. Throws on a configuration that would silently
 * map versions to the wrong secret. Never logs or returns secret values.
 */
function loadKeyRing(env) {
  const currentSecret = env.ENCRYPTION_MASTER_KEY || DEV_MASTER_KEY;
  const currentFrom = parseVersionEnv('ENCRYPTION_MASTER_KEY_VERSION', env.ENCRYPTION_MASTER_KEY_VERSION) || 1;
  const previousSecret = env.ENCRYPTION_MASTER_KEY_PREVIOUS || null;
  const previousFrom = parseVersionEnv('ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION', env.ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION) || 1;
  const warnings = [];

  if (previousSecret) {
    if (currentFrom <= previousFrom) {
      // Typical mistake: new secret + PREVIOUS set, but VERSION forgotten. Every
      // version would map to the new secret and old data would be unreadable.
      throw new Error(
        'ENCRYPTION_MASTER_KEY_PREVIOUS is set, so ENCRYPTION_MASTER_KEY_VERSION must be set to a version ' +
        'greater than ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION (normally: the highest existing key version + 1). ' +
        'See docs/troubleshooting/key-rotation-runbook.md'
      );
    }
    if (previousSecret === currentSecret) {
      warnings.push('ENCRYPTION_MASTER_KEY_PREVIOUS equals ENCRYPTION_MASTER_KEY; the rotation does not change the secret.');
    }
  } else if (currentFrom > 1) {
    warnings.push(
      `No ENCRYPTION_MASTER_KEY_PREVIOUS: data under key versions below ${currentFrom} cannot be decrypted. ` +
      'This is expected only after the previous key was retired.'
    );
  }

  return {
    current: { secret: currentSecret, fromVersion: currentFrom },
    previous: previousSecret ? { secret: previousSecret, fromVersion: previousFrom } : null,
    usingDevDefault: !env.ENCRYPTION_MASTER_KEY,
    warnings,
  };
}

let keyRing = loadKeyRing(process.env);
for (const w of keyRing.warnings) logger.warn('[ENCRYPTION] ' + w);

// Derived keys, cached per key version. PBKDF2 with 100k iterations takes
// tens of milliseconds and blocks the event loop; running it on every
// encrypt/decrypt made list endpoints that decrypt hundreds of rows block for
// seconds. The derivation is deterministic (same secret + version -> same
// key), so caching changes nothing about which ciphertexts decrypt. The
// caches are dropped whenever the key ring is reloaded.
let derivedKeyCache = new Map();
let rootKeyCache = new Map();
let subKeyCache = new Map();
// Key-check results per database handle (a restore swaps the handle).
let keyCheckCache = new WeakMap();

function keyUnavailableError(keyVersion) {
  const err = new Error(
    `No master key configured for encryption key version ${keyVersion} ` +
    '(set ENCRYPTION_MASTER_KEY_PREVIOUS / _VERSION; see docs/troubleshooting/key-rotation-runbook.md)'
  );
  err.code = 'KEY_VERSION_UNAVAILABLE';
  return err;
}

function assertVersionNumber(keyVersion) {
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error('Invalid key version in encrypted data');
  }
}

/** Which configured secret serves a version: 'current' | 'previous' | 'missing'. */
function getKeySource(keyVersion) {
  if (!Number.isInteger(keyVersion) || keyVersion < 1) return 'missing';
  if (keyVersion >= keyRing.current.fromVersion) return 'current';
  if (keyRing.previous && keyVersion >= keyRing.previous.fromVersion) return 'previous';
  return 'missing';
}

function masterSecretFor(keyVersion) {
  const source = getKeySource(keyVersion);
  if (source === 'current') return keyRing.current.secret;
  if (source === 'previous') return keyRing.previous.secret;
  return null;
}

/** True when some configured secret can decrypt data under this version. */
function hasKeyVersion(keyVersion) {
  return masterSecretFor(keyVersion) !== null;
}

/**
 * Derive the field (column) key for a key version. Same derivation as before
 * the key ring existed: PBKDF2-SHA256(secret, "prtop-key-v<version>", 100k).
 */
function deriveKey(keyVersion) {
  assertVersionNumber(keyVersion);
  let key = derivedKeyCache.get(keyVersion);
  if (!key) {
    const secret = masterSecretFor(keyVersion);
    if (secret === null) throw keyUnavailableError(keyVersion);
    key = crypto.pbkdf2Sync(secret, `prtop-key-v${keyVersion}`, PBKDF2_ITERATIONS, 32, 'sha256');
    derivedKeyCache.set(keyVersion, key);
  }
  return key;
}

// Per-version root for purpose sub-keys. Different salt than the field key,
// so a leaked field key says nothing about backup/file keys and vice versa.
function deriveRootKey(keyVersion) {
  assertVersionNumber(keyVersion);
  let key = rootKeyCache.get(keyVersion);
  if (!key) {
    const secret = masterSecretFor(keyVersion);
    if (secret === null) throw keyUnavailableError(keyVersion);
    key = crypto.pbkdf2Sync(secret, `prtop-root-v${keyVersion}`, PBKDF2_ITERATIONS, 32, 'sha256');
    rootKeyCache.set(keyVersion, key);
  }
  return key;
}

/**
 * Derive a 32-byte purpose key (HKDF-SHA256) for a key version, e.g.
 * deriveSubKey(v, KEY_PURPOSE.BACKUP) or deriveSubKey(v, KEY_PURPOSE.FILE).
 * Distinct purposes / versions give independent keys. Returns a fresh copy.
 * Throws (code KEY_VERSION_UNAVAILABLE) when no secret serves the version.
 */
function deriveSubKey(keyVersion, purpose) {
  if (typeof purpose !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(purpose)) {
    throw new Error('Invalid key purpose');
  }
  assertVersionNumber(keyVersion);
  const cacheKey = keyVersion + '|' + purpose;
  let key = subKeyCache.get(cacheKey);
  if (!key) {
    const info = Buffer.from(`prtop:${purpose}:v${keyVersion}`, 'utf8');
    key = Buffer.from(crypto.hkdfSync('sha256', deriveRootKey(keyVersion), SUBKEY_SALT, info, 32));
    subKeyCache.set(cacheKey, key);
  }
  return Buffer.from(key);
}

/**
 * Short public fingerprint of the key behind a version (no secret material;
 * an HKDF output). Lets an operator confirm two deployments hold the same
 * key for a version, e.g. that ENCRYPTION_MASTER_KEY_PREVIOUS is the old key.
 */
function getKeyFingerprint(keyVersion) {
  if (!hasKeyVersion(keyVersion)) return null;
  return deriveSubKey(keyVersion, 'fingerprint').subarray(0, 8).toString('hex');
}

/**
 * Re-read the key ring from env and drop every cached key / key check.
 * Used by tests and available for an operator-triggered reload; normal
 * deployments change keys by restarting with new env.
 */
function reloadKeyRing(env = process.env) {
  const next = loadKeyRing(env);
  keyRing = next;
  derivedKeyCache = new Map();
  rootKeyCache = new Map();
  subKeyCache = new Map();
  keyCheckCache = new WeakMap();
  for (const w of next.warnings) logger.warn('[ENCRYPTION] ' + w);
  return getKeyRingInfo();
}

/** Key-ring configuration without secrets (for the admin status page). */
function getKeyRingInfo() {
  return {
    current_from_version: keyRing.current.fromVersion,
    previous_configured: !!keyRing.previous,
    previous_from_version: keyRing.previous ? keyRing.previous.fromVersion : null,
    using_dev_default_key: keyRing.usingDevDefault,
    warnings: keyRing.warnings.slice(),
  };
}

// ---------------------------------------------------------------------------
// Packed values
// ---------------------------------------------------------------------------

/** True when value has the exact layout encrypt() produces. */
function isEncryptedValue(value) {
  return typeof value === 'string' && PACKED_RE.test(value);
}

/** Key version of a packed value, or null when value isn't ciphertext. */
function getPackedKeyVersion(value) {
  if (typeof value !== 'string') return null;
  const m = PACKED_RE.exec(value);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return Number.isInteger(v) && v >= 1 ? v : null;
}

function packWithVersion(plaintext, keyVersion) {
  const key = deriveKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  // Pack: version:iv:authTag:ciphertext (all base64 encoded)
  return [keyVersion.toString(), iv.toString('base64'), authTag.toString('base64'), encrypted].join(':');
}

// ---------------------------------------------------------------------------
// Key versions in the database
// ---------------------------------------------------------------------------

function keyCheckPlaintext(keyVersion) {
  return `prtop-key-check:v${keyVersion}`;
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function tableHasColumn(db, table, column) {
  try {
    const r = db.exec(`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`, [table, column]);
    return r.length > 0 && r[0].values[0][0] > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Make `target` the single active key version (inserting it if needed).
 * Used when the env key ring starts at a version above the DB's active one
 * (a master-key rotation was deployed) and by rotateKey().
 */
function activateKeyVersion(db, target) {
  const exists = db.exec('SELECT id FROM encryption_keys WHERE key_version = ?', [target]);
  if (exists.length > 0 && exists[0].values.length > 0) {
    db.run("UPDATE encryption_keys SET status = 'active', rotated_at = NULL WHERE key_version = ?", [target]);
  } else {
    db.run("INSERT INTO encryption_keys (key_version, status) VALUES (?, 'active')", [target]);
  }
  db.run(
    "UPDATE encryption_keys SET status = 'rotated', rotated_at = datetime('now') WHERE status = 'active' AND key_version <> ?",
    [target]
  );
  saveDatabaseAfterWrite();
}

/**
 * Get the current active encryption key version from the database.
 * Returns the highest active key version. When the env key ring says the
 * current secret starts at a higher version (ENCRYPTION_MASTER_KEY_VERSION),
 * that version is created and activated first, so new data is never written
 * under a version that belongs to a previous secret.
 */
function getActiveKeyVersion() {
  const db = getDatabase();
  const result = db.exec(
    "SELECT key_version FROM encryption_keys WHERE status = 'active' ORDER BY key_version DESC LIMIT 1"
  );
  let active = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : null;
  const floor = keyRing.current.fromVersion;

  if (active !== null && active >= floor) return active;

  let target = floor;
  if (active === null) {
    // No active row (fresh DB, or every row rotated): never reuse a version
    // number below an existing one.
    const maxRes = db.exec('SELECT MAX(key_version) FROM encryption_keys');
    const maxExisting = maxRes.length > 0 ? maxRes[0].values[0][0] : null;
    target = Math.max(floor, maxExisting || 1);
  }
  activateKeyVersion(db, target);
  if (active !== null) {
    logger.warn(
      `[ENCRYPTION] Active key version advanced from v${active} to v${target} ` +
      '(ENCRYPTION_MASTER_KEY_VERSION). Older data stays readable through ENCRYPTION_MASTER_KEY_PREVIOUS ' +
      'until the re-encryption job has moved it to the new version.'
    );
  }
  return target;
}

/**
 * Get the encryption key record ID for a given version.
 */
function getKeyId(keyVersion) {
  const db = getDatabase();
  const result = db.exec(
    'SELECT id FROM encryption_keys WHERE key_version = ?',
    [keyVersion]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return result[0].values[0][0];
}

function tryDecrypt(value) {
  try {
    return { ok: true, plaintext: decrypt(value) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function computeKeyCheck(db, keyVersion) {
  if (!hasKeyVersion(keyVersion)) return 'unavailable';

  let row = null;
  try {
    const r = db.exec('SELECT key_check, status FROM encryption_keys WHERE key_version = ?', [keyVersion]);
    if (r.length > 0 && r[0].values.length > 0) row = { keyCheck: r[0].values[0][0], status: r[0].values[0][1] };
  } catch (e) {
    // key_check column missing (schema older than wave 3): fall back to sampling
  }

  if (row && row.keyCheck) {
    const res = tryDecrypt(row.keyCheck);
    return res.ok && res.plaintext === keyCheckPlaintext(keyVersion) ? 'ok' : 'mismatch';
  }

  // No canary yet: verify against real data under this version. Any sampled
  // value that decrypts proves the secret; only "every sample fails" is a
  // mismatch (one corrupt value must not block all writes). Newest rows first:
  // they are the most likely to have been written with the configured secret.
  let tried = 0;
  let opened = 0;
  for (const { table, column } of ENCRYPTED_COLUMNS) {
    if (tried >= 10 || opened > 0) break;
    if (!tableHasColumn(db, table, column)) continue;
    let r;
    try {
      r = db.exec(
        `SELECT ${quoteIdent(column)} FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} GLOB ? ORDER BY rowid DESC LIMIT 3`,
        [`${keyVersion}:*`]
      );
    } catch (e) {
      continue;
    }
    if (r.length === 0) continue;
    for (const [value] of r[0].values) {
      if (getPackedKeyVersion(value) !== keyVersion) continue;
      tried++;
      if (tryDecrypt(value).ok) { opened++; break; }
    }
  }

  if (tried > 0 && opened === 0) return 'mismatch';
  if (opened === 0 && !(row && row.status === 'active')) {
    // No data under a non-active version: nothing at risk, nothing to prove.
    return 'unverified';
  }

  // Verified by data, or the active version with no data yet: record the canary.
  if (row) {
    try {
      db.run(
        'UPDATE encryption_keys SET key_check = ? WHERE key_version = ? AND key_check IS NULL',
        [packWithVersion(keyCheckPlaintext(keyVersion), keyVersion), keyVersion]
      );
      saveDatabaseAfterWrite();
    } catch (e) {
      logger.warn(`[ENCRYPTION] Could not store key check for v${keyVersion}: ${e.message}`);
    }
  }
  return 'ok';
}

/**
 * Check that the configured secret is the right one for a key version.
 * @returns {'ok'|'mismatch'|'unavailable'|'unverified'}
 *   ok          - canary (or real data) decrypts
 *   mismatch    - the configured secret does NOT open data under this version
 *   unavailable - no secret configured for this version
 *   unverified  - nothing stored under this version to check against
 */
function verifyKeyVersion(keyVersion) {
  const db = getDatabase();
  let perDb = keyCheckCache.get(db);
  if (!perDb) {
    perDb = new Map();
    keyCheckCache.set(db, perDb);
  }
  const cached = perDb.get(keyVersion);
  if (cached) return cached;
  const status = computeKeyCheck(db, keyVersion);
  if (status !== 'unverified') perDb.set(keyVersion, status);
  if (status === 'mismatch') {
    logger.error(
      `[ENCRYPTION] Key check FAILED for key version v${keyVersion}: the configured master key does not ` +
      'decrypt data stored under this version. Writes under it are refused. ' +
      'See docs/troubleshooting/key-rotation-runbook.md'
    );
  }
  return status;
}

/**
 * Throw unless new data may be written under this version: it must be served
 * by the CURRENT secret and pass the key check.
 */
function assertWritableKeyVersion(keyVersion) {
  if (getKeySource(keyVersion) !== 'current') {
    const err = new Error(`Key version ${keyVersion} is not served by the current master key; refusing to encrypt`);
    err.code = 'KEY_VERSION_NOT_WRITABLE';
    throw err;
  }
  const status = verifyKeyVersion(keyVersion);
  if (status === 'mismatch') {
    if (process.env.ENCRYPTION_KEY_CHECK === 'warn') {
      // Operator escape hatch for a false positive (see runbook). Logged once
      // per process by verifyKeyVersion(); writes proceed.
      return;
    }
    const err = new Error(
      `Encryption key check failed for active key version ${keyVersion}; refusing to encrypt. ` +
      'If you are rotating the master key, ENCRYPTION_MASTER_KEY_VERSION must be greater than the highest existing key version.'
    );
    err.code = 'KEY_CHECK_FAILED';
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext data using the current active key version.
 * Returns an object with encrypted data, IV, auth tag, and key version.
 *
 * @param {string} plaintext - The data to encrypt
 * @returns {{ encrypted: string, keyVersion: number, keyId: number }}
 */
function encrypt(plaintext) {
  const keyVersion = getActiveKeyVersion();
  assertWritableKeyVersion(keyVersion);
  const packed = packWithVersion(plaintext, keyVersion);
  const keyId = getKeyId(keyVersion);

  logger.debug(`Encrypted data with key version ${keyVersion}`);

  return {
    encrypted: packed,
    keyVersion,
    keyId
  };
}

/**
 * Encrypt under an explicit key version (re-encryption job). The version must
 * be served by the current secret and pass the key check.
 * @returns {string} packed ciphertext
 */
function encryptAtVersion(plaintext, keyVersion) {
  assertWritableKeyVersion(keyVersion);
  return packWithVersion(plaintext, keyVersion);
}

/**
 * Decrypt data that was encrypted with any key version.
 * Extracts the key version from the packed data and uses the corresponding key.
 *
 * @param {string} packed - The packed encrypted data (version:iv:authTag:ciphertext)
 * @returns {string} Decrypted plaintext
 */
function decrypt(packed) {
  const parts = packed.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [versionStr, ivB64, authTagB64, ciphertext] = parts;
  const keyVersion = parseInt(versionStr, 10);

  if (isNaN(keyVersion)) {
    throw new Error('Invalid key version in encrypted data');
  }

  const key = deriveKey(keyVersion);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  logger.debug(`Decrypted data from key version ${keyVersion}`);

  return decrypted;
}

/**
 * Create a new encryption key version from the CURRENT master secret (a
 * derived-key rotation; changing the secret itself is done through env, see
 * the runbook). The old active version is marked 'rotated'; its data stays
 * readable and is moved by the re-encryption job.
 *
 * @returns {{ newVersion: number, newKeyId: number }}
 */
function rotateKey() {
  const db = getDatabase();
  const currentVersion = getActiveKeyVersion();
  const maxRes = db.exec('SELECT MAX(key_version) FROM encryption_keys');
  const maxExisting = maxRes.length > 0 ? (maxRes[0].values[0][0] || 0) : 0;
  const newVersion = Math.max(currentVersion, maxExisting) + 1;

  activateKeyVersion(db, newVersion);
  // Record the canary for the new version right away.
  verifyKeyVersion(newVersion);

  const newKeyId = getKeyId(newVersion);

  logger.info(`Encryption key rotated: v${currentVersion} -> v${newVersion}`);

  return { newVersion, newKeyId };
}

/**
 * Get all encryption key versions and their statuses.
 * key_source: which configured secret serves it ('current'|'previous'|'missing');
 * key_check: see verifyKeyVersion(); fingerprint: see getKeyFingerprint().
 */
function listKeyVersions() {
  const db = getDatabase();
  const result = db.exec(
    'SELECT id, key_version, status, created_at, rotated_at FROM encryption_keys ORDER BY key_version ASC'
  );

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => {
    const version = row[1];
    let check = 'unavailable';
    let fingerprint = null;
    try { check = verifyKeyVersion(version); } catch (e) { check = 'error'; }
    try { fingerprint = getKeyFingerprint(version); } catch (e) { fingerprint = null; }
    return {
      id: row[0],
      key_version: version,
      status: row[2],
      created_at: row[3],
      rotated_at: row[4],
      key_source: getKeySource(version),
      key_check: check,
      fingerprint
    };
  });
}

/**
 * Re-encrypt data from an old key version to the current active version.
 * Useful for migrating data after key rotation.
 */
function reEncrypt(packed) {
  const plaintext = decrypt(packed);
  return encrypt(plaintext);
}

module.exports = {
  encrypt,
  decrypt,
  rotateKey,
  getActiveKeyVersion,
  getKeyId,
  listKeyVersions,
  reEncrypt,
  // Wave 3 (M15/M16): key ring, purpose keys, rotation support
  KEY_PURPOSE,
  ENCRYPTED_COLUMNS,
  PACKED_GLOB,
  deriveSubKey,
  // Field key of a version, for code that must stream-decrypt values written
  // by encrypt() (legacy media files). Do not use it to write new data.
  deriveKey,
  hasKeyVersion,
  getKeySource,
  getKeyFingerprint,
  getKeyRingInfo,
  reloadKeyRing,
  verifyKeyVersion,
  assertWritableKeyVersion,
  encryptAtVersion,
  isEncryptedValue,
  getPackedKeyVersion,
};
