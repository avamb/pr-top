import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

const LOCALES = ['en', 'ru', 'es', 'uk'];
const TEMPLATE_KEYS = ['day_before', 'day_of', 'opt_in'];

const TONE_OPTIONS = ['neutral', 'warm', 'brief'];

function ToggleSwitch({ checked, onChange, label, id }) {
  return (
    <div className="flex items-center justify-between py-3">
      <label htmlFor={id} className="text-sm text-stone-700 cursor-pointer">{label}</label>
      <button
        id={id}
        type="button"
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

/**
 * ReminderPolicyForm
 * Props:
 *   initialPolicy: object (from GET /api/settings/reminder-policy)
 *   onSaved: function(updatedPolicy) — called after a successful save
 */
export default function ReminderPolicyForm({ initialPolicy, onSaved }) {
  const { t } = useTranslation();

  const [enabled, setEnabled] = useState(!!initialPolicy?.enabled);
  const [tone, setTone] = useState(initialPolicy?.tone || 'neutral');
  const [rescheduleLeadHours, setRescheduleLeadHours] = useState(
    Number.isInteger(initialPolicy?.reschedule_lead_hours) ? initialPolicy.reschedule_lead_hours : 24
  );
  const [releaseLeadHours, setReleaseLeadHours] = useState(
    Number.isInteger(initialPolicy?.release_lead_hours) ? initialPolicy.release_lead_hours : 12
  );
  const [customTemplates, setCustomTemplates] = useState(
    (initialPolicy?.custom_templates && typeof initialPolicy.custom_templates === 'object')
      ? initialPolicy.custom_templates
      : {}
  );

  const [expandedLocale, setExpandedLocale] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Snapshot state for optimistic revert on error
  function getSnapshot() {
    return { enabled, tone, rescheduleLeadHours, releaseLeadHours, customTemplates };
  }

  function updateTemplate(locale, key, value) {
    setCustomTemplates(prev => ({
      ...prev,
      [locale]: {
        ...(prev[locale] || {}),
        [key]: value
      }
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const snapshot = getSnapshot();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const token = localStorage.getItem('token');
    const payload = {
      enabled,
      tone,
      reschedule_lead_hours: rescheduleLeadHours,
      release_lead_hours: releaseLeadHours,
      custom_templates: customTemplates
    };

    try {
      const res = await fetch(`${API_URL}/settings/reminder-policy`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        // Revert optimistic state
        setEnabled(snapshot.enabled);
        setTone(snapshot.tone);
        setRescheduleLeadHours(snapshot.rescheduleLeadHours);
        setReleaseLeadHours(snapshot.releaseLeadHours);
        setCustomTemplates(snapshot.customTemplates);
        setErrorMsg(data.error || t('reminders.settings.saveError'));
        return;
      }

      setSuccessMsg(t('reminders.settings.saved'));
      if (onSaved && data.reminder_policy) onSaved(data.reminder_policy);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      // Revert optimistic state
      setEnabled(snapshot.enabled);
      setTone(snapshot.tone);
      setRescheduleLeadHours(snapshot.rescheduleLeadHours);
      setReleaseLeadHours(snapshot.releaseLeadHours);
      setCustomTemplates(snapshot.customTemplates);
      setErrorMsg(t('reminders.settings.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="reminder-policy-form">
      {/* Success / Error banners */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm" data-testid="reminder-policy-success">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="reminder-policy-error">
          {errorMsg}
        </div>
      )}

      {/* Master enable toggle */}
      <ToggleSwitch
        id="reminder_policy_enabled"
        label={t('reminders.settings.enableLabel')}
        checked={enabled}
        onChange={setEnabled}
      />

      {/* Read-only info row */}
      <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mb-4 mt-1">
        {t('reminders.settings.scheduleInfo')}
      </p>

      {/* Tone radio group */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-stone-700 mb-2">
          {t('reminders.settings.toneLabel')}
        </label>
        <div className="flex gap-4 flex-wrap">
          {TONE_OPTIONS.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reminder_tone"
                value={opt}
                checked={tone === opt}
                onChange={() => setTone(opt)}
                className="accent-teal-600"
                data-testid={`tone-${opt}`}
              />
              <span className="text-sm text-stone-700">{t(`reminders.settings.tone.${opt}`)}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-1 italic">{t(`reminders.settings.toneHint.${tone}`)}</p>
      </div>

      {/* Reschedule lead hours slider */}
      <div className="mb-5">
        <label htmlFor="reschedule_lead_hours" className="block text-sm font-medium text-stone-700 mb-1">
          {t('reminders.settings.rescheduleLeadLabel', { hours: rescheduleLeadHours })}
        </label>
        <input
          id="reschedule_lead_hours"
          type="range"
          min={1}
          max={72}
          step={1}
          value={rescheduleLeadHours}
          onChange={e => setRescheduleLeadHours(Number(e.target.value))}
          className="w-full accent-teal-600"
          data-testid="reschedule-lead-slider"
        />
        <div className="flex justify-between text-xs text-stone-400 mt-0.5">
          <span>1h</span>
          <span className="font-medium text-teal-700">{rescheduleLeadHours}h</span>
          <span>72h</span>
        </div>
      </div>

      {/* Release lead hours slider */}
      <div className="mb-5">
        <label htmlFor="release_lead_hours" className="block text-sm font-medium text-stone-700 mb-1">
          {t('reminders.settings.releaseLeadLabel', { hours: releaseLeadHours })}
        </label>
        <input
          id="release_lead_hours"
          type="range"
          min={1}
          max={48}
          step={1}
          value={releaseLeadHours}
          onChange={e => setReleaseLeadHours(Number(e.target.value))}
          className="w-full accent-teal-600"
          data-testid="release-lead-slider"
        />
        <div className="flex justify-between text-xs text-stone-400 mt-0.5">
          <span>1h</span>
          <span className="font-medium text-teal-700">{releaseLeadHours}h</span>
          <span>48h</span>
        </div>
      </div>

      {/* Template overrides per locale (collapsed accordion) */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setExpandedLocale(prev => prev ? null : LOCALES[0])}
          className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-teal-700 transition-colors"
          data-testid="template-overrides-toggle"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expandedLocale ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {t('reminders.settings.templateOverridesLabel')}
        </button>

        {expandedLocale && (
          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
            {/* Locale tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {LOCALES.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setExpandedLocale(loc)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    expandedLocale === loc
                      ? 'bg-white text-teal-700 border-b-2 border-teal-600'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Template fields for selected locale */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-400 italic">{t('reminders.settings.templateOverridesHint')}</p>
              {TEMPLATE_KEYS.map(key => (
                <div key={key}>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    {t(`reminders.settings.templateKey.${key}`)}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={(customTemplates[expandedLocale] || {})[key] || ''}
                    onChange={e => updateTemplate(expandedLocale, key, e.target.value)}
                    placeholder={t('reminders.settings.templatePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y font-mono"
                    data-testid={`template-${expandedLocale}-${key}`}
                  />
                  <p className="text-xs text-stone-400 text-right mt-0.5">
                    {((customTemplates[expandedLocale] || {})[key] || '').length}/500
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          data-testid="reminder-policy-save-btn"
          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? t('reminders.settings.saving') : t('reminders.settings.save')}
        </button>
      </div>
    </form>
  );
}
