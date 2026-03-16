import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatUserDateOnly } from '../utils/formatDate';

const API_URL = '/api';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-secondary">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
      </div>
    </div>
  );
}

function ActivityItem({ activity, t }) {
  const typeLabels = {
    diary_entry: t('dashboard.diaryEntry'),
    session: t('dashboard.session'),
    sos_event: t('dashboard.sosAlert'),
    note: t('dashboard.note')
  };

  const typeColors = {
    diary_entry: 'bg-blue-100 text-blue-700',
    session: 'bg-green-100 text-green-700',
    sos_event: 'bg-red-100 text-red-700',
    note: 'bg-amber-100 text-amber-700'
  };

  const typeIcons = {
    diary_entry: '\u{1F4D3}',
    session: '\u{1F3A7}',
    sos_event: '\u{1F6A8}',
    note: '\u{1F4DD}'
  };

  const clientName = activity.client_email || activity.client_telegram_id || `Client #${activity.client_id}`;
  const date = new Date(activity.created_at);
  const timeAgo = getTimeAgo(date, t);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <span className="text-xl">{typeIcons[activity.type] || '\u{1F4CB}'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text truncate">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${typeColors[activity.type] || 'bg-gray-100 text-gray-700'}`}>
            {typeLabels[activity.type] || activity.type}
          </span>
          <span className="font-medium">{clientName}</span>
        </p>
      </div>
      <span className="text-xs text-secondary whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

function getTimeAgo(date, t) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return t('dashboard.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('dashboard.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('dashboard.daysAgo', { count: days });
  return formatUserDateOnly(date);
}

function SubscriptionBadge({ subscription, t }) {
  if (!subscription) return null;

  const planColors = {
    trial: 'bg-amber-100 text-amber-800 border-amber-200',
    basic: 'bg-blue-100 text-blue-800 border-blue-200',
    pro: 'bg-purple-100 text-purple-800 border-purple-200',
    premium: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };

  const planName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
  let statusInfo = '';

  if (subscription.plan === 'trial' && subscription.trial_ends_at) {
    const daysLeft = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)));
    statusInfo = ` \u00B7 ${t('dashboard.daysLeft', { days: daysLeft })}`;
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${planColors[subscription.plan] || 'bg-gray-100 text-gray-800'}`}>
      {planName} {t('dashboard.plan')}{statusInfo}
    </span>
  );
}

function InviteCodeSection({ t }) {
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState(null);
  const [linkError, setLinkError] = useState(null);

  useEffect(() => {
    fetchInviteCode();
    fetchInviteLink();
  }, []);

  async function fetchInviteCode() {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/invite-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch invite code');
      const data = await res.json();
      setInviteCode(data.invite_code);
    } catch (err) {
      const friendly = err.message === 'Failed to fetch'
        ? 'Unable to connect to server.'
        : err.message;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInviteLink() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/invite-code/link`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data.error?.includes('BOT_USERNAME')) {
          setLinkError('bot_not_configured');
        }
        return;
      }
      const data = await res.json();
      setInviteLink(data.invite_link);
    } catch {
      // Link not available — silently degrade
    }
  }

  async function handleRegenerate() {
    try {
      setRegenerating(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/invite-code/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to regenerate invite code');
      const data = await res.json();
      setInviteCode(data.invite_code);
      setCopied(false);
      setLinkCopied(false);
      // Refresh invite link with new code
      fetchInviteLink();
    } catch (err) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  }

  async function handleShare() {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PR-TOP',
          text: t('dashboard.inviteLinkDesc'),
          url: inviteLink
        });
      } catch {
        // User cancelled share — fallback to copy
        handleCopyLink();
      }
    } else {
      // Web Share API not available — fallback to copy
      handleCopyLink();
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-text mb-3">{t('dashboard.inviteCode')}</h3>
      <p className="text-sm text-secondary mb-4">{t('dashboard.inviteCodeDesc')}</p>
      {loading ? (
        <div className="animate-pulse h-12 bg-gray-200 rounded w-48"></div>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-block bg-primary/10 text-primary font-mono text-2xl font-bold px-6 py-3 rounded-lg tracking-widest select-all"
              data-testid="invite-code"
            >
              {inviteCode}
            </span>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
              title="Copy invite code"
            >
              {copied ? t('dashboard.copied') : t('dashboard.copy')}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-4 py-2 text-sm font-medium text-secondary border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Generate a new invite code"
            >
              {regenerating ? t('dashboard.regenerating') : t('dashboard.regenerate')}
            </button>
          </div>

          {/* Invite deep link section */}
          {inviteLink && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-secondary mb-3">{t('dashboard.inviteLinkDesc')}</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block bg-gray-50 text-gray-700 font-mono text-sm px-3 py-2 rounded-lg break-all select-all border border-gray-200" data-testid="invite-link">
                  {inviteLink}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                  data-testid="copy-invite-link-btn"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  {linkCopied ? t('dashboard.inviteLinkCopied') : t('dashboard.copyInviteLink')}
                </button>
                <button
                  onClick={handleShare}
                  className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                  data-testid="share-invite-link-btn"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  {t('dashboard.shareInviteLink')}
                </button>
              </div>
            </div>
          )}
          {linkError === 'bot_not_configured' && (
            <p className="mt-3 text-xs text-amber-600">{t('dashboard.botNotConfigured')}</p>
          )}
          {linkCopied && (
            <div className="mt-2 text-sm text-green-600 font-medium animate-pulse">
              {t('dashboard.inviteLinkCopied')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const abortControllerRef = React.useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    fetchDashboardData(token);

    return () => {
      // Abort any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [navigate]);

  async function fetchDashboardData(token) {
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [statsRes, activityRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats`, { headers, signal: controller.signal }),
        fetch(`${API_URL}/dashboard/activity`, { headers, signal: controller.signal })
      ]);

      if (controller.signal.aborted) return;

      if (statsRes.status === 401 || activityRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      // Handle expired subscription - redirect to subscription page
      if (statsRes.status === 402 || activityRes.status === 402) {
        navigate('/subscription', { state: { expired: true } });
        return;
      }

      if (!statsRes.ok) throw new Error('Unable to load dashboard data. Please try again.');
      if (!activityRes.ok) throw new Error('Unable to load recent activity. Please try again.');

      const statsData = await statsRes.json();
      const activityData = await activityRes.json();

      if (!controller.signal.aborted) {
        setStats(statsData);
        setActivities(activityData.activities || []);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Dashboard fetch error:', err);
      const friendly = err.message === 'Failed to fetch'
        ? 'Unable to connect to server. Please check your connection and try again.'
        : err.message;
      if (!controller.signal.aborted) {
        setError(friendly);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  if (!user) return null;

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-xl font-bold text-primary">{t('dashboard.title')}</h1>
          <div className="flex items-center gap-4">
            {stats?.subscription && <SubscriptionBadge subscription={stats.subscription} t={t} />}
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{t('dashboard.failedToLoad')} {error}</span>
            <button
              onClick={() => fetchDashboardData(localStorage.getItem('token'))}
              className="ml-4 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium"
            >
              {t('dashboard.retry')}
            </button>
          </div>
        )}

        {(user.role === 'therapist' || user.role === 'superadmin') && (
          <section className="mb-8">
            <InviteCodeSection t={t} />
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text mb-4">{t('dashboard.quickStats')}</h2>
          {loading && !stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-12"></div>
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t('dashboard.clients')} value={stats.clients} icon={'\u{1F465}'} color="bg-blue-50" />
              <StatCard label={t('dashboard.sessions')} value={stats.sessions} icon={'\u{1F3A7}'} color="bg-green-50" />
              <StatCard label={t('dashboard.notes')} value={stats.notes} icon={'\u{1F4DD}'} color="bg-amber-50" />
              <StatCard label={t('dashboard.activeSos')} value={stats.active_sos} icon={'\u{1F6A8}'} color="bg-red-50" />
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            {loading && activities.length === 0 ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="flex-1"><div className="h-4 bg-gray-200 rounded w-3/4"></div></div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div>
                {activities.map((activity, idx) => (
                  <ActivityItem key={`${activity.type}-${activity.id}-${idx}`} activity={activity} t={t} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-secondary text-lg mb-2">{t('dashboard.noActivity')}</p>
                <p className="text-sm text-gray-400">{t('dashboard.noActivityHint')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Ask about a client - NL query shortcut */}
        <section className="mt-6 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🔍</span>
            <h2 className="text-lg font-semibold text-primary">{t('dashboard.askClient', 'Ask About a Client')}</h2>
          </div>
          <p className="text-sm text-secondary mb-3">
            {t('dashboard.askClientHint', 'Use natural language to search through client records, diary entries, and session notes.')}
          </p>
          <button
            onClick={() => navigate('/clients')}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
          >
            {t('dashboard.selectClient', 'Select a Client to Query')}
          </button>
        </section>

        {/* Need help? link */}
        <section className="mt-8 text-center">
          <button
            onClick={() => navigate('/dashboard/guide')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            {t('dashboard.needHelp')}
          </button>
        </section>
      </main>
    </div>
  );
}

export { getTimeAgo };
