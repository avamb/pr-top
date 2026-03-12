import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCsrfToken } from '../hooks/useCsrfToken';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const csrfToken = useCsrfToken();
  const redirectTo = location.state?.from || null;
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

      // Redirect to intended page, or default based on role
      if (redirectTo) {
        navigate(redirectTo);
      } else if (data.user.role === 'superadmin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
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
          <p className="text-secondary mt-2">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold text-text mb-6">{t('auth.loginTitle')}</h2>

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
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.password ? 'border-error' : 'border-gray-300'}`}
                placeholder={t('auth.passwordPlaceholder')}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-error">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-secondary">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary hover:text-primary-600 font-medium">
              {t('auth.registerTitle')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
