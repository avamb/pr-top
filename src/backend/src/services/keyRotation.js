// Key rotation: resumable background re-encryption (audit wave 3, M16).
//
// After the active key version changes (a new master secret deployed with
// ENCRYPTION_MASTER_KEY_VERSION, or POST /api/encryption/rotate), existing data
// stays on its old version until this job moves it. The job:
//   1. columns  - every Class A column (encryption.ENCRYPTED_COLUMNS plus any
//                 other TEXT column the schema scan finds holding ciphertext):
//                 values on a version below the active one are decrypted,
//                 re-encrypted under the active version, verified, and
//                 written back, in small batches inside a transaction, with
//                 saveDatabaseAfterWrite() and a pause between batches;
//   2. backups  - backup files not on the GCM format at the active version
//                 are re-encrypted (backupService.rewrapBackup, verified,
//                 atomic replace);
//   3. files    - media files under data/sessions and data/diary_files: every
//                 legacy-format file and every chunked file below the active
//                 version is re-encrypted in place by fileCrypto.reencryptFile
//                 (per-file lock, verified before it replaces the original),
//                 one file per tick, cursor = last processed file. Temp
//                 leftovers (*.part, *.rewrite.part, *.tmp) are skipped.
// Progress lives in encryption_rotation_jobs, so a restart or a pause resumes
// from the stored cursor. Re-running is always safe: only values below the
// active version are touched, and a value that fails to decrypt is left as is
// and reported.
//
// Retiring the previous key is safe only when getRotationStatus() reports
// safe_to_retire_previous (nothing left on an old version anywhere).
// Runbook: docs/troubleshooting/key-rotation-runbook.md

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { getDatabase, saveDatabaseAfterWrite, inOpenTransaction, validateDatabaseImage } = require('../db/connection');
const enc = require('./encryption');
const backupService = require('./backupService');
const { logger } = require('../utils/logger');

const EXCLUDED_TABLES = new Set(['encryption_keys', 'encryption_rotation_jobs', 'sqlite_sequence']);
const MAX_FAILURE_SAMPLES = 100;
const DISCOVERY_CACHE_MS = 60 * 1000;
const FILE_INVENTORY_CACHE_MS = 30 * 1000;
const END_OF_TABLES = '*end*'; // cursor marker: column phase finished (not a valid table name here)

const settings = {
  batchRows: 200,
  batchPauseMs: 10,
  fileDirs: [
    path.resolve(__dirname, '../../data/sessions'),
    path.resolve(__dirname, '../../data/diary_files'),
  ],
};

let runner = null; // { jobId, pauseRequested, promise }
let discoveryCache = null; // { db, at, targets }
let fileInventoryCache = null; // { at, active, value }

/** Test / ops hook: override batch size, pause and scanned file dirs. */
function configure(opts = {}) {
  if (Number.isInteger(opts.batchRows) && opts.batchRows > 0) settings.batchRows = opts.batchRows;
  if (Number.isInteger(opts.batchPauseMs) && opts.batchPauseMs >= 0) settings.batchPauseMs = opts.batchPauseMs;
  if (Array.isArray(opts.fileDirs)) settings.fileDirs = opts.fileDirs.slice();
  discoveryCache = null;
  fileInventoryCache = null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function q(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function rows(db, sql, params) {
  const r = db.exec(sql, params);
  if (r.length === 0) return [];
  const cols = r[0].columns;
  return r[0].values.map((v) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}

// ---------------------------------------------------------------------------
// Target discovery
// ---------------------------------------------------------------------------

function listTables(db) {
  return rows(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map((r) => r.name)
    .filter((n) => !EXCLUDED_TABLES.has(n));
}

function tableColumns(db, table) {
  return rows(db, `PRAGMA table_info(${q(table)})`).map((r) => ({ name: r.name, type: String(r.type || '') }));
}

function isTextAffinity(type) {
  return type === '' || /CHAR|CLOB|TEXT/i.test(type);
}

function columnHoldsCiphertext(db, table, column) {
  const r = db.exec(
    `SELECT ${q(column)} FROM ${q(table)} WHERE ${q(column)} GLOB ? LIMIT 20`,
    [enc.PACKED_GLOB]
  );
  if (r.length === 0) return false;
  return r[0].values.some(([v]) => enc.isEncryptedValue(v));
}

/**
 * Every table/column the job covers: the explicit ENCRYPTED_COLUMNS list (for
 * the tables/columns that exist) plus any other TEXT column found holding
 * ciphertext. Result: [{ table, columns: [{ column, keyIdColumn, listed }] }].
 */
function discoverTargets(db, { useCache = false } = {}) {
  if (useCache && discoveryCache && discoveryCache.db === db && Date.now() - discoveryCache.at < DISCOVERY_CACHE_MS) {
    return discoveryCache.targets;
  }
  const listed = new Map();
  for (const e of enc.ENCRYPTED_COLUMNS) {
    if (!listed.has(e.table)) listed.set(e.table, new Map());
    listed.get(e.table).set(e.column, e.keyIdColumn || null);
  }
  const targets = [];
  for (const table of listTables(db)) {
    const cols = tableColumns(db, table);
    const names = new Set(cols.map((c) => c.name));
    const listedCols = listed.get(table) || new Map();
    const out = [];
    for (const c of cols) {
      if (listedCols.has(c.name)) {
        const kid = listedCols.get(c.name);
        out.push({ column: c.name, keyIdColumn: kid && names.has(kid) ? kid : null, listed: true });
      } else if (isTextAffinity(c.type)) {
        let found = false;
        try { found = columnHoldsCiphertext(db, table, c.name); } catch (e) { found = false; }
        if (found) out.push({ column: c.name, keyIdColumn: null, listed: false });
      }
    }
    if (out.length > 0) targets.push({ table, columns: out });
  }
  if (useCache) discoveryCache = { db, at: Date.now(), targets };
  return targets;
}

const VERSION_EXPR = (col) => `CAST(substr(${q(col)}, 1, instr(${q(col)}, ':') - 1) AS INTEGER)`;

/**
 * Per-column counts of ciphertext values by key version.
 * minVersion: lowest key version found anywhere (null when no ciphertext).
 */
function inventoryColumns(db, targets, activeVersion) {
  const columns = [];
  let outdated = 0;
  let total = 0;
  let minVersion = null;
  for (const t of targets) {
    for (const c of t.columns) {
      const byVersion = {};
      let colOutdated = 0;
      let colTotal = 0;
      const r = rows(
        db,
        `SELECT ${VERSION_EXPR(c.column)} AS v, COUNT(*) AS n FROM ${q(t.table)} WHERE ${q(c.column)} GLOB ? GROUP BY v`,
        [enc.PACKED_GLOB]
      );
      for (const { v, n } of r) {
        byVersion[v] = n;
        colTotal += n;
        if (v < activeVersion) colOutdated += n;
        if (minVersion === null || v < minVersion) minVersion = v;
      }
      outdated += colOutdated;
      total += colTotal;
      columns.push({ table: t.table, column: c.column, listed: c.listed, total: colTotal, outdated: colOutdated, by_version: byVersion });
    }
  }
  return { columns, total, outdated, minVersion };
}

function inventoryBackups(activeVersion) {
  const list = backupService.listBackups();
  const byFormat = {};
  let outdated = 0;
  for (const b of list.backups || []) {
    const label = b.format === 'gcm-v1' ? `gcm-v1:v${b.key_version}/data-v${b.data_key_version_min || '?'}` : b.format;
    byFormat[label] = (byFormat[label] || 0) + 1;
    if (backupService.backupNeedsRewrap(b, activeVersion)) outdated++;
  }
  return { total: (list.backups || []).length, outdated, by_format: byFormat };
}


// ---------------------------------------------------------------------------
// Encrypted files (count only)
// ---------------------------------------------------------------------------

const LEGACY_FILE_RE = /^(\d+):[A-Za-z0-9+/]{16}:/;

function loadFileCrypto() {
  try {
    // Track M's chunked format. Optional: absent before it lands.
    return require('./fileCrypto');
  } catch (e) {
    return null;
  }
}

async function fileCryptoKeyVersion(fc, filePath) {
  if (!fc) return null;
  if (typeof fc.readFileInfo === 'function') {
    // { format: 'v1'|'legacy'|'unknown', keyVersion }; legacy is handled by the caller
    try {
      const info = await fc.readFileInfo(filePath);
      return info && info.format === 'v1' && Number.isInteger(info.keyVersion) && info.keyVersion >= 1 ? info.keyVersion : null;
    } catch (e) {
      return null;
    }
  }
  for (const name of ['readKeyVersion', 'readFileKeyVersion', 'getFileKeyVersion']) {
    if (typeof fc[name] === 'function') {
      try {
        const v = await fc[name](filePath);
        if (Number.isInteger(v) && v >= 1) return v;
      } catch (e) {
        return null;
      }
      return null;
    }
  }
  return null;
}

// Temp / leftover names that are never media: fileCrypto's in-progress writes
// (*.part, *.rewrite.part), upload staging files (*.upload.enc, renamed to
// the final name once the content type is known), *.tmp and dotfiles. Skipped
// by the inventory and the job, so a leftover can't count as "unknown" or
// "outdated" forever; fileCrypto.startHousekeeping() sweeps stale ones.
function isTempName(name) {
  return name.startsWith('.') || name.endsWith('.tmp') || name.endsWith('.part') || name.endsWith('.upload.enc');
}

// fileCrypto.reencryptFile errors worth one retry: the file was replaced
// mid-rewrite, or a transient fs lock (Windows / AV scanners).
const RETRYABLE_FILE_ERRORS = new Set(['SOURCE_CHANGED', 'EPERM', 'EBUSY', 'EACCES', 'EAGAIN']);

async function walkFiles(dir, depth, out) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return; // directory absent
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (depth < 3 && ent.name !== 'tmp') await walkFiles(full, depth + 1, out);
    } else if (ent.isFile() && !isTempName(ent.name)) {
      out.push(full);
    }
  }
}

async function readHead(filePath, n) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/**
 * Count encrypted media files per format and key version.
 * legacy: base64-in-GCM text files ("<v>:<iv>:..."); chunked: track M's
 * format, read through fileCrypto.readFileInfo(path) when available;
 * unknown: neither (includes chunked files while no reader is exported).
 */
async function inventoryFiles(activeVersion, { useCache = false } = {}) {
  if (useCache && fileInventoryCache && fileInventoryCache.active === activeVersion &&
      Date.now() - fileInventoryCache.at < FILE_INVENTORY_CACHE_MS) {
    return fileInventoryCache.value;
  }
  const fc = loadFileCrypto();
  const readerAvailable = !!(fc && ['readFileInfo', 'readKeyVersion', 'readFileKeyVersion', 'getFileKeyVersion'].some((n) => typeof fc[n] === 'function'));
  const files = [];
  for (const dir of settings.fileDirs) await walkFiles(dir, 0, files);
  const value = { total: files.length, legacy: {}, chunked: {}, unknown: 0, unknown_files: [], outdated: 0, reader_available: readerAvailable };
  const noteUnknown = (f) => {
    value.unknown++;
    if (value.unknown_files.length < 20) value.unknown_files.push(mediaKey(f));
  };
  for (const f of files) {
    let head;
    try { head = await readHead(f, 64); } catch (e) { noteUnknown(f); continue; }
    const m = LEGACY_FILE_RE.exec(head.toString('latin1'));
    if (m) {
      const v = parseInt(m[1], 10);
      value.legacy[v] = (value.legacy[v] || 0) + 1;
      if (v < activeVersion) value.outdated++;
      continue;
    }
    const v = await fileCryptoKeyVersion(fc, f);
    if (v) {
      value.chunked[v] = (value.chunked[v] || 0) + 1;
      if (v < activeVersion) value.outdated++;
    } else {
      noteUnknown(f);
    }
  }
  fileInventoryCache = { at: Date.now(), active: activeVersion, value };
  return value;
}

// ---------------------------------------------------------------------------
// Job state
// ---------------------------------------------------------------------------

function parseJob(row) {
  if (!row) return null;
  let cursor = {};
  let stats = {};
  try { cursor = row.cursor_json ? JSON.parse(row.cursor_json) : {}; } catch (e) { cursor = {}; }
  try { stats = row.stats_json ? JSON.parse(row.stats_json) : {}; } catch (e) { stats = {}; }
  return { ...row, cursor, stats };
}

function loadJob(db, jobId) {
  return parseJob(rows(db, 'SELECT * FROM encryption_rotation_jobs WHERE id = ?', [jobId])[0]);
}

function latestJob(db) {
  return parseJob(rows(db, 'SELECT * FROM encryption_rotation_jobs ORDER BY id DESC LIMIT 1')[0]);
}

function persistJob(db, job) {
  db.run(
    `UPDATE encryption_rotation_jobs
        SET target_version = ?, status = ?, phase = ?, cursor_json = ?, stats_json = ?, error = ?,
            updated_at = datetime('now'), finished_at = ?
      WHERE id = ?`,
    [job.target_version, job.status, job.phase, JSON.stringify(job.cursor || {}), JSON.stringify(job.stats || {}),
      job.error || null, job.finished_at || null, job.id]
  );
}

function freshStats() {
  return {
    rows_scanned: 0,
    values_reencrypted: 0,
    values_failed: 0,
    tables: {},
    failures: [],
    backups: { rewrapped: 0, failed: 0, skipped: 0, errors: [] },
    files: null,
    files_reencrypt: { reencrypted: 0, failed: 0, skipped: 0 },
    remaining: null,
  };
}

function recordFailure(stats, f) {
  stats.values_failed++;
  if (stats.failures.length < MAX_FAILURE_SAMPLES) stats.failures.push(f);
}

function audit(db, actorId, action, details) {
  try {
    db.run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, details_encrypted, created_at) VALUES (?, ?, 'system', 0, ?, datetime('now'))",
      [actorId || 0, action, JSON.stringify(details)]
    );
  } catch (e) {
    logger.warn(`[KEY-ROTATION] audit log failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Column phase
// ---------------------------------------------------------------------------

/**
 * Re-encrypt one batch of rows of one table. Runs inside the caller's
 * transaction. Returns { done, lastRowid }.
 */
function processBatch(db, target, targetKeyId, tableTarget, afterRowid, stats) {
  const { table, columns } = tableTarget;
  const colNames = columns.map((c) => c.column);
  const conds = colNames
    .map((c) => `(${q(c)} GLOB ? AND ${VERSION_EXPR(c)} < ?)`)
    .join(' OR ');
  const params = [afterRowid];
  for (let i = 0; i < colNames.length; i++) params.push(enc.PACKED_GLOB, target);
  params.push(settings.batchRows);

  const r = db.exec(
    `SELECT rowid, ${colNames.map(q).join(', ')} FROM ${q(table)} WHERE rowid > ? AND (${conds}) ORDER BY rowid LIMIT ?`,
    params
  );
  const batch = r.length > 0 ? r[0].values : [];
  const tstats = stats.tables[table] || (stats.tables[table] = { reencrypted: 0, failed: 0 });
  let lastRowid = afterRowid;

  for (const row of batch) {
    const rowid = row[0];
    lastRowid = rowid;
    stats.rows_scanned++;
    const updates = {};
    const finalValues = {};
    columns.forEach((c, i) => {
      const value = row[i + 1];
      finalValues[c.column] = value;
      const v = enc.getPackedKeyVersion(value);
      if (v === null || v >= target) return;
      try {
        const plaintext = enc.decrypt(value);
        const fresh = enc.encryptAtVersion(plaintext, target);
        // Never write a value we have not just read back successfully.
        if (enc.decrypt(fresh) !== plaintext || enc.getPackedKeyVersion(fresh) !== target) {
          throw new Error('verification of re-encrypted value failed');
        }
        updates[c.column] = fresh;
        finalValues[c.column] = fresh;
      } catch (e) {
        tstats.failed++;
        recordFailure(stats, {
          table, column: c.column, rowid, key_version: v,
          error: e.code || String(e.message || e).slice(0, 120),
        });
      }
    });

    const changed = Object.keys(updates);
    if (changed.length === 0) continue;

    const sets = changed.map((c) => `${q(c)} = ?`);
    const setParams = changed.map((c) => updates[c]);
    // Key-id metadata: point it at the new key once every column that shares it
    // is on the target version (or holds no ciphertext).
    const keyIdCols = new Set(columns.filter((c) => c.keyIdColumn && changed.includes(c.column)).map((c) => c.keyIdColumn));
    for (const kid of keyIdCols) {
      const sharing = columns.filter((c) => c.keyIdColumn === kid);
      const allCurrent = sharing.every((c) => {
        const fv = enc.getPackedKeyVersion(finalValues[c.column]);
        return fv === null || fv >= target;
      });
      if (allCurrent && targetKeyId !== null) {
        sets.push(`${q(kid)} = ?`);
        setParams.push(targetKeyId);
      }
    }
    const guards = changed.map((c) => `${q(c)} = ?`).join(' AND ');
    const guardParams = changed.map((c) => row[colNames.indexOf(c) + 1]);
    db.run(
      `UPDATE ${q(table)} SET ${sets.join(', ')} WHERE rowid = ? AND ${guards}`,
      [...setParams, rowid, ...guardParams]
    );
    if (db.getRowsModified() === 1) {
      stats.values_reencrypted += changed.length;
      tstats.reencrypted += changed.length;
    }
  }

  return { done: batch.length < settings.batchRows, lastRowid };
}

/**
 * Re-encrypt every outdated Class A value inside a raw SQLite image (a
 * backup), off the live database. Same per-value rules as the live job
 * (decrypt, re-encrypt, read back, guarded UPDATE); key-id metadata columns
 * are left as they are (they refer to the image's own encryption_keys rows).
 * Yields to the event loop between batches.
 * @returns {Promise<{ raw: Buffer, stats: object, outdated: number, minVersion: number|null }>}
 */
async function reencryptImage(rawImage, targetVersion) {
  validateDatabaseImage(rawImage);
  const SQL = await initSqlJs(); // sql.js caches its module: same WASM instance as the live DB
  const db = new SQL.Database(rawImage);
  try {
    const stats = freshStats();
    const targets = discoverTargets(db);
    for (const t of targets) {
      let after = 0;
      for (;;) {
        const res = processBatch(db, targetVersion, null, t, after, stats);
        after = res.lastRowid;
        if (res.done) break;
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    const inv = inventoryColumns(db, targets, targetVersion);
    // Keep the image's key table consistent with its data: after a restore the
    // target version is the active one (its key check is re-derived from data).
    try {
      const has = db.exec('SELECT id FROM encryption_keys WHERE key_version = ?', [targetVersion]);
      if (has.length > 0 && has[0].values.length > 0) {
        db.run("UPDATE encryption_keys SET status = 'active', rotated_at = NULL WHERE key_version = ?", [targetVersion]);
      } else {
        db.run("INSERT INTO encryption_keys (key_version, status) VALUES (?, 'active')", [targetVersion]);
      }
      db.run("UPDATE encryption_keys SET status = 'rotated', rotated_at = COALESCE(rotated_at, datetime('now')) WHERE status = 'active' AND key_version <> ?", [targetVersion]);
    } catch (e) {
      // very old image without encryption_keys: the restore migration creates it
    }
    return { raw: Buffer.from(db.export()), stats, outdated: inv.outdated, minVersion: inv.minVersion };
  } finally {
    try { db.close(); } catch (e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Media files phase
// ---------------------------------------------------------------------------

let fileListCache = null; // { jobId, list: [{ key, path }] } sorted by key

// Stable, Class B identifier of a media file: "<dir index>:<relative path>".
function mediaKey(filePath) {
  for (let i = 0; i < settings.fileDirs.length; i++) {
    const rel = path.relative(settings.fileDirs[i], filePath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return `${i}:${rel.split(path.sep).join('/')}`;
  }
  return path.basename(filePath);
}

async function mediaFileList(jobId) {
  if (fileListCache && fileListCache.jobId === jobId) return fileListCache.list;
  const files = [];
  for (const dir of settings.fileDirs) await walkFiles(dir, 0, files);
  const list = files.map((p) => ({ key: mediaKey(p), path: p })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  fileListCache = { jobId, list };
  return list;
}

/**
 * Re-encrypt the next media file after job.cursor.file_last (if it needs it)
 * and advance the cursor. A failure is recorded and the job moves on.
 * Sets job.phase = 'finalize' when there is nothing left.
 */
async function processNextMediaFile(jobId, job, active) {
  const fr = job.stats.files_reencrypt || (job.stats.files_reencrypt = { reencrypted: 0, failed: 0, skipped: 0 });
  const fc = loadFileCrypto();
  if (!fc || typeof fc.reencryptFile !== 'function' || typeof fc.readFileInfo !== 'function') {
    fr.unavailable = true;
    job.phase = 'finalize';
    return;
  }
  const list = await mediaFileList(jobId);
  const after = job.cursor.file_last || '';
  const next = list.find((f) => f.key > after);
  if (!next) {
    fileListCache = null;
    job.phase = 'finalize';
    return;
  }
  job.cursor.file_last = next.key;
  let info = null;
  try {
    info = await fc.readFileInfo(next.path);
  } catch (e) {
    fr.skipped++; // vanished since the listing (deleted / renamed)
    return;
  }
  const needs = info && (info.format === 'legacy' || (info.format === 'v1' && Number.isInteger(info.keyVersion) && info.keyVersion < active));
  if (!needs) {
    fr.skipped++;
    return;
  }
  try {
    let res;
    try {
      res = await fc.reencryptFile(next.path, { keyVersion: active });
    } catch (e) {
      if (e && e.code === 'ENOENT') { fr.skipped++; return; } // deleted meanwhile
      if (!e || !RETRYABLE_FILE_ERRORS.has(e.code)) throw e;
      await sleep(250);
      res = await fc.reencryptFile(next.path, { keyVersion: active });
    }
    if (res && res.changed) fr.reencrypted++;
    else fr.skipped++;
  } catch (e) {
    fr.failed++;
    if (job.stats.failures.length < MAX_FAILURE_SAMPLES) {
      job.stats.failures.push({ file: next.key, format: info.format, key_version: info.keyVersion != null ? info.keyVersion : null, error: e.code || String(e.message || e).slice(0, 120) });
    }
    logger.warn(`[KEY-ROTATION] job #${jobId}: re-encrypting media file ${next.key} failed: ${e.code || e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function resetCursor(job) {
  job.phase = 'columns';
  job.cursor = { table: null, last_rowid: 0, backups_done: [], file_last: '' };
  fileListCache = null;
}

async function runJob(jobId) {
  let lastError = null;
  for (;;) {
    const db = getDatabase();
    const job = loadJob(db, jobId);
    // Gone or no longer ours (e.g. the database was restored underneath).
    if (!job || job.status !== 'running') return;

    if (runner && runner.pauseRequested) {
      job.status = 'paused';
      persistJob(db, job);
      saveDatabaseAfterWrite();
      logger.info(`[KEY-ROTATION] job #${jobId} paused (${job.phase}, ${job.stats.values_reencrypted || 0} values re-encrypted so far)`);
      return;
    }

    if (inOpenTransaction()) {
      await sleep(50);
      continue;
    }

    try {
      const active = enc.getActiveKeyVersion();
      if (active !== job.target_version) {
        logger.info(`[KEY-ROTATION] job #${jobId}: active key version changed v${job.target_version} -> v${active}; restarting scan`);
        job.target_version = active;
        resetCursor(job);
        persistJob(db, job);
        saveDatabaseAfterWrite();
        continue;
      }
      enc.assertWritableKeyVersion(active);

      if (job.phase === 'columns') {
        const targets = discoverTargets(db, { useCache: true });
        let idx = 0;
        let afterRowid = 0;
        if (job.cursor.table === END_OF_TABLES) {
          idx = targets.length;
        } else if (job.cursor.table) {
          idx = targets.findIndex((t) => t.table === job.cursor.table);
          if (idx < 0) idx = 0; // table vanished: rescan from the start (only outdated rows are touched)
          else afterRowid = job.cursor.last_rowid || 0;
        }
        if (idx >= targets.length) {
          job.phase = 'backups';
          persistJob(db, job);
          saveDatabaseAfterWrite();
          continue;
        }
        const targetKeyId = enc.getKeyId(active);
        db.run('BEGIN');
        try {
          const res = processBatch(db, active, targetKeyId, targets[idx], afterRowid, job.stats);
          if (res.done) {
            const next = targets[idx + 1];
            job.cursor.table = next ? next.table : END_OF_TABLES;
            job.cursor.last_rowid = 0;
            if (!next) job.phase = 'backups';
          } else {
            job.cursor.table = targets[idx].table;
            job.cursor.last_rowid = res.lastRowid;
          }
          persistJob(db, job);
          db.run('COMMIT');
        } catch (e) {
          try { db.run('ROLLBACK'); } catch (_) { /* ignore */ }
          throw e;
        }
        saveDatabaseAfterWrite();
      } else if (job.phase === 'backups') {
        const done = new Set(job.cursor.backups_done || []);
        const list = backupService.listBackups().backups || [];
        const next = list.find((b) => !done.has(b.filename));
        if (!next) {
          job.phase = 'files';
        } else {
          if (backupService.backupNeedsRewrap(next, active)) {
            const res = await backupService.rewrapBackup(next.filename, active);
            if (res.error) {
              job.stats.backups.failed++;
              if (job.stats.backups.errors.length < 50) job.stats.backups.errors.push({ filename: next.filename, error: res.error });
            } else if (res.rewrapped) {
              job.stats.backups.rewrapped++;
            } else {
              job.stats.backups.skipped++;
            }
          } else {
            job.stats.backups.skipped++;
          }
          done.add(next.filename);
          job.cursor.backups_done = Array.from(done);
        }
        // The DB may have been swapped while awaiting; re-check before writing.
        const db2 = getDatabase();
        const still = loadJob(db2, jobId);
        if (!still || still.status !== 'running') return;
        persistJob(db2, job);
        saveDatabaseAfterWrite();
      } else if (job.phase === 'files') {
        // One media file per tick: legacy files and files below the active
        // version are re-encrypted in place by fileCrypto.reencryptFile (own
        // per-file lock, verified before it replaces the original).
        await processNextMediaFile(jobId, job, active);
        const db2 = getDatabase();
        const still = loadJob(db2, jobId);
        if (!still || still.status !== 'running') return;
        persistJob(db2, job);
        saveDatabaseAfterWrite();
      } else {
        job.stats.files = await inventoryFiles(active);
        const db2 = getDatabase();
        const still = loadJob(db2, jobId);
        if (!still || still.status !== 'running') return;
        finalizeJob(db2, job, active);
        return;
      }
      lastError = null;
    } catch (e) {
      // A transient problem retries once; a repeat fails the job (resumable).
      if (lastError && lastError === e.message) {
        const db2 = getDatabase();
        const still = loadJob(db2, jobId);
        if (still && still.status === 'running') {
          still.status = 'failed';
          still.error = String(e.code || e.message).slice(0, 300);
          still.finished_at = new Date().toISOString();
          persistJob(db2, still);
          audit(db2, 0, 'key_rotation_failed', { job_id: jobId, error: still.error });
          saveDatabaseAfterWrite();
        }
        logger.error(`[KEY-ROTATION] job #${jobId} failed: ${e.message}`);
        return;
      }
      lastError = e.message;
      logger.warn(`[KEY-ROTATION] job #${jobId} batch error (will retry once): ${e.message}`);
      await sleep(1000);
      continue;
    }

    await sleep(settings.batchPauseMs);
  }
}

function finalizeJob(db, job, active) {
  discoveryCache = null;
  const targets = discoverTargets(db);
  const cols = inventoryColumns(db, targets, active);
  const backups = inventoryBackups(active);
  const files = job.stats.files || { outdated: 0, unknown: 0 };
  job.stats.remaining = { column_values: cols.outdated, backups: backups.outdated, files: files.outdated, files_unknown: files.unknown };
  const fr = job.stats.files_reencrypt || { failed: 0 };
  const hadErrors = job.stats.values_failed > 0 || cols.outdated > 0 || job.stats.backups.failed > 0 || backups.outdated > 0 ||
    fr.failed > 0 || files.outdated > 0;
  job.status = hadErrors ? 'completed_with_errors' : 'completed';
  job.phase = 'done';
  job.finished_at = new Date().toISOString();

  // Older versions no longer referenced anywhere are marked 'retired'
  // (informational: decryption ignores the status).
  if (!hadErrors && files.outdated === 0 && files.unknown === 0) {
    db.run("UPDATE encryption_keys SET status = 'retired' WHERE key_version < ? AND status = 'rotated'", [active]);
  }
  persistJob(db, job);
  audit(db, job.started_by, 'key_rotation_completed', {
    job_id: job.id, target_version: active, status: job.status,
    values_reencrypted: job.stats.values_reencrypted, values_failed: job.stats.values_failed,
    remaining: job.stats.remaining,
  });
  saveDatabaseAfterWrite();
  logger.info(
    `[KEY-ROTATION] job #${job.id} ${job.status}: ${job.stats.values_reencrypted} values re-encrypted, ` +
    `${job.stats.values_failed} failed, ${fr.reencrypted || 0} media files re-encrypted (${fr.failed || 0} failed); remaining old-version values ${cols.outdated}, backups ${backups.outdated}, files ${files.outdated} (+${files.unknown} unknown)`
  );
}

function launch(jobId) {
  const r = { jobId, pauseRequested: false, promise: null };
  runner = r;
  r.promise = runJob(jobId)
    .catch((e) => logger.error(`[KEY-ROTATION] runner crashed: ${e.message}`))
    .finally(() => { if (runner === r) runner = null; });
  return r;
}

function isRunning() {
  return runner !== null;
}

/**
 * Start a re-encryption job, or resume the latest paused / interrupted /
 * failed one. Refuses when the active key version fails its key check.
 * @returns {{ job: object, resumed: boolean, already_running: boolean }}
 */
function startReencryption({ actorId = 0 } = {}) {
  const db = getDatabase();
  if (runner) {
    return { job: publicJob(loadJob(db, runner.jobId)), resumed: false, already_running: true };
  }
  const active = enc.getActiveKeyVersion();
  enc.assertWritableKeyVersion(active);

  const last = latestJob(db);
  let job;
  let resumed = false;
  if (last && ['running', 'paused', 'failed'].includes(last.status)) {
    job = last;
    resumed = true;
    job.status = 'running';
    job.error = null;
    job.finished_at = null;
    if (job.target_version !== active) {
      job.target_version = active;
      resetCursor(job);
    }
    persistJob(db, job);
  } else {
    db.run(
      "INSERT INTO encryption_rotation_jobs (target_version, status, phase, cursor_json, stats_json, started_by) VALUES (?, 'running', 'columns', ?, ?, ?)",
      [active, JSON.stringify({ table: null, last_rowid: 0, backups_done: [] }), JSON.stringify(freshStats()), actorId || null]
    );
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    job = loadJob(db, id);
  }
  if (!job.stats || typeof job.stats.values_reencrypted !== 'number') job.stats = freshStats();
  persistJob(db, job);
  audit(db, actorId, resumed ? 'key_rotation_resumed' : 'key_rotation_started', { job_id: job.id, target_version: active });
  saveDatabaseAfterWrite();
  discoveryCache = null;
  fileInventoryCache = null;
  logger.info(`[KEY-ROTATION] job #${job.id} ${resumed ? 'resumed' : 'started'} (target v${active})`);
  launch(job.id);
  return { job: publicJob(loadJob(db, job.id)), resumed, already_running: false };
}

/** Ask the running job to stop after its current batch. */
function pauseReencryption({ actorId = 0 } = {}) {
  const db = getDatabase();
  if (runner) {
    runner.pauseRequested = true;
    audit(db, actorId, 'key_rotation_pause_requested', { job_id: runner.jobId });
    saveDatabaseAfterWrite();
    return { pausing: true };
  }
  const last = latestJob(db);
  if (last && last.status === 'running') {
    // Interrupted by a restart: just record it as paused.
    last.status = 'paused';
    persistJob(db, last);
    saveDatabaseAfterWrite();
    return { pausing: true };
  }
  return { pausing: false };
}

/**
 * For startup wiring (index.js): continue a job a restart interrupted.
 * Returns true when a job was resumed.
 */
function resumeInterruptedJob() {
  try {
    const last = latestJob(getDatabase());
    if (!last || last.status !== 'running' || runner) return false;
    startReencryption({ actorId: last.started_by || 0 });
    return true;
  } catch (e) {
    logger.warn(`[KEY-ROTATION] could not resume interrupted job: ${e.message}`);
    return false;
  }
}

/** Wait for the in-process runner (tests). */
async function waitForIdle() {
  while (runner) {
    await runner.promise;
  }
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    target_version: job.target_version,
    status: job.status,
    interrupted: job.status === 'running' && (!runner || runner.jobId !== job.id),
    phase: job.phase,
    current_table: job.cursor && job.cursor.table && job.cursor.table !== END_OF_TABLES ? job.cursor.table : null,
    started_by: job.started_by,
    started_at: job.started_at,
    updated_at: job.updated_at,
    finished_at: job.finished_at,
    error: job.error,
    stats: job.stats,
  };
}

/**
 * Everything the admin page shows: key ring, key versions, job progress and
 * what is still on an older key version.
 */
async function getRotationStatus() {
  const db = getDatabase();
  const active = enc.getActiveKeyVersion();
  const keys = enc.listKeyVersions();
  const targets = discoverTargets(db, { useCache: true });
  const cols = inventoryColumns(db, targets, active);
  const backups = inventoryBackups(active);
  const files = await inventoryFiles(active, { useCache: true });
  const unlisted = cols.columns.filter((c) => !c.listed && c.total > 0).map((c) => `${c.table}.${c.column}`);
  const activeCheck = enc.verifyKeyVersion(active);
  const safe = activeCheck === 'ok' && cols.outdated === 0 && backups.outdated === 0 &&
    files.outdated === 0 && files.unknown === 0;
  return {
    active_version: active,
    active_key_check: activeCheck,
    key_ring: enc.getKeyRingInfo(),
    keys,
    job: publicJob(latestJob(db)),
    running: isRunning(),
    inventory: {
      column_values_total: cols.total,
      column_values_outdated: cols.outdated,
      columns: cols.columns,
      unlisted_columns_with_ciphertext: unlisted,
      backups,
      files,
    },
    safe_to_retire_previous: safe,
  };
}

module.exports = {
  startReencryption,
  pauseReencryption,
  resumeInterruptedJob,
  getRotationStatus,
  isRunning,
  waitForIdle,
  discoverTargets,
  inventoryColumns,
  inventoryFiles,
  reencryptImage,
  configure,
};
