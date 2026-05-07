import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchApi } from '../utils/fetchApi';
import { formatUserDate } from '../utils/formatDate';
import LoadingSpinner from './LoadingSpinner';

/**
 * CommentsPanel — T-10 dual-comment (private + shared) component.
 *
 * Renders two tabs ("For me" / "For client" or "For me" / "For therapist"
 * depending on viewer role) on top of a polymorphic GET/POST/PATCH/DELETE
 * /api/comments?entity_type=&entity_id= endpoint.
 *
 * Props:
 *   - entityType: one of 'client' | 'session' | 'assignment' |
 *                 'assignment_report' | 'exercise_completion' | 'inquiry'
 *   - entityId:   number/string id of the entity
 *   - userRole:   current user's role ('therapist' | 'client' | 'superadmin')
 *   - currentUserId: current user's id (used to detect "your own" comments)
 *   - className?: optional wrapper className
 */
function CommentsPanel({ entityType, entityId, userRole, currentUserId, className = '' }) {
  const { t } = useTranslation();
  const isTherapist = userRole === 'therapist' || userRole === 'superadmin';
  const isClient = userRole === 'client';
  // T-11: therapists default to their own private tab (their notes are private
  // by default — see also showToClient toggle below); clients land on the
  // shared tab because their comments are always shared with the therapist.
  const [activeTab, setActiveTab] = useState(isClient ? 'shared' : 'private');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [actionId, setActionId] = useState(null);
  // T-11: explicit "Show to client" toggle for therapist authors. Default OFF
  // = comment is private to the therapist. When ON the comment is created
  // with visibility='shared'. Clients never see this toggle (their comments
  // are always shared with the therapist).
  const [showToClient, setShowToClient] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError('');
    try {
      const qs = `?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`;
      const res = await fetchApi(`/api/comments${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('comments.errorLoad'));
      }
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      setError(e.message || t('comments.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Filter comments per active tab.
  // Tab 'private' = comments authored by ME with visibility=private (my private notes)
  // Tab 'shared'  = comments visible to BOTH parties (visibility=shared) regardless of author
  const visibleComments = comments.filter((c) => {
    if (activeTab === 'private') {
      return c.visibility === 'private' && Number(c.author_id) === Number(currentUserId);
    }
    return c.visibility === 'shared';
  });

  async function handleCreate(e) {
    if (e && e.preventDefault) e.preventDefault();
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    setError('');
    try {
      // T-11: For therapist authors the explicit "Show to client" toggle is
      // the source of truth for visibility — default off ⇒ private. Clients
      // always create shared comments (visible to their therapist).
      const visibility = isClient ? 'shared' : showToClient ? 'shared' : 'private';
      const res = await fetchApi('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: Number(entityId),
          content,
          visibility,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('comments.errorSave'));
      }
      setDraft('');
      // After creating, surface the new comment in the tab where it actually
      // lives so the therapist isn't confused by an "empty" view.
      if (isTherapist && activeTab !== visibility) {
        setActiveTab(visibility);
      }
      // Reset the toggle to default-off after a successful create so the next
      // comment also defaults to private.
      setShowToClient(false);
      await fetchComments();
    } catch (e) {
      setError(e.message || t('comments.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(comment) {
    setEditingId(comment.id);
    setEditingContent(comment.content || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingContent('');
  }

  async function handleSaveEdit(commentId) {
    const content = editingContent.trim();
    if (!content || actionId === commentId) return;
    setActionId(commentId);
    setError('');
    try {
      const res = await fetchApi(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('comments.errorSave'));
      }
      cancelEdit();
      await fetchComments();
    } catch (e) {
      setError(e.message || t('comments.errorSave'));
    } finally {
      setActionId(null);
    }
  }

  async function handleToggleVisibility(comment) {
    if (actionId === comment.id) return;
    setActionId(comment.id);
    setError('');
    try {
      const newVisibility = comment.visibility === 'private' ? 'shared' : 'private';
      const res = await fetchApi(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('comments.errorSave'));
      }
      await fetchComments();
    } catch (e) {
      setError(e.message || t('comments.errorSave'));
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(commentId) {
    if (!window.confirm(t('comments.confirmDelete'))) return;
    setActionId(commentId);
    setError('');
    try {
      const res = await fetchApi(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('comments.errorDelete'));
      }
      await fetchComments();
    } catch (e) {
      setError(e.message || t('comments.errorDelete'));
    } finally {
      setActionId(null);
    }
  }

  const sharedTabLabel = isClient ? t('comments.tabForTherapist') : t('comments.tabForClient');
  // T-11: For therapists, the placeholder + submit-button copy follows the
  // explicit "Show to client" toggle (off ⇒ private). Clients always write
  // shared comments and don't see the toggle.
  const willBeShared = isClient ? true : showToClient;
  const placeholder = willBeShared
    ? t('comments.placeholderShared')
    : t('comments.placeholderPrivate');
  const emptyMessage =
    activeTab === 'private'
      ? t('comments.emptyForYou')
      : isClient
      ? t('comments.emptyForTherapist')
      : t('comments.emptyForClient');

  return (
    <div
      data-testid="comments-panel"
      className={`bg-white rounded-lg shadow-sm border border-stone-200 p-4 ${className}`}
    >
      <h3 className="text-base font-semibold text-stone-800 mb-3 flex items-center gap-2">
        <span aria-hidden="true">💬</span>
        {t('comments.title')}
      </h3>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-4" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'private'}
          onClick={() => setActiveTab('private')}
          data-tab="private"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'private'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          🔒 {t('comments.tabForMe')}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'shared'}
          onClick={() => setActiveTab('shared')}
          data-tab="shared"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'shared'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          🤝 {sharedTabLabel}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-4">
        <textarea
          data-testid="comment-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          rows={3}
          maxLength={50000}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          {/* T-11: explicit "Show to client" toggle (therapists only,
              default off). Off ⇒ private comment. */}
          {isTherapist ? (
            <label
              className="inline-flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none"
              title={t('comments.visibility.showToClientHint')}
            >
              <input
                type="checkbox"
                data-testid="comment-show-to-client"
                checked={showToClient}
                onChange={(e) => setShowToClient(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
              />
              <span>{t('comments.visibility.showToClient')}</span>
              <span className="text-stone-400">
                {showToClient
                  ? `· ${t('comments.visibility.shared')}`
                  : `· ${t('comments.visibility.private')}`}
              </span>
            </label>
          ) : (
            <span />
          )}
          <button
            type="submit"
            data-testid="comment-save"
            data-will-be-shared={willBeShared ? 'true' : 'false'}
            disabled={saving || !draft.trim()}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <LoadingSpinner size={16} className="mr-2" />}
            {saving
              ? t('comments.saving')
              : willBeShared
              ? t('comments.addShared')
              : t('comments.addPrivate')}
          </button>
        </div>
      </form>

      {/* List */}
      {loading ? (
        <div className="text-center py-6 text-sm text-stone-500">
          <LoadingSpinner size={20} className="mr-2" />
          {t('comments.loading')}
        </div>
      ) : visibleComments.length === 0 ? (
        <div className="text-center py-8 text-sm text-stone-500">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-3" data-testid="comment-list">
          {visibleComments.map((c) => {
            const mine = Number(c.author_id) === Number(currentUserId);
            const canEdit = mine || userRole === 'superadmin';
            const isEditing = editingId === c.id;
            return (
              <li
                key={c.id}
                data-testid={`comment-${c.id}`}
                data-visibility={c.visibility}
                className="border border-stone-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="font-medium text-stone-700">
                      {mine
                        ? t('comments.you')
                        : c.author_role === 'therapist'
                        ? t('comments.byTherapist')
                        : c.author_role === 'client'
                        ? t('comments.byClient')
                        : c.author_role}
                    </span>
                    <span>·</span>
                    <span>{formatUserDate(c.created_at)}</span>
                    {c.updated_at && c.updated_at !== c.created_at && (
                      <>
                        <span>·</span>
                        <span className="italic">edited</span>
                      </>
                    )}
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        c.visibility === 'private'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {c.visibility === 'private'
                        ? t('comments.visibility.private')
                        : t('comments.visibility.shared')}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {!isEditing && isTherapist && (
                        <button
                          onClick={() => handleToggleVisibility(c)}
                          disabled={actionId === c.id}
                          title={t('comments.visibility.toggle')}
                          className="text-xs text-stone-600 hover:text-stone-800 disabled:opacity-50"
                        >
                          {c.visibility === 'private'
                            ? t('comments.visibility.makeShared')
                            : t('comments.visibility.makePrivate')}
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(c)}
                          className="text-xs text-teal-600 hover:text-teal-800"
                        >
                          {t('comments.edit')}
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={actionId === c.id}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {t('comments.delete')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2 text-sm"
                      rows={3}
                      maxLength={50000}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 bg-stone-100 text-stone-700 text-xs rounded-lg hover:bg-stone-200"
                      >
                        {t('comments.cancel')}
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={!editingContent.trim() || actionId === c.id}
                        className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 disabled:opacity-50"
                      >
                        {actionId === c.id ? t('comments.saving') : t('comments.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-stone-700 whitespace-pre-wrap text-sm">{c.content}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CommentsPanel;
