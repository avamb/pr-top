import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCsrfToken } from '../hooks/useCsrfToken';
import LoadingSpinner from '../components/LoadingSpinner';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const csrfToken = useCsrfToken();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!email.trim()) {
      setError(t('auth.fieldRequired', 'This field is required'));
      return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.forgotPasswordError', 'Something went wrong. Please try again.'));
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(t('auth.networkError', 'Network error. Please check your connection.'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher compact />
      </div>
      <main className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">{t('brand')}</h1>
          <p className="text-secondary mt-2">{t('auth.forgotPasswordSubtitle', 'Reset your password')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold text-text mb-6">
            {t('auth.forgotPasswordTitle', 'Forgot Password')}
          </h2>

          {success ? (
            <div>
              <div className="bg-green-50 border border-green-300 text-green-700 rounded-md p-4 mb-4 text-sm">
                {t('auth.forgotPasswordSuccess', 'If an account with that email exists, a password reset link has been sent. Please check your email (and console logs in development mode).')}
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 transition-colors"
              >
                {t('auth.backToLogin', 'Back to Login')}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="bg-red-50 border border-error text-error rounded-md p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              <p className="text-sm text-secondary mb-4">
                {t('auth.forgotPasswordInstructions', 'Enter your email address and we\'ll send you a link to reset your password.')}
              </p>

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
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && <LoadingSpinner size={16} className="mr-2" />}
                  {loading ? t('auth.sending', 'Sending...') : t('auth.sendResetLink', 'Send Reset Link')}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-secondary">
                <Link to="/login" className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.backToLogin', 'Back to Login')}
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
