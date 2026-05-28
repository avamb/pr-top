import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackUmamiEvent } from '../../utils/umami';
import LoadingSpinner from '../LoadingSpinner';
import { useCsrfToken } from '../../hooks/useCsrfToken';

/**
 * IANA timezones list (common subset). Full list would need a library.
 * Grouped by region for usability.
 */
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Warsaw',
  'Europe/Vienna',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Helsinki',
  'Europe/Kyiv',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Tbilisi',
  'Asia/Yerevan',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Novosibirsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'uk', label: 'Українська' },
];

/**
 * ConfirmSignupForm — embedded registration form for the Confirm landing page.
 *
 * Submit flow:
 *  1. POST /api/auth/register with intended_plan='confirm' + X-Acquisition-Source: landing_confirm
 *  2. On 200 + next_action='await_stripe_checkout' → POST /api/subscription/create-checkout-session
 *  3. Redirect to Stripe Checkout URL
 */
export default function ConfirmSignupForm({ formRef, defaultLanguage = 'en' }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { csrfToken } = useCsrfToken();

  // Auto-detect timezone
  const detectedTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  })();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    language: defaultLanguage || i18n.language || 'en',
    timezone: detectedTz,
  });

  const [consents, setConsents] = useState({
    age: false,
    privacy: false,
    reminders: true, // pre-checked per spec
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync language if i18n changes
  useEffect(() => {
    setForm(prev => ({ ...prev, language: i18n.language || 'en' }));
  }, [i18n.language]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleConsentChange = (key) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
    if (errors.consents) setErrors(prev => ({ ...prev, consents: '' }));
  };

  const validate = () => {
    const errs = {};

    if (!form.name.trim()) {
      errs.name = t('landingConfirm.signup.errors.nameRequired');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      errs.email = t('landingConfirm.signup.errors.required');
    } else if (!emailRegex.test(form.email)) {
      errs.email = t('landingConfirm.signup.errors.invalidEmail');
    }

    const pwdErrors = [];
    if (form.password.length < 8) pwdErrors.push(true);
    if (!/[A-Z]/.test(form.password)) pwdErrors.push(true);
    if (!/[a-z]/.test(form.password)) pwdErrors.push(true);
    if (!/[0-9]/.test(form.password)) pwdErrors.push(true);
    if (pwdErrors.length > 0) {
      errs.password = t('landingConfirm.signup.errors.passwordWeak');
    }

    if (!consents.age || !consents.privacy || !consents.reminders) {
      errs.consents = t('landingConfirm.signup.errors.consentRequired');
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    trackUmamiEvent('confirm_signup_submitted', { locale: i18n.language });

    try {
      // Step 1: Register
      const registerHeaders = {
        'Content-Type': 'application/json',
        'X-Acquisition-Source': 'landing_confirm',
      };
      if (csrfToken) {
        registerHeaders['X-CSRF-Token'] = csrfToken;
      }
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: registerHeaders,
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          language: form.language,
          timezone: form.timezone,
          intended_plan: 'confirm',
          consents: {
            age_18: consents.age,
            privacy_terms: consents.privacy,
            session_reminders: consents.reminders,
          },
        }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        setSubmitError(registerData.error || t('landingConfirm.signup.errors.generic'));
        setLoading(false);
        return;
      }

      trackUmamiEvent('confirm_signup_success', { locale: i18n.language });

      // Store auth token
      localStorage.setItem('token', registerData.token);
      localStorage.setItem('user', JSON.stringify(registerData.user));

      // Step 2: If next_action is 'await_stripe_checkout', go to Stripe
      if (registerData.next_action === 'await_stripe_checkout') {
        try {
          const checkoutRes = await fetch('/api/subscription/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${registerData.token}`,
            },
            body: JSON.stringify({ plan: 'confirm' }),
          });

          const checkoutData = await checkoutRes.json();

          if (checkoutRes.ok && checkoutData.checkout_url) {
            trackUmamiEvent('confirm_stripe_redirect', { locale: i18n.language });
            window.location.href = checkoutData.checkout_url;
            return;
          }

          // Dev mode: auto_completed = true, redirect to dashboard
          if (checkoutData.auto_completed) {
            navigate('/dashboard?welcome=confirm', { replace: true });
            return;
          }

          // Fallback: go to subscription page
          navigate('/subscription', { replace: true });
        } catch (checkoutErr) {
          // Checkout failed but account created — go to dashboard
          navigate('/dashboard?welcome=confirm', { replace: true });
        }
      } else {
        // No Stripe needed, go to dashboard
        navigate('/dashboard?welcome=confirm', { replace: true });
      }
    } catch (err) {
      setSubmitError(t('landingConfirm.signup.errors.generic'));
      setLoading(false);
    }
  };

  return (
    <section id="signup" aria-label="Sign up" className="py-20 bg-surface" ref={formRef}>
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-text">
            {t('landingConfirm.signup.title')}
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-surface p-8">
          {submitError && (
            <div role="alert" className="bg-red-50 border border-error text-error rounded-lg p-3 mb-5 text-sm">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="lc-name" className="block text-sm font-medium text-text mb-1">
                {t('landingConfirm.signup.nameLabel')} <span className="text-error">*</span>
              </label>
              <input
                id="lc-name"
                name="name"
                type="text"
                autoComplete="given-name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder={t('landingConfirm.signup.namePlaceholder')}
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm ${errors.name ? 'border-error' : 'border-gray-300'}`}
              />
              {errors.name && <p role="alert" className="mt-1 text-xs text-error">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="lc-email" className="block text-sm font-medium text-text mb-1">
                {t('landingConfirm.signup.emailLabel')} <span className="text-error">*</span>
              </label>
              <input
                id="lc-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder={t('landingConfirm.signup.emailPlaceholder')}
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm ${errors.email ? 'border-error' : 'border-gray-300'}`}
              />
              {errors.email && <p role="alert" className="mt-1 text-xs text-error">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="lc-password" className="block text-sm font-medium text-text mb-1">
                {t('landingConfirm.signup.passwordLabel')} <span className="text-error">*</span>
              </label>
              <input
                id="lc-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder={t('landingConfirm.signup.passwordPlaceholder')}
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm ${errors.password ? 'border-error' : 'border-gray-300'}`}
              />
              {errors.password && <p role="alert" className="mt-1 text-xs text-error">{errors.password}</p>}
            </div>

            {/* Language + Timezone side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Language */}
              <div>
                <label htmlFor="lc-language" className="block text-sm font-medium text-text mb-1">
                  {t('landingConfirm.signup.languageLabel')}
                </label>
                <select
                  id="lc-language"
                  name="language"
                  value={form.language}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label htmlFor="lc-timezone" className="block text-sm font-medium text-text mb-1">
                  {t('landingConfirm.signup.timezoneLabel')}
                </label>
                <select
                  id="lc-timezone"
                  name="timezone"
                  value={form.timezone}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                >
                  {COMMON_TIMEZONES.includes(detectedTz) ? null : (
                    <option value={detectedTz}>{detectedTz}</option>
                  )}
                  {COMMON_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Consent checkboxes */}
            <div className={`space-y-3 pt-2 ${errors.consents ? 'p-3 bg-red-50 rounded-lg border border-red-200' : ''}`}>
              {/* Age consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.age}
                  onChange={() => handleConsentChange('age')}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary shrink-0"
                />
                <span className="text-xs text-secondary leading-relaxed">
                  {t('landingConfirm.signup.consentAge')} <span className="text-error">*</span>
                </span>
              </label>

              {/* Privacy consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.privacy}
                  onChange={() => handleConsentChange('privacy')}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary shrink-0"
                />
                <span className="text-xs text-secondary leading-relaxed">
                  {t('landingConfirm.signup.consentPrivacy')}{' '}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>
                  {' & '}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms</Link>
                  . <span className="text-error">*</span>
                </span>
              </label>

              {/* Session reminders consent (pre-checked) */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.reminders}
                  onChange={() => handleConsentChange('reminders')}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary shrink-0"
                />
                <span className="text-xs text-secondary leading-relaxed">
                  {t('landingConfirm.signup.consentReminders')} <span className="text-error">*</span>
                </span>
              </label>

              {errors.consents && (
                <p role="alert" className="text-xs text-error">{errors.consents}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 bg-primary text-white font-bold rounded-xl hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px] text-base flex items-center justify-center gap-2 mt-2"
            >
              {loading && <LoadingSpinner size={18} className="text-white" />}
              {loading ? t('landingConfirm.signup.submitting') : t('landingConfirm.signup.submitBtn')}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-5 text-center text-sm text-secondary">
            {t('landingConfirm.signup.orLogin')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('landingConfirm.signup.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
