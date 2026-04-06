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

function RatingBadge({ rating }) {
  const colors = {
    good: 'text-green-600',
    bad: 'text-red-600',
    neutral: 'text-gray-500'
  };
  const icons = { good: '👍', bad: '👎', neutral: '➖' };
  return (
    <span className={`text-sm ${colors[rating] || 'text-gray-500'}`}>
      {icons[rating] || ''}
    </span>
  );
}

function CommentForm({ messageId, existingComment, onSave, onCancel, t }) {
  const [rating, setRating] = useState(existingComment?.rating || 'neutral');
  const [commentText, setCommentText] = useState(existingComment?.comment_text || '');
  const [correctionText, setCorrectionText] = useState(existingComment?.correction_text || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ rating, comment_text: commentText, correction_text: correctionText });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 bg-gray-50 rounded-lg border border-border space-y-3">
      <div>
        <label className="block text-xs font-medium text-secondary mb-1">
          {t('admin.assistantAnalytics.rating', 'Rating')}
        </label>
        <div className="flex gap-2">
          {['good', 'bad', 'neutral'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                rating === r
                  ? r === 'good' ? 'bg-green-100 border-green-300 text-green-800'
                    : r === 'bad' ? 'bg-red-100 border-red-300 text-red-800'
                    : 'bg-gray-200 border-gray-300 text-gray-800'
                  : 'bg-white border-border text-secondary hover:bg-gray-50'
              }`}
            >
              {r === 'good' ? '👍' : r === 'bad' ? '👎' : '➖'} {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-secondary mb-1">
          {t('admin.assistantAnalytics.commentText', 'Comment (optional)')}
        </label>
        <textarea
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
          rows={2}
          placeholder={t('admin.assistantAnalytics.commentPlaceholder', 'Add your feedback about this response...')}
        />
      </div>
      {rating === 'bad' && (
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            {t('admin.assistantAnalytics.correctionText', 'Correction — what should the assistant have said?')}
          </label>
          <textarea
            value={correctionText}
            onChange={e => setCorrectionText(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
            rows={3}
            placeholder={t('admin.assistantAnalytics.correctionPlaceholder', 'Provide the correct response to cache for future similar questions...')}
          />
          <p className="text-xs text-secondary mt-1">
            {t('admin.assistantAnalytics.correctionHint', 'This correction will be cached so the assistant gives a better answer next time.')}
          </p>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-gray-100 transition-colors"
        >
          {t('admin.assistantAnalytics.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : existingComment ? t('admin.assistantAnalytics.updateComment', 'Update') : t('admin.assistantAnalytics.saveComment', 'Save')}
        </button>
      </div>
    </form>
  );
}

function MessageComments({ messageId, t }) {
  const [comments, setComments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function loadComments() {
    try {
      const res = await fetch(`${API_URL}/admin/assistant/messages/${messageId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
    setLoaded(true);
  }

  function handleExpand() {
    if (!loaded) loadComments();
    setExpanded(!expanded);
  }

  async function handleSave(formData) {
    try {
      if (editingComment) {
        const res = await fetch(`${API_URL}/admin/assistant/comments/${editingComment.id}`, {
          method: 'PUT', headers, body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to update');
      } else {
        const res = await fetch(`${API_URL}/admin/assistant/messages/${messageId}/comments`, {
          method: 'POST', headers, body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to create');
      }
      setShowForm(false);
      setEditingComment(null);
      await loadComments();
    } catch (err) {
      console.error('Comment save error:', err);
    }
  }

  async function handleDelete(commentId) {
    if (!confirm(t('admin.assistantAnalytics.deleteConfirm', 'Delete this comment?'))) return;
    try {
      await fetch(`${API_URL}/admin/assistant/comments/${commentId}`, {
        method: 'DELETE', headers
      });
      await loadComments();
    } catch (err) {
      console.error('Comment delete error:', err);
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={handleExpand}
        className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1"
      >
        💬 {t('admin.assistantAnalytics.feedback', 'Feedback')}
        {comments.length > 0 && <span className="bg-primary/10 text-primary px-1.5 rounded-full text-xs">{comments.length}</span>}
        <span className="text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {comments.map(comment => (
            <div key={comment.id} className="p-2 bg-yellow-50 rounded border border-yellow-200 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RatingBadge rating={comment.rating} />
                  <span className="text-secondary">{comment.admin_email}</span>
                  <span className="text-secondary">{comment.created_at}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingComment(comment); setShowForm(true); }}
                    className="text-primary hover:underline"
                  >
                    {t('admin.assistantAnalytics.edit', 'Edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-red-500 hover:underline"
                  >
                    {t('admin.assistantAnalytics.delete', 'Delete')}
                  </button>
                </div>
              </div>
              {comment.comment_text && <p className="mt-1 text-text">{comment.comment_text}</p>}
              {comment.correction_text && (
                <div className="mt-1 p-1.5 bg-blue-50 rounded border border-blue-200">
                  <span className="font-medium text-blue-700">{t('admin.assistantAnalytics.correction', 'Correction:')}</span>{' '}
                  <span className="text-text">{comment.correction_text}</span>
                </div>
              )}
            </div>
          ))}

          {!showForm ? (
            <button
              onClick={() => { setShowForm(true); setEditingComment(null); }}
              className="text-xs text-primary hover:underline"
            >
              + {t('admin.assistantAnalytics.addComment', 'Add feedback')}
            </button>
          ) : (
            <CommentForm
              messageId={messageId}
              existingComment={editingComment}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingComment(null); }}
              t={t}
            />
          )}
        </div>
      )}
    </div>
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

  // AI Summary state
  const [summaryDateFrom, setSummaryDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [summaryDateTo, setSummaryDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaryTherapistId, setSummaryTherapistId] = useState('');
  const [summaryTags, setSummaryTags] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);
  const [summaryMeta, setSummaryMeta] = useState(null);
  const [summaryStreamText, setSummaryStreamText] = useState('');

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

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryResult(null);
    setSummaryStreamText('');
    setSummaryMeta(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/admin/assistant/summary`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: summaryDateFrom,
          dateTo: summaryDateTo,
          therapistId: summaryTherapistId || undefined,
          tags: summaryTags.length > 0 ? summaryTags : undefined
        })
      });

      // Check content type - JSON means non-streaming response (no conversations, or error)
      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        const errData = contentType.includes('json') ? await res.json().catch(() => ({})) : {};
        throw new Error(errData.error || 'Failed to generate summary');
      }

      // If response is JSON (no conversations found), handle directly
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setSummaryResult(data.summary);
        setSummaryMeta(data.meta);
        setSummaryLoading(false);
        return;
      }

      // Handle SSE streaming
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'meta') {
              setSummaryMeta(parsed);
            } else if (parsed.type === 'chunk') {
              streamedText += parsed.text;
              setSummaryStreamText(streamedText);
            } else if (parsed.type === 'done') {
              setSummaryResult(parsed.summary);
              setSummaryMeta(prev => ({ ...prev, ...parsed.meta }));
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              console.warn('SSE parse error:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleExportSummary() {
    if (!summaryResult) return;
    try {
      const res = await fetch(`${API_URL}/admin/assistant/summary/export`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryResult, meta: summaryMeta })
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assistant-summary-${summaryDateFrom}-to-${summaryDateTo}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleSummaryTag(tag) {
    setSummaryTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function handleExportComments(format) {
    try {
      const res = await fetch(`${API_URL}/admin/assistant/comments/export?format=${format}`, { headers });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assistant_admin_comments.${format === 'csv' ? 'csv' : 'json'}`;
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
    { key: 'insights', label: t('admin.assistantAnalytics.insights', 'Insights') },
    { key: 'ai-summary', label: t('admin.assistantAnalytics.aiSummary', 'AI Summary') }
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
          <button
            onClick={() => handleExportComments('json')}
            className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
            title={t('admin.assistantAnalytics.exportTrainingData', 'Export training data (comments)')}
          >
            🧠 {t('admin.assistantAnalytics.exportTraining', 'Training Data')}
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
                        {msg.latest_rating && <RatingBadge rating={msg.latest_rating} />}
                        {msg.comment_count > 0 && (
                          <span className="bg-yellow-100 text-yellow-800 px-1.5 rounded-full text-xs">
                            {msg.comment_count} {msg.comment_count === 1 ? 'comment' : 'comments'}
                          </span>
                        )}
                      </div>
                      {/* Admin comment/feedback section for assistant messages */}
                      {msg.role === 'assistant' && (
                        <MessageComments messageId={msg.id} t={t} />
                      )}
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

          {/* Feature Requests from Therapists (enhanced) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-3 flex items-center gap-2">
              💡 {t('admin.assistantAnalytics.featureRequestsFromTherapists', 'Feature Requests from Therapists')}
              {analytics.feature_request_details?.length > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{analytics.feature_request_details.length}</span>
              )}
            </h3>
            {analytics.feedback_prompt_stats && (
              <p className="text-xs text-secondary mb-3">
                {t('admin.assistantAnalytics.feedbackPromptStats', 'Proactive feedback prompts sent to')} {analytics.feedback_prompt_stats.therapists_prompted} {t('admin.assistantAnalytics.therapists', 'therapists')}
                {analytics.feedback_prompt_stats.total_prompts > 0 && ` (${analytics.feedback_prompt_stats.total_prompts} ${t('admin.assistantAnalytics.totalPrompts', 'total prompts')})`}
              </p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(analytics.feature_request_details || analytics.feature_requests?.map(fr => ({ content: fr })) || []).map((fr, i) => (
                <div key={i} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-sm text-text">{fr.content || fr}</p>
                  {fr.therapist && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-secondary">
                      <span>{fr.therapist}</span>
                      {fr.created_at && <span>· {fr.created_at}</span>}
                      {fr.language && <span className="uppercase bg-purple-100 text-purple-700 px-1.5 rounded">{fr.language}</span>}
                    </div>
                  )}
                </div>
              ))}
              {(!analytics.feature_request_details || analytics.feature_request_details.length === 0) && analytics.feature_requests.length === 0 && (
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

      {/* AI Summary Tab */}
      {activeTab === 'ai-summary' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              🧠 {t('admin.assistantAnalytics.aiSummaryTitle', 'AI-Powered Conversation Summary')}
            </h3>
            <p className="text-sm text-secondary mb-4">
              {t('admin.assistantAnalytics.aiSummaryDesc', 'Analyze all assistant conversations for the selected period. AI will extract feature requests, bugs, FAQ, trends, and recommendations.')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Date From */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('admin.assistantAnalytics.dateFrom', 'From')}
                </label>
                <input
                  type="date"
                  value={summaryDateFrom}
                  onChange={e => setSummaryDateFrom(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              {/* Date To */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('admin.assistantAnalytics.dateTo', 'To')}
                </label>
                <input
                  type="date"
                  value={summaryDateTo}
                  onChange={e => setSummaryDateTo(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              {/* Therapist Filter */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('admin.assistantAnalytics.therapistFilter', 'Therapist (optional)')}
                </label>
                <select
                  value={summaryTherapistId}
                  onChange={e => setSummaryTherapistId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="">{t('admin.assistantAnalytics.allTherapists', 'All therapists')}</option>
                  {analytics && analytics.by_therapist && analytics.by_therapist.map(th => (
                    <option key={th.therapist_id} value={th.therapist_id}>{th.email}</option>
                  ))}
                </select>
              </div>
              {/* Generate Button */}
              <div className="flex items-end">
                <button
                  onClick={generateSummary}
                  disabled={summaryLoading}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  {summaryLoading ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      {t('admin.assistantAnalytics.generating', 'Analyzing...')}
                    </>
                  ) : (
                    <>🔍 {t('admin.assistantAnalytics.generateSummary', 'Generate Summary')}</>
                  )}
                </button>
              </div>
            </div>

            {/* Tag Filters */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">
                {t('admin.assistantAnalytics.filterByTags', 'Filter by message tags (optional)')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {['question', 'feature_request', 'difficulty', 'feedback'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleSummaryTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      summaryTags.includes(tag)
                        ? tag === 'question' ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : tag === 'feature_request' ? 'bg-purple-100 border-purple-300 text-purple-800'
                          : tag === 'difficulty' ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-white border-border text-secondary hover:bg-gray-50'
                    }`}
                  >
                    {tag.replace('_', ' ')}
                  </button>
                ))}
                {summaryTags.length > 0 && (
                  <button
                    onClick={() => setSummaryTags([])}
                    className="px-3 py-1.5 text-xs text-secondary hover:text-text transition-colors"
                  >
                    {t('admin.assistantAnalytics.clearFilters', 'Clear filters')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Meta info */}
          {summaryMeta && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-center gap-4">
              <span>📊 {t('admin.assistantAnalytics.analyzed', 'Analyzed')}: {summaryMeta.conversations_analyzed} {t('admin.assistantAnalytics.conversations', 'conversations')}, {summaryMeta.messages_analyzed} {t('admin.assistantAnalytics.messages', 'messages')}</span>
              {summaryMeta.model && <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">🤖 {summaryMeta.provider}/{summaryMeta.model}</span>}
            </div>
          )}

          {/* Streaming indicator */}
          {summaryLoading && summaryStreamText && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></span>
                <span className="text-sm font-medium text-secondary">{t('admin.assistantAnalytics.aiAnalyzing', 'AI is analyzing conversations...')}</span>
              </div>
              <pre className="text-xs text-secondary bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                {summaryStreamText}
              </pre>
            </div>
          )}

          {/* Results */}
          {summaryResult && (
            <div className="space-y-6">
              {/* Export button */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleExportSummary}
                  className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  📥 {t('admin.assistantAnalytics.exportJSON', 'Export JSON')}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feature Requests */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    💡 {t('admin.assistantAnalytics.featureRequests', 'Feature Requests')}
                    {summaryResult.feature_requests?.length > 0 && (
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{summaryResult.feature_requests.length}</span>
                    )}
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(summaryResult.feature_requests || []).map((fr, i) => (
                      <div key={i} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-sm text-text">{fr.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            fr.priority === 'high' ? 'bg-red-100 text-red-700' :
                            fr.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{fr.priority}</span>
                        </div>
                        <p className="text-xs text-secondary mt-1">{fr.description}</p>
                        {fr.frequency > 1 && <span className="text-xs text-purple-600 mt-1 inline-block">×{fr.frequency} mentions</span>}
                      </div>
                    ))}
                    {(!summaryResult.feature_requests || summaryResult.feature_requests.length === 0) && (
                      <p className="text-center text-secondary text-sm py-4">{t('admin.assistantAnalytics.noFeatureRequests', 'No feature requests detected')}</p>
                    )}
                  </div>
                </div>

                {/* Bugs */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    🐛 {t('admin.assistantAnalytics.bugsFound', 'Bugs & Issues')}
                    {summaryResult.bugs?.length > 0 && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{summaryResult.bugs.length}</span>
                    )}
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(summaryResult.bugs || []).map((bug, i) => (
                      <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-sm text-text">{bug.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            bug.severity === 'critical' ? 'bg-red-200 text-red-800' :
                            bug.severity === 'high' ? 'bg-red-100 text-red-700' :
                            bug.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{bug.severity}</span>
                        </div>
                        <p className="text-xs text-secondary mt-1">{bug.description}</p>
                      </div>
                    ))}
                    {(!summaryResult.bugs || summaryResult.bugs.length === 0) && (
                      <p className="text-center text-secondary text-sm py-4">{t('admin.assistantAnalytics.noBugs', 'No bugs detected')}</p>
                    )}
                  </div>
                </div>

                {/* FAQ */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    ❓ {t('admin.assistantAnalytics.faqTitle', 'Frequently Asked Questions')}
                    {summaryResult.faq?.length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{summaryResult.faq.length}</span>
                    )}
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(summaryResult.faq || []).map((item, i) => (
                      <div key={i} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-sm text-text">{item.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.frequency > 1 && <span className="text-xs text-blue-600">×{item.frequency}</span>}
                          {item.category && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{item.category}</span>}
                        </div>
                      </div>
                    ))}
                    {(!summaryResult.faq || summaryResult.faq.length === 0) && (
                      <p className="text-center text-secondary text-sm py-4">{t('admin.assistantAnalytics.noFaq', 'No FAQ patterns detected')}</p>
                    )}
                  </div>
                </div>

                {/* Trends */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                    📈 {t('admin.assistantAnalytics.trendsTitle', 'Usage Trends & Patterns')}
                    {summaryResult.trends?.length > 0 && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{summaryResult.trends.length}</span>
                    )}
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(summaryResult.trends || []).map((trend, i) => (
                      <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-text">{trend.trend}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                            trend.impact === 'high' ? 'bg-red-100 text-red-700' :
                            trend.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{trend.impact}</span>
                        </div>
                      </div>
                    ))}
                    {(!summaryResult.trends || summaryResult.trends.length === 0) && (
                      <p className="text-center text-secondary text-sm py-4">{t('admin.assistantAnalytics.noTrends', 'No trends detected')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommendations - full width */}
              {summaryResult.recommendations && summaryResult.recommendations.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-text mb-4">
                    🎯 {t('admin.assistantAnalytics.recommendationsTitle', 'Recommendations')}
                  </h3>
                  <div className="space-y-3">
                    {summaryResult.recommendations.map((rec, i) => (
                      <div key={i} className="p-4 bg-gradient-to-r from-primary/5 to-transparent rounded-lg border border-primary/10">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm text-text">{rec.action}</p>
                            <p className="text-xs text-secondary mt-1">{rec.rationale}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                            rec.effort === 'low' ? 'bg-green-100 text-green-700' :
                            rec.effort === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>{rec.effort} effort</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw text fallback if parsing failed */}
              {summaryResult.raw_text && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-text mb-4">
                    📝 {t('admin.assistantAnalytics.rawAnalysis', 'Raw AI Analysis')}
                  </h3>
                  <pre className="text-sm text-text bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                    {summaryResult.raw_text}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!summaryLoading && !summaryResult && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-5xl mb-4">🧠</div>
              <h3 className="text-lg font-semibold text-text mb-2">
                {t('admin.assistantAnalytics.aiSummaryEmpty', 'Generate an AI Summary')}
              </h3>
              <p className="text-sm text-secondary max-w-md mx-auto">
                {t('admin.assistantAnalytics.aiSummaryEmptyDesc', 'Select a date range and click "Generate Summary" to get AI-powered insights from all assistant conversations. The analysis will identify feature requests, bugs, frequently asked questions, and usage trends.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
