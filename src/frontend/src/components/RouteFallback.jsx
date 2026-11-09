import React from 'react';

/**
 * Suspense fallback shown while a lazily loaded route chunk downloads.
 * Intentionally dependency-free (no i18n, no router) so it never pulls
 * anything into the entry chunk and cannot itself suspend or mismatch.
 */
export default function RouteFallback() {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-8 w-8 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
