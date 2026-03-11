import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');

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
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-teal-600">PsyLink</h1>
            <nav className="flex gap-2 ml-4" aria-label="Main navigation">
              <button onClick={() => navigate('/dashboard')} className="text-sm text-stone-600 hover:text-teal-600 px-3 py-1 rounded transition-colors">Dashboard</button>
              <button onClick={() => navigate('/clients')} className="text-sm text-stone-600 hover:text-teal-600 px-3 py-1 rounded transition-colors">Clients</button>
              <button onClick={() => navigate('/analytics')} className="text-sm text-stone-600 hover:text-teal-600 px-3 py-1 rounded transition-colors">Analytics</button>
              <button className="text-sm text-teal-600 font-medium bg-teal-50 px-3 py-1 rounded">Settings</button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {profile && <span className="text-sm text-stone-500">{profile.email}</span>}
            <button
              onClick={handleLogout}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-stone-800 mb-6">Profile Settings</h2>

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
          <div className="bg-white rounded-lg shadow-md p-8">
            {/* Account info (read-only) */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-stone-700 mb-4">Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-500 mb-1">Email</label>
                  <p className="text-stone-800">{profile.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-500 mb-1">Role</label>
                  <p className="text-stone-800 capitalize">{profile.role}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-500 mb-1">Member since</label>
                  <p className="text-stone-800">{new Date(profile.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Editable settings */}
            <form onSubmit={handleSave}>
              <h3 className="text-lg font-semibold text-stone-700 mb-4">Preferences</h3>
              <div className="space-y-6">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-stone-700 mb-2">
                    Language
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
                    Timezone
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
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}
