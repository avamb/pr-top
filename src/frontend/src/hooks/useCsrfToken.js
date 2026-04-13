import { useState, useEffect } from 'react';

/**
 * Hook to fetch and cache a CSRF token for forms.
 * Used on login/register pages that submit without Authorization headers.
 * Retries up to 3 times with increasing delays on failure.
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchWithRetry(attempt) {
      try {
        const res = await fetch('/api/csrf-token');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setCsrfToken(data.csrfToken);
            setIsLoading(false);
          }
          return;
        }
      } catch (e) {
        // network error — will retry below
      }
      if (attempt < 3 && !cancelled) {
        setTimeout(() => fetchWithRetry(attempt + 1), 500 * (attempt + 1));
      } else if (!cancelled) {
        setIsLoading(false);
      }
    }
    fetchWithRetry(0);
    return () => { cancelled = true; };
  }, []);

  return { csrfToken, isLoading };
}
