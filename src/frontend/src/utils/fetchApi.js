/**
 * Global fetch wrapper with 401 (session expired) handling.
 * Wraps the native fetch API to automatically redirect to login
 * when the session cookie is missing, invalid or expired.
 */

import { dispatchEmailNotVerified } from './emailVerificationEvents';
import { clearVerifiedUser } from './authSession';

const SESSION_EXPIRED_EVENT = 'session-expired';

/**
 * Dispatch a custom event to notify the app that the session has expired.
 * Components can listen for this to show messages or redirect.
 */
function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/** Drop the cached profile (the JWT itself is HttpOnly and never stored) and notify the app. */
function handleSessionExpired() {
  localStorage.removeItem('user');
  clearVerifiedUser();
  notifySessionExpired();
}

// ---------------------------------------------------------------------------
// CSRF token cache. The JWT lives only in the HttpOnly `session_token` cookie
// (sent automatically, same-origin), so every state-changing request must carry
// an X-CSRF-Token fetched once from GET /api/csrf-token.
// ---------------------------------------------------------------------------
let csrfTokenValue = null;
let csrfTokenPromise = null;
let csrfTokenFetchedAt = 0;
// Server-side tokens expire after 2 h; refresh well before that.
const CSRF_MAX_AGE_MS = 90 * 60 * 1000;

/**
 * Get the cached CSRF token, fetching it on first use.
 * @param {boolean} [force=false] - drop the cache and fetch a fresh token
 * @returns {Promise<string|null>}
 */
export async function getCsrfToken(force = false) {
  if (force || (csrfTokenValue && Date.now() - csrfTokenFetchedAt > CSRF_MAX_AGE_MS)) {
    csrfTokenValue = null;
    csrfTokenPromise = null;
  }
  if (csrfTokenValue) return csrfTokenValue;
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch('/api/csrf-token', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        csrfTokenValue = (data && data.csrfToken) || null;
        csrfTokenFetchedAt = Date.now();
        return csrfTokenValue;
      })
      .catch(() => null)
      .finally(() => { csrfTokenPromise = null; });
  }
  return csrfTokenPromise;
}

/** Forget the cached token (e.g. after logout). */
export function clearCsrfToken() {
  csrfTokenValue = null;
  csrfTokenFetchedAt = 0;
  csrfTokenPromise = null;
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

async function isCsrfFailure(response) {
  if (response.status !== 403) return false;
  try {
    const data = await response.clone().json();
    return !!(data && typeof data.error === 'string' && data.error.startsWith('CSRF token'));
  } catch {
    return false;
  }
}

function buildInit(options, csrf) {
  const headers = new Headers(options.headers || {});
  // Never send a stale/legacy Bearer from callers: the cookie is the credential.
  headers.delete('Authorization');
  if (csrf) headers.set('X-CSRF-Token', csrf);
  // FormData / URLSearchParams / Blob: let the browser set the Content-Type
  // (multipart boundary). A caller-set Content-Type on FormData would break it.
  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    headers.delete('Content-Type');
  }
  return { ...options, headers, credentials: options.credentials || 'same-origin' };
}

/**
 * Enhanced fetch for the authenticated API:
 *  - cookie auth (credentials: same-origin), no Authorization header;
 *  - X-CSRF-Token on state-changing requests (one retry after a CSRF failure);
 *  - global 401 (session expired) and 403 EMAIL_NOT_VERIFIED handling.
 *
 * @param {string} url - The URL to fetch
 * @param {RequestInit} [options={}] - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export async function fetchApi(url, options = {}) {
  const needsCsrf = !isSafeMethod(options.method);
  let csrf = needsCsrf ? await getCsrfToken() : null;

  let response = await fetch(url, buildInit(options, csrf));

  // CSRF token expired / server restarted: refresh once and retry.
  if (needsCsrf && (await isCsrfFailure(response))) {
    csrf = await getCsrfToken(true);
    if (csrf) {
      response = await fetch(url, buildInit(options, csrf));
    }
  }

  // Handle 401 - session expired
  if (response.status === 401) handleSessionExpired();

  // Handle 403 EMAIL_NOT_VERIFIED - a gated mutation was blocked by the
  // email-verification gate (spec: SPEC_ANTIBOT_WAVES.md, Трек 2D, п.4).
  // Peek at a clone so the caller can still read the original body/json().
  if (response.status === 403) {
    response.clone().json().then((data) => {
      if (data && data.code === 'EMAIL_NOT_VERIFIED') {
        dispatchEmailNotVerified();
      }
    }).catch(() => { /* not JSON or empty body - ignore */ });
  }

  return response;
}

/**
 * multipart POST with upload-progress events (XMLHttpRequest, since fetch has
 * no upload progress). Same guarantees as fetchApi: cookie auth, X-CSRF-Token,
 * one retry with a fresh token after a CSRF 403, and the global session-expired
 * handling on 401.
 *
 * Resolves { status, ok, data } for ANY HTTP response (data = parsed JSON or {});
 * rejects with an Error whose `code` is 'network' or 'timeout'.
 *
 * @param {string} url
 * @param {FormData} formData
 * @param {{onProgress?: (percent:number)=>void, timeout?: number, method?: string}} [opts]
 */
export async function uploadWithProgress(url, formData, { onProgress, timeout = 5 * 60 * 1000, method = 'POST' } = {}) {
  const send = (csrf) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}') || {}; } catch { /* non-JSON body */ }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, data });
    };
    xhr.onerror = () => { const e = new Error('Network error during upload'); e.code = 'network'; reject(e); };
    xhr.ontimeout = () => { const e = new Error('Upload timed out'); e.code = 'timeout'; reject(e); };
    xhr.timeout = timeout;
    xhr.send(formData);
  });

  let result = await send(await getCsrfToken());
  if (result.status === 403 && typeof result.data.error === 'string' && result.data.error.startsWith('CSRF token')) {
    const fresh = await getCsrfToken(true);
    if (fresh) result = await send(fresh);
  }
  if (result.status === 401) handleSessionExpired();
  if (result.status === 403 && result.data.code === 'EMAIL_NOT_VERIFIED') dispatchEmailNotVerified();
  return result;
}

/**
 * Hook-compatible: listen for session expiry and redirect to login.
 * Call this in your top-level layout component.
 *
 * @param {Function} navigate - React Router navigate function
 */
export function setupSessionExpiredHandler(navigate) {
  const handler = () => {
    // Only redirect if not already on login page
    if (window.location.pathname !== '/login') {
      navigate('/login', {
        state: { message: 'Your session has expired. Please log in again.' }
      });
    }
  };

  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

export default fetchApi;
