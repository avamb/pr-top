import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchApi } from '../utils/fetchApi';
import { formatUserDate } from '../utils/formatDate';
import LoadingSpinner from './LoadingSpinner';
import useWebSocket from '../hooks/useWebSocket';

/**
 * AssignmentReportsFeed — T-04 (feature #362).
 *
 * Inline chronological feed of freeform client progress reports for a single
 * assignment. Mounted lazily under the assignment row when the therapist
 * clicks "Show reports". Receives a WebSocket "assignment_report_created" /
 * "assignment_report_transcribed" event from the parent panel via the
 * `wsTick` prop so it can refetch in real-time without polling.
 */
function AssignmentReportsFeed({ clientId, assignmentId, wsTick }) {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const url = `/api/clients/${clientId}/assignments/${assignmentId}/reports`;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApi(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('assignment.report.errorLoad'));
      }
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url, t]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports, wsTick]);

  if (loading && reports.length === 0) {
    return (
      <div className="mt-3 pl-3 border-l-2 border-teal-200" data-testid={`reports-feed-${assignmentId}`}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <p
        data-testid={`reports-feed-error-${assignmentId}`}
        className="mt-3 text-sm text-rose-600 pl-3 border-l-2 border-rose-200"
      >
        {error}
      </p>
    );
  }

  if (reports.length === 0) {
    return (
      <p
        data-testid={`reports-feed-empty-${assignmentId}`}
        className="mt-3 text-sm text-stone-400 pl-3 border-l-2 border-stone-200"
      >
        {t('assignment.report.empty')}
      </p>
    );
  }

  return (
    <ul
      data-testid={`reports-feed-${assignmentId}`}
      className="mt-3 pl-3 border-l-2 border-teal-200 space-y-2"
    >
      {reports.map((r) => {
        const transcriptPending = r.report_type === 'voice'
          && r.has_audio
          && (!r.content || r.content.length === 0)
          && r.transcription_status !== 'completed';
        return (
          <li
            key={r.id}
            data-testid={`report-row-${r.id}`}
            className="bg-white border border-stone-200 rounded p-2"
          >
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-500">
              <span className="font-medium text-stone-700">
                {r.report_type === 'voice'
                  ? `🎤 ${t('assignment.report.typeVoice')}`
                  : `✍️ ${t('assignment.report.typeText')}`}
              </span>
              <span>· {formatUserDate(r.created_at)}</span>
              {r.is_final && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                  {t('assignment.report.finalBadge')}
                </span>
              )}
              {transcriptPending && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-semibold">
                  {t('assignment.report.transcribing')}
                </span>
              )}
              {r.transcription_status === 'failed' && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                  {t('assignment.report.transcribeFailed')}
                </span>
              )}
            </div>
            {r.content && r.content.length > 0 ? (
              <p
                data-testid={`report-content-${r.id}`}
                className="mt-1 text-sm text-stone-800 whitespace-pre-wrap"
              >
                {r.content}
              </p>
            ) : transcriptPending ? (
              <p className="mt-1 text-sm text-stone-400 italic">
                {t('assignment.report.transcribingHint')}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * AssignmentsPanel — T-03 (feature #361).
 *
 * Renders the therapist-side UI for managing homework "assignments" attached
 * to a client. The same component drives two surfaces:
 *
 *  - mode="session": filters by sessionId. Used inside SessionDetail under
 *    the "Assignments" section. Creating an assignment from here posts to
 *    POST /api/sessions/:sessionId/assignments so it is linked to the
 *    session out of the box.
 *
 *  - mode="client":  aggregated list across all sessions for the client.
 *    Used inside ClientDetail. Creating from here posts to
 *    POST /api/clients/:clientId/assignments with sessionId=null.
 *
 * Each assignment can either reference an exercise from the library
 * (exercise_id) OR carry a freeform title + description (exercise_id IS NULL).
 *
 * Status flow: active → completed | abandoned. The "Abandon" action calls
 * POST /api/clients/:cid/assignments/:aid/abandon. The therapist can also
 * manually mark an assignment as completed via the inline edit form (the
 * full completion flow with client-side accept lands in T-05).
 *
 * Props:
 *   - mode:       'session' | 'client'
 *   - sessionId:  number — required when mode === 'session'
 *   - clientId:   number — required in both modes
 *   - canEdit:    boolean — when false the create form and action buttons
 *                 are hidden. Defaults to true (therapist view).
 *   - onChange:   optional callback fired after a successful mutation so the
 *                 parent can refresh related state (e.g. session timeline).
 */
function AssignmentsPanel({ mode = 'client', sessionId = null, clientId, canEdit = true, onChange = null }) {
  const { t, i18n } = useTranslation();

  // ── Server state ────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Library exercises used to (a) populate the dropdown when creating an
  // assignment and (b) resolve an exercise's localized title for existing
  // assignments where the therapist picked an exercise.
  const [exercises, setExercises] = useState([]);
  const [exercisesLoaded, setExercisesLoaded] = useState(false);

  // ── Create form state ───────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formExerciseId, setFormExerciseId] = useState('');
  const [formFrequency, setFormFrequency] = useState('on_demand');
  const [formFrequencyN, setFormFrequencyN] = useState('3');
  const [formDeadline, setFormDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Per-row action state (abandon / delete) ─────────────────────────────
  const [busyId, setBusyId] = useState(null);

  // T-04: per-assignment expanded "reports" feed. Map: assignmentId -> tick.
  // The tick is incremented whenever a WS event arrives for that assignment,
  // which is passed to <AssignmentReportsFeed> as a re-fetch trigger.
  const [expandedReports, setExpandedReports] = useState({});
  const [reportTicks, setReportTicks] = useState({});
  const { on: wsOn } = useWebSocket();

  // Subscribe to T-04 WebSocket events so an expanded feed refreshes when a
  // new report arrives or finishes transcription.
  useEffect(() => {
    const handle = (msg) => {
      if (!msg || !msg.assignment_id) return;
      setReportTicks((prev) => ({
        ...prev,
        [msg.assignment_id]: (prev[msg.assignment_id] || 0) + 1,
      }));
    };
    const off1 = wsOn('assignment_report_created', handle);
    const off2 = wsOn('assignment_report_transcribed', handle);
    return () => { off1(); off2(); };
  }, [wsOn]);

  function toggleReports(assignmentId) {
    setExpandedReports((prev) => ({ ...prev, [assignmentId]: !prev[assignmentId] }));
  }

  // Build the client/session-scoped API URL used to list this panel's
  // assignments.
  const listUrl = useMemo(() => {
    if (mode === 'session' && sessionId) {
      return `/api/sessions/${sessionId}/assignments`;
    }
    return `/api/clients/${clientId}/assignments`;
  }, [mode, sessionId, clientId]);

  // Endpoint to POST a new assignment. Session mode posts to the session
  // route so it is automatically linked; client mode posts to the client
  // route with sessionId=null (orphan).
  const createUrl = useMemo(() => {
    if (mode === 'session' && sessionId) {
      return `/api/sessions/${sessionId}/assignments`;
    }
    return `/api/clients/${clientId}/assignments`;
  }, [mode, sessionId, clientId]);

  // ── Loaders ─────────────────────────────────────────────────────────────
  const fetchAssignments = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchApi(listUrl);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('assignment.errorLoad'));
      }
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [listUrl, clientId, t]);

  const fetchExercises = useCallback(async () => {
    if (exercisesLoaded) return;
    try {
      const lang = (i18n.language || 'en').slice(0, 2);
      const res = await fetchApi(`/api/exercises?language=${encodeURIComponent(lang)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.exercises)) {
        setExercises(data.exercises);
      }
    } catch (_) {
      // best-effort — the dropdown just stays empty
    } finally {
      setExercisesLoaded(true);
    }
  }, [exercisesLoaded, i18n.language]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Pull the exercise library lazily — only when the create form opens or
  // there's an assignment that references an exercise we need to label.
  useEffect(() => {
    const hasExerciseRef = assignments.some((a) => a.exercise_id != null);
    if (showCreate || hasExerciseRef) {
      fetchExercises();
    }
  }, [showCreate, assignments, fetchExercises]);

  function resetForm() {
    setFormTitle('');
    setFormDescription('');
    setFormExerciseId('');
    setFormFrequency('on_demand');
    setFormFrequencyN('3');
    setFormDeadline('');
    setSubmitError('');
  }

  // Resolve a localized title for an exercise reference. Falls back through
  // the user's language → en → first available.
  const exerciseTitle = useCallback((exerciseId) => {
    if (!exerciseId) return '';
    const ex = exercises.find((x) => Number(x.id) === Number(exerciseId));
    if (!ex) return '';
    const lang = (i18n.language || 'en').slice(0, 2);
    return ex[`title_${lang}`] || ex.title_en || ex.title_ru || ex.title || `#${exerciseId}`;
  }, [exercises, i18n.language]);

  // ── Mutations ───────────────────────────────────────────────────────────
  async function handleCreate(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;

    const title = formTitle.trim();
    if (!title) {
      setSubmitError(t('assignment.errorTitleRequired'));
      return;
    }
    if (formFrequency === 'every_n_days') {
      const n = parseInt(formFrequencyN, 10);
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        setSubmitError(t('assignment.errorFrequencyN'));
        return;
      }
    }

    setSubmitting(true);
    setSubmitError('');

    const payload = {
      title,
      description: formDescription.trim() || undefined,
      exercise_id: formExerciseId ? Number(formExerciseId) : null,
      report_frequency: formFrequency,
      report_frequency_n: formFrequency === 'every_n_days' ? Number(formFrequencyN) : null,
      deadline: formDeadline || null,
    };

    try {
      const res = await fetchApi(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('assignment.errorCreate'));
      }
      resetForm();
      setShowCreate(false);
      await fetchAssignments();
      if (onChange) onChange();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAbandon(assignmentId) {
    if (busyId) return;
    if (!window.confirm(t('assignment.confirmAbandon'))) return;
    setBusyId(assignmentId);
    try {
      const res = await fetchApi(`/api/clients/${clientId}/assignments/${assignmentId}/abandon`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('assignment.errorAbandon'));
      await fetchAssignments();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(assignmentId) {
    if (busyId) return;
    setBusyId(assignmentId);
    try {
      const res = await fetchApi(`/api/clients/${clientId}/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('assignment.errorComplete'));
      await fetchAssignments();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(assignmentId) {
    if (busyId) return;
    if (!window.confirm(t('assignment.confirmDelete'))) return;
    setBusyId(assignmentId);
    try {
      const res = await fetchApi(`/api/clients/${clientId}/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('assignment.errorDelete'));
      await fetchAssignments();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // ── Rendering helpers ──────────────────────────────────────────────────
  function statusBadge(status) {
    const map = {
      active:    'bg-amber-100 text-amber-800',
      completed: 'bg-green-100 text-green-800',
      abandoned: 'bg-stone-200 text-stone-600',
    };
    return map[status] || 'bg-stone-100 text-stone-700';
  }

  function frequencyLabel(a) {
    const key = `assignment.frequency.${a.report_frequency}`;
    const label = t(key);
    if (a.report_frequency === 'every_n_days' && a.report_frequency_n) {
      return `${label} (${a.report_frequency_n})`;
    }
    return label;
  }

  return (
    <section
      data-testid={`assignments-panel-${mode}`}
      className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-800">
            📝 {t('assignment.title')}
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            {mode === 'session'
              ? t('assignment.subtitleSession')
              : t('assignment.subtitleClient')}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            data-testid="assignments-create-toggle"
            onClick={() => { setShowCreate((v) => !v); if (showCreate) resetForm(); }}
            className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
          >
            {showCreate ? t('assignment.cancel') : `＋ ${t('assignment.newButton')}`}
          </button>
        )}
      </div>

      {showCreate && canEdit && (
        <form
          onSubmit={handleCreate}
          data-testid="assignments-create-form"
          className="border border-teal-200 bg-teal-50/40 rounded-lg p-4 mb-4 space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              {t('assignment.fieldTitle')} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              data-testid="assignments-form-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('assignment.titlePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              {t('assignment.fieldExercise')}
            </label>
            <select
              data-testid="assignments-form-exercise"
              value={formExerciseId}
              onChange={(e) => setFormExerciseId(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{t('assignment.exerciseNone')}</option>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {(ex.title || ex.title_en || ex.title_ru || `#${ex.id}`) + (ex.is_custom ? ` ★` : '')}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500 mt-1">{t('assignment.exerciseHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              {t('assignment.fieldDescription')}
            </label>
            <textarea
              data-testid="assignments-form-description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('assignment.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                {t('assignment.fieldFrequency')}
              </label>
              <select
                data-testid="assignments-form-frequency"
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="on_demand">{t('assignment.frequency.on_demand')}</option>
                <option value="daily">{t('assignment.frequency.daily')}</option>
                <option value="every_n_days">{t('assignment.frequency.every_n_days')}</option>
                <option value="weekly">{t('assignment.frequency.weekly')}</option>
              </select>
            </div>
            {formFrequency === 'every_n_days' && (
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {t('assignment.fieldFrequencyN')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  data-testid="assignments-form-frequency-n"
                  value={formFrequencyN}
                  onChange={(e) => setFormFrequencyN(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                {t('assignment.fieldDeadline')}
              </label>
              <input
                type="date"
                data-testid="assignments-form-deadline"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {submitError && (
            <p data-testid="assignments-form-error" className="text-rose-600 text-sm">{submitError}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              data-testid="assignments-form-submit"
              disabled={submitting}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {submitting ? t('assignment.creating') : t('assignment.create')}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-lg text-sm font-medium"
            >
              {t('assignment.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* List of existing assignments */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p data-testid="assignments-error" className="text-rose-600 text-sm">{error}</p>
      ) : assignments.length === 0 ? (
        <p data-testid="assignments-empty" className="text-sm text-stone-400">
          {mode === 'session' ? t('assignment.emptySession') : t('assignment.emptyClient')}
        </p>
      ) : (
        <ul data-testid="assignments-list" className="space-y-3">
          {assignments.map((a) => {
            const exTitle = exerciseTitle(a.exercise_id);
            const displayTitle = (a.title && a.title.trim()) || exTitle || `${t('assignment.title')} #${a.id}`;
            return (
              <li
                key={a.id}
                data-testid={`assignment-row-${a.id}`}
                className="border border-stone-200 rounded-lg p-3 bg-stone-50/40"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-stone-800">{displayTitle}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${statusBadge(a.status)}`}>
                        {t(`assignment.status.${a.status}`)}
                      </span>
                      {a.exercise_id && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                          {t('assignment.fromLibrary')}
                        </span>
                      )}
                      {mode === 'client' && a.session_id == null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 font-semibold">
                          {t('assignment.orphan')}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-sm text-stone-600 mt-1 whitespace-pre-wrap">{a.description}</p>
                    )}
                    {!a.title && a.exercise_id && exTitle && (
                      <p className="text-[11px] text-stone-500 mt-1">{t('assignment.linkedExercise')}: {exTitle}</p>
                    )}
                    <div className="text-[11px] text-stone-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>⏱ {frequencyLabel(a)}</span>
                      {a.deadline && (
                        <span>📅 {t('assignment.deadlineLabel')}: {formatUserDate(a.deadline)}</span>
                      )}
                      <span>{t('assignment.createdAt')}: {formatUserDate(a.created_at)}</span>
                    </div>
                  </div>
                  {canEdit && a.status === 'active' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        data-testid={`assignment-complete-${a.id}`}
                        onClick={() => handleComplete(a.id)}
                        disabled={busyId === a.id}
                        className="px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded disabled:opacity-50"
                      >
                        ✓ {t('assignment.markComplete')}
                      </button>
                      <button
                        type="button"
                        data-testid={`assignment-abandon-${a.id}`}
                        onClick={() => handleAbandon(a.id)}
                        disabled={busyId === a.id}
                        className="px-2 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded disabled:opacity-50"
                      >
                        {t('assignment.abandon')}
                      </button>
                    </div>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      data-testid={`assignment-delete-${a.id}`}
                      onClick={() => handleDelete(a.id)}
                      disabled={busyId === a.id}
                      className="px-2 py-1 text-xs bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded disabled:opacity-50"
                      title={t('assignment.delete')}
                    >
                      🗑
                    </button>
                  )}
                </div>

                {/* T-04: Reports toggle + feed */}
                <div className="mt-2">
                  <button
                    type="button"
                    data-testid={`assignment-reports-toggle-${a.id}`}
                    onClick={() => toggleReports(a.id)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    {expandedReports[a.id]
                      ? `▾ ${t('assignment.report.hide')}`
                      : `▸ ${t('assignment.report.show')}`}
                  </button>
                  {expandedReports[a.id] && (
                    <AssignmentReportsFeed
                      clientId={clientId}
                      assignmentId={a.id}
                      wsTick={reportTicks[a.id] || 0}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default AssignmentsPanel;
