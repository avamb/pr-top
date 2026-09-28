/**
 * Tiny window CustomEvent bus so any authenticated fetch call (see
 * utils/fetchApi.js) can notify EmailVerificationBanner that a gated route
 * just answered 403 { code: 'EMAIL_NOT_VERIFIED' } — without a prop/context
 * chain from every page down to the banner.
 *
 * Spec: docs/security/SPEC_ANTIBOT_WAVES.md, Трек 2D, п.4.
 */

const EMAIL_NOT_VERIFIED_EVENT = 'prtop:email-not-verified';

/**
 * Dispatch the "a gated action was blocked by the email-verification gate"
 * event. Safe to call outside a browser environment (no-op).
 */
export function dispatchEmailNotVerified() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EMAIL_NOT_VERIFIED_EVENT));
}

/**
 * Subscribe to the event. Returns an unsubscribe function, so callers can
 * use it directly as a useEffect cleanup:
 *
 *   useEffect(() => onEmailNotVerified(handler), []);
 */
export function onEmailNotVerified(cb) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, cb);
  return () => window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, cb);
}

export default { dispatchEmailNotVerified, onEmailNotVerified };
