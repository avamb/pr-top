// Signed-link helper for email attendance / opt-in CTAs.
//
// Why a dedicated helper instead of full JWT?
//   - These are short-lived, single-purpose URLs delivered in plain email.
//   - We want them stateless (no DB row per link) so reschedule/cancel can
//     simply invalidate the *session*, not have to revoke a token.
//   - We want them shorter than a JWT (which carries unwanted overhead).
//
// Token shape: "<base64url(payload_json)>.<base64url(hmac_sha256)>".
// Payload is a tiny JSON object: { v, s, c, a, x } where
//   v = format version (always 1 for now)
//   s = session_id (number)
//   c = client_id (number, defensive — also confirms the click belongs to the
//                  client we addressed; prevents URL-stealing across clients)
//   a = action ("confirm" | "reschedule" | "release" | "optin_yes" | "optin_no")
//   x = expires-at epoch seconds (UTC)
//
// HMAC key: process.env.SIGNED_LINK_SECRET ?? process.env.JWT_SECRET ??
//           a known dev default (matches middleware/auth.js convention).
//
// Tokens expire when (a) the embedded `x` field is past now, or (b) when the
// route handler determines the session's scheduled_at has passed (the route
// handler owns that latter check — this helper only does cryptographic
// integrity + structural expiry).

const crypto = require('crypto');

const FORMAT_VERSION = 1;
const ALLOWED_ACTIONS = new Set([
  'confirm',
  'reschedule',
  'release',
  'optin_yes',
  'optin_no',
]);

function getSecret() {
  return (
    process.env.SIGNED_LINK_SECRET ||
    process.env.JWT_SECRET ||
    'dev-jwt-secret-change-in-production'
  );
}

/**
 * Encode a Buffer or string to base64url (no padding).
 */
function b64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Decode a base64url string into a Buffer.
 */
function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * HMAC-SHA256(secret, payload) → base64url string.
 */
function sign(payloadB64) {
  return b64url(
    crypto.createHmac('sha256', getSecret()).update(payloadB64).digest()
  );
}

/**
 * Constant-time string equality (Buffer.compare or timingSafeEqual on
 * pre-hashed equal-length buffers).
 */
function safeEqual(a, b) {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // crypto.timingSafeEqual requires equal-length buffers; do a deliberately
    // useless compare against zero-padded bb to keep timing comparable.
    const pad = Buffer.alloc(ab.length);
    bb.copy(pad);
    crypto.timingSafeEqual(ab, pad);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Generate a signed attendance link token.
 *
 * @param {object} args
 * @param {number} args.session_id
 * @param {number} args.client_id
 * @param {string} args.action     - one of ALLOWED_ACTIONS
 * @param {Date|string|number} args.expires_at - absolute expiry (Date, ISO string, or epoch ms)
 * @returns {string} token
 */
function generateAttendanceToken({ session_id, client_id, action, expires_at }) {
  if (!Number.isInteger(session_id) || session_id <= 0) {
    throw new Error('generateAttendanceToken: session_id must be a positive integer');
  }
  if (!Number.isInteger(client_id) || client_id <= 0) {
    throw new Error('generateAttendanceToken: client_id must be a positive integer');
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`generateAttendanceToken: action must be one of ${[...ALLOWED_ACTIONS].join(',')}`);
  }
  let xEpochSec;
  if (expires_at instanceof Date) {
    xEpochSec = Math.floor(expires_at.getTime() / 1000);
  } else if (typeof expires_at === 'number') {
    xEpochSec = Math.floor(expires_at / 1000);
  } else if (typeof expires_at === 'string') {
    const d = new Date(expires_at);
    if (isNaN(d.getTime())) throw new Error('generateAttendanceToken: invalid expires_at string');
    xEpochSec = Math.floor(d.getTime() / 1000);
  } else {
    throw new Error('generateAttendanceToken: expires_at required');
  }

  const payload = { v: FORMAT_VERSION, s: session_id, c: client_id, a: action, x: xEpochSec };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sigB64 = sign(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a signed attendance link token. Returns the decoded payload on success
 * or an object { ok: false, reason } on failure. Never throws.
 *
 * @param {string} token
 * @returns {{ok:true, payload:{session_id:number, client_id:number, action:string, expires_at_sec:number}} |
 *           {ok:false, reason:string}}
 */
function verifyAttendanceToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, reason: 'malformed' };
  }
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) {
    return { ok: false, reason: 'malformed' };
  }
  // Recompute the signature against the encoded payload (NOT a re-encoded
  // copy of the parsed payload — preserve byte-for-byte equality).
  const expectedSig = sign(payloadB64);
  if (!safeEqual(sigB64, expectedSig)) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch (e) {
    return { ok: false, reason: 'bad_payload' };
  }
  if (!payload || payload.v !== FORMAT_VERSION) {
    return { ok: false, reason: 'bad_version' };
  }
  if (!Number.isInteger(payload.s) || payload.s <= 0) {
    return { ok: false, reason: 'bad_session_id' };
  }
  if (!Number.isInteger(payload.c) || payload.c <= 0) {
    return { ok: false, reason: 'bad_client_id' };
  }
  if (!ALLOWED_ACTIONS.has(payload.a)) {
    return { ok: false, reason: 'bad_action' };
  }
  if (!Number.isInteger(payload.x) || payload.x <= 0) {
    return { ok: false, reason: 'bad_expiry' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.x < nowSec) {
    return { ok: false, reason: 'expired' };
  }
  return {
    ok: true,
    payload: {
      session_id: payload.s,
      client_id: payload.c,
      action: payload.a,
      expires_at_sec: payload.x,
    },
  };
}

/**
 * Convenience helper: build a full URL pointing at the public attendance-link
 * endpoint for the given action. The handler at /api/public/attendance-link
 * verifies the token, updates session.attendance_status, and renders a
 * thank-you page.
 *
 * @param {object} args - same shape as generateAttendanceToken
 * @param {string} [baseUrl] - optional override; defaults to PUBLIC_URL || FRONTEND_URL
 * @returns {string} absolute URL
 */
function buildAttendanceUrl(args, baseUrl) {
  const base = (
    baseUrl ||
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
  const token = generateAttendanceToken(args);
  return `${base}/api/public/attendance-link?token=${encodeURIComponent(token)}`;
}

module.exports = {
  FORMAT_VERSION,
  ALLOWED_ACTIONS,
  generateAttendanceToken,
  verifyAttendanceToken,
  buildAttendanceUrl,
};
