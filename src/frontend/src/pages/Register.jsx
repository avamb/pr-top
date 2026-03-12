import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCsrfToken } from '../hooks/useCsrfToken';

export default function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const csrfToken = useCsrfToken();
  const [searchParams] = useSearchParams();

  // Redirect if already authenticated (prevents back-button resubmit)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Capture UTM params from URL
  const utmParams = useMemo(() => ({
    utm_source: searchParams.get('utm_source') || undefined,
    utm_medium: searchParams.get('utm_medium') || undefined,
    utm_campaign: searchParams.get('utm_campaign') || undefined,
    utm_content: searchParams.get('utm_content') || undefined,
    utm_term: searchParams.get('utm_term') || undefined,
  }), [searchParams]);
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    // Clear field error when user starts typing
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setFieldErrors({});

    // Per-field required validation
    const errors = {};
    if (!form.email.trim()) {
      errors.email = t('auth.fieldRequired', 'This field is required');
    }
    if (!form.password) {
      errors.password = t('auth.fieldRequired', 'This field is required');
    }
    if (!form.confirmPassword) {
      errors.confirmPassword = t('auth.fieldRequired', 'This field is required');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(t('auth.fillRequiredFields', 'Please fill in all required fields'));
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setFieldErrors({ email: t('auth.invalidEmail', 'Please enter a valid email address') });
      setError(t('auth.invalidEmail', 'Please enter a valid email address'));
      return;
    }

    // Password strength validation
    const passwordErrors = [];
    if (form.password.length < 8) {
      passwordErrors.push(t('auth.passwordReqLength', 'At least 8 characters'));
    }
    if (!/[A-Z]/.test(form.password)) {
      passwordErrors.push(t('auth.passwordReqUppercase', 'At least one uppercase letter'));
    }
    if (!/[a-z]/.test(form.password)) {
      passwordErrors.push(t('auth.passwordReqLowercase', 'At least one lowercase letter'));
    }
    if (!/[0-9]/.test(form.password)) {
      passwordErrors.push(t('auth.passwordReqNumber', 'At least one number'));
    }
    if (passwordErrors.length > 0) {
      setFieldErrors({ password: passwordErrors.join(', ') });
      setError(t('auth.passwordWeak', 'Password does not meet requirements') + ': ' + passwordErrors.join(', '));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: t('auth.passwordMismatch') });
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          role: 'therapist',
          ...utmParams
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to dashboard (replace history to prevent back-button resubmit)
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(t('auth.networkError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>
      <main id="main-content" className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">{t('brand')}</h1>
          <p className="text-secondary mt-2">{t('auth.registerSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold text-text mb-6">{t('auth.registerTitle')}</h2>

          {error && (
            <div className="bg-red-50 border border-error text-error rounded-md p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                value={form.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.email ? 'border-error' : 'border-gray-300'}`}
                placeholder={t('auth.emailPlaceholder')}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-error">{fieldErrors.email}</p>
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
                autoComplete="new-password"
                required
                value={form.password}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.password ? 'border-error' : 'border-gray-300'}`}
                placeholder={t('auth.passwordStrengthPlaceholder', 'Min 8 chars, upper, lower, number')}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-error">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text mb-1">
                {t('auth.confirmPassword')} <span className="text-error">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.confirmPassword ? 'border-error' : 'border-gray-300'}`}
                placeholder={t('auth.confirmPasswordPlaceholder')}
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-sm text-error">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-secondary">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary hover:text-primary-600 font-medium">
              {t('auth.loginTitle')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
