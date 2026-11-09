/**
 * Server-side logout + local cleanup.
 *
 * POST /api/auth/logout clears the HttpOnly session cookie, which the SPA
 * cannot remove itself. The request is CSRF-protected (X-CSRF-Token from
 * GET /api/csrf-token, attached by fetchApi). The JWT is never stored by the
 * SPA; only the cached profile (`user`) is cleared, plus a stale legacy
 * `token` key left over from before cookie-only auth.
 * localStorage is cleared even if the request fails (offline, 5xx, timeout).
 */
import { fetchApi, clearCsrfToken } from './fetchApi';
import { clearVerifiedUser } from './authSession';
import { disconnectWebSocket } from '../hooks/useWebSocket';

const LOGOUT_TIMEOUT_MS = 5000;

async function postLogout() {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS) : null;
  try {
    await fetchApi('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller ? controller.signal : undefined
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One-time migration: drop a JWT that older builds kept in localStorage. */
export function removeLegacyToken() {
  try { localStorage.removeItem('token'); } catch { /* storage unavailable */ }
}

export async function logout() {
  try {
    await postLogout();
  } catch (e) {
    // Network/abort errors are ignored: local state is cleared regardless.
  } finally {
    removeLegacyToken();
    localStorage.removeItem('user');
    clearCsrfToken();
    clearVerifiedUser();
    disconnectWebSocket();
  }
}

export default logout;
