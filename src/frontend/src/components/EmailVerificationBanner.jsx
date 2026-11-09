import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { onEmailNotVerified } from '../utils/emailVerificationEvents';
import { fetchApi } from '../utils/fetchApi';

const API_URL = '/api';
const DISMISS_KEY = 'email_verify_banner_dismissed';
const RESEND_COOLDOWN_S = 60;

/**
 * ChangeEmailModal — small modal used by EmailVerificationBanner to let a
 * therapist with an unverified address fix a typo without contacting
 * support. POST /api/auth/change-unverified-email { email, password }.
 */
function ChangeEmailModal({ currentEmail, onClose, onChanged }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!email.trim() || !password) {
      setError(t('auth.fillRequiredFields', 'Please fill in all required fields'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetchApi(`${API_URL}/auth/change-unverified-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('auth.networkError'));
        setSaving(false);
        return;
      }
      onChanged(data.email || email.trim());
    } catch {
      setError(t('auth.networkError'));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={t('verifyEmail.changeEmail', 'Change email')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-text mb-4">
          {t('verifyEmail.changeTitle', 'Change email address')}
        </h2>
        <p className="text-sm text-secondary mb-4">
          {t('verifyEmail.currentEmail', 'Current: {{email}}', { email: currentEmail })}
        </p>
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="new-email" className="block text-sm font-medium text-text mb-1">
              {t('verifyEmail.newEmail', 'New email')}
            </label>
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-text mb-1">
              {t('auth.password')}
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-error">{error}</p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-secondary border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {saving ? t('verifyEmail.saving', 'Saving…') : t('common.save', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * EmailVerificationBanner — shown to therapists whose email is not yet
 * verified. Rendered by AppLayout right after TimezoneDetectionBanner, so
 * it appears on every authenticated page.
 *
 * Spec: docs/security/SPEC_ANTIBOT_WAVES.md, Трек 2D, п.3-4.
 */
export default function EmailVerificationBanner({ user }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [emailVerified, setEmailVerified] = useState(null); // null = unknown yet
  const [meEmail, setMeEmail] = useState(user?.email || '');
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | error
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changedMessage, setChangedMessage] = useState('');
  const [toast, setToast] = useState(null); // { kind: 'success' | 'gate', text }

  const bannerRef = useRef(null);
  const successToastShownRef = useRef(false);
  const mountedRef = useRef(false);
  const fetchAbortRef = useRef(null);

  const isTherapist = user && user.role === 'therapist';

  // Mounted-guard + in-flight-request tracking so a slow /me response can't
  // setState after unmount, and a focus-triggered refetch cancels any
  // still-pending one instead of racing it.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fetchAbortRef.current?.abort();
    };
  }, []);

  const fetchMe = useCallback(async () => {
    if (!isTherapist) return;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    try {
      const res = await fetchApi(`${API_URL}/auth/me`, {
        signal: controller.signal
      });
      if (!mountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (!mountedRef.current) return;
        if (data.user) {
          setEmailVerified(!!data.user.email_verified);
          if (data.user.email) setMeEmail(data.user.email);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Non-critical - banner just stays in its last known state.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTherapist]);

  // Fetch on mount, and again whenever the tab regains focus (A10 - the
  // user may have verified in another tab by clicking the email link).
  useEffect(() => {
    if (!isTherapist) return undefined;
    fetchMe();
    function onFocus() { fetchMe(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isTherapist, fetchMe]);

  // ?verified=1 - the backend just verified + logged the user in via the
  // email link redirect. ?verified=already - same link clicked again (or
  // the account was already confirmed). Either way: one-time success toast,
  // don't show the (now stale) unverified banner while we wait for the /me
  // refetch above, and strip the param.
  useEffect(() => {
    if (successToastShownRef.current) return;
    const verifiedParam = searchParams.get('verified');
    if (verifiedParam === '1' || verifiedParam === 'already') {
      successToastShownRef.current = true;
      const text = verifiedParam === 'already'
        ? t('verifyEmail.statusAlready', 'Your email was already confirmed.')
        : t('verifyEmail.statusSuccess', 'Email verified! You’re all set.');
      setToast({ kind: 'success', text });
      setEmailVerified(true);
      const next = new URLSearchParams(searchParams);
      next.delete('verified');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Gate toast: some gated POST/export call came back 403 EMAIL_NOT_VERIFIED.
  useEffect(() => {
    return onEmailNotVerified(() => {
      setDismissed(false);
      try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
      setToast({ kind: 'gate', text: t('verifyEmail.gateToast', 'Please verify your email to do this.') });
      bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [t]);

  // Auto-hide the toast after a few seconds.
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), toast.kind === 'gate' ? 6000 : 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    if (resendState === 'sending' || cooldown > 0) return;
    setResendState('sending');
    setResendError('');
    try {
      const res = await fetchApi(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setResendState('error');
        setResendError(data.error || t('verifyEmail.resendLimitReached', 'Too many resend attempts. Please try again later.'));
        return;
      }
      if (!res.ok) {
        setResendState('error');
        setResendError(data.error || t('auth.networkError'));
        return;
      }
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setResendState('error');
      setResendError(t('auth.networkError'));
    }
  }

  function handleDismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  function handleEmailChanged(newEmail) {
    setShowChangeModal(false);
    setMeEmail(newEmail);
    setChangedMessage(t('verifyEmail.changed', 'Email updated. Check {{email}} for a new verification link.', { email: newEmail }));
    setResendState('idle');
    setCooldown(0);
    fetchMe();
  }

  const toastNode = toast && (
    <div
      role="status"
      className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
        toast.kind === 'success'
          ? 'bg-green-50 border border-green-300 text-green-800'
          : 'bg-amber-50 border border-amber-300 text-amber-800'
      }`}
    >
      {toast.text}
    </div>
  );

  if (!isTherapist) return toastNode;
  if (emailVerified !== false) return toastNode;
  if (dismissed) return toastNode;

  return (
    <>
      {toastNode}
      <div ref={bannerRef} className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex-1 text-sm text-yellow-800">
            <p className="font-medium">{t('verifyEmail.bannerTitle', 'Please verify your email')}</p>
            <p>
              {changedMessage || t('verifyEmail.bannerText', 'We sent a verification link to {{email}}. Some actions are blocked until you confirm it.', { email: meEmail })}
            </p>
            {resendState === 'sent' && (
              <p className="text-green-700 mt-1">{t('verifyEmail.sent', 'Verification email sent.')}</p>
            )}
            {resendState === 'error' && resendError && (
              <p role="alert" className="text-error mt-1">{resendError}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleResend}
              disabled={resendState === 'sending' || cooldown > 0}
              className="px-3 py-1.5 text-sm font-medium bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {cooldown > 0
                ? t('verifyEmail.resendIn', 'Resend in {{seconds}}s', { seconds: cooldown })
                : resendState === 'sending'
                  ? t('verifyEmail.sending', 'Sending…')
                  : t('verifyEmail.resend', 'Resend email')}
            </button>
            <button
              onClick={() => setShowChangeModal(true)}
              className="px-3 py-1.5 text-sm font-medium bg-white text-yellow-700 border border-yellow-300 rounded-md hover:bg-yellow-50 transition-colors"
            >
              {t('verifyEmail.changeEmail', 'Change email')}
            </button>
            <button
              onClick={handleDismiss}
              aria-label={t('common.dismiss', 'Dismiss')}
              className="px-2 py-1.5 text-sm text-yellow-700 hover:bg-yellow-100 rounded-md transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      </div>

      {showChangeModal && (
        <ChangeEmailModal
          currentEmail={meEmail}
          onClose={() => setShowChangeModal(false)}
          onChanged={handleEmailChanged}
        />
      )}
    </>
  );
}
