/**
 * Server-side logout + local cleanup.
 *
 * POST /api/auth/logout clears the HttpOnly session cookie, which the SPA
 * cannot remove itself. With a Bearer token the request is CSRF-exempt; a
 * cookie-only session needs an X-CSRF-Token from GET /api/csrf-token.
 * localStorage is cleared even if the request fails (offline, 5xx, timeout).
 */
const LOGOUT_TIMEOUT_MS = 5000;

async function postLogout() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const csrfRes = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    if (csrfRes.ok) {
      const data = await csrfRes.json();
      if (data && data.csrfToken) headers['X-CSRF-Token'] = data.csrfToken;
    }
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS) : null;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function logout() {
  try {
    await postLogout();
  } catch (e) {
    // Network/abort errors are ignored: local state is cleared regardless.
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

export default logout;
