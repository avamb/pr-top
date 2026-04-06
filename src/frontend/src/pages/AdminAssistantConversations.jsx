import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

function RatingBadge({ rating }) {
  const icons = { good: '👍', bad: '👎', neutral: '➖' };
  return <span className="text-sm">{icons[rating] || ''}</span>;
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
          {t('admin.conversations.rating', 'Rating')}
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
          {t('admin.conversations.comment', 'Comment (optional)')}
        </label>
        <textarea
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
          rows={2}
          placeholder={t('admin.conversations.commentPlaceholder', 'Add your feedback...')}
        />
      </div>
      {rating === 'bad' && (
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            {t('admin.conversations.correctionLabel', 'Correction — what should the assistant have said?')}
          </label>
          <textarea
            value={correctionText}
            onChange={e => setCorrectionText(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
            rows={3}
            placeholder={t('admin.conversations.correctionPlaceholder', 'Provide the correct response...')}
          />
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-gray-100">
          {t('admin.conversations.cancel', 'Cancel')}
        </button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {saving ? '...' : existingComment ? t('admin.conversations.update', 'Update') : t('admin.conversations.save', 'Save')}
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
        await fetch(`${API_URL}/admin/assistant/comments/${editingComment.id}`, {
          method: 'PUT', headers, body: JSON.stringify(formData)
        });
      } else {
        await fetch(`${API_URL}/admin/assistant/messages/${messageId}/comments`, {
          method: 'POST', headers, body: JSON.stringify(formData)
        });
      }
      setShowForm(false);
      setEditingComment(null);
      await loadComments();
    } catch (err) {
      console.error('Comment save error:', err);
    }
  }

  async function handleDelete(commentId) {
    if (!confirm(t('admin.conversations.deleteConfirm', 'Delete this comment?'))) return;
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
      <button onClick={handleExpand} className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1">
        💬 {t('admin.conversations.feedback', 'Feedback')}
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
                  <button onClick={() => { setEditingComment(comment); setShowForm(true); }} className="text-primary hover:underline">
                    {t('admin.conversations.edit', 'Edit')}
                  </button>
                  <button onClick={() => handleDelete(comment.id)} className="text-red-500 hover:underline">
                    {t('admin.conversations.delete', 'Delete')}
                  </button>
                </div>
              </div>
              {comment.comment_text && <p className="mt-1 text-text">{comment.comment_text}</p>}
              {comment.correction_text && (
                <div className="mt-1 p-1.5 bg-blue-50 rounded border border-blue-200">
                  <span className="font-medium text-blue-700">{t('admin.conversations.correction', 'Correction:')}</span>{' '}
                  <span className="text-text">{comment.correction_text}</span>
                </div>
              )}
            </div>
          ))}
          {!showForm ? (
            <button onClick={() => { setShowForm(true); setEditingComment(null); }} className="text-xs text-primary hover:underline">
              + {t('admin.conversations.addFeedback', 'Add feedback')}
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

export default function AdminAssistantConversations() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterTherapist, setFilterTherapist] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Therapist list for filter dropdown
  const [therapists, setTherapists] = useState([]);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadTherapists();
  }, []);

  useEffect(() => {
    loadConversations(1);
  }, [filterLanguage, filterTherapist, filterDateFrom, filterDateTo, searchQuery]);

  async function loadTherapists() {
    try {
      const res = await fetch(`${API_URL}/admin/therapists`, { headers });
      if (res.ok) {
        const data = await res.json();
        setTherapists(data.therapists || []);
      }
    } catch (err) {
      // Non-critical
    }
  }

  const loadConversations = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 20 });
      if (filterLanguage) params.set('language', filterLanguage);
      if (filterTherapist) params.set('therapist_id', filterTherapist);
      if (filterDateFrom) params.set('date_from', filterDateFrom);
      if (filterDateTo) params.set('date_to', filterDateTo);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${API_URL}/admin/assistant/conversations?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data.conversations);
      setTotal(data.total);
      setPage(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterLanguage, filterTherapist, filterDateFrom, filterDateTo, searchQuery]);

  async function loadMessages(conv) {
    setMessagesLoading(true);
    setSelectedConv(conv);
    try {
      const res = await fetch(`${API_URL}/admin/assistant/conversations/${conv.id}/messages`, { headers });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setMessagesLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearchQuery(searchInput);
  }

  function clearFilters() {
    setFilterLanguage('');
    setFilterTherapist('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
    setSearchInput('');
  }

  const totalPages = Math.ceil(total / 20);
  const hasFilters = filterLanguage || filterTherapist || filterDateFrom || filterDateTo || searchQuery;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">
          {t('admin.conversations.title', 'Assistant Conversations')}
        </h1>
        <p className="text-secondary text-sm mt-1">
          {t('admin.conversations.subtitle', 'Browse and review all therapist-assistant dialogues')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-secondary mb-1">
              {t('admin.conversations.search', 'Search messages')}
            </label>
            <form onSubmit={handleSearch} className="flex gap-1">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder={t('admin.conversations.searchPlaceholder', 'Search conversation content...')}
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <button type="submit" className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                🔍
              </button>
            </form>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              {t('admin.conversations.therapist', 'Therapist')}
            </label>
            <select
              value={filterTherapist}
              onChange={e => setFilterTherapist(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50"
            >
              <option value="">{t('admin.conversations.allTherapists', 'All')}</option>
              {therapists.map(th => (
                <option key={th.id} value={th.id}>{th.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              {t('admin.conversations.language', 'Language')}
            </label>
            <select
              value={filterLanguage}
              onChange={e => setFilterLanguage(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50"
            >
              <option value="">{t('admin.conversations.allLanguages', 'All')}</option>
              <option value="en">EN</option>
              <option value="ru">RU</option>
              <option value="es">ES</option>
              <option value="uk">UK</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              {t('admin.conversations.dateFrom', 'From')}
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              {t('admin.conversations.dateTo', 'To')}
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm text-secondary border border-border rounded-lg hover:bg-gray-50"
            >
              ✕ {t('admin.conversations.clearFilters', 'Clear')}
            </button>
          )}
        </div>
        {hasFilters && (
          <p className="text-xs text-secondary mt-2">
            {t('admin.conversations.showing', 'Showing')} {total} {t('admin.conversations.results', 'results')}
          </p>
        )}
      </div>

      {/* Master-Detail Layout */}
      <div className="flex gap-4" style={{ minHeight: '70vh' }}>
        {/* Conversation List (Left) */}
        <div className={`${selectedConv ? 'hidden lg:block lg:w-1/3' : 'w-full'} space-y-2`}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-secondary">
              {t('admin.conversations.noConversations', 'No conversations found')}
            </div>
          ) : (
            <>
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => loadMessages(conv)}
                  className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md border-l-4 ${
                    selectedConv?.id === conv.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text truncate">{conv.email}</span>
                    <span className="text-xs text-secondary uppercase ml-2">{conv.language}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-secondary">{conv.started_at?.slice(0, 16)}</span>
                    <span className="text-xs bg-gray-100 text-secondary px-2 py-0.5 rounded-full">
                      {conv.message_count} {t('admin.conversations.msgs', 'msgs')}
                    </span>
                  </div>
                  {conv.page_context && (
                    <span className="text-xs text-secondary font-mono mt-1 block truncate">{conv.page_context}</span>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => loadConversations(page - 1)}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1 text-xs text-secondary">
                    {page}/{totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => loadConversations(page + 1)}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Message Detail (Right) */}
        <div className={`${selectedConv ? 'w-full lg:w-2/3' : 'hidden'}`}>
          {selectedConv && (
            <div className="bg-white rounded-lg shadow-md flex flex-col" style={{ height: '70vh' }}>
              {/* Header */}
              <div className="p-4 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={() => setSelectedConv(null)}
                      className="lg:hidden text-primary hover:underline text-sm mb-1 block"
                    >
                      ← {t('admin.conversations.back', 'Back')}
                    </button>
                    <h3 className="text-lg font-semibold text-text">
                      {t('admin.conversations.conversationTitle', 'Conversation')} #{selectedConv.id}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-secondary flex-wrap">
                      <span>{selectedConv.email}</span>
                      <span>·</span>
                      <span>{selectedConv.started_at?.slice(0, 16)}</span>
                      <span>·</span>
                      <span className="uppercase">{selectedConv.language}</span>
                      {selectedConv.page_context && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-xs">{selectedConv.page_context}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedConv(null)}
                    className="hidden lg:block text-secondary hover:text-text text-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-secondary py-8">
                    {t('admin.conversations.noMessages', 'No messages in this conversation')}
                  </p>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-gray-100 text-text rounded-bl-md'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className={`flex items-center gap-2 mt-1.5 text-xs ${
                          msg.role === 'user' ? 'text-white/70' : 'text-secondary'
                        }`}>
                          <span>{msg.created_at?.slice(11, 16)}</span>
                          {msg.is_cached && <span className="text-amber-500">⚡ cached</span>}
                          {msg.tags && <TagBadge tag={msg.tags} />}
                          {msg.latest_rating && <RatingBadge rating={msg.latest_rating} />}
                          {msg.comment_count > 0 && (
                            <span className={`px-1.5 rounded-full text-xs ${
                              msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {msg.comment_count} 💬
                            </span>
                          )}
                        </div>
                        {/* Admin comment section for assistant messages */}
                        {msg.role === 'assistant' && (
                          <MessageComments messageId={msg.id} t={t} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!selectedConv && (
            <div className="hidden lg:flex bg-white rounded-lg shadow-md items-center justify-center" style={{ height: '70vh' }}>
              <div className="text-center text-secondary">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-lg font-medium">{t('admin.conversations.selectConversation', 'Select a conversation')}</p>
                <p className="text-sm mt-1">{t('admin.conversations.selectHint', 'Click on a conversation from the list to view its messages')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
