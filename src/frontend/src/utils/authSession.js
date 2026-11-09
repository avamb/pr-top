/**
 * Client-side view of the cookie session.
 *
 * The JWT lives only in the HttpOnly `session_token` cookie, so JavaScript can
 * neither read nor store it. Whether the visitor is signed in is decided by the
 * server: GET /api/auth/me. `localStorage.user` is just a cached copy of that
 * profile (used for instant rendering and cross-tab sync), never proof of auth.
 */

const RECHECK_MS = 5 * 60 * 1000;

let verifiedUser = null;
let verifiedAt = 0;

function readCachedUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Remember a server-confirmed profile (after login/register or /me). */
export function setVerifiedUser(user) {
  verifiedUser = user || null;
  verifiedAt = user ? Date.now() : 0;
  if (user) {
    try {
      const prev = readCachedUser() || {};
      localStorage.setItem('user', JSON.stringify({ ...prev, ...user }));
    } catch { /* storage unavailable */ }
  }
}

/** Forget the verified profile (logout / session expired). */
export function clearVerifiedUser() {
  verifiedUser = null;
  verifiedAt = 0;
}

/**
 * Resolve the signed-in user from the server.
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ user: object|null, offline?: boolean }>}
 *   user is null when the server says the visitor is not authenticated.
 *   offline=true means /me could not be reached; user is then the cached
 *   profile (if any) so the UI can still render, and API calls will surface errors.
 */
export async function fetchCurrentUser(opts = {}) {
  if (!opts.force && verifiedUser && Date.now() - verifiedAt < RECHECK_MS) {
    // Prefer the cached profile: Settings edits it in place (e.g. language).
    return { user: { ...verifiedUser, ...(readCachedUser() || {}) } };
  }
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        setVerifiedUser(data.user);
        return { user: verifiedUser };
      }
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      clearVerifiedUser();
      try { localStorage.removeItem('user'); } catch { /* ignore */ }
      return { user: null };
    }
  } catch { /* network error: fall through */ }
  return { user: readCachedUser(), offline: true };
}
