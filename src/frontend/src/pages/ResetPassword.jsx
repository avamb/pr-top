import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCsrfToken } from '../hooks/useCsrfToken';
import LoadingSpinner from '../components/LoadingSpinner';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const csrfToken = useCsrfToken();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // If no token in URL, show error
  useEffect(() => {
    if (!token) {
      setError(t('auth.resetPasswordNoToken', 'No reset token provided. Please use the link from your email.'));
    }
  }, [token, t]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !token) return;
    setError('');
    setFieldErrors({});

    // Validate fields
    const errors = {};
    if (!form.password) {
      errors.password = t('auth.fieldRequired', 'This field is required');
    } else {
      const pwdErrors = [];
      if (form.password.length < 8) pwdErrors.push(t('auth.pwdMinLength', 'at least 8 characters'));
      if (!/[A-Z]/.test(form.password)) pwdErrors.push(t('auth.pwdUppercase', 'at least one uppercase letter'));
      if (!/[a-z]/.test(form.password)) pwdErrors.push(t('auth.pwdLowercase', 'at least one lowercase letter'));
      if (!/[0-9]/.test(form.password)) pwdErrors.push(t('auth.pwdNumber', 'at least one number'));
      if (pwdErrors.length > 0) {
        errors.password = t('auth.pwdRequirements', 'Password requires: ') + pwdErrors.join(', ');
      }
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = t('auth.fieldRequired', 'This field is required');
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = t('auth.passwordsMismatch', 'Passwords do not match');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, password: form.password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.resetPasswordError', 'Failed to reset password. The link may be expired.'));
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
          <p className="text-secondary mt-2">{t('auth.resetPasswordSubtitle', 'Set a new password')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold text-text mb-6">
            {t('auth.resetPasswordTitle', 'Reset Password')}
          </h2>

          {success ? (
            <div>
              <div className="bg-green-50 border border-green-300 text-green-700 rounded-md p-4 mb-4 text-sm">
                {t('auth.resetPasswordSuccess', 'Your password has been reset successfully! You can now log in with your new password.')}
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 transition-colors"
              >
                {t('auth.goToLogin', 'Go to Login')}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="bg-red-50 border border-error text-error rounded-md p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              {token && (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
                      {t('auth.newPassword', 'New Password')} <span className="text-error">*</span>
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      value={form.password}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.password ? 'border-error' : 'border-gray-300'}`}
                      placeholder={t('auth.newPasswordPlaceholder', 'Enter new password')}
                    />
                    {fieldErrors.password && (
                      <p id="password-error" role="alert" className="mt-1 text-sm text-error">{fieldErrors.password}</p>
                    )}
                    <p className="mt-1 text-xs text-secondary">
                      {t('auth.passwordRequirements', 'Minimum 8 characters, with uppercase, lowercase, and a number')}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-text mb-1">
                      {t('auth.confirmPassword', 'Confirm Password')} <span className="text-error">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      aria-invalid={!!fieldErrors.confirmPassword}
                      aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${fieldErrors.confirmPassword ? 'border-error' : 'border-gray-300'}`}
                      placeholder={t('auth.confirmPasswordPlaceholder', 'Confirm new password')}
                    />
                    {fieldErrors.confirmPassword && (
                      <p id="confirm-password-error" role="alert" className="mt-1 text-sm text-error">{fieldErrors.confirmPassword}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 bg-primary text-white font-medium rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading && <LoadingSpinner size={16} className="mr-2" />}
                    {loading ? t('auth.resetting', 'Resetting...') : t('auth.resetPassword', 'Reset Password')}
                  </button>
                </form>
              )}

              <p className="mt-4 text-center text-sm text-secondary">
                <Link to="/forgot-password" className="text-primary hover:text-primary-600 font-medium">
                  {t('auth.requestNewLink', 'Request a new reset link')}
                </Link>
                {' | '}
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
