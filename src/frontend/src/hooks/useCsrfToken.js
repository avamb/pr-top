import { useState, useEffect } from 'react';

/**
 * Hook to fetch and cache a CSRF token for forms.
 * Used on login/register pages that submit without Authorization headers.
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await fetch('/api/csrf-token');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setCsrfToken(data.csrfToken);
          }
        }
      } catch (e) {
        // Token fetch failed - form will still work if backend is lenient
        console.warn('Failed to fetch CSRF token:', e.message);
      }
    }
    fetchToken();
    return () => { cancelled = true; };
  }, []);

  return csrfToken;
}
