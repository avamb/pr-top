import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

export default function AdminCachedAnswers() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadCachedAnswers();
  }, [page]);

  const loadCachedAnswers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/assistant/cached-answers?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load cached answers' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.answer_text);
  };

  const handleSaveEdit = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/assistant/cached-answers/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_text: editText })
      });
      if (res.ok) {
        setEditingId(null);
        setMessage({ type: 'success', text: t('admin.cache.editSuccess') });
        loadCachedAnswers();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.cache.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/assistant/cached-answers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage({ type: 'success', text: t('admin.cache.deleteSuccess') });
        loadCachedAnswers();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-4 py-2 rounded z-50">
        Skip to main content
      </a>
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-heading">{t('admin.cache.title')}</h2>
          <p className="text-secondary mt-1">{t('admin.cache.description')}</p>
          <p className="text-sm text-secondary mt-1">
            {t('admin.cache.totalEntries')}: <span className="font-medium">{total}</span>
          </p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-secondary">{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-secondary">{t('admin.cache.empty')}</p>
            <p className="text-sm text-secondary mt-1">{t('admin.cache.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                        #{item.id}
                      </span>
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                        {t('admin.cache.usedTimes', { count: item.usage_count })}
                      </span>
                      {item.has_rag_context ? (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded" title="Answer was generated with RAG context">
                          ✅ RAG
                        </span>
                      ) : (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded" title="No RAG context — excluded from cache serving">
                          ⚠️ No RAG
                        </span>
                      )}
                      <span className="text-xs text-secondary">
                        {new Date(item.updated_at + 'Z').toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-xs font-medium text-secondary uppercase">{t('admin.cache.question')}:</span>
                      <p className="text-sm text-heading mt-0.5 line-clamp-2">{item.question_text}</p>
                    </div>

                    {editingId === item.id ? (
                      <div>
                        <span className="text-xs font-medium text-secondary uppercase">{t('admin.cache.answer')}:</span>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="w-full mt-1 p-2 border rounded text-sm min-h-[80px] focus:ring-2 focus:ring-primary focus:border-primary"
                          rows={4}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary/90"
                          >
                            {t('save')}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-medium text-secondary uppercase">{t('admin.cache.answer')}:</span>
                        <p className="text-sm text-heading mt-0.5 whitespace-pre-wrap line-clamp-4">{item.answer_text}</p>
                      </div>
                    )}
                  </div>

                  {editingId !== item.id && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/5 rounded"
                        title={t('edit')}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title={t('delete')}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                  {t('previous')}
                </button>
                <span className="px-3 py-1 text-sm text-secondary">
                  {page} / {pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                  {t('next')}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
