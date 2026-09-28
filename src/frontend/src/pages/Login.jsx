import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCsrfToken } from '../hooks/useCsrfToken';
import { useAntibotFields, waitForTurnstileToken } from '../hooks/useAntibotFields';
import LoadingSpinner from '../components/LoadingSpinner';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Seo from '../components/Seo';
import TurnstileWidget from '../components/TurnstileWidget';
import CodeInput from '../components/auth/CodeInput';

const RESEND_COOLDOWN_S = 60;

/**
 * Login — three modes (spec: docs/security/SPEC_ANTIBOT_WAVES.md, Трек 2D, п.1):
 *   'email'    default. Email field + "Get code" (primary) + "Sign in with password" link.
 *   'code'     6-digit CodeInput sent to the email above, auto-submits at 6 digits.
 *   'password' the classic email+password form, kept as a fallback.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { csrfToken, isLoading: csrfLoading } = useCsrfToken();
  const redirectTo = location.state?.from || null;
  const accessDenied = location.state?.accessDenied || false;
  const sessionExpiredMessage = location.state?.message || null;

  // Redirect if already authenticated (prevents back-button resubmit)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !accessDenied) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, accessDenied]);

  const [mode, setMode] = useState('email'); // 'email' | 'code' | 'password'
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(
    accessDenied ? t('auth.clientAccessDenied', 'Access denied. The web panel is for therapists only. Clients should use the Telegram bot.')
    : sessionExpiredMessage ? sessionExpiredMessage
    : ''
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  // Green info banner (distinct from `error`) - e.g. "?verified=1" landing
  // here because a different account's session cookie was present, so the
  // backend confirmed the email but did not auto sign-in (Трек 2D fix #8).
  const [infoMessage, setInfoMessage] = useState('');

  // login-code/request state
  const [requestingCode, setRequestingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // login-code/verify state
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeLocked, setCodeLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { honeypotProps, honeypotValue, setHoneypotValue, hiddenFields } = useAntibotFields();
  const turnstileRef = useRef(null);
  const turnstileTokenRef = useRef(undefined);
  const verifyAbortRef = useRef(null);

  // One-time query-param handling on mount:
  //   ?code_error=expired - the /login-code/link magic link was stale/used.
  //   ?verified=1         - the confirmation link was clicked while a
  //                          DIFFERENT account's session cookie was present,
  //                          so the backend confirmed the email but could
  //                          not auto sign-in (redirects here instead of
  //                          /dashboard). Show a success note and let the
  //                          person sign in normally.
  // Stripping both params preserves location.state (redirectTo/accessDenied/
  // session-expired) so it isn't lost on the replace navigation.
  useEffect(() => {
    const codeError = searchParams.get('code_error');
    const verifiedParam = searchParams.get('verified');
    if (!codeError && !verifiedParam) return;

    if (codeError === 'expired') {
      setError(t('auth.codeExpiredLink', 'That sign-in link has expired. Request a new code below.'));
    } else if (verifiedParam === '1') {
      setMode('email');
      setInfoMessage(
        `${t('verifyEmail.statusSuccess', 'Email verified! You’re all set.')} ${t('auth.pleaseSignInNow', 'Please sign in below.')}`
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete('code_error');
    next.delete('verified');
    setSearchParams(next, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  /**
   * Shared post-login logic for both the password form and the login-code
   * verify step: stash the session, sync the profile language, then redirect
   * by role. Returns true on success, false if the login was rejected
   * (client role denial) so the caller can stop its own loading spinner.
   */
  const handleLoginSuccess = useCallback(async (data) => {
    if (data.user.role === 'client') {
      setError(t('auth.clientAccessDenied', 'Access denied. The web panel is for therapists only. Clients should use the Telegram bot.'));
      return false;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Fetch user profile to sync language
    try {
      const profileRes = await fetch('/api/settings/profile', {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const lang = profileData.profile?.language || 'en';
        i18n.changeLanguage(lang);
        localStorage.setItem('app_language', lang);
      }
    } catch (e) { /* ignore - language will sync on settings page */ }

    // Redirect to intended page, or default based on role (replace history to prevent back-button resubmit)
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
    } else if (data.user.role === 'superadmin') {
      navigate('/admin', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectTo, navigate, i18n]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setFieldErrors({});

    const errors = {};
    if (!form.email.trim()) {
      errors.email = t('auth.fieldRequired', 'This field is required');
    }
    if (!form.password) {
      errors.password = t('auth.fieldRequired', 'This field is required');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(t('auth.fillRequiredFields', 'Please fill in all required fields'));
      return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      const ok = await handleLoginSuccess(data);
      if (!ok) setLoading(false);
    } catch (err) {
      setError(t('auth.networkError'));
      setLoading(false);
    }
  };

  /**
   * POST /api/auth/login-code/request. Used both for the initial "Get code"
   * submit (isResend=false) and the "Resend" button in code mode
   * (isResend=true) - same endpoint, same antibot fields.
   */
  const requestCode = async (isResend) => {
    if (requestingCode) return;
    if (isResend && cooldown > 0) return;

    setError('');
    if (!isResend) {
      if (!form.email.trim()) {
        setFieldErrors({ email: t('auth.fieldRequired', 'This field is required') });
        setError(t('auth.fillRequiredFields', 'Please fill in all required fields'));
        return;
      }
      setFieldErrors({});
    }

    setRequestingCode(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      if (isResend) {
        // Turnstile tokens are single-use - get a fresh one for the resend.
        turnstileTokenRef.current = undefined;
        turnstileRef.current?.reset();
      }
      let turnstileToken = turnstileTokenRef.current;
      if (turnstileToken === undefined) {
        turnstileToken = await waitForTurnstileToken(turnstileTokenRef);
      }

      const res = await fetch('/api/auth/login-code/request', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: form.email.trim(),
          ...hiddenFields,
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {})
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Any non-2xx here means the token we just sent is either rejected
        // or (per Cloudflare) already consumed server-side - never resend
        // it on the next attempt, always get a fresh one.
        turnstileTokenRef.current = undefined;
        turnstileRef.current?.reset();
        if (data.code === 'TURNSTILE_FAILED') {
          setError(t('auth.turnstileFailed', 'Verification failed. Please disable ad blockers, reload the page and try again.'));
          setRequestingCode(false);
          return;
        }
        setError(data.error || t('auth.networkError'));
        setRequestingCode(false);
        return;
      }

      // Backend always answers 200 here, whether the email exists or not (A8) -
      // move to the code step regardless.
      setMode('code');
      setCode('');
      setCodeError('');
      setCodeLocked(false);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(t('auth.networkError'));
    }
    setRequestingCode(false);
  };

  const handleRequestCodeSubmit = (e) => {
    e.preventDefault();
    requestCode(false);
  };

  const handleVerifyCode = useCallback(async (codeValue) => {
    if (verifying) return;
    setVerifying(true);
    setCodeError('');

    verifyAbortRef.current?.abort();
    const controller = new AbortController();
    verifyAbortRef.current = controller;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/auth/login-code/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: form.email.trim(), code: codeValue }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Contract: the backend no longer returns 403 for a client-role
        // account at this endpoint (that denial - if the backend ever adds
        // one back - is still caught by handleLoginSuccess()'s own role
        // check on a 200 response, same as the password path). Every
        // failure now comes back as 401 CODE_INVALID (anti-enumeration);
        // the CODE_LOCKED branch is kept harmless in case attempt lockouts
        // return later, but must never be the only way to re-enable input -
        // requestCode(true) (resend) always clears it below.
        if (data.code === 'CODE_LOCKED') {
          setCodeError(t('auth.codeLocked', 'Too many incorrect attempts. Request a new code to try again.'));
          setCodeLocked(true);
        } else {
          setCodeError(t('auth.codeInvalid', 'That code is incorrect. Please try again.'));
          setCode('');
        }
        setVerifying(false);
        return;
      }

      const ok = await handleLoginSuccess(data);
      if (!ok) setVerifying(false);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setCodeError(t('auth.networkError'));
      setVerifying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifying, csrfToken, form.email, handleLoginSuccess, t]);

  function switchToPassword() {
    verifyAbortRef.current?.abort();
    setVerifying(false);
    setMode('password');
    setError('');
    setFieldErrors({});
    setCode('');
    setCodeError('');
    setCodeLocked(false);
  }

  function switchToEmail() {
    verifyAbortRef.current?.abort();
    setVerifying(false);
    setMode('email');
    setError('');
    setCode('');
    setCodeError('');
    setCodeLocked(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <Seo path="/login" title="Sign in — PR-TOP" description="Sign in to PR-TOP." noindex />
      <div className="absolute top-4 right-4">
        <LanguageSwitcher compact />
      </div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>
      <main id="main-content" className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">{t('brand')}</h1>
          <p className="text-secondary mt-2">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold text-text mb-6">{t('auth.loginTitle')}</h2>

          {error && (
            <div role="alert" className="bg-red-50 border border-error text-error rounded-md p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {!error && infoMessage && (
            <div role="status" className="bg-green-50 border border-green-300 text-green-700 rounded-md p-3 mb-4 text-sm">
              {infoMessage}
            </div>
          )}

          {mode === 'email' && (
            <>
              <form onSubmit={handleRequestCodeSubmit} noValidate className="space-y-4">
                <input
                  {...honeypotProps}
                  value={honeypotValue}
                  onChange={(e) => setHoneypotValue(e.target.value)}
                />

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
                    {t('auth.email')} <span className="text-error">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    value={form.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.email ? 'border-error' : 'border-gray-300'}`}
                    placeholder={t('auth.emailPlaceholder')}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" role="alert" className="mt-1 text-sm text-error">{fieldErrors.email}</p>
                  )}
                  <p className="mt-1 text-xs text-secondary">
                    {t('auth.codeHint', "We'll email you a 6-digit code - no password needed.")}
                  </p>
                </div>

                <TurnstileWidget
                  ref={turnstileRef}
                  action="login_code"
                  onToken={(token) => { turnstileTokenRef.current = token; }}
                  onExpire={() => { turnstileTokenRef.current = null; }}
                />

                <button
                  type="submit"
                  disabled={requestingCode || csrfLoading}
                  className="w-full py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {(requestingCode || csrfLoading) && <LoadingSpinner size={16} className="mr-2" />}
                  {t('auth.getCode', 'Get code')}
                </button>
              </form>

              <p className="mt-3 text-center text-sm">
                <button type="button" onClick={switchToPassword} className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.loginWithPassword', 'Sign in with password instead')}
                </button>
              </p>

              <p className="mt-2 text-center text-sm text-secondary">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.registerTitle')}
                </Link>
              </p>
            </>
          )}

          {mode === 'code' && (
            <>
              <p className="text-sm text-secondary mb-4 text-center">
                {t('auth.codeSentTo', 'We sent a 6-digit code to {{email}}', { email: form.email.trim() })}
              </p>

              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={handleVerifyCode}
                disabled={verifying || codeLocked}
                error={!!codeError}
                autoFocus
              />

              {codeError && (
                <p role="alert" className="mt-3 text-sm text-error text-center">{codeError}</p>
              )}

              {verifying && (
                <p className="mt-3 text-sm text-secondary text-center flex items-center justify-center gap-2">
                  <LoadingSpinner size={16} />
                  {t('auth.verifying', 'Verifying…')}
                </p>
              )}

              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => requestCode(true)}
                  disabled={requestingCode || cooldown > 0}
                  className="text-primary hover:text-primary-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cooldown > 0
                    ? t('auth.resendIn', 'Resend code in {{seconds}}s', { seconds: cooldown })
                    : t('auth.resendCode', 'Resend code')}
                </button>
              </div>

              <p className="mt-2 text-center text-sm">
                <button type="button" onClick={switchToEmail} className="text-secondary hover:text-text font-medium">
                  {t('auth.changeEmail', 'Change email')}
                </button>
              </p>

              <p className="mt-3 text-center text-sm">
                <button type="button" onClick={switchToPassword} className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.loginWithPassword', 'Sign in with password instead')}
                </button>
              </p>
            </>
          )}

          {mode === 'password' && (
            <>
              <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
                    {t('auth.email')} <span className="text-error">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    value={form.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.email ? 'border-error' : 'border-gray-300'}`}
                    placeholder={t('auth.emailPlaceholder')}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" role="alert" className="mt-1 text-sm text-error">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
                    {t('auth.password')} <span className="text-error">*</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    value={form.password}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.password ? 'border-error' : 'border-gray-300'}`}
                    placeholder={t('auth.passwordPlaceholder')}
                  />
                  {fieldErrors.password && (
                    <p id="password-error" role="alert" className="mt-1 text-sm text-error">{fieldErrors.password}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || csrfLoading}
                  className="w-full py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {(loading || csrfLoading) && <LoadingSpinner size={16} className="mr-2" />}
                  {loading ? t('auth.signingIn') : t('auth.signIn')}
                </button>
              </form>

              <p className="mt-3 text-center text-sm">
                <button type="button" onClick={switchToEmail} className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.loginWithCode', 'Sign in with an email code instead')}
                </button>
              </p>

              <p className="mt-2 text-center text-sm">
                <Link to="/forgot-password" className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.forgotPassword', 'Forgot password?')}
                </Link>
              </p>

              <p className="mt-2 text-center text-sm text-secondary">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.registerTitle')}
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
