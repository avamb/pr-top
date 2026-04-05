import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

function TagBadge({ tag }) {
  const colors = {
    question: 'bg-blue-100 text-blue-800',
    feature_request: 'bg-purple-100 text-purple-800',
    difficulty: 'bg-amber-100 text-amber-800',
    feedback: 'bg-green-100 text-green-800'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[tag] || 'bg-gray-100 text-gray-800'}`}>
      {tag ? tag.replace('_', ' ') : 'unknown'}
    </span>
  );
}

export default function AdminAssistantAnalytics() {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadAnalytics();
    loadConversations(1);
  }, []);

  async function loadAnalytics() {
    try {
      const res = await fetch(`${API_URL}/admin/assistant/analytics`, { headers });
      if (!res.ok) throw new Error('Failed to load analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversations(p) {
    try {
      const res = await fetch(`${API_URL}/admin/assistant/conversations?page=${p}&limit=20`, { headers });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data.conversations);
      setConversationTotal(data.total);
      setPage(p);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMessages(convId) {
    try {
      const res = await fetch(`${API_URL}/admin/assistant/conversations/${convId}/messages`, { headers });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setSelectedConversation(data.conversation);
      setConversationMessages(data.messages);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleExport(format) {
    try {
      const res = await fetch(`${API_URL}/admin/assistant/export?format=${format}`, { headers });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assistant_conversations.${format === 'csv' ? 'csv' : 'json'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: t('admin.assistantAnalytics.overview', 'Overview') },
    { key: 'conversations', label: t('admin.assistantAnalytics.conversations', 'Conversations') },
    { key: 'insights', label: t('admin.assistantAnalytics.insights', 'Insights') }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {t('admin.assistantAnalytics.title', 'Assistant Chat Analytics')}
          </h1>
          <p className="text-secondary text-sm mt-1">
            {t('admin.assistantAnalytics.subtitle', 'Monitor assistant usage, questions, and insights')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            📥 CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            📥 JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('admin.assistantAnalytics.totalConversations', 'Total Conversations')}
              value={analytics.total_conversations}
              icon="💬" color="bg-blue-50"
            />
            <StatCard
              label={t('admin.assistantAnalytics.totalMessages', 'Total Messages')}
              value={analytics.total_messages}
              icon="📝" color="bg-green-50"
            />
            <StatCard
              label={t('admin.assistantAnalytics.cachedResponses', 'Cached Responses')}
              value={analytics.cached_responses}
              icon="⚡" color="bg-amber-50"
            />
            <StatCard
              label={t('admin.assistantAnalytics.freshResponses', 'Fresh AI Responses')}
              value={analytics.fresh_responses}
              icon="🤖" color="bg-purple-50"
            />
          </div>

          {/* Tag Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              {t('admin.assistantAnalytics.messageCategories', 'Message Categories')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analytics.tag_breakdown).map(([tag, count]) => (
                <div key={tag} className="text-center p-4 bg-gray-50 rounded-lg">
                  <TagBadge tag={tag} />
                  <p className="text-2xl font-bold text-text mt-2">{count}</p>
                </div>
              ))}
              {Object.keys(analytics.tag_breakdown).length === 0 && (
                <p className="text-secondary col-span-4 text-center py-4">
                  {t('admin.assistantAnalytics.noData', 'No data yet')}
                </p>
              )}
            </div>
          </div>

          {/* Daily Usage Chart */}
          {analytics.daily_usage.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-text mb-4">
                {t('admin.assistantAnalytics.dailyUsage', 'Daily Usage (Last 30 Days)')}
              </h3>
              <div className="space-y-2">
                {analytics.daily_usage.map(day => {
                  const total = day.cached + day.fresh;
                  const maxVal = Math.max(...analytics.daily_usage.map(d => d.cached + d.fresh));
                  const pct = maxVal > 0 ? (total / maxVal) * 100 : 0;
                  const cachedPct = total > 0 ? (day.cached / total) * 100 : 0;
                  return (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="text-xs text-secondary w-20 flex-shrink-0">{day.date.slice(5)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="h-full flex" style={{ width: `${pct}%` }}>
                          <div className="bg-primary h-full" style={{ width: `${100 - cachedPct}%` }} title={`Fresh: ${day.fresh}`}></div>
                          <div className="bg-amber-400 h-full" style={{ width: `${cachedPct}%` }} title={`Cached: ${day.cached}`}></div>
                        </div>
                      </div>
                      <span className="text-xs text-secondary w-8 text-right">{total}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 mt-2 text-xs text-secondary">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary inline-block"></span> Fresh</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Cached</span>
                </div>
              </div>
            </div>
          )}

          {/* By Therapist */}
          {analytics.by_therapist.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-text mb-4">
                {t('admin.assistantAnalytics.byTherapist', 'Usage by Therapist')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3">{t('admin.assistantAnalytics.therapist', 'Therapist')}</th>
                      <th className="text-right py-2 px-3">{t('admin.assistantAnalytics.conversations', 'Conversations')}</th>
                      <th className="text-right py-2 px-3">{t('admin.assistantAnalytics.messages', 'Messages')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.by_therapist.map(t => (
                      <tr key={t.therapist_id} className="border-b border-border/50">
                        <td className="py-2 px-3">{t.email}</td>
                        <td className="text-right py-2 px-3">{t.conversations}</td>
                        <td className="text-right py-2 px-3">{t.messages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Language Breakdown */}
          {Object.keys(analytics.by_language).length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-text mb-4">
                {t('admin.assistantAnalytics.byLanguage', 'By Language')}
              </h3>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(analytics.by_language).map(([lang, count]) => (
                  <div key={lang} className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                    <p className="text-lg font-bold text-text">{count}</p>
                    <p className="text-xs text-secondary uppercase">{lang}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="space-y-4">
          {selectedConversation ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <button
                    onClick={() => { setSelectedConversation(null); setConversationMessages([]); }}
                    className="text-primary hover:underline text-sm mb-1"
                  >
                    ← {t('admin.assistantAnalytics.backToList', 'Back to list')}
                  </button>
                  <h3 className="text-lg font-semibold">
                    {t('admin.assistantAnalytics.conversationWith', 'Conversation')} #{selectedConversation.id}
                  </h3>
                  <p className="text-sm text-secondary">
                    {selectedConversation.email} · {selectedConversation.started_at} · {selectedConversation.language}
                    {selectedConversation.page_context && ` · ${selectedConversation.page_context}`}
                  </p>
                </div>
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {conversationMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user' ? 'bg-primary/10 text-text' : 'bg-gray-100 text-text'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-secondary">
                        <span>{msg.created_at}</span>
                        {msg.is_cached && <span className="text-amber-600">⚡ cached</span>}
                        {msg.tags && <TagBadge tag={msg.tags} />}
                      </div>
                    </div>
                  </div>
                ))}
                {conversationMessages.length === 0 && (
                  <p className="text-center text-secondary py-8">{t('admin.assistantAnalytics.noMessages', 'No messages')}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-border">
                      <th className="text-left py-3 px-4">ID</th>
                      <th className="text-left py-3 px-4">{t('admin.assistantAnalytics.therapist', 'Therapist')}</th>
                      <th className="text-left py-3 px-4">{t('admin.assistantAnalytics.startedAt', 'Started')}</th>
                      <th className="text-left py-3 px-4">{t('admin.assistantAnalytics.pageContext', 'Page')}</th>
                      <th className="text-center py-3 px-4">{t('admin.assistantAnalytics.lang', 'Lang')}</th>
                      <th className="text-center py-3 px-4">{t('admin.assistantAnalytics.msgs', 'Msgs')}</th>
                      <th className="text-right py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.map(conv => (
                      <tr key={conv.id} className="border-b border-border/50 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-xs">{conv.id}</td>
                        <td className="py-3 px-4">{conv.email}</td>
                        <td className="py-3 px-4 text-xs">{conv.started_at}</td>
                        <td className="py-3 px-4 text-xs">{conv.page_context || '-'}</td>
                        <td className="py-3 px-4 text-center text-xs uppercase">{conv.language}</td>
                        <td className="py-3 px-4 text-center">{conv.message_count}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => loadMessages(conv.id)}
                            className="text-primary hover:underline text-xs"
                          >
                            {t('admin.assistantAnalytics.view', 'View')}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {conversations.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-secondary">
                          {t('admin.assistantAnalytics.noConversations', 'No conversations yet')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {conversationTotal > 20 && (
                <div className="flex justify-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => loadConversations(page - 1)}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1 text-sm text-secondary">
                    {t('admin.assistantAnalytics.pageOf', 'Page')} {page}/{Math.ceil(conversationTotal / 20)}
                  </span>
                  <button
                    disabled={page >= Math.ceil(conversationTotal / 20)}
                    onClick={() => loadConversations(page + 1)}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Questions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              🔝 {t('admin.assistantAnalytics.topQuestions', 'Most Asked Questions')}
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {analytics.top_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                  <span className="text-xs bg-gray-100 text-secondary px-2 py-1 rounded font-mono flex-shrink-0">{q.count}×</span>
                  <p className="text-sm text-text">{q.question}</p>
                </div>
              ))}
              {analytics.top_questions.length === 0 && (
                <p className="text-center text-secondary py-4">{t('admin.assistantAnalytics.noData', 'No data yet')}</p>
              )}
            </div>
          </div>

          {/* Feature Requests */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              💡 {t('admin.assistantAnalytics.featureRequests', 'Feature Requests')}
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {analytics.feature_requests.map((fr, i) => (
                <div key={i} className="p-2 bg-purple-50 rounded text-sm text-text">{fr}</div>
              ))}
              {analytics.feature_requests.length === 0 && (
                <p className="text-center text-secondary py-4">{t('admin.assistantAnalytics.noFeatureRequests', 'No feature requests detected')}</p>
              )}
            </div>
          </div>

          {/* Difficulties */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              ⚠️ {t('admin.assistantAnalytics.difficulties', 'Common Difficulties')}
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {analytics.difficulties.map((d, i) => (
                <div key={i} className="p-2 bg-amber-50 rounded text-sm text-text">{d}</div>
              ))}
              {analytics.difficulties.length === 0 && (
                <p className="text-center text-secondary py-4">{t('admin.assistantAnalytics.noDifficulties', 'No difficulties detected')}</p>
              )}
            </div>
          </div>

          {/* Top Page Contexts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              📍 {t('admin.assistantAnalytics.topPages', 'Top Pages (Context)')}
            </h3>
            <div className="space-y-2">
              {analytics.top_contexts.map((ctx, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <span className="text-sm font-mono text-text">{ctx.context}</span>
                  <span className="text-xs bg-gray-100 text-secondary px-2 py-1 rounded">{ctx.count}</span>
                </div>
              ))}
              {analytics.top_contexts.length === 0 && (
                <p className="text-center text-secondary py-4">{t('admin.assistantAnalytics.noData', 'No data yet')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
