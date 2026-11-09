// Short-lived signed media URLs (audit H8, frontend side).
//
// The dashboard player used to download the whole decrypted recording with
// fetch() + Authorization header into a Blob, because <audio src> cannot
// carry a Bearer token. Now the player asks GET /api/<kind>/:id/media-url
// (normal authentication + the same ownership/consent checks as the stream
// route) and plays the returned URL directly; the browser then streams it
// with Range requests.
//
//   /api/sessions/42/stream?uid=7&exp=1767225600&sig=<base64url HMAC>
//
// The signature binds: media kind, resource id, user id, the user's
// token_version and the expiry. Bumping token_version (logout everywhere,
// password reset, block) therefore invalidates outstanding media links
// immediately. Links live MEDIA_LINK_TTL_SEC (10 min); the player asks for a
// fresh one when a link expires mid-playback.
//
// The stream route still runs the full ownership + consent checks for the
// user named in the link on every request; the link only replaces the
// session cookie / Bearer token as the authentication step. Requests without
// a link (or with an invalid one) fall back to normal `authenticate`.
//
// HMAC key: HMAC-SHA256(SIGNED_LINK_SECRET || JWT_SECRET || dev default,
// "prtop-media-link-v1") — domain-separated from the attendance links in
// utils/signedLinks.js that share the same secret.

const crypto = require('crypto');
const { getDatabase } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const MEDIA_LINK_TTL_SEC = 10 * 60;
const KINDS = new Set(['session', 'diary']);

function getKey() {
  const secret = process.env.SIGNED_LINK_SECRET || process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  return crypto.createHmac('sha256', secret).update('prtop-media-link-v1').digest();
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function computeSig(kind, resourceId, userId, tokenVersion, exp) {
  return b64url(
    crypto.createHmac('sha256', getKey())
      .update(`${kind}|${resourceId}|${userId}|${tokenVersion}|${exp}`)
      .digest()
  );
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function tokenVersionOfRow(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/**
 * Build a signed stream URL for an already-authorized user.
 *
 * @param {object} args
 * @param {'session'|'diary'} args.kind
 * @param {number|string} args.resourceId
 * @param {number} args.userId
 * @param {string} args.streamPath - e.g. `/api/sessions/42/stream`
 * @returns {{url:string, expiresAt:string}}
 */
function createMediaUrl({ kind, resourceId, userId, streamPath, ttlSec = MEDIA_LINK_TTL_SEC }) {
  if (!KINDS.has(kind)) throw new Error('createMediaUrl: unknown kind');
  const db = getDatabase();
  const r = db.exec('SELECT token_version FROM users WHERE id = ?', [userId]);
  const tv = r.length && r[0].values.length ? tokenVersionOfRow(r[0].values[0][0]) : 0;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const rid = String(parseInt(resourceId, 10));
  const sig = computeSig(kind, rid, userId, tv, exp);
  const url = `${streamPath}?uid=${encodeURIComponent(userId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
  return { url, expiresAt: new Date(exp * 1000).toISOString() };
}

/**
 * Verify the link on `req` for resource `req.params.id`. Never throws.
 * @returns {{ok:true, user:object}|{ok:false, reason:string}}
 */
function verifyMediaLink(req, kind) {
  const { uid, exp, sig } = req.query || {};
  if (typeof sig !== 'string' || typeof uid !== 'string' || typeof exp !== 'string') return { ok: false, reason: 'missing' };
  if (!/^\d{1,12}$/.test(uid) || !/^\d{1,12}$/.test(exp) || !/^\d{1,12}$/.test(String(req.params.id || ''))) {
    return { ok: false, reason: 'malformed' };
  }
  const now = Math.floor(Date.now() / 1000);
  const expN = parseInt(exp, 10);
  if (expN < now) return { ok: false, reason: 'expired' };
  if (expN > now + MEDIA_LINK_TTL_SEC + 60) return { ok: false, reason: 'bad_expiry' };
  const userId = parseInt(uid, 10);
  const db = getDatabase();
  const r = db.exec(
    'SELECT id, email, role, blocked_at, email_verified_at, token_version FROM users WHERE id = ?',
    [userId]
  );
  if (!r.length || !r[0].values.length) return { ok: false, reason: 'no_user' };
  const row = r[0].values[0];
  const rid = String(parseInt(req.params.id, 10));
  const expected = computeSig(kind, rid, userId, tokenVersionOfRow(row[5]), expN);
  if (!safeEqual(sig, expected)) return { ok: false, reason: 'bad_signature' };
  if (row[3]) return { ok: false, reason: 'blocked' };
  return {
    ok: true,
    user: { id: row[0], email: row[1], role: row[2], emailVerified: !!row[4] },
  };
}

/**
 * Authentication middleware for stream routes: a valid signed media link,
 * otherwise the normal cookie / Bearer authentication.
 */
function mediaAuth(kind) {
  return function mediaAuthMiddleware(req, res, next) {
    if (req.query && req.query.sig) {
      let v;
      try {
        v = verifyMediaLink(req, kind);
      } catch (_) {
        v = { ok: false, reason: 'error' };
      }
      if (v.ok) {
        req.user = v.user;
        req.mediaLink = true;
        return next();
      }
      const hasCredential = !!(
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) ||
        (req.cookies && req.cookies.session_token)
      );
      if (!hasCredential) {
        if (v.reason === 'blocked') {
          return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
        }
        return res.status(401).json({ error: 'Invalid or expired media link', code: 'MEDIA_LINK_INVALID' });
      }
    }
    return authenticate(req, res, next);
  };
}

module.exports = {
  MEDIA_LINK_TTL_SEC,
  createMediaUrl,
  verifyMediaLink,
  mediaAuth,
};
