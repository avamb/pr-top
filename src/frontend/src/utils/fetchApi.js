/**
 * Global fetch wrapper with 401 (session expired) handling.
 * Wraps the native fetch API to automatically redirect to login
 * when the JWT token is invalid or expired.
 */

const SESSION_EXPIRED_EVENT = 'session-expired';

/**
 * Dispatch a custom event to notify the app that the session has expired.
 * Components can listen for this to show messages or redirect.
 */
function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/**
 * Enhanced fetch that handles 401 responses globally.
 * Automatically includes the Authorization header if a token exists.
 *
 * @param {string} url - The URL to fetch
 * @param {RequestInit} [options={}] - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export async function fetchApi(url, options = {}) {
  // Auto-inject Authorization header if token exists and not already set
  const token = localStorage.getItem('token');
  if (token) {
    if (!options.headers) {
      options.headers = {};
    }
    // Support both Headers object and plain object
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    } else {
      if (!options.headers.Authorization && !options.headers.authorization) {
        options.headers.Authorization = `Bearer ${token}`;
      }
    }
  }

  const response = await fetch(url, options);

  // Handle 401 - session expired
  if (response.status === 401) {
    // Clear stored auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Notify the app
    notifySessionExpired();
  }

  return response;
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
