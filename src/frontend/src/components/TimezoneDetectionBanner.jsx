import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';
const DISMISSED_KEY_PREFIX = 'timezone_confirmed_';

/**
 * Non-intrusive banner shown to therapists whose timezone is 'UTC' (default).
 * Auto-detects browser timezone and prompts to confirm or change.
 * Only shown once per user - dismissed state persisted in localStorage.
 */
export default function TimezoneDetectionBanner({ user }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [browserTz, setBrowserTz] = useState('UTC');
  const [saving, setSaving] = useState(false);

  const dismissedKey = user ? `${DISMISSED_KEY_PREFIX}${user.id || user.email}` : null;

  useEffect(() => {
    if (!user || !dismissedKey) return;
    // Only show for therapists/superadmins with UTC or empty timezone
    if (user.role !== 'therapist' && user.role !== 'superadmin') return;

    // Check if already dismissed for this user
    if (localStorage.getItem(dismissedKey)) return;

    // Check user's current timezone
    const userTz = user.timezone || 'UTC';
    if (userTz !== 'UTC') return;

    // Detect browser timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected !== 'UTC') {
        setBrowserTz(detected);
        setVisible(true);
      }
    } catch {
      // Intl not supported - don't show banner
    }
  }, [user]);

  async function handleConfirm() {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timezone: browserTz })
      });

      if (res.ok) {
        // Update localStorage user object
        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          storedUser.timezone = browserTz;
          localStorage.setItem('user', JSON.stringify(storedUser));
        } catch { /* ignore */ }
      }
    } catch { /* ignore errors - timezone will stay UTC */ }

    localStorage.setItem(dismissedKey, 'true');
    setVisible(false);
    setSaving(false);
  }

  function handleChange() {
    localStorage.setItem(dismissedKey, 'true');
    setVisible(false);
    navigate('/settings');
  }

  if (!visible) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <span className="text-blue-800 text-sm flex-1">
          🕐 {t('settings.timezoneBannerMessage', { timezone: browserTz })}
        </span>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : t('settings.timezoneBannerConfirm')}
          </button>
          <button
            onClick={handleChange}
            className="px-3 py-1.5 text-sm font-medium bg-white text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            {t('settings.timezoneBannerChange')}
          </button>
        </div>
      </div>
    </div>
  );
}
