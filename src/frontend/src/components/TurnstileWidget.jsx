import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Loaded exactly once per page, no matter how many widgets mount
// (spec: docs/security/SPEC_ANTIBOT_WAVES.md, Трек 1B).
let turnstileScriptPromise = null;

function loadTurnstileScript() {
  if (typeof window !== 'undefined' && window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

/**
 * TurnstileWidget — explicit-render Cloudflare Turnstile widget.
 *
 * Renders nothing when VITE_TURNSTILE_SITE_KEY is unset (dev/self-hosted
 * without Cloudflare) and reports `onToken(null)` once so callers can submit
 * without a token. Otherwise loads the Turnstile script once, renders an
 * "interaction-only" invisible-style widget, and forwards a `reset()` method
 * so the caller can retry after a TURNSTILE_FAILED response.
 */
const TurnstileWidget = forwardRef(function TurnstileWidget({ onToken, onExpire, action }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Keep the latest callbacks in refs so the render effect doesn't need to
  // re-run (and re-render the widget) every time a parent re-renders.
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }), []);

  useEffect(() => {
    if (!siteKey) {
      onTokenRef.current?.(null);
      return undefined;
    }

    let cancelled = false;

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current || !turnstile) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: 'interaction-only',
          callback: (token) => onTokenRef.current?.(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onTokenRef.current?.(null),
        });
      })
      .catch(() => {
        if (!cancelled) onTokenRef.current?.(null);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, action]);

  if (!siteKey) return null;

  return <div ref={containerRef} />;
});

export default TurnstileWidget;
