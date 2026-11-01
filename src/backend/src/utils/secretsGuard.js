// Fail-closed secrets guard
//
// Several modules fall back to hard-coded development secrets when an env var
// is missing (e.g. `process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'`).
// In production that would let anyone forge sessions, decrypt Class A data or
// call the bot API. This guard runs at the very top of index.js, before any
// route is mounted or the server listens, and refuses to start in production
// when a critical secret is missing, too short, or equal to a known default.
//
// Escape hatch: ALLOW_INSECURE_DEFAULT_SECRETS=true downgrades the exit to a
// loud error. It exists only for the case where production data was already
// encrypted with a default key and must stay readable until it is re-keyed.
//
// Secret VALUES are never logged — only variable names and the reason.

const MIN_SECRET_LENGTH = 16;

// Known insecure values: the in-code dev fallbacks plus the .env.example
// placeholders (copying .env.example unchanged must not reach production).
const CRITICAL_SECRETS = {
  JWT_SECRET: ['dev-jwt-secret-change-in-production', 'change-me-to-a-random-64-char-string'],
  ENCRYPTION_MASTER_KEY: ['dev-master-key-change-in-production', 'change-me-to-a-random-64-char-string'],
  BOT_API_KEY: ['dev-bot-api-key', 'change-me-to-a-random-api-key'],
};

// Optional secrets that silently fall back to JWT_SECRET when unset.
const FALLBACK_SECRETS = ['SIGNED_LINK_SECRET', 'LOGIN_CODE_PEPPER'];

/**
 * Inspect env and return the problems found (no side effects).
 * @param {object} env
 * @returns {{ problems: Array<{name: string, reason: string}>, warnings: string[] }}
 */
function checkSecrets(env) {
  const problems = [];
  const warnings = [];
  for (const [name, defaults] of Object.entries(CRITICAL_SECRETS)) {
    const value = env[name];
    if (!value) {
      problems.push({ name, reason: 'is not set' });
    } else if (defaults.includes(value)) {
      problems.push({ name, reason: 'equals a known development/example default' });
    } else if (value.length < MIN_SECRET_LENGTH) {
      problems.push({ name, reason: `is shorter than ${MIN_SECRET_LENGTH} characters` });
    }
  }
  for (const name of FALLBACK_SECRETS) {
    if (!env[name]) {
      warnings.push(`${name} is not set; it falls back to JWT_SECRET. Set a dedicated random value in production.`);
    }
  }
  return { problems, warnings };
}

/**
 * Enforce the secrets policy. Only acts when NODE_ENV === 'production'.
 * @param {object} [opts]
 * @param {object} [opts.env=process.env]
 * @param {function} [opts.exit=process.exit]
 * @param {object} [opts.log] - logger with error/warn methods
 * @returns {{ ok: boolean, problems: Array, warnings: string[], bypassed: boolean }}
 */
function enforceSecrets(opts = {}) {
  const env = opts.env || process.env;
  const exit = opts.exit || ((code) => process.exit(code));
  let log = opts.log;
  if (!log) {
    try { log = require('./logger').logger; } catch (_) { log = console; }
  }

  if (env.NODE_ENV !== 'production') {
    return { ok: true, problems: [], warnings: [], bypassed: false };
  }

  const { problems, warnings } = checkSecrets(env);
  for (const w of warnings) log.warn(`[SECRETS] ${w}`);

  if (problems.length === 0) {
    return { ok: true, problems, warnings, bypassed: false };
  }

  const bypass = env.ALLOW_INSECURE_DEFAULT_SECRETS === 'true';
  for (const p of problems) {
    const line = bypass
      ? `[SECRETS] INSECURE: ${p.name} ${p.reason} — continuing ONLY because ALLOW_INSECURE_DEFAULT_SECRETS=true. Rotate it and remove the override.`
      : `[SECRETS] FATAL: ${p.name} ${p.reason}. Refusing to start in production.`;
    log.error(line);
    // Mirror to stderr synchronously so the reason survives an immediate exit
    // (winston transports may not flush before process.exit).
    if (log !== console) console.error(line);
  }

  if (bypass) {
    return { ok: false, problems, warnings, bypassed: true };
  }

  const hint = '[SECRETS] Set strong random values (>= ' + MIN_SECRET_LENGTH + ' chars) for the variables above. ' +
    'If production data was encrypted with a default key, set ALLOW_INSECURE_DEFAULT_SECRETS=true temporarily and re-key.';
  log.error(hint);
  if (log !== console) console.error(hint);
  exit(1);
  return { ok: false, problems, warnings, bypassed: false };
}

module.exports = { enforceSecrets, checkSecrets, MIN_SECRET_LENGTH, CRITICAL_SECRETS };
