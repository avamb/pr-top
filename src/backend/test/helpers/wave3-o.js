'use strict';
// Shared helpers for the wave-3 backup / key-rotation suites. Self-contained: dummy env,
// temp DB, never reads the repo .env (chdir to the temp dir before requiring).
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const BACKEND = path.resolve(__dirname, '..', '..');
const SRC = path.join(BACKEND, 'src');
const LEGACY_DIR = path.join(__dirname, '..', 'fixtures', 'legacy');

const KEY_A = 'track-o-master-key-AAAAAAAAAAAAAAAAAAAA';
const KEY_B = 'track-o-master-key-BBBBBBBBBBBBBBBBBBBB';

function setupEnv(label, { tmp, keyEnv } = {}) {
  const dir = tmp || fs.mkdtempSync(path.join(os.tmpdir(), `prtop-trackO-${label}-`));
  for (const k of ['ENCRYPTION_MASTER_KEY_VERSION', 'ENCRYPTION_MASTER_KEY_PREVIOUS', 'ENCRYPTION_MASTER_KEY_PREVIOUS_VERSION', 'BACKUP_OFFSITE_COMMAND']) {
    delete process.env[k];
  }
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-xxxxxxxxxxxxxxxx',
    ENCRYPTION_MASTER_KEY: KEY_A,
    BOT_API_KEY: 'test-bot-key-xxxxxxxxxxxx',
    SIGNED_LINK_SECRET: 'test-signed-link-secret-xxxx',
    LOGIN_CODE_PEPPER: 'test-login-pepper-xxxxxxxx',
    DATABASE_URL: 'sqlite:' + path.join(dir, 'test.db').split(path.sep).join('/'),
    BACKUP_DIR: path.join(dir, 'backups'),
    SUPERADMIN_EMAIL: 'admin@test.local',
    SUPERADMIN_PASSWORD: 'Admin123!test',
    LOG_LEVEL: process.env.TRACKO_LOG_LEVEL || 'error',
  }, keyEnv || {});
  process.chdir(dir);
  return { tmp: dir, dbFile: path.join(dir, 'test.db') };
}

/** Load a pre-wave-3 module copy (git show HEAD:...) bound to the live src/. */
function loadLegacy(name) {
  const file = path.join(LEGACY_DIR, name);
  let code = fs.readFileSync(file, 'utf8');
  code = code
    .replace("require('../db/connection')", `require(${JSON.stringify(path.join(SRC, 'db', 'connection.js'))})`)
    .replace("require('../utils/logger')", `require(${JSON.stringify(path.join(SRC, 'utils', 'logger.js'))})`);
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(SRC);
  m._compile(code, file);
  return m.exports;
}

function rowsOf(db, sql, params) {
  const r = db.exec(sql, params);
  if (!r.length) return [];
  return r[0].values.map((v) => Object.fromEntries(r[0].columns.map((c, i) => [c, v[i]])));
}

// Valid values for CHECK-constrained / NOT NULL columns of the seeded tables.
const OVERRIDES = {
  users: (i) => ({ email: `seed${i}-${Math.random().toString(36).slice(2)}@t.local`, role: 'therapist', password_hash: 'x' }),
  diary_entries: (i) => ({ client_id: 100 + i, entry_type: 'text' }),
  therapist_notes: (i) => ({ therapist_id: 1, client_id: 100 + i }),
  sessions: (i) => ({ therapist_id: 1, client_id: 100 + i }),
  client_context: (i) => ({ therapist_id: 1, client_id: 100 + i }),
  exercise_deliveries: (i) => ({ exercise_id: 1, therapist_id: 1, client_id: 100 + i }),
  sos_events: (i) => ({ client_id: 100 + i, therapist_id: 1 }),
  inquiries: (i) => ({ client_id: 100 + i, therapist_id: 1 }),
  comments: (i) => ({ entity_type: 'assignment', entity_id: 1, author_id: 1, author_role: 'therapist', visibility: 'private' }),
  assignments: (i) => ({ therapist_id: 1, client_id: 100 + i }),
  assignment_reports: (i) => ({ assignment_id: 1, client_id: 100 + i, therapist_id: 1, report_type: 'text' }),
  vector_embeddings: (i) => ({ source_type: 'diary', source_id: 1000 + i, client_id: 100 + i, therapist_id: 1, embedding: '[]' }),
  audit_logs: (i) => ({ actor_id: 0, action: 'seed', target_type: 'system', target_id: 0 }),
};

function dummyFor(col) {
  const t = String(col.type || '').toUpperCase();
  if (/INT/.test(t)) return 1;
  if (/REAL|FLOA|DOUB/.test(t)) return 1.0;
  return 'x';
}

/**
 * Insert `count` rows into every table of ENCRYPTED_COLUMNS, with every listed
 * column of that table holding encrypt(plaintext). Returns
 * [{ table, column, rowid, plaintext }] for later verification.
 */
function seedEncryptedColumns(db, enc, count) {
  const expected = [];
  const byTable = new Map();
  for (const e of enc.ENCRYPTED_COLUMNS) {
    if (!byTable.has(e.table)) byTable.set(e.table, []);
    byTable.get(e.table).push(e.column);
  }
  for (const [table, columns] of byTable) {
    const info = rowsOf(db, `PRAGMA table_info("${table}")`);
    if (!info.length) throw new Error(`seed: table ${table} missing`);
    for (let i = 0; i < count; i++) {
      const vals = {};
      for (const c of info) {
        if (c.pk) continue;
        if (c.notnull && c.dflt_value === null) vals[c.name] = dummyFor(c);
      }
      Object.assign(vals, OVERRIDES[table] ? OVERRIDES[table](i) : {});
      const plain = {};
      for (const col of columns) {
        plain[col] = `${table}.${col} #${i} — Ünïcødé ✓ ${'z'.repeat(i % 5)}`;
        vals[col] = enc.encrypt(plain[col]).encrypted;
      }
      const names = Object.keys(vals);
      db.run(`INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(',')}) VALUES (${names.map(() => '?').join(',')})`, names.map((n) => vals[n]));
      const rowid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      for (const col of columns) expected.push({ table, column: col, rowid, plaintext: plain[col] });
    }
  }
  return expected;
}

module.exports = { BACKEND, SRC, KEY_A, KEY_B, setupEnv, loadLegacy, rowsOf, seedEncryptedColumns };
