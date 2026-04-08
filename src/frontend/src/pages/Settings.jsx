import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatUserDateOnly } from '../utils/formatDate';

const API_URL = '/api';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'uk', label: 'Українська' }
];

// Build comprehensive timezone list using Intl API with fallback
const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Chicago',
  'America/Denver', 'America/Halifax', 'America/Lima', 'America/Los_Angeles', 'America/Mexico_City',
  'America/New_York', 'America/Phoenix', 'America/Santiago', 'America/Sao_Paulo', 'America/Toronto',
  'America/Vancouver',
  'Asia/Almaty', 'Asia/Baghdad', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Hong_Kong',
  'Asia/Istanbul', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Novosibirsk', 'Asia/Riyadh', 'Asia/Seoul',
  'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tbilisi', 'Asia/Tehran', 'Asia/Tokyo',
  'Asia/Vladivostok', 'Asia/Yekaterinburg',
  'Atlantic/Reykjavik',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Brussels',
  'Europe/Bucharest', 'Europe/Dublin', 'Europe/Helsinki', 'Europe/Kyiv', 'Europe/Lisbon',
  'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris',
  'Europe/Prague', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu'
];

function getAllTimezones() {
  try {
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
      return ['UTC', ...Intl.supportedValuesOf('timeZone')];
    }
  } catch (e) {
    // fallback
  }
  return FALLBACK_TIMEZONES;
}

function groupTimezones(tzList) {
  const groups = {};
  for (const tz of tzList) {
    if (tz === 'UTC') {
      if (!groups['UTC']) groups['UTC'] = [];
      groups['UTC'].push(tz);
      continue;
    }
    const slashIdx = tz.indexOf('/');
    const region = slashIdx > -1 ? tz.substring(0, slashIdx) : 'Other';
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  }
  // Sort regions: UTC first, then alphabetical
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'UTC') return -1;
    if (b === 'UTC') return 1;
    return a.localeCompare(b);
  });
  return sortedKeys.map(key => ({ region: key, zones: groups[key].sort() }));
}

const TIMEZONE_GROUPS = groupTimezones(getAllTimezones());

const DEFAULT_ESCALATION = {
  sos_telegram: true,
  sos_email: true,
  sos_web_push: true,
  sos_sound_alert: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  escalation_delay_minutes: 0,
  forward_voice_to_telegram: false
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [escalationSuccess, setEscalationSuccess] = useState(null);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [escalation, setEscalation] = useState(DEFAULT_ESCALATION);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [otherInfo, setOtherInfo] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);

  const abortControllerRef = React.useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    fetchProfile(token);
    fetchReferralLink(token);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function fetchReferralLink(token) {
    setReferralLoading(true);
    setReferralError('');
    try {
      const res = await fetch(`${API_URL}/user/referral-link`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        setReferralError(t('settings.referralError'));
        return;
      }
      const data = await res.json();
      setReferralLink(data.referral_link || '');
    } catch (err) {
      setReferralError(t('settings.referralError'));
    } finally {
      setReferralLoading(false);
    }
  }

  async function handleCopyReferral() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    }
  }

  async function fetchProfile(token) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/settings/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      if (!controller.signal.aborted) {
        setProfile(data.profile);
        setLanguage(data.profile.language || 'en');
        setTimezone(data.profile.timezone || 'UTC');
        setEscalation({ ...DEFAULT_ESCALATION, ...(data.profile.escalation_preferences || {}) });
        setFirstName(data.profile.first_name || '');
        setLastName(data.profile.last_name || '');
        setPhone(data.profile.phone || '');
        setTelegramUsername(data.profile.telegram_username || '');
        setOtherInfo(data.profile.other_info || '');
        // Sync i18n language with profile
        const lang = data.profile.language || 'en';
        if (i18n.language !== lang) {
          i18n.changeLanguage(lang);
          localStorage.setItem('app_language', lang);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setError(err.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
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
      // Also sync language to dedicated endpoint for consistency
      try {
        await fetch(`${API_URL}/profile/language`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ language })
        });
      } catch (e) { /* already saved via PUT */ }
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

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setError(null);
    setProfileSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone, telegram_username: telegramUsername, other_info: otherInfo })
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
      setFirstName(data.profile.first_name || '');
      setLastName(data.profile.last_name || '');
      setPhone(data.profile.phone || '');
      setTelegramUsername(data.profile.telegram_username || '');
      setOtherInfo(data.profile.other_info || '');
      setProfileSuccess(t('settings.profileSaved'));
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
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
            {/* Personal Information Section */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
              <h3 className="text-lg font-semibold text-stone-700 mb-4">{t('settings.personalInfo')}</h3>

              {profileSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {profileSuccess}
                </div>
              )}

              <form onSubmit={handleSaveProfile}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-stone-700 mb-2">
                      {t('settings.firstName')}
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t('settings.firstNamePlaceholder')}
                      maxLength={100}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-stone-700 mb-2">
                      {t('settings.lastName')}
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={t('settings.lastNamePlaceholder')}
                      maxLength={100}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-stone-700 mb-2">
                      {t('settings.phone')}
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('settings.phonePlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="telegramUsername" className="block text-sm font-medium text-stone-700 mb-2">
                      {t('settings.telegramUsername')}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">@</span>
                      <input
                        id="telegramUsername"
                        type="text"
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ''))}
                        placeholder={t('settings.telegramUsernamePlaceholder')}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="otherInfo" className="block text-sm font-medium text-stone-700 mb-2">
                    {t('settings.otherInfo')}
                  </label>
                  <textarea
                    id="otherInfo"
                    value={otherInfo}
                    onChange={(e) => setOtherInfo(e.target.value)}
                    placeholder={t('settings.otherInfoPlaceholder')}
                    maxLength={1000}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors resize-y"
                  />
                  <p className="text-xs text-stone-400 mt-1">{otherInfo.length}/1000</p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {savingProfile && <LoadingSpinner size={16} className="mr-2" />}
                    {savingProfile ? t('settings.saving') : t('settings.saveProfile')}
                  </button>
                </div>
              </form>
            </div>

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
                      {TIMEZONE_GROUPS.map(group => (
                        group.region === 'UTC' ? (
                          group.zones.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))
                        ) : (
                          <optgroup key={group.region} label={group.region}>
                            {group.zones.map(tz => {
                              const city = tz.substring(tz.indexOf('/') + 1).replace(/_/g, ' ');
                              return <option key={tz} value={tz}>{city}</option>;
                            })}
                          </optgroup>
                        )
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

            {/* Referral Link Section */}
            {(profile.role === 'therapist' || profile.role === 'superadmin') && (
              <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h3 className="text-lg font-semibold text-stone-700 mb-2">{t('settings.referralTitle')}</h3>
                <p className="text-sm text-stone-500 mb-4">{t('settings.referralDesc')}</p>

                {referralLoading ? (
                  <p className="text-sm text-stone-400">{t('settings.referralLoading')}</p>
                ) : referralError ? (
                  <p className="text-sm text-red-500">{referralError}</p>
                ) : referralLink ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-stone-700 text-sm font-mono select-all"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={handleCopyReferral}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        referralCopied
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {referralCopied ? t('settings.referralCopied') : t('settings.referralCopy')}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

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
                    <h4 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">{t('settings.voiceForwardingTitle')}</h4>
                    <p className="text-xs text-stone-500 mb-3">{t('settings.voiceForwardingDesc')}</p>
                    <ToggleSwitch
                      id="forward_voice_to_telegram"
                      label={t('settings.forwardVoiceToTelegram')}
                      checked={escalation.forward_voice_to_telegram}
                      onChange={(v) => updateEscalation('forward_voice_to_telegram', v)}
                    />
                    <p className="text-xs text-stone-400 mt-1 italic">{t('settings.voiceForwardingDisclaimer')}</p>
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
