import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = 'http://localhost:3001/api';

export default function AdminSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});
  const [formValues, setFormValues] = useState({});
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState([]);

  const SETTING_GROUPS = [
    {
      title: t('admin.trialConfig'),
      description: t('admin.trialConfigDesc'),
      fields: [
        { key: 'trial_duration_days', label: t('admin.trialDuration'), min: 1, max: 365 },
        { key: 'trial_client_limit', label: t('admin.trialClientLimit'), min: 1, max: 1000 },
        { key: 'trial_session_limit', label: t('admin.trialSessionLimit'), min: 1, max: 10000 },
      ]
    },
    {
      title: t('admin.basicLimits'),
      description: t('admin.basicLimitsDesc'),
      fields: [
        { key: 'basic_client_limit', label: t('admin.clientLimit'), min: 1, max: 1000 },
        { key: 'basic_session_limit', label: t('admin.sessionsPerMonth'), min: 1, max: 10000 },
      ]
    },
    {
      title: t('admin.proLimits'),
      description: t('admin.proLimitsDesc'),
      fields: [
        { key: 'pro_client_limit', label: t('admin.clientLimit'), min: 1, max: 10000 },
        { key: 'pro_session_limit', label: t('admin.sessionsPerMonth'), min: 1, max: 100000 },
      ]
    },
    {
      title: t('admin.pricingCents'),
      description: t('admin.pricingCentsDesc'),
      fields: [
        { key: 'basic_price_monthly', label: t('admin.basicPrice'), min: 100, max: 100000, isCents: true },
        { key: 'pro_price_monthly', label: t('admin.proPrice'), min: 100, max: 100000, isCents: true },
        { key: 'premium_price_monthly', label: t('admin.premiumPrice'), min: 100, max: 100000, isCents: true },
      ]
    }
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        if (data.user.role !== 'superadmin') {
          navigate('/dashboard');
          return;
        }
        loadSettings(token);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      });
  }, [navigate]);

  const loadSettings = async (token) => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        const values = {};
        for (const group of SETTING_GROUPS) {
          for (const field of group.fields) {
            values[field.key] = data.settings[field.key]?.value || '';
          }
        }
        setFormValues(values);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setErrors([]);

    try {
      const token = localStorage.getItem('token');
      const changedSettings = {};
      for (const [key, value] of Object.entries(formValues)) {
        const currentVal = settings[key]?.value || '';
        if (String(value) !== String(currentVal)) {
          changedSettings[key] = value;
        }
      }

      if (Object.keys(changedSettings).length === 0) {
        setMessage(t('admin.noChanges'));
        setSaving(false);
        return;
      }

      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: changedSettings })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || t('settings.settingsSaved'));
        if (data.errors) setErrors(data.errors);
        if (data.settings) {
          setSettings(data.settings);
          const values = {};
          for (const group of SETTING_GROUPS) {
            for (const field of group.fields) {
              values[field.key] = data.settings[field.key]?.value || '';
            }
          }
          setFormValues(values);
        }
      } else {
        setErrors([data.error || 'Failed to update settings']);
      }
    } catch (err) {
      setErrors(['Network error: ' + err.message]);
    } finally {
      setSaving(false);
    }
  };

  const formatCents = (cents) => {
    const num = parseInt(cents, 10);
    if (isNaN(num)) return '$0.00';
    return `$${(num / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-lg">{t('admin.loadingSettings')}</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-text">{t('admin.settingsTitle')}</h2>
          <p className="text-secondary mt-1">{t('admin.settingsSubtitle')}</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${errors.length > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
            {message}
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <ul className="list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-8">
          {SETTING_GROUPS.map((group) => (
            <div key={group.title} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-text mb-1">{group.title}</h3>
              <p className="text-sm text-secondary mb-4">{group.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-text mb-1">
                      {field.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={formValues[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      />
                      {field.isCents && (
                        <span className="text-sm text-secondary whitespace-nowrap">
                          {formatCents(formValues[field.key])}
                        </span>
                      )}
                    </div>
                    {settings[field.key]?.updated_at && (
                      <p className="text-xs text-secondary mt-1">
                        {t('admin.lastUpdated', { date: new Date(settings[field.key].updated_at).toLocaleDateString() })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {saving ? t('admin.savingSettings') : t('admin.saveSettings')}
          </button>
        </div>
      </main>
    </div>
  );
}
