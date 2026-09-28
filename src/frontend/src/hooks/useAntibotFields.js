import { useRef, useState } from 'react';

// Off-screen but present in the DOM (not display:none) so it stays out of
// the tab order and is invisible, yet a naive bot that fills every input
// still trips it. Matches middleware/antibot.js field name (`website`).
const HONEYPOT_STYLE = {
  position: 'absolute',
  left: '-9999px',
  width: 0,
  height: 0,
  opacity: 0,
};

/**
 * useAntibotFields() — honeypot input props + timing field for public forms.
 *
 * `hiddenFields.form_started_at` is captured once on mount so the backend
 * (middleware/antibot.js) can reject submits that happen faster than a human
 * could plausibly fill the form.
 */
export function useAntibotFields() {
  const [honeypotValue, setHoneypotValue] = useState('');
  const formStartedAtRef = useRef(Date.now());

  const honeypotProps = {
    name: 'website',
    tabIndex: -1,
    autoComplete: 'off',
    'aria-hidden': true,
    style: HONEYPOT_STYLE,
  };

  const hiddenFields = {
    website: honeypotValue,
    form_started_at: formStartedAtRef.current,
  };

  return { honeypotProps, honeypotValue, setHoneypotValue, hiddenFields };
}

/**
 * waitForTurnstileToken(tokenRef) — polls a ref updated by TurnstileWidget's
 * onToken callback so submit doesn't hang if Turnstile is slow, but still
 * gives the invisible widget a brief chance to finish (spec: wait up to 3s,
 * poll every 100ms, then send whatever is available).
 *
 * `tokenRef.current` must start as `undefined` ("not resolved yet"). It
 * becomes a string token, or `null` when no site key is configured or
 * Turnstile reports an error — either way that's a final answer, so the
 * wait ends immediately instead of spinning for the full timeout.
 */
export async function waitForTurnstileToken(tokenRef, { timeoutMs = 3000, intervalMs = 100 } = {}) {
  const start = Date.now();
  while (tokenRef.current === undefined && Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return tokenRef.current === undefined ? null : tokenRef.current;
}

export default useAntibotFields;
