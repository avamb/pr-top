import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatUserDateOnly } from '../utils/formatDate';

const API_URL = 'http://localhost:3001/api';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' }
];

const TIMEZONES = [
  'UTC',
  'Europe/Moscow',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney'
];

const DEFAULT_ESCALATION = {
  sos_telegram: true,
  sos_email: true,
  sos_web_push: true,
  sos_sound_alert: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  escalation_delay_minutes: 0
};

function ToggleSwitch({ checked, onChange, label, id }) {
  return (
    <div className="flex items-center justify-between py-3">
      <label htmlFor={id} className="text-sm text-stone-700 cursor-pointer">{label}</label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-teal-600' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [escalationSuccess, setEscalationSuccess] = useState(null);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [escalation, setEscalation] = useState(DEFAULT_ESCALATION);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    fetchProfile(token);
  }, []);

  async function fetchProfile(token) {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/settings/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setProfile(data.profile);
      setLanguage(data.profile.language || 'en');
      setTimezone(data.profile.timezone || 'UTC');
      setEscalation({ ...DEFAULT_ESCALATION, ...(data.profile.escalation_preferences || {}) });
      // Sync i18n language with profile
      const lang = data.profile.language || 'en';
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang);
        localStorage.setItem('app_language', lang);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language, timezone })
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const data = await res.json();
      setProfile(data.profile);
      // Switch i18n language immediately
      i18n.changeLanguage(language);
      localStorage.setItem('app_language', language);
      // Update user timezone in localStorage for formatDate utility
      try {
        var storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.timezone = timezone;
        localStorage.setItem('user', JSON.stringify(storedUser));
      } catch (e) { /* ignore */ }
      setSuccess(t('settings.settingsSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEscalation(e) {
    e.preventDefault();
    if (savingEscalation) return;
    setSavingEscalation(true);
    setError(null);
    setEscalationSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/escalation`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ escalation_preferences: escalation })
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update escalation preferences');
      }

      const data = await res.json();
      setEscalation({ ...DEFAULT_ESCALATION, ...data.escalation_preferences });
      setEscalationSuccess(t('settings.escalationSaved'));
      setTimeout(() => setEscalationSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEscalation(false);
    }
  }

  function updateEscalation(key, value) {
    setEscalation(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-stone-800 mb-6">{t('settings.title')}</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ) : profile ? (
          <>
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
              {/* Account info (read-only) */}
              <div className="mb-8 pb-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-stone-700 mb-4">{t('settings.accountInfo')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-500 mb-1">{t('settings.email')}</label>
                    <p className="text-stone-800">{profile.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-500 mb-1">{t('settings.role')}</label>
                    <p className="text-stone-800 capitalize">{profile.role}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-500 mb-1">{t('settings.memberSince')}</label>
                    <p className="text-stone-800">{formatUserDateOnly(profile.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Editable settings */}
              <form onSubmit={handleSave}>
                <h3 className="text-lg font-semibold text-stone-700 mb-4">{t('settings.preferences')}</h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="language" className="block text-sm font-medium text-stone-700 mb-2">
                      {t('settings.language')}
                    </label>
                    <select
                      id="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors bg-white"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="timezone" className="block text-sm font-medium text-stone-700 mb-2">
                      {t('settings.timezone')}
                    </label>
                    <select
                      id="timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors bg-white"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {saving && <LoadingSpinner size={16} className="mr-2" />}
                      {saving ? t('settings.saving') : t('settings.saveChanges')}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Escalation Preferences Section */}
            {(profile.role === 'therapist' || profile.role === 'superadmin') && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h3 className="text-lg font-semibold text-stone-700 mb-2">{t('settings.escalationTitle')}</h3>
                <p className="text-sm text-stone-500 mb-6">{t('settings.escalationDesc')}</p>

                {escalationSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    {escalationSuccess}
                  </div>
                )}

                <form onSubmit={handleSaveEscalation}>
                  <div className="space-y-1 mb-6">
                    <h4 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">{t('settings.notificationChannels')}</h4>
                    <ToggleSwitch
                      id="sos_telegram"
                      label={t('settings.telegramNotifications')}
                      checked={escalation.sos_telegram}
                      onChange={(v) => updateEscalation('sos_telegram', v)}
                    />
                    <ToggleSwitch
                      id="sos_email"
                      label={t('settings.emailNotifications')}
                      checked={escalation.sos_email}
                      onChange={(v) => updateEscalation('sos_email', v)}
                    />
                    <ToggleSwitch
                      id="sos_web_push"
                      label={t('settings.webPushNotifications')}
                      checked={escalation.sos_web_push}
                      onChange={(v) => updateEscalation('sos_web_push', v)}
                    />
                    <ToggleSwitch
                      id="sos_sound_alert"
                      label={t('settings.soundAlert')}
                      checked={escalation.sos_sound_alert}
                      onChange={(v) => updateEscalation('sos_sound_alert', v)}
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-6 mb-6">
                    <h4 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">{t('settings.quietHours')}</h4>
                    <ToggleSwitch
                      id="quiet_hours_enabled"
                      label={t('settings.quietHoursEnable')}
                      checked={escalation.quiet_hours_enabled}
                      onChange={(v) => updateEscalation('quiet_hours_enabled', v)}
                    />
                    {escalation.quiet_hours_enabled && (
                      <div className="flex gap-4 mt-3">
                        <div className="flex-1">
                          <label htmlFor="quiet_start" className="block text-xs text-stone-500 mb-1">{t('settings.quietStart')}</label>
                          <input
                            id="quiet_start"
                            type="time"
                            value={escalation.quiet_hours_start}
                            onChange={(e) => updateEscalation('quiet_hours_start', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label htmlFor="quiet_end" className="block text-xs text-stone-500 mb-1">{t('settings.quietEnd')}</label>
                          <input
                            id="quiet_end"
                            type="time"
                            value={escalation.quiet_hours_end}
                            onChange={(e) => updateEscalation('quiet_hours_end', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-6 mb-6">
                    <h4 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">{t('settings.escalationDelay')}</h4>
                    <div>
                      <label htmlFor="escalation_delay" className="block text-sm text-stone-700 mb-2">
                        {t('settings.delayLabel')}
                      </label>
                      <select
                        id="escalation_delay"
                        value={escalation.escalation_delay_minutes}
                        onChange={(e) => updateEscalation('escalation_delay_minutes', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors bg-white text-sm"
                      >
                        <option value={0}>{t('settings.delayImmediate')}</option>
                        <option value={5}>{t('settings.delayMinutes', { count: 5 })}</option>
                        <option value={10}>{t('settings.delayMinutes', { count: 10 })}</option>
                        <option value={15}>{t('settings.delayMinutes', { count: 15 })}</option>
                        <option value={30}>{t('settings.delayMinutes', { count: 30 })}</option>
                        <option value={60}>{t('settings.delayMinutes', { count: 60 })}</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingEscalation}
                      className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {savingEscalation && <LoadingSpinner size={16} className="mr-2" />}
                      {savingEscalation ? t('settings.saving') : t('settings.saveEscalation')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
