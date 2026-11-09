// Automated Database Backup Service
// Creates encrypted, compressed snapshots of the SQLite database
// with configurable retention policy and restore capability.
//
// File format (audit wave 3, M15) — "PRTOPBAK" v1, AES-256-GCM:
//   [8]  magic "PRTOPBAK"
//   [1]  format version (1)
//   [4]  key version, uint32 big-endian (the backup envelope key)
//   [4]  lowest key version of any Class A value INSIDE the image, uint32 BE
//        (0 = unknown). A backup is only free of an old key when both
//        numbers are >= the active version; the rotation job re-encrypts the
//        image contents as well as the envelope.
//   [12] IV
//   [..] ciphertext of gzip(SQLite image)
//   [16] GCM auth tag
// The 25-byte header is the GCM AAD, so magic/version/key version are
// authenticated too. The key is deriveSubKey(keyVersion, 'backup') from
// services/encryption.js: HKDF-separated from the field and file keys, and
// tied to the key ring, so a master-key rotation covers backups as well.
//
// Legacy files (before wave 3): [16 IV][AES-256-CBC(gzip(image))] with key
// sha256(ENCRYPTION_MASTER_KEY). They still restore: the current and the
// previous master secret are tried, and a candidate is only accepted when it
// unpads, gunzips and yields a SQLite image.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { getDatabase, saveDatabaseAfterWrite, snapshotDatabase, replaceDatabase, validateDatabaseImage } = require('../db/connection');
const { getActiveKeyVersion, deriveSubKey, KEY_PURPOSE, getKeySource } = require('./encryption');
const { logger } = require('../utils/logger');

const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');
const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '30', 10);
const DEV_MASTER_KEY = 'dev-master-key-change-in-production';
const GZIP_LEVEL = 6; // runs on the libuv threadpool; 9 cost a lot of CPU for ~1% size

const BACKUP_MAGIC = Buffer.from('PRTOPBAK', 'ascii');
const BACKUP_FORMAT_VERSION = 1;
const HEADER_LENGTH = BACKUP_MAGIC.length + 1 + 4 + 4 + 12; // 29
const IV_OFFSET = BACKUP_MAGIC.length + 9;
const TAG_LENGTH = 16;
const BACKUP_SUFFIX = '.db.gz.enc';
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1');

const DEFAULT_OFFSITE_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    logger.info(`[BACKUP] Created backup directory: ${BACKUP_DIR}`);
  }
}

// ---------------------------------------------------------------------------
// Serialisation: backup, restore and re-wrap never overlap (restore swaps the
// live DB; re-wrap replaces files that a restore might be reading).
// ---------------------------------------------------------------------------
// Never call an exclusive function from inside another one (it would wait on
// itself): restore uses createBackupUnlocked() for its safety backup.
let opChain = Promise.resolve();
function runExclusive(fn) {
  const run = opChain.then(() => fn());
  opChain = run.catch(() => {});
  return run;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function encryptBackupPayload(gzipped, keyVersion, dataKeyVersionMin) {
  const key = deriveSubKey(keyVersion, KEY_PURPOSE.BACKUP);
  const iv = crypto.randomBytes(12);
  const header = Buffer.alloc(HEADER_LENGTH);
  BACKUP_MAGIC.copy(header, 0);
  header.writeUInt8(BACKUP_FORMAT_VERSION, BACKUP_MAGIC.length);
  header.writeUInt32BE(keyVersion, BACKUP_MAGIC.length + 1);
  header.writeUInt32BE(Number.isInteger(dataKeyVersionMin) && dataKeyVersionMin > 0 ? dataKeyVersionMin : 0, BACKUP_MAGIC.length + 5);
  iv.copy(header, IV_OFFSET);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(gzipped), cipher.final()]);
  return Buffer.concat([header, body, cipher.getAuthTag()]);
}

/**
 * Describe a backup file from its first bytes (no decryption).
 * @returns {{ format: 'gcm-v1'|'legacy-cbc'|'unknown', key_version: number|null, data_key_version_min: number|null }}
 *   data_key_version_min: 0 = unknown (treated as outdated)
 */
function parseBackupHeader(head) {
  if (head.length >= HEADER_LENGTH && head.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    const fmt = head.readUInt8(BACKUP_MAGIC.length);
    if (fmt === BACKUP_FORMAT_VERSION) {
      return {
        format: 'gcm-v1',
        key_version: head.readUInt32BE(BACKUP_MAGIC.length + 1),
        data_key_version_min: head.readUInt32BE(BACKUP_MAGIC.length + 5)
      };
    }
    return { format: 'unknown', key_version: null, data_key_version_min: null };
  }
  return { format: 'legacy-cbc', key_version: null, data_key_version_min: null };
}

function readBackupHeaderSync(filepath) {
  const fd = fs.openSync(filepath, 'r');
  try {
    const head = Buffer.alloc(HEADER_LENGTH);
    const n = fs.readSync(fd, head, 0, HEADER_LENGTH, 0);
    return parseBackupHeader(head.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
}

function legacySecretCandidates() {
  // Legacy backups used sha256(ENCRYPTION_MASTER_KEY) directly, whatever the
  // secret was at the time: try the current one, then the previous one.
  const out = [];
  const current = process.env.ENCRYPTION_MASTER_KEY || DEV_MASTER_KEY;
  out.push({ source: 'current', secret: current });
  const prev = process.env.ENCRYPTION_MASTER_KEY_PREVIOUS;
  if (prev && prev !== current) out.push({ source: 'previous', secret: prev });
  return out;
}

async function decryptLegacyCbc(data) {
  if (data.length < 17 || (data.length - 16) % 16 !== 0) {
    return { error: 'Backup file is too small or corrupted' };
  }
  const iv = data.subarray(0, 16);
  const encrypted = data.subarray(16);
  for (const cand of legacySecretCandidates()) {
    const key = crypto.createHash('sha256').update(cand.secret).digest();
    let gz;
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      gz = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (e) {
      continue; // bad padding: wrong key
    }
    let raw;
    try {
      raw = await gunzipAsync(gz);
    } catch (e) {
      continue; // padding happened to look valid, but this is not our gzip
    }
    if (raw.length >= 100 && raw.subarray(0, 16).equals(SQLITE_HEADER)) {
      return { raw, gzipped: gz, format: 'legacy-cbc', keyVersion: null, keySource: cand.source };
    }
  }
  return { error: 'Decryption failed - wrong encryption key or corrupted file' };
}

/**
 * Decrypt any supported backup buffer.
 * @returns {Promise<{raw?: Buffer, gzipped?: Buffer, format?: string, keyVersion?: number|null, error?: string}>}
 */
async function decryptBackupBuffer(data) {
  const header = parseBackupHeader(data);
  if (header.format === 'gcm-v1') {
    const keyVersion = header.key_version;
    if (data.length < HEADER_LENGTH + TAG_LENGTH) {
      return { error: 'Backup file is too small or corrupted' };
    }
    let key;
    try {
      key = deriveSubKey(keyVersion, KEY_PURPOSE.BACKUP);
    } catch (e) {
      if (e.code === 'KEY_VERSION_UNAVAILABLE') {
        return {
          error: `Backup is encrypted with key version ${keyVersion}, which no configured master key serves ` +
            '(set ENCRYPTION_MASTER_KEY_PREVIOUS / ENCRYPTION_MASTER_KEY_VERSION)'
        };
      }
      return { error: 'Backup header is corrupted (invalid key version)' };
    }
    let gz = null;
    try {
      const headerBytes = data.subarray(0, HEADER_LENGTH);
      const iv = headerBytes.subarray(IV_OFFSET);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAAD(headerBytes);
      decipher.setAuthTag(data.subarray(data.length - TAG_LENGTH));
      gz = Buffer.concat([decipher.update(data.subarray(HEADER_LENGTH, data.length - TAG_LENGTH)), decipher.final()]);
    } catch (e) {
      // A legacy CBC file whose random IV starts with the magic (2^-64) still restores.
      const legacy = await decryptLegacyCbc(data);
      if (!legacy.error) return legacy;
      return { error: 'Decryption failed - wrong encryption key or corrupted file' };
    }
    let raw;
    try {
      raw = await gunzipAsync(gz);
    } catch (e) {
      return { error: 'Decompression failed - corrupted backup' };
    }
    return { raw, gzipped: gz, format: 'gcm-v1', keyVersion, dataKeyVersionMin: header.data_key_version_min, keySource: getKeySource(keyVersion) };
  }
  if (header.format === 'unknown') {
    return { error: 'Unsupported backup format version' };
  }
  return decryptLegacyCbc(data);
}

function isValidBackupFilename(filename) {
  return typeof filename === 'string' && filename.length > 0 && filename.length <= 200 &&
    !filename.includes('..') && !filename.includes('/') && !filename.includes('\\') &&
    path.basename(filename) === filename && filename.endsWith(BACKUP_SUFFIX) &&
    /^[A-Za-z0-9_.-]+$/.test(filename);
}

async function writeFileAtomicAsync(filepath, data) {
  const tmp = `${filepath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.promises.writeFile(tmp, data, { mode: 0o600 });
    await fs.promises.rename(tmp, filepath);
  } catch (e) {
    try { await fs.promises.unlink(tmp); } catch (_) { /* ignore */ }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Off-host copy hook (BACKUP_OFFSITE_COMMAND)
// ---------------------------------------------------------------------------

// Secrets are not handed to the operator's copy command (rclone, scp, ...):
// every variable whose name looks like a credential is removed, except the
// prefixes a copy tool legitimately needs for its own credentials.
const OFFSITE_SECRET_NAME_RE = /(KEY|SECRET|TOKEN|PASS|PASSWORD|PEPPER)/i;
const OFFSITE_ALLOW_PREFIXES = ['RCLONE_', 'AWS_', 'SSH_', 'B2_', 'GOOGLE_APPLICATION_CREDENTIALS'];
// Not matched by the pattern but still sensitive.
const OFFSITE_ENV_STRIP = ['DATABASE_URL', 'SMTP_USER', 'SUPERADMIN_EMAIL'];

function isOffsiteSecretName(name) {
  const upper = name.toUpperCase();
  if (OFFSITE_ALLOW_PREFIXES.some((p) => upper.startsWith(p))) return false;
  return OFFSITE_SECRET_NAME_RE.test(name) || OFFSITE_ENV_STRIP.includes(upper) || upper.startsWith('STRIPE_');
}

let offsiteRunning = false;
let lastOffsiteResult = null;

function shellQuote(p) {
  if (process.platform === 'win32') return '"' + String(p).replace(/"/g, '') + '"';
  return "'" + String(p).replace(/'/g, "'\\''") + "'";
}

function offsiteEnv(filePath) {
  const env = { ...process.env, BACKUP_FILE: filePath };
  for (const k of Object.keys(env)) {
    if (k !== 'BACKUP_FILE' && isOffsiteSecretName(k)) delete env[k];
  }
  return env;
}

function killTree(child) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL'); // detached => own process group
    }
  } catch (e) {
    try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
  }
}

/**
 * Run BACKUP_OFFSITE_COMMAND with the backup path as its last argument (also
 * in $BACKUP_FILE). Never throws and never blocks the backup: callers do not
 * await it. Killed after BACKUP_OFFSITE_TIMEOUT_MS (default 10 min). Only one
 * copy runs at a time; a backup finishing while one runs is skipped (logged).
 * @returns {Promise<object>} the logged result (for tests / status)
 */
function runOffsiteHook(filePath, opts = {}) {
  const command = String(opts.command !== undefined ? opts.command : (process.env.BACKUP_OFFSITE_COMMAND || '')).trim();
  if (!command) return Promise.resolve({ skipped: true, reason: 'not_configured' });
  if (offsiteRunning) {
    logger.warn(`[BACKUP] Off-site copy skipped for ${path.basename(filePath)}: previous copy still running`);
    return Promise.resolve({ skipped: true, reason: 'busy' });
  }
  const rawTimeout = opts.timeoutMs !== undefined ? opts.timeoutMs : parseInt(process.env.BACKUP_OFFSITE_TIMEOUT_MS || '', 10);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_OFFSITE_TIMEOUT_MS;

  offsiteRunning = true;
  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stderr = '';
    let child;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      offsiteRunning = false;
      const out = {
        file: path.basename(filePath),
        durationMs: Date.now() - started,
        finished_at: new Date().toISOString(),
        ...result,
        stderrTail: stderr.slice(-500).trim() || undefined,
      };
      lastOffsiteResult = out;
      if (out.ok) {
        logger.info(`[BACKUP] Off-site copy of ${out.file} succeeded in ${out.durationMs} ms`);
      } else {
        logger.warn(`[BACKUP] Off-site copy of ${out.file} FAILED (${out.timedOut ? 'timed out after ' + timeoutMs + ' ms' : 'exit ' + out.code + (out.signal ? ' ' + out.signal : '')}${out.error ? ': ' + out.error : ''})${out.stderrTail ? ' stderr: ' + out.stderrTail : ''}`);
      }
      resolve(out);
    };
    try {
      child = spawn(`${command} ${shellQuote(filePath)}`, {
        shell: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'ignore', 'pipe'],
        env: offsiteEnv(filePath),
        windowsHide: true,
      });
    } catch (e) {
      finish({ ok: false, code: null, error: e.message });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      // If the kill does not surface an exit event, settle anyway.
      setTimeout(() => finish({ ok: false, code: null, timedOut: true }), 2000).unref();
    }, timeoutMs);
    timer.unref();
    if (child.stderr) {
      child.stderr.on('data', (d) => {
        stderr += d.toString();
        if (stderr.length > 4000) stderr = stderr.slice(-2000);
      });
    }
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: null, error: e.message }); });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      finish({ ok: !timedOut && code === 0, code, signal: signal || undefined, timedOut: timedOut || undefined });
    });
  });
}

// ---------------------------------------------------------------------------
// Backup / restore
// ---------------------------------------------------------------------------

async function createBackupUnlocked({ prefix = 'prtop_backup_', applyRetentionPolicy = true, offsite = true } = {}) {
  ensureBackupDir();

  // The single export of the live database (also flushes it to disk).
  // snapshotDatabase() goes through the connection helper so per-connection
  // pragmas survive the export.
  const data = snapshotDatabase();
  const rawBuffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const keyVersion = getActiveKeyVersion();
  const dataKeyVersionMin = liveDataKeyVersionMin(keyVersion);

  // gzip on the libuv threadpool, not the event loop.
  const compressed = await gzipAsync(rawBuffer, { level: GZIP_LEVEL });
  const output = encryptBackupPayload(compressed, keyVersion, dataKeyVersionMin);

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  let filename = `${prefix}${timestamp}${BACKUP_SUFFIX}`;
  let filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) {
    filename = `${prefix}${timestamp}-${crypto.randomBytes(2).toString('hex')}${BACKUP_SUFFIX}`;
    filepath = path.join(BACKUP_DIR, filename);
  }

  // tmp + rename: a crash never leaves a truncated file that looks like a backup.
  await writeFileAtomicAsync(filepath, output);

  const stats = fs.statSync(filepath);

  logger.info(`[BACKUP] Created backup: ${filename} (${formatSize(stats.size)}, raw ${formatSize(rawBuffer.length)}, key v${keyVersion})`);

  // Record in audit log
  try {
    const db = getDatabase();
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'database_backup', 'system', 0, ?, datetime('now'))",
      [JSON.stringify({ filename, size: stats.size, raw_size: rawBuffer.length, key_version: keyVersion })]
    );
    saveDatabaseAfterWrite();
  } catch (auditErr) {
    logger.warn(`[BACKUP] Failed to log backup audit: ${auditErr.message}`);
  }

  // Apply retention policy
  if (applyRetentionPolicy) applyRetention();

  // Off-host copy: fire and forget.
  if (offsite) {
    runOffsiteHook(filepath).catch(() => {});
  }

  return { success: true, filename, size: stats.size, raw_size: rawBuffer.length, key_version: keyVersion, format: 'gcm-v1' };
}

/**
 * Create an encrypted, compressed backup of the database.
 * Async (wave 3): compression runs off the event loop.
 * @returns {Promise<{ success: boolean, filename?: string, size?: number, raw_size?: number, key_version?: number, error?: string }>}
 */
function backup() {
  return runExclusive(async () => {
    try {
      return await createBackupUnlocked();
    } catch (error) {
      logger.error(`[BACKUP] Backup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  });
}

function rotationJobRunning() {
  try {
    // Lazy: keyRotation depends on this module.
    return require('./keyRotation').isRunning();
  } catch (e) {
    return false;
  }
}

/**
 * Restore database from an encrypted backup file
 * @param {string} filename - The backup filename to restore
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
function restore(filename) {
  return runExclusive(async () => {
    try {
      // Validate filename to prevent path traversal — before touching the FS
      if (!isValidBackupFilename(filename)) {
        return { success: false, error: 'Invalid filename' };
      }

      if (rotationJobRunning()) {
        return { success: false, error: 'A key re-encryption job is running; pause it before restoring' };
      }

      const filepath = path.join(BACKUP_DIR, filename);

      if (!fs.existsSync(filepath)) {
        return { success: false, error: 'Backup file not found' };
      }

      const data = await fs.promises.readFile(filepath);

      if (data.length < 17) {
        return { success: false, error: 'Backup file is too small or corrupted' };
      }

      const decoded = await decryptBackupBuffer(data);
      if (decoded.error) {
        return { success: false, error: decoded.error };
      }
      const rawData = decoded.raw;

      // Reject a bad image before anything is touched (no safety backup, no swap)
      try {
        validateDatabaseImage(rawData);
      } catch (validateErr) {
        return { success: false, error: 'Backup is not a usable database - ' + validateErr.message };
      }

      // Create a safety backup of current database before restoring
      // The restore replaces the live DB for real, so never do it without a
      // way back: abort (nothing changed) if the safety backup failed.
      let safetyResult;
      try {
        safetyResult = await createBackupUnlocked({ prefix: 'pre_restore_', applyRetentionPolicy: false });
      } catch (safetyErr) {
        safetyResult = { success: false, error: safetyErr.message };
      }
      if (!safetyResult.success) {
        logger.error(`[BACKUP] Restore aborted: pre-restore safety backup failed: ${safetyResult.error}`);
        return { success: false, error: 'Pre-restore safety backup failed - restore aborted, nothing changed: ' + safetyResult.error };
      }

      // Swap the live in-memory DB and write the image to disk atomically.
      // Writing only the file (as before) was undone by the next save, which
      // flushed the old in-memory DB straight back over it. replaceDatabase()
      // validates again and runs the schema migrations on the image first.
      replaceDatabase(rawData);

      logger.info(`[BACKUP] Database restored from: ${filename} (${formatSize(rawData.length)}, ${decoded.format}${decoded.keyVersion ? ' key v' + decoded.keyVersion : ''})`);

      // Record restore in audit (note: this writes to the RESTORED database)
      try {
        const db = getDatabase();
        db.run(
          "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (0, 'database_restored', 'system', 0, ?, datetime('now'))",
          [JSON.stringify({ filename, size: rawData.length, format: decoded.format, safety_backup: safetyResult.filename })]
        );
        saveDatabaseAfterWrite();
      } catch (auditErr) {
        // The restored DB may not have the audit_logs table - non-fatal
      }

      return { success: true, filename, size: rawData.length, format: decoded.format, safety_backup: safetyResult.filename };
    } catch (error) {
      logger.error(`[BACKUP] Restore failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Lowest key version of any Class A value in the live database (0 = unknown).
 * Read right after the snapshot (same tick, no writes in between).
 */
function liveDataKeyVersionMin(fallbackVersion) {
  try {
    const kr = require('./keyRotation'); // lazy: keyRotation depends on this module
    const db = getDatabase();
    const inv = kr.inventoryColumns(db, kr.discoverTargets(db, { useCache: true }), fallbackVersion);
    return inv.minVersion === null ? fallbackVersion : inv.minVersion;
  } catch (e) {
    logger.warn(`[BACKUP] Could not determine the data key versions of the snapshot: ${e.message}`);
    return 0;
  }
}

/** True when a backup (header from parseBackupHeader / listBackups) still depends on a key older than activeVersion. */
function backupNeedsRewrap(header, activeVersion) {
  if (header.format === 'legacy-cbc') return true;
  if (header.format !== 'gcm-v1') return false; // unknown format: reported, never touched
  return header.key_version < activeVersion || !(header.data_key_version_min >= activeVersion);
}

/**
 * Re-encrypt one backup under `targetVersion` (key-rotation job): the envelope
 * AND every Class A value inside the database image that is on an older key
 * version (keyRotation.reencryptImage), so restoring it later never needs the
 * retired key. The new file is verified (decrypts, gunzips to the exact new
 * image, image passes integrity_check) before it atomically replaces the old
 * one; on any failure the original file is kept unchanged.
 * @returns {Promise<{ filename, rewrapped: boolean, from?: object, values_reencrypted?: number, values_failed?: number, error?: string }>}
 */
function rewrapBackup(filename, targetVersion) {
  return runExclusive(async () => {
    if (!isValidBackupFilename(filename)) return { filename, rewrapped: false, error: 'Invalid filename' };
    const filepath = path.join(BACKUP_DIR, filename);
    try {
      const data = await fs.promises.readFile(filepath);
      const header = parseBackupHeader(data);
      if (!backupNeedsRewrap(header, targetVersion)) {
        return { filename, rewrapped: false };
      }
      const decoded = await decryptBackupBuffer(data);
      if (decoded.error) return { filename, rewrapped: false, error: decoded.error };

      let image = decoded.raw;
      let dataMin = decoded.dataKeyVersionMin;
      let stats = { values_reencrypted: 0, values_failed: 0 };
      if (!(dataMin >= targetVersion)) {
        const kr = require('./keyRotation'); // lazy: keyRotation depends on this module
        const res = await kr.reencryptImage(decoded.raw, targetVersion);
        image = res.raw;
        dataMin = res.minVersion === null ? targetVersion : res.minVersion;
        stats = { values_reencrypted: res.stats.values_reencrypted, values_failed: res.stats.values_failed };
      }
      validateDatabaseImage(image);
      const gz = image === decoded.raw ? decoded.gzipped : await gzipAsync(image, { level: GZIP_LEVEL });
      const fresh = encryptBackupPayload(gz, targetVersion, dataMin);
      const check = await decryptBackupBuffer(fresh);
      const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
      if (check.error || check.keyVersion !== targetVersion || sha(check.raw) !== sha(image)) {
        return { filename, rewrapped: false, error: 'Verification of the re-encrypted backup failed; original kept' };
      }
      await writeFileAtomicAsync(filepath, fresh);
      logger.info(`[BACKUP] Re-encrypted ${filename}: ${decoded.format}${decoded.keyVersion ? ' v' + decoded.keyVersion : ''} -> gcm-v1 v${targetVersion} (${stats.values_reencrypted} values inside re-encrypted${stats.values_failed ? ', ' + stats.values_failed + ' could not be' : ''})`);
      const out = { filename, rewrapped: true, from: { format: decoded.format, key_version: decoded.keyVersion }, ...stats };
      if (stats.values_failed > 0) out.error = `${stats.values_failed} value(s) inside the backup could not be re-encrypted`;
      return out;
    } catch (e) {
      return { filename, rewrapped: false, error: e.message };
    }
  });
}

/**
 * List available backup files
 * @returns {{ backups: Array<{filename, size, created_at, format, key_version}>, total_size: number }}
 */
function listBackups() {
  ensureBackupDir();

  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(BACKUP_SUFFIX))
      .sort()
      .reverse(); // newest first

    const backups = files.map(filename => {
      const filepath = path.join(BACKUP_DIR, filename);
      const stats = fs.statSync(filepath);
      // Extract date from filename: prtop_backup_2026-03-13_17-30-00-000.db.gz.enc
      let created_at = stats.birthtime.toISOString();
      const dateMatch = filename.match(/(?:prtop_backup|pre_restore)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const timeStr = dateMatch[2].replace(/-/g, ':');
        created_at = `${dateStr}T${timeStr}Z`;
      }
      let header = { format: 'unknown', key_version: null, data_key_version_min: null };
      try { header = readBackupHeaderSync(filepath); } catch (e) { /* unreadable: report unknown */ }
      return {
        filename,
        size: stats.size,
        size_formatted: formatSize(stats.size),
        created_at,
        format: header.format,
        key_version: header.key_version,
        data_key_version_min: header.data_key_version_min
      };
    });

    const total_size = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      backups,
      count: backups.length,
      total_size,
      total_size_formatted: formatSize(total_size),
      retention_limit: BACKUP_RETENTION_COUNT,
      backup_dir: BACKUP_DIR
    };
  } catch (error) {
    logger.error(`[BACKUP] List backups failed: ${error.message}`);
    return { backups: [], count: 0, total_size: 0, total_size_formatted: '0 B' };
  }
}

/**
 * Apply retention policy: delete oldest backups beyond the retention limit
 */
function applyRetention() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('prtop_backup_') && f.endsWith(BACKUP_SUFFIX))
      .sort(); // oldest first

    if (files.length <= BACKUP_RETENTION_COUNT) return;

    const toDelete = files.slice(0, files.length - BACKUP_RETENTION_COUNT);
    for (const file of toDelete) {
      const filepath = path.join(BACKUP_DIR, file);
      fs.unlinkSync(filepath);
      logger.info(`[BACKUP] Retention: deleted old backup ${file}`);
    }

    logger.info(`[BACKUP] Retention applied: deleted ${toDelete.length} old backups, kept ${BACKUP_RETENTION_COUNT}`);
  } catch (error) {
    logger.warn(`[BACKUP] Retention cleanup failed: ${error.message}`);
  }
}

/**
 * Get backup status summary (for admin dashboard)
 */
function getBackupStatus() {
  const list = listBackups();
  const lastBackup = list.backups.find(b => b.filename.startsWith('prtop_backup_')) || list.backups[0] || null;
  return {
    last_backup: lastBackup ? lastBackup.created_at : null,
    last_backup_size: lastBackup ? lastBackup.size_formatted : null,
    backup_count: list.count,
    total_size: list.total_size_formatted,
    retention_limit: BACKUP_RETENTION_COUNT,
    backup_dir: BACKUP_DIR,
    offsite: {
      configured: !!(process.env.BACKUP_OFFSITE_COMMAND || '').trim(),
      running: offsiteRunning,
      last_result: lastOffsiteResult
        ? {
          file: lastOffsiteResult.file,
          ok: !!lastOffsiteResult.ok,
          skipped: !!lastOffsiteResult.skipped,
          timed_out: !!lastOffsiteResult.timedOut,
          code: lastOffsiteResult.code === undefined ? null : lastOffsiteResult.code,
          duration_ms: lastOffsiteResult.durationMs || null,
          finished_at: lastOffsiteResult.finished_at || null
        }
        : null
    }
  };
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

module.exports = {
  backup,
  restore,
  listBackups,
  getBackupStatus,
  applyRetention,
  // Wave 3 (M15/M16)
  rewrapBackup,
  backupNeedsRewrap,
  runOffsiteHook,
  isOffsiteSecretName,
  decryptBackupBuffer,
  parseBackupHeader,
  readBackupHeaderSync,
  isValidBackupFilename,
  BACKUP_DIR,
  BACKUP_SUFFIX,
};
