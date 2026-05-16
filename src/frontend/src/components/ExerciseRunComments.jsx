import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchApi } from '../utils/fetchApi';
import { formatUserDate } from '../utils/formatDate';
import LoadingSpinner from './LoadingSpinner';

/**
 * ExerciseRunComments — T-22 per-exercise-run comments UI.
 *
 * UI polish on top of T-10 (polymorphic comments) and T-04 (exercise
 * deliveries). For a single exercise delivery, presents two tabs:
 *
 *   - "Running notes": comments authored DURING the exercise. These come
 *     from the polymorphic comments API with
 *     entity_type='exercise_completion', entity_id=deliveryId.
 *     Reuses /api/comments — no new endpoints (T-22 requirement).
 *
 *   - "Final": the client's final response on the exercise itself, stored
 *     on exercise_deliveries.response_encrypted (delivered via T-04 and
 *     surfaced by GET /api/clients/:id/exercises).
 *
 * The "Final" entry is rendered with an explicit ✅ badge so it is visually
 * distinct from running notes (Step 3 of T-22).
 *
 * Props:
 *   - deliveryId:       number — exercise_deliveries.id
 *   - finalResponse:    string|null — decrypted final response (from T-04)
 *   - completedAt:      string|null — ISO timestamp the client completed
 *   - userRole:         current viewer's role
 *   - currentUserId:    current viewer's id (used to label own comments)
 *   - canPostComment:   boolean — therapists may post running notes (T-10);
 *                       defaults to true for therapist/superadmin.
 */
function ExerciseRunComments({
  deliveryId,
  finalResponse,
  completedAt,
  userRole,
  currentUserId,
  canPostComment = true,
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('running');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const isTherapist = userRole === 'therapist' || userRole === 'superadmin';

  const fetchComments = useCallback(async () => {
    if (!deliveryId) return;
    setLoading(true);
    setError('');
    try {
      const qs = `?entity_type=exercise_completion&entity_id=${encodeURIComponent(deliveryId)}`;
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
  }, [deliveryId, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleCreate(e) {
    if (e && e.preventDefault) e.preventDefault();
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    setError('');
    try {
      // Therapist running notes default to 'shared' so the client can read
      // them on the bot during the exercise. Authors can later patch
      // visibility via the dedicated CommentsPanel if needed.
      const res = await fetchApi('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'exercise_completion',
          entity_id: Number(deliveryId),
          content,
          visibility: 'shared',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('comments.errorSave'));
      }
      setDraft('');
      await fetchComments();
    } catch (e) {
      setError(e.message || t('comments.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  const hasFinal = !!(finalResponse && finalResponse.trim());
  const runningCount = comments.length;

  return (
    <div
      data-testid={`exercise-run-comments-${deliveryId}`}
      className="mt-3 border-t border-stone-200 pt-3"
    >
      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-3" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'running'}
          onClick={() => setActiveTab('running')}
          data-tab="running"
          data-testid={`exercise-tab-running-${deliveryId}`}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'running'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          📝 {t('exercise.comments.running')} ({runningCount})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'final'}
          onClick={() => setActiveTab('final')}
          data-tab="final"
          data-testid={`exercise-tab-final-${deliveryId}`}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'final'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          ✅ {t('exercise.comments.final')} ({hasFinal ? 1 : 0})
        </button>
      </div>

      {error && (
        <div className="mb-2 p-2 rounded text-xs bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {activeTab === 'running' && (
        <div data-testid={`exercise-running-panel-${deliveryId}`}>
          {loading ? (
            <div className="text-center py-3 text-xs text-stone-500">
              <LoadingSpinner size={14} className="mr-2" />
              {t('comments.loading')}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-stone-400 py-2">
              {t('exercise.comments.emptyRunning')}
            </div>
          ) : (
            <ul className="space-y-2" data-testid={`exercise-running-list-${deliveryId}`}>
              {comments.map((c) => {
                const mine = Number(c.author_id) === Number(currentUserId);
                return (
                  <li
                    key={c.id}
                    data-testid={`exercise-running-comment-${c.id}`}
                    data-visibility={c.visibility}
                    className="bg-stone-50 border border-stone-200 rounded p-2"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 mb-1 flex-wrap">
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
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
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
                    <p className="text-stone-700 whitespace-pre-wrap text-xs">{c.content}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Composer (therapists only — clients write running notes via bot) */}
          {isTherapist && canPostComment && (
            <form onSubmit={handleCreate} className="mt-3">
              <textarea
                data-testid={`exercise-running-input-${deliveryId}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('exercise.comments.runningPlaceholder')}
                className="w-full border border-stone-300 rounded p-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={2}
                maxLength={50000}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  data-testid={`exercise-running-save-${deliveryId}`}
                  disabled={saving || !draft.trim()}
                  className="inline-flex items-center px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving && <LoadingSpinner size={12} className="mr-2" />}
                  {saving ? t('comments.saving') : t('exercise.comments.addRunning')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === 'final' && (
        <div data-testid={`exercise-final-panel-${deliveryId}`}>
          {hasFinal ? (
            <div
              data-testid={`exercise-final-entry-${deliveryId}`}
              className="border border-green-200 bg-green-50 rounded p-3"
            >
              <div className="flex items-center gap-2 text-[11px] text-green-700 mb-2 flex-wrap">
                <span className="px-1.5 py-0.5 rounded-full bg-green-200 text-green-800 font-semibold">
                  ✅ {t('exercise.comments.finalBadge')}
                </span>
                <span className="font-medium">{t('comments.byClient')}</span>
                {completedAt && (
                  <>
                    <span>·</span>
                    <span>{formatUserDate(completedAt)}</span>
                  </>
                )}
              </div>
              <p className="text-stone-800 whitespace-pre-wrap text-sm">{finalResponse}</p>
            </div>
          ) : (
            <div className="text-xs text-stone-400 py-2">
              {t('exercise.comments.emptyFinal')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExerciseRunComments;
