import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../components/Breadcrumb';
import useNavigationBlocker from '../hooks/useNavigationBlocker';
import useWebSocket from '../hooks/useWebSocket';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatUserDate, formatUserDateOnly, getUserTimezone } from '../utils/formatDate';
import AudioPlayer from '../components/AudioPlayer';
import CommentsPanel from '../components/CommentsPanel';
import ExerciseRunComments from '../components/ExerciseRunComments';
import AssignmentsPanel from '../components/AssignmentsPanel';
import SupervisionShareModal from '../components/SupervisionShareModal';
import SessionCalendar from '../components/SessionCalendar';

const API = '/api';

// Diary entry card with audio player, collapsible transcript, and retry transcription
function DiaryEntryCard({ entry, typeIcon, typeBadgeColor, formatUserDate, deleteDiaryEntry, clientId, t }) {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [retranscribing, setRetranscribing] = useState(false);
  const [retranscribeError, setRetranscribeError] = useState('');
  const [localTranscript, setLocalTranscript] = useState(entry.transcript);
  const isVoiceOrVideo = entry.entry_type === 'voice' || entry.entry_type === 'video';

  const [transcriptionStatus, setTranscriptionStatus] = useState(() => {
    // Use backend transcription_status if available, otherwise derive from data
    if (entry.transcription_status === 'completed' || entry.transcript) return 'transcribed';
    if (entry.transcription_status === 'failed') return 'failed';
    if (entry.transcription_status === 'processing') return 'processing';
    if (entry.transcription_status === 'pending') return 'pending';
    if (entry.has_audio_file) return 'pending';
    if (isVoiceOrVideo) return 'pending';
    return 'no_audio';
  });
  const hasAudio = entry.has_audio_file;
  const transcriptText = localTranscript || entry.transcript;
  const isLongTranscript = transcriptText && transcriptText.length > 300;

  const handleRetranscribe = async () => {
    setRetranscribing(true);
    setRetranscribeError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/diary/${entry.id}/retranscribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      if (data.transcript) {
        setLocalTranscript(data.transcript);
        setTranscriptionStatus('transcribed');
      }
    } catch (e) {
      setRetranscribeError(e.message);
      setTranscriptionStatus('failed');
    } finally {
      setRetranscribing(false);
    }
  };

  const statusBadge = () => {
    if (!isVoiceOrVideo) return null;
    switch (transcriptionStatus) {
      case 'transcribed':
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">✅ {t('diary.transcribed', 'Transcribed')}</span>;
      case 'failed':
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">❌ {t('diary.transcriptionFailed', 'Failed')}</span>;
      case 'processing':
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">⏳ {t('diary.processingTranscription', 'Processing...')}</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">⏳ {t('diary.pendingTranscription', 'Pending transcription')}</span>;
    }
  };

  return (
    <div className="border border-stone-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-lg">{typeIcon(entry.entry_type)}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(entry.entry_type)}`}>
          {entry.entry_type}
        </span>
        {statusBadge()}
        <span className="text-xs text-stone-400 ml-auto">
          {formatUserDate(entry.created_at)}
        </span>
        <button
          onClick={() => deleteDiaryEntry(entry.id)}
          className="ml-2 text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
          title="Delete diary entry"
        >🗑️ Delete</button>
      </div>

      {/* Text content */}
      {entry.content && (
        <p className="text-stone-700 whitespace-pre-wrap">{entry.content}</p>
      )}

      {/* Audio/Video Player */}
      {isVoiceOrVideo && hasAudio && (
        <div className="mt-3">
          <AudioPlayer
            sessionId={entry.id}
            audioRef={entry.entry_type === 'video' ? 'file.mp4' : 'file.ogg'}
            streamUrl={`${API}/diary/${entry.id}/stream`}
          />
        </div>
      )}

      {/* Transcript section */}
      {isVoiceOrVideo && (
        <div className="mt-3">
          {transcriptText ? (
            <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-600 border border-stone-100">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-stone-700">📝 {t('diary.transcript', 'Transcript')}</span>
                {isLongTranscript && (
                  <button
                    onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {transcriptExpanded ? t('diary.collapse', 'Collapse') : t('diary.expand', 'Expand')}
                  </button>
                )}
              </div>
              <p className={`whitespace-pre-wrap ${isLongTranscript && !transcriptExpanded ? 'line-clamp-4' : ''}`}>
                {transcriptText}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-400 border border-stone-100 flex items-center justify-between">
              <span>📝 {t('diary.noTranscript', 'No transcript available')}</span>
              {(hasAudio || entry.content) && (
                <button
                  onClick={handleRetranscribe}
                  disabled={retranscribing}
                  className="text-xs px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg border border-teal-200 font-medium disabled:opacity-50 transition-colors"
                >
                  {retranscribing ? '⏳ ...' : `🔄 ${t('diary.retryTranscription', 'Retry transcription')}`}
                </button>
              )}
            </div>
          )}

          {/* Retry button for existing failed transcripts */}
          {transcriptText && transcriptionStatus === 'failed' && (hasAudio || entry.content) && (
            <button
              onClick={handleRetranscribe}
              disabled={retranscribing}
              className="mt-2 text-xs px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg border border-teal-200 font-medium disabled:opacity-50 transition-colors"
            >
              {retranscribing ? '⏳ ...' : `🔄 ${t('diary.retryTranscription', 'Retry transcription')}`}
            </button>
          )}

          {/* Retry error message */}
          {retranscribeError && (
            <p className="mt-1 text-xs text-red-600">{retranscribeError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filter state from URL query parameters
  const [client, setClient] = useState(null);
  const [diary, setDiary] = useState([]);
  const [diaryTotal, setDiaryTotal] = useState(0);
  const [diaryPage, setDiaryPage] = useState(1);
  const [diaryHasMore, setDiaryHasMore] = useState(false);
  const [diaryLoadingMore, setDiaryLoadingMore] = useState(false);
  const [notes, setNotes] = useState([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);
  const [notesSearch, setNotesSearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [updatingNote, setUpdatingNote] = useState(false);
  const [context, setContext] = useState(null);
  const [contextForm, setContextForm] = useState({ anamnesis: '', current_goals: '', contraindications: '', ai_instructions: '' });
  const [contextSaving, setContextSaving] = useState(false);
  const [contextMsg, setContextMsg] = useState('');
  const [contextDirty, setContextDirty] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diaryError, setDiaryError] = useState('');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [diarySearch, setDiarySearch] = useState(searchParams.get('search') || '');
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || todayStr);
  const [timeline, setTimeline] = useState([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [timelineStartDate, setTimelineStartDate] = useState(searchParams.get('tl_start') || '');
  const [timelineEndDate, setTimelineEndDate] = useState(searchParams.get('tl_end') || todayStr);
  const [timelineTypeFilter, setTimelineTypeFilter] = useState(searchParams.get('tl_type') || '');
  const [sessions, setSessions] = useState([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  // T-02: filter the Sessions tab by inquiry. '' = all sessions, 'none' =
  // sessions with no inquiry, otherwise a positive integer (inquiry id).
  const [sessionsInquiryFilter, setSessionsInquiryFilter] = useState('');
  const [sessionUploadFile, setSessionUploadFile] = useState(null);
  const [sessionUploading, setSessionUploading] = useState(false);
  const [sessionUploadProgress, setSessionUploadProgress] = useState(0);
  const [sessionUploadMsg, setSessionUploadMsg] = useState('');
  const [sessionUploadError, setSessionUploadError] = useState('');
  const [sessionDragActive, setSessionDragActive] = useState(false);
  // T-07: Optional metadata sent alongside the audio upload.
  // meetingDate -> scheduled_at (T-02 compatible), title -> sessions.title, inquiryId -> sessions.inquiry_id (T-01).
  // T-02: meeting_date defaults to today; therapist can change it before
  // uploading the recording. Empty string is still allowed for backwards
  // compatibility (the API will fall back to created_at on the backend).
  const [sessionMeetingDate, setSessionMeetingDate] = useState(todayStr);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionInquiryId, setSessionInquiryId] = useState('');
  // T-19: when the client did not consent to recording, the therapist can
  // upload a Zoom-style mixed audio file and have the system keep only their
  // voice. Default false (= mixed mode = legacy behaviour).
  const [sessionSingleTrack, setSessionSingleTrack] = useState(false);
  const sessionFileInputRef = useRef(null);

  // Accepted media formats for session upload (mp3, m4a, wav, mp4, webm, ogg)
  const SESSION_UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100MB
  const SESSION_UPLOAD_ACCEPT = 'audio/*,video/*,.mp3,.m4a,.wav,.mp4,.webm,.ogg';

  // Validate file type/size before accepting upload
  function validateSessionFile(file) {
    if (!file) return { valid: false, error: 'No file selected' };
    if (file.size > SESSION_UPLOAD_MAX_BYTES) {
      return {
        valid: false,
        error: t('session.upload.tooLarge', 'File too large. Maximum size is 100MB.') +
          ` (${(file.size / (1024 * 1024)).toFixed(1)}MB)`
      };
    }
    const name = (file.name || '').toLowerCase();
    const allowedExt = ['.mp3', '.m4a', '.wav', '.mp4', '.webm', '.ogg', '.aac', '.flac', '.mov', '.mkv'];
    const hasAllowedExt = allowedExt.some(ext => name.endsWith(ext));
    const isAudio = (file.type || '').startsWith('audio/');
    const isVideo = (file.type || '').startsWith('video/');
    if (!isAudio && !isVideo && !hasAllowedExt) {
      return {
        valid: false,
        error: t('session.upload.invalidType', 'Unsupported file type. Use mp3, m4a, wav, mp4, webm, or ogg.')
      };
    }
    return { valid: true };
  }
  const [exercises, setExercises] = useState([]);
  const [exercisesTotal, setExercisesTotal] = useState(0);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [sendingExercise, setSendingExercise] = useState(null);
  const [exerciseSendMsg, setExerciseSendMsg] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  // NL Query state
  const [nlQueryText, setNlQueryText] = useState('');
  const [nlQueryLoading, setNlQueryLoading] = useState(false);
  const [nlQueryResult, setNlQueryResult] = useState(null);
  const [nlQueryError, setNlQueryError] = useState('');
  const [nlQueryUpgradeRequired, setNlQueryUpgradeRequired] = useState(false);
  const [showNlQuery, setShowNlQuery] = useState(false);
  const [nlSortBy, setNlSortBy] = useState('relevance');
  // Export state
  const [exportFormat, setExportFormat] = useState('json');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  // SOS state
  const [sosEvents, setSosEvents] = useState([]);
  const [sosTotal, setSosTotal] = useState(0);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosActionLoading, setSosActionLoading] = useState(null);
  const [sosMsg, setSosMsg] = useState('');
  // Inquiries state (T-01)
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesTotal, setInquiriesTotal] = useState(0);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [inquiriesError, setInquiriesError] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('');
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryFormTitle, setInquiryFormTitle] = useState('');
  const [inquiryFormDescription, setInquiryFormDescription] = useState('');
  const [inquirySaving, setInquirySaving] = useState(false);
  const [editingInquiryId, setEditingInquiryId] = useState(null);
  const [editingInquiryTitle, setEditingInquiryTitle] = useState('');
  const [editingInquiryDescription, setEditingInquiryDescription] = useState('');
  const [inquiryActionLoading, setInquiryActionLoading] = useState(null);
  // T-17 Supervision share modal
  const [showSupervisionShare, setShowSupervisionShare] = useState(false);
  // T-16: per-client reminders override (null = inherit, true = on, false = off)
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [remindersMsg, setRemindersMsg] = useState('');
  const { on: onWsEvent } = useWebSocket();
  const token = localStorage.getItem('token');

  // Warn user before leaving page with unsaved form data
  const hasUnsavedChanges = newNoteContent.trim() !== '' || contextDirty;
  useNavigationBlocker(hasUnsavedChanges);

  // Track previous client ID to detect client switches
  const prevIdRef = useRef(id);

  // Reset all filters when switching to a different client
  useEffect(() => {
    if (prevIdRef.current !== id) {
      prevIdRef.current = id;
      // Reset diary filters
      setTypeFilter('');
      setDateFrom('');
      setDateTo(new Date().toISOString().split('T')[0]);
      // Reset timeline filters
      setTimelineStartDate('');
      setTimelineEndDate(new Date().toISOString().split('T')[0]);
      setTimelineTypeFilter('');
      // Reset pagination
      setDiaryPage(1);
      setDiaryHasMore(false);
      setTimelinePage(1);
      setTimelineHasMore(false);
      // Reset notes search and diary search
      setNotesSearch('');
      setDiarySearch('');
      // Reset tab to default
      setActiveTab('timeline');
      // Reset data states
      setDiary([]);
      setDiaryTotal(0);
      setNotes([]);
      setNotesTotal(0);
      setTimeline([]);
      setTimelineTotal(0);
      setSessions([]);
      setSessionsTotal(0);
      setExercises([]);
      setExercisesTotal(0);
      setInquiries([]);
      setInquiriesTotal(0);
      setInquiryStatusFilter('');
      setShowInquiryForm(false);
      setInquiryFormTitle('');
      setInquiryFormDescription('');
      setEditingInquiryId(null);
      setNewNoteContent('');
      setContext(null);
      setContextForm({ anamnesis: '', current_goals: '', contraindications: '', ai_instructions: '' });
      setContextDirty(false);
      setContextMsg('');
      setError('');
      setDiaryError('');
      setLoading(true);
      setClient(null);
    }
  }, [id]);

  // Sync filter state to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab && activeTab !== 'timeline') params.set('tab', activeTab);
    if (typeFilter) params.set('type', typeFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (diarySearch) params.set('search', diarySearch);
    if (timelineStartDate) params.set('tl_start', timelineStartDate);
    if (timelineEndDate) params.set('tl_end', timelineEndDate);
    if (timelineTypeFilter) params.set('tl_type', timelineTypeFilter);
    setSearchParams(params, { replace: true });
  }, [activeTab, typeFilter, dateFrom, dateTo, diarySearch, timelineStartDate, timelineEndDate, timelineTypeFilter]);

  // T-06: Solo clients have no diary/exercises/SOS — if a stale URL or
  // back-button lands the user on one of those tabs, snap back to timeline.
  // T-03: Assignments tab is also bot-only (the client has to read them
  // through Telegram), so solo clients skip it too.
  useEffect(() => {
    if (client && client.mode === 'solo' &&
        (activeTab === 'diary' || activeTab === 'exercises' || activeTab === 'sos' || activeTab === 'assignments')) {
      setActiveTab('timeline');
    }
  }, [client, activeTab]);

  // Validate client ID is a positive integer
  const isValidId = /^\d+$/.test(id) && Number(id) > 0;
  const clientAbortRef = useRef(null);

  // SOS fetch function (defined early so useEffect can reference it)
  const fetchSos = useCallback(async (signal) => {
    setSosLoading(true);
    try {
      const res = await fetch(`${API}/clients/${id}/sos`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.ok) {
        const data = await res.json();
        setSosEvents(data.sos_events || []);
        setSosTotal(data.total || 0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('SOS fetch error:', e);
    } finally {
      setSosLoading(false);
    }
  }, [id, token]);

  // Inquiries fetch function (T-01)
  const fetchInquiries = useCallback(async (signal, statusOverride) => {
    setInquiriesLoading(true);
    setInquiriesError('');
    try {
      const status = statusOverride !== undefined ? statusOverride : inquiryStatusFilter;
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await fetch(`${API}/clients/${id}/inquiries${qs}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInquiriesError(data.error || t('inquiry.errorLoad'));
        return;
      }
      const data = await res.json();
      if (signal && signal.aborted) return;
      setInquiries(data.inquiries || []);
      setInquiriesTotal(data.total || 0);
    } catch (e) {
      if (e.name !== 'AbortError') {
        setInquiriesError(e.message);
      }
    } finally {
      setInquiriesLoading(false);
    }
  }, [id, token, inquiryStatusFilter, t]);

  async function handleCreateInquiry(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!inquiryFormTitle.trim() || inquirySaving) return;
    setInquirySaving(true);
    setInquiriesError('');
    try {
      const res = await fetch(`${API}/clients/${id}/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: inquiryFormTitle.trim(),
          description: inquiryFormDescription.trim()
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('inquiry.errorSave'));
      }
      setInquiryFormTitle('');
      setInquiryFormDescription('');
      setShowInquiryForm(false);
      await fetchInquiries();
    } catch (err) {
      setInquiriesError(err.message);
    } finally {
      setInquirySaving(false);
    }
  }

  function startEditInquiry(inquiry) {
    setEditingInquiryId(inquiry.id);
    setEditingInquiryTitle(inquiry.title);
    setEditingInquiryDescription(inquiry.description || '');
  }

  function cancelEditInquiry() {
    setEditingInquiryId(null);
    setEditingInquiryTitle('');
    setEditingInquiryDescription('');
  }

  async function handleSaveInquiryEdit(inquiryId) {
    if (!editingInquiryTitle.trim() || inquiryActionLoading === inquiryId) return;
    setInquiryActionLoading(inquiryId);
    setInquiriesError('');
    try {
      const res = await fetch(`${API}/clients/${id}/inquiries/${inquiryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editingInquiryTitle.trim(),
          description: editingInquiryDescription.trim()
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('inquiry.errorSave'));
      }
      cancelEditInquiry();
      await fetchInquiries();
    } catch (err) {
      setInquiriesError(err.message);
    } finally {
      setInquiryActionLoading(null);
    }
  }

  async function handleChangeInquiryStatus(inquiryId, newStatus) {
    setInquiryActionLoading(inquiryId);
    setInquiriesError('');
    try {
      const res = await fetch(`${API}/clients/${id}/inquiries/${inquiryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('inquiry.errorSave'));
      }
      await fetchInquiries();
    } catch (err) {
      setInquiriesError(err.message);
    } finally {
      setInquiryActionLoading(null);
    }
  }

  async function handleDeleteInquiry(inquiryId) {
    if (!window.confirm(t('inquiry.confirmDelete'))) return;
    setInquiryActionLoading(inquiryId);
    setInquiriesError('');
    try {
      const res = await fetch(`${API}/clients/${id}/inquiries/${inquiryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete inquiry');
      }
      await fetchInquiries();
    } catch (err) {
      setInquiriesError(err.message);
    } finally {
      setInquiryActionLoading(null);
    }
  }

  // Load client and all sub-resources when client ID changes
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!isValidId) {
      setError('Invalid client ID');
      setLoading(false);
      return;
    }

    // Abort previous requests when deps change or component unmounts
    if (clientAbortRef.current) {
      clientAbortRef.current.abort();
    }
    const controller = new AbortController();
    clientAbortRef.current = controller;

    // First verify the client exists and is accessible, then load sub-resources
    fetchClient(controller.signal).then(function(clientOk) {
      if (clientOk && !controller.signal.aborted) {
        fetchDiary(false, undefined, controller.signal);
        fetchNotes(undefined, controller.signal);
        fetchContext(controller.signal);
        fetchTimeline(false, controller.signal);
        fetchSessions(controller.signal);
        fetchExercises(controller.signal);
        fetchSos(controller.signal);
        fetchInquiries(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [id]);

  // Re-fetch only diary when diary filters change
  useEffect(() => {
    if (!token || !isValidId) return;
    fetchDiary();
  }, [typeFilter, dateFrom, dateTo]);

  // Re-fetch only timeline when timeline filters change
  useEffect(() => {
    if (!token || !isValidId) return;
    fetchTimeline();
  }, [timelineStartDate, timelineEndDate, timelineTypeFilter]);

  // WebSocket: auto-refresh SOS when new sos_alert arrives for this client
  useEffect(() => {
    const unsubscribe = onWsEvent('sos_alert', (data) => {
      if (!data.client_id || String(data.client_id) === String(id)) {
        fetchSos();
      }
    });
    return unsubscribe;
  }, [onWsEvent, id, fetchSos]);

  // Re-fetch inquiries when status filter changes (after initial load)
  useEffect(() => {
    if (!token || !isValidId) return;
    fetchInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryStatusFilter]);

  // T-02: re-fetch sessions when the inquiry filter changes (after initial load)
  useEffect(() => {
    if (!token || !isValidId) return;
    fetchSessions(undefined, { inquiryFilter: sessionsInquiryFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsInquiryFilter]);

  async function fetchClient(signal) {
    try {
      const res = await fetch(`${API}/clients/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return false;
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return false;
      }
      if (res.status === 404) {
        setError(t('client.not_found', 'This client is no longer available. They may have been unlinked or their consent was revoked.'));
        setLoading(false);
        return false;
      }
      if (res.status === 403) {
        setError(t('client.access_denied', 'You do not have permission to view this client.'));
        setLoading(false);
        return false;
      }
      if (!res.ok) throw new Error('Failed to fetch client');
      const data = await res.json();
      if (signal && signal.aborted) return false;
      setClient(data.client);
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      setError(e.message);
      return false;
    }
  }

  async function fetchDiary(loadMore = false, searchOverride, signal) {
    try {
      if (loadMore) {
        setDiaryLoadingMore(true);
      } else {
        setLoading(true);
        setDiaryPage(1);
      }
      setDiaryError('');
      const currentPage = loadMore ? diaryPage + 1 : 1;
      const params = new URLSearchParams();
      if (typeFilter) params.set('entry_type', typeFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const searchVal = searchOverride !== undefined ? searchOverride : diarySearch;
      if (searchVal.trim()) params.set('search', searchVal.trim());
      params.set('page', currentPage);
      params.set('per_page', '25');
      var tz = getUserTimezone();
      if (tz) params.set('timezone', tz);
      const qs = params.toString();
      const url = `${API}/clients/${id}/diary${qs ? '?' + qs : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDiaryError(data.error || 'Failed to fetch diary');
        return;
      }
      const data = await res.json();
      if (signal && signal.aborted) return;
      if (loadMore) {
        setDiary(prev => [...prev, ...data.entries]);
        setDiaryPage(currentPage);
      } else {
        setDiary(data.entries);
      }
      setDiaryTotal(data.total);
      setDiaryHasMore(currentPage < (data.total_pages || 1));
    } catch (e) {
      if (e.name === 'AbortError') return;
      setDiaryError(e.message);
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
        setDiaryLoadingMore(false);
      }
    }
  }

  async function deleteDiaryEntry(entryId) {
    if (!window.confirm('Are you sure you want to delete this diary entry?')) return;
    try {
      const res = await fetch(`${API}/clients/${id}/diary/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 404) {
        // Entry was already deleted (e.g., by another session)
        setContextMsg('This entry has already been deleted.');
        fetchDiary();
        fetchTimeline();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete diary entry');
        return;
      }
      // Refresh diary and timeline
      fetchDiary();
      fetchTimeline();
    } catch (e) {
      alert('Error deleting diary entry: ' + e.message);
    }
  }

  async function fetchNotes(search, signal) {
    try {
      const params = new URLSearchParams();
      const q = (search !== undefined ? search : notesSearch).trim();
      if (q) params.set('search', q);
      const qs = params.toString();
      const res = await fetch(`${API}/clients/${id}/notes${qs ? '?' + qs : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      if (signal && signal.aborted) return;
      setNotes(data.notes);
      setNotesTotal(data.total);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Notes fetch error:', e.message);
    }
  }

  async function handleCreateNote(e) {
    e.preventDefault();
    if (!newNoteContent.trim() || creatingNote) return;
    setCreatingNote(true);
    try {
      const res = await fetch(`${API}/clients/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newNoteContent.trim() })
      });
      if (!res.ok) throw new Error('Failed to create note');
      setNewNoteContent('');
      fetchNotes();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreatingNote(false);
    }
  }

  async function handleUpdateNote(noteId) {
    if (!editingNoteContent.trim() || updatingNote) return;
    setUpdatingNote(true);
    try {
      const res = await fetch(`${API}/clients/${id}/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: editingNoteContent.trim() })
      });
      if (!res.ok) throw new Error('Failed to update note');
      setEditingNoteId(null);
      setEditingNoteContent('');
      fetchNotes();
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingNote(false);
    }
  }

  async function handleExportDiary() {
    try {
      var res = await fetch(`${API}/clients/${id}/diary/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        alert(errData.error || 'Failed to export diary entries');
        return;
      }
      // Get filename from Content-Disposition header or use default
      var disposition = res.headers.get('Content-Disposition') || '';
      var filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      var filename = filenameMatch ? filenameMatch[1] : 'diary_export.json';
      var blob = await res.blob();
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  async function handleImportFile(e, importType) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // Reset file input
    setImportLoading(true);
    setImportMsg('');
    setImportError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/clients/${id}/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error + (data.details ? ' (' + data.details + ')' : ''));
        return;
      }
      setImportMsg(`Imported ${data.imported}/${data.total} ${importType} successfully.` +
        (data.errors ? ` ${data.errors.length} entries had errors.` : ''));
      if (importType === 'notes') fetchNotes();
      else fetchDiary();
    } catch (err) {
      setImportError('Import failed: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  }

  async function fetchContext(signal) {
    try {
      const res = await fetch(`${API}/clients/${id}/context`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) throw new Error('Failed to fetch context');
      const data = await res.json();
      if (signal && signal.aborted) return;
      setContext(data.context);
      setContextForm({
        anamnesis: data.context.anamnesis || '',
        current_goals: data.context.current_goals || '',
        contraindications: data.context.contraindications || '',
        ai_instructions: data.context.ai_instructions || ''
      });
      setContextDirty(false);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Context fetch error:', e.message);
    }
  }

  async function handleSaveContext(e) {
    e.preventDefault();
    setContextSaving(true);
    setContextMsg('');
    try {
      const body = {};
      if (contextForm.anamnesis.trim()) body.anamnesis = contextForm.anamnesis.trim();
      if (contextForm.current_goals.trim()) body.current_goals = contextForm.current_goals.trim();
      if (contextForm.contraindications.trim()) body.contraindications = contextForm.contraindications.trim();
      if (contextForm.ai_instructions.trim()) body.ai_instructions = contextForm.ai_instructions.trim();

      if (Object.keys(body).length === 0) {
        setContextMsg('Please fill in at least one field.');
        setContextSaving(false);
        return;
      }

      // Send expected_updated_at for optimistic concurrency control
      if (context && context.updated_at) {
        body.expected_updated_at = context.updated_at;
      }

      const res = await fetch(`${API}/clients/${id}/context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (res.status === 409) {
        // Conflict detected - another session modified the context
        const conflictData = await res.json().catch(() => ({}));
        if (conflictData.conflict && conflictData.latest_context) {
          setContext(conflictData.latest_context);
          setContextForm({
            anamnesis: conflictData.latest_context.anamnesis || '',
            current_goals: conflictData.latest_context.current_goals || '',
            contraindications: conflictData.latest_context.contraindications || '',
            ai_instructions: conflictData.latest_context.ai_instructions || ''
          });
          setContextDirty(false);
        }
        setContextMsg('Conflict: Context was modified in another session. The latest version has been loaded. Please review and save again.');
        setContextSaving(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save context');
      }
      const data = await res.json();
      setContext(data.context);
      setContextDirty(false);
      setContextMsg('Context saved successfully!');
    } catch (e) {
      setContextMsg('Error: ' + e.message);
    } finally {
      setContextSaving(false);
    }
  }

  async function fetchTimeline(loadMore = false, signal) {
    try {
      if (loadMore) {
        setTimelineLoadingMore(true);
      } else {
        setTimelineLoading(true);
        setTimelinePage(1);
      }
      const currentPage = loadMore ? timelinePage + 1 : 1;
      const params = new URLSearchParams();
      if (timelineStartDate) params.set('start_date', timelineStartDate);
      if (timelineEndDate) params.set('end_date', timelineEndDate);
      if (timelineTypeFilter) params.set('type', timelineTypeFilter);
      params.set('page', currentPage);
      params.set('per_page', '50');
      var tz = getUserTimezone();
      if (tz) params.set('timezone', tz);
      const qs = params.toString();
      const url = `${API}/clients/${id}/timeline${qs ? '?' + qs : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Timeline error:', data.error);
        if (!loadMore) {
          setTimeline([]);
          setTimelineTotal(0);
        }
        return;
      }
      const data = await res.json();
      if (signal && signal.aborted) return;
      if (loadMore) {
        setTimeline(prev => [...prev, ...data.timeline]);
        setTimelinePage(currentPage);
      } else {
        setTimeline(data.timeline);
      }
      setTimelineTotal(data.total);
      setTimelineHasMore(data.has_more || false);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Timeline fetch error:', e.message);
    } finally {
      if (!signal || !signal.aborted) {
        setTimelineLoading(false);
        setTimelineLoadingMore(false);
      }
    }
  }

  async function fetchSessions(signal, opts = {}) {
    try {
      setSessionsLoading(true);
      // T-02: apply inquiry filter if one is active. We accept an explicit
      // override so call sites that change the filter and re-fetch don't
      // race against a stale React render of `sessionsInquiryFilter`.
      const inquiryFilter = Object.prototype.hasOwnProperty.call(opts, 'inquiryFilter')
        ? opts.inquiryFilter
        : sessionsInquiryFilter;
      const qs = new URLSearchParams();
      if (inquiryFilter !== '' && inquiryFilter !== null && inquiryFilter !== undefined) {
        qs.set('inquiry_id', String(inquiryFilter));
      }
      const url = qs.toString()
        ? `${API}/clients/${id}/sessions?${qs.toString()}`
        : `${API}/clients/${id}/sessions`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      if (signal && signal.aborted) return;
      setSessions(data.sessions);
      setSessionsTotal(data.total);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Sessions fetch error:', e.message);
    } finally {
      if (!signal || !signal.aborted) {
        setSessionsLoading(false);
      }
    }
  }

  async function handleSessionUpload() {
    if (!sessionUploadFile || sessionUploading) return;
    setSessionUploading(true);
    setSessionUploadProgress(0);
    setSessionUploadMsg('');
    setSessionUploadError('');

    try {
      const formData = new FormData();
      formData.append('audio', sessionUploadFile);
      formData.append('client_id', id);
      // T-07: optional metadata from the New Session form. Only send if present so
      // the backend keeps treating these as truly optional.
      if (sessionMeetingDate) formData.append('scheduled_at', sessionMeetingDate);
      if (sessionTitle.trim()) formData.append('title', sessionTitle.trim());
      if (sessionInquiryId) formData.append('inquiry_id', sessionInquiryId);
      // T-19: opt into single-track (therapist-only) mode
      if (sessionSingleTrack) formData.append('recording_mode', 'single_track');

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/sessions`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        // Get CSRF token from cookie or meta
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) {
          xhr.setRequestHeader('x-csrf-token', csrfMeta.content);
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setSessionUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || `Upload failed (${xhr.status})`));
            }
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 300000; // 5 minutes
        xhr.send(formData);
      });

      setSessionUploadMsg(t('clientDetail.uploadSuccess', 'Session uploaded successfully! Transcription in progress...'));
      setSessionUploadFile(null);
      // Reset optional metadata fields (T-07 / T-02 — meeting_date defaults to today again)
      setSessionMeetingDate(todayStr);
      setSessionTitle('');
      setSessionInquiryId('');
      setSessionSingleTrack(false);
      if (sessionFileInputRef.current) sessionFileInputRef.current.value = '';

      // Refresh sessions list after a short delay to let transcription start
      setTimeout(() => {
        fetchSessions();
      }, 2000);

      // Refresh again after longer delay to catch completed transcription
      setTimeout(() => {
        fetchSessions();
      }, 8000);

      // Redirect to the new session detail page so the user sees transcription status
      if (result && result.id) {
        setTimeout(() => {
          navigate(`/sessions/${result.id}`);
        }, 800);
      }

    } catch (e) {
      setSessionUploadError(e.message);
    } finally {
      setSessionUploading(false);
      setSessionUploadProgress(0);
    }
  }

  // Drag-and-drop handlers for session upload dropzone
  function handleSessionDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!sessionUploading) setSessionDragActive(true);
  }
  function handleSessionDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setSessionDragActive(false);
  }
  function handleSessionDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setSessionDragActive(false);
    if (sessionUploading) return;
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const v = validateSessionFile(file);
    if (!v.valid) {
      setSessionUploadError(v.error);
      setSessionUploadFile(null);
      return;
    }
    setSessionUploadFile(file);
    setSessionUploadMsg('');
    setSessionUploadError('');
  }

  // T-16: persist per-client reminders override
  // value: true = force on, false = force off, null = inherit therapist default
  async function handleSaveRemindersOverride(value) {
    if (remindersSaving) return;
    setRemindersSaving(true);
    setRemindersMsg('');
    try {
      const res = await fetch(`${API}/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reminders_enabled: value })
      });
      if (!res.ok) {
        setRemindersMsg(t('clientDetail.remindersSaveFailed'));
        return;
      }
      const data = await res.json();
      if (data && data.client) {
        setClient(data.client);
      }
      setRemindersMsg(t('clientDetail.remindersSaved'));
      setTimeout(() => setRemindersMsg(''), 3000);
    } catch (e) {
      setRemindersMsg(t('clientDetail.remindersSaveFailed'));
    } finally {
      setRemindersSaving(false);
    }
  }

  async function handleExport() {
    if (exportLoading) return;
    setExportLoading(true);
    setExportMsg('');
    try {
      const res = await fetch(`${API}/export/client/${id}?format=${exportFormat}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.required_plans) {
          setExportMsg(t('clientDetail.exportUpgradeRequired'));
        } else {
          setExportMsg(data.error || t('clientDetail.exportFailed'));
        }
        return;
      }
      if (!res.ok) {
        setExportMsg(t('clientDetail.exportFailed'));
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = exportFormat === 'csv' ? 'zip' : 'json';
      a.href = url;
      a.download = `client_${id}_export.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportMsg(t('clientDetail.exportSuccess'));
    } catch (e) {
      setExportMsg(t('clientDetail.exportFailed'));
    } finally {
      setExportLoading(false);
    }
  }

  async function handleNlQuery(e) {
    if (e) e.preventDefault();
    if (!nlQueryText.trim() || nlQueryLoading) return;
    setNlQueryLoading(true);
    setNlQueryResult(null);
    setNlQueryError('');
    setNlQueryUpgradeRequired(false);

    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ client_id: parseInt(id), query: nlQueryText.trim() })
      });

      const data = await res.json();

      if (res.status === 403 && (data.error === 'Plan upgrade required' || data.required_plans)) {
        setNlQueryUpgradeRequired(true);
        setNlQueryError(data.message || t('clientDetail.nlUpgradeRequired', 'Natural language queries require a Pro or Premium plan.'));
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Query failed');
      }

      setNlQueryResult(data);
    } catch (err) {
      setNlQueryError(err.message);
    } finally {
      setNlQueryLoading(false);
    }
  }

  async function fetchExercises(signal) {
    try {
      setExercisesLoading(true);
      const res = await fetch(`${API}/clients/${id}/exercises`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (signal && signal.aborted) return;
      if (!res.ok) throw new Error('Failed to fetch exercises');
      const data = await res.json();
      if (signal && signal.aborted) return;
      setExercises(data.deliveries);
      setExercisesTotal(data.total);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Exercises fetch error:', e.message);
    } finally {
      if (!signal || !signal.aborted) {
        setExercisesLoading(false);
      }
    }
  }

  async function fetchExerciseLibrary() {
    if (exerciseLibrary.length > 0) return; // already loaded
    try {
      setExerciseLibraryLoading(true);
      const res = await fetch(`${API}/exercises?language=${lang}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch exercise library');
      const data = await res.json();
      setExerciseLibrary(data.exercises || []);
    } catch (e) {
      console.error('Exercise library fetch error:', e.message);
    } finally {
      setExerciseLibraryLoading(false);
    }
  }

  async function sendExercise(exerciseId) {
    try {
      setSendingExercise(exerciseId);
      setExerciseSendMsg('');
      const res = await fetch(`${API}/clients/${id}/exercises`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: exerciseId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send exercise');
      setExerciseSendMsg(data.message || 'Exercise sent!');
      setShowExercisePicker(false);
      fetchExercises();
    } catch (e) {
      setExerciseSendMsg('Error: ' + e.message);
    } finally {
      setSendingExercise(null);
    }
  }

  // SOS action handlers
  async function handleSosAcknowledge(sosId) {
    setSosActionLoading(sosId);
    setSosMsg('');
    try {
      const res = await fetch(`${API}/clients/${id}/sos/${sosId}/acknowledge`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to acknowledge');
      setSosMsg(t('clientDetail.sosAcknowledged'));
      fetchSos();
    } catch (e) {
      setSosMsg('Error: ' + e.message);
    } finally {
      setSosActionLoading(null);
    }
  }

  async function handleSosResolve(sosId) {
    setSosActionLoading(sosId);
    setSosMsg('');
    try {
      const res = await fetch(`${API}/clients/${id}/sos/${sosId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve');
      setSosMsg(t('clientDetail.sosResolved'));
      fetchSos();
    } catch (e) {
      setSosMsg('Error: ' + e.message);
    } finally {
      setSosActionLoading(null);
    }
  }

  const timelineTypeIcon = (item) => {
    switch(item.type) {
      case 'diary': return item.entry_type === 'voice' ? '🎤' : item.entry_type === 'video' ? '🎥' : '📝';
      case 'note': return '🗒️';
      case 'session': return '🎧';
      default: return '📄';
    }
  };

  const timelineTypeBadge = (item) => {
    switch(item.type) {
      case 'diary': return { label: `Diary (${item.entry_type})`, color: 'bg-blue-100 text-blue-800' };
      case 'note': return { label: 'Therapist Note', color: 'bg-amber-100 text-amber-800' };
      case 'session': return { label: `Session (${item.status})`, color: 'bg-green-100 text-green-800' };
      default: return { label: item.type, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const typeIcon = (type) => {
    switch(type) {
      case 'text': return '📝';
      case 'voice': return '🎤';
      case 'video': return '🎥';
      default: return '📄';
    }
  };

  const typeBadgeColor = (type) => {
    switch(type) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'voice': return 'bg-purple-100 text-purple-800';
      case 'video': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-5xl mb-4" role="img" aria-label="warning">&#9888;</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('client.unavailable', 'Client Unavailable')}</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/clients')}
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            {t('nav.clients', 'Back to Clients')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {client && (
          <div className="mb-6">
            <Breadcrumb items={[
              { label: t('nav.dashboard'), to: '/dashboard' },
              { label: t('nav.clients'), to: '/clients' },
              { label: [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || client.telegram_id || `#${client.id}` }
            ]} />
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-stone-800">
                {[client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || client.telegram_id || `#${client.id}`}
              </h2>
              {/* T-06: Solo mode badge — flag therapist-only "smart notebook" clients */}
              {client.mode === 'solo' && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
                  title={t('client.solo.badgeTooltip', 'Therapist-only notebook — client is not connected to the bot.')}
                  data-testid="client-solo-badge"
                >
                  📓 {t('client.solo.badge', 'Solo')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-stone-500">
              {client.phone && <span>{t('clientDetail.phone')}: {client.phone}</span>}
              {client.telegram_username && <span>{t('clientDetail.telegram')}: @{client.telegram_username}</span>}
              <span>{t('clientDetail.language')}: {(client.language || 'en').toUpperCase()}</span>
              <span>{t('clientDetail.consent')}: {client.consent_therapist_access ? t('clientDetail.consentGranted') : t('clientDetail.consentNotGranted')}</span>
              <span>{t('clientDetail.joined')}: {formatUserDateOnly(client.created_at)}</span>
              {client.mode === 'solo' && (
                <span className="text-indigo-600">
                  {t('client.solo.subtitle', 'Therapist-only notebook · no bot connection')}
                </span>
              )}
            </div>
            {/* T-16: Per-client reminders override */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" data-testid="client-reminders-control">
              <label htmlFor="client-reminders-select" className="text-stone-600">
                {t('clientDetail.remindersLabel')}:
              </label>
              <select
                id="client-reminders-select"
                data-testid="client-reminders-select"
                disabled={remindersSaving}
                value={client.reminders_enabled === true ? 'on' : client.reminders_enabled === false ? 'off' : 'inherit'}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = v === 'on' ? true : v === 'off' ? false : null;
                  handleSaveRemindersOverride(next);
                }}
                className="px-2 py-1 border border-stone-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
              >
                <option value="inherit">{t('clientDetail.remindersInherit', { state: '—' })}</option>
                <option value="on">{t('clientDetail.remindersOverrideOn')}</option>
                <option value="off">{t('clientDetail.remindersOverrideOff')}</option>
              </select>
              <span className="text-xs text-stone-400 italic">{t('clientDetail.remindersHint')}</span>
              {remindersMsg && (
                <span className={`text-xs ${remindersMsg === t('clientDetail.remindersSaved') ? 'text-green-600' : 'text-amber-600'}`}>
                  {remindersMsg}
                </span>
              )}
            </div>
            {/* Export All Data */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="px-2 py-1.5 border border-stone-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="json">{t('clientDetail.exportJSON', 'JSON')}</option>
                <option value="csv">{t('clientDetail.exportCSV', 'CSV (ZIP)')}</option>
              </select>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="px-3 py-1.5 bg-stone-600 text-white rounded text-sm hover:bg-stone-700 disabled:opacity-50 flex items-center gap-1"
              >
                <span>📥</span>
                {exportLoading ? t('clientDetail.exportDownloading', 'Exporting...') : t('clientDetail.exportAllData', 'Export All Data')}
              </button>
              <button
                type="button"
                onClick={() => setShowSupervisionShare(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                title={t('supervision.openModalHint', 'Generate a read-only share link for a supervisor')}
              >
                <span>🔗</span>
                {t('supervision.openModalBtn', 'Share for supervision')}
              </button>
              {exportMsg && (
                <span className={`text-sm ${exportMsg.includes(t('clientDetail.exportSuccess', 'success')) || exportMsg === t('clientDetail.exportSuccess') ? 'text-green-600' : 'text-amber-600'}`}>
                  {exportMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* T-17 Supervision share modal */}
        {client && (
          <SupervisionShareModal
            open={showSupervisionShare}
            onClose={() => setShowSupervisionShare(false)}
            clientId={client.id}
            clientLabel={[client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || client.telegram_id || `#${client.id}`}
            token={token}
          />
        )}

        {/* Tab Navigation.
            T-06: Solo clients have no bot side, so Diary, Exercises, and SOS
            tabs are hidden — those flows are exclusively client-driven via
            Telegram. The therapist can still use Timeline, Notes, Sessions,
            Inquiries, Context, and Comments. */}
        {(() => {
          const isSolo = client && client.mode === 'solo';
          return (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin" data-testid="client-tabs">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'timeline' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
              >📊 {t('clientDetail.timeline')} ({timelineTotal})</button>
              {!isSolo && (
                <button
                  onClick={() => setActiveTab('diary')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'diary' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                  data-testid="tab-diary"
                >📝 {t('clientDetail.diary')} ({diaryTotal})</button>
              )}
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'notes' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
              >🗒️ {t('clientDetail.notesTab')} ({notesTotal})</button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'sessions' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
              >🎧 {t('clientDetail.sessionsTab')} ({sessionsTotal})</button>
              <button
                onClick={() => setActiveTab('inquiries')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'inquiries' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
              >🎯 {t('clientDetail.inquiriesTab')} ({inquiriesTotal})</button>
              {!isSolo && (
                <button
                  onClick={() => setActiveTab('exercises')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'exercises' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                  data-testid="tab-exercises"
                >💪 {t('clientDetail.exercisesTab')} ({exercisesTotal})</button>
              )}
              {/* T-03: Assignments — aggregated homework list across all sessions.
                  Solo clients have no bot side, so they don't get this tab
                  (assignments only make sense if the client receives them
                  via Telegram). */}
              {!isSolo && (
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'assignments' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                  data-testid="tab-assignments"
                >📝 {t('assignment.title')}</button>
              )}
              <button
                onClick={() => setActiveTab('context')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'context' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
              >🧠 {t('clientDetail.contextTab')}</button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'comments' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
              >💬 {t('comments.title')}</button>
              {!isSolo && (
                <button
                  onClick={() => setActiveTab('sos')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'sos' ? 'bg-red-600 text-white' : sosEvents.some(e => e.status !== 'resolved') ? 'bg-red-50 text-red-700 border border-red-300 animate-pulse' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                  data-testid="tab-sos"
                >🚨 {t('clientDetail.sosTab')} ({sosTotal})</button>
              )}
            </div>
          );
        })()}

        {/* SOS Status Banner */}
        {(() => {
          const activeSos = sosEvents.filter(e => e.status === 'triggered' || e.status === 'acknowledged');
          if (activeSos.length === 0) return null;
          return (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4 animate-pulse">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚨</span>
                  <div>
                    <h3 className="text-red-800 font-bold text-lg">{t('clientDetail.sosActiveAlert')}</h3>
                    <p className="text-red-600 text-sm">
                      {t('clientDetail.sosActiveCount', { count: activeSos.length })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {activeSos.filter(e => e.status === 'triggered').map(e => (
                    <button
                      key={`ack-${e.id}`}
                      onClick={() => handleSosAcknowledge(e.id)}
                      disabled={sosActionLoading === e.id}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                    >
                      {sosActionLoading === e.id ? '...' : t('clientDetail.sosAcknowledgeBtn')}
                    </button>
                  ))}
                  {activeSos.filter(e => e.status === 'acknowledged').map(e => (
                    <button
                      key={`res-${e.id}`}
                      onClick={() => handleSosResolve(e.id)}
                      disabled={sosActionLoading === e.id}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {sosActionLoading === e.id ? '...' : t('clientDetail.sosResolveBtn')}
                    </button>
                  ))}
                </div>
              </div>
              {sosMsg && <p className="mt-2 text-sm text-red-700">{sosMsg}</p>}
            </div>
          );
        })()}

        {/* NL Query Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-4 mb-4">
          <button
            onClick={() => setShowNlQuery(!showNlQuery)}
            className="flex items-center gap-2 w-full text-left"
          >
            <span className="text-lg">🔍</span>
            <span className="font-medium text-stone-700">{t('clientDetail.askAboutClient', 'Ask about this client')}</span>
            <span className="ml-auto text-stone-400 text-sm">{showNlQuery ? '▲' : '▼'}</span>
          </button>

          {showNlQuery && (
            <div className="mt-3">
              <form onSubmit={handleNlQuery} className="flex gap-2">
                <input
                  type="text"
                  value={nlQueryText}
                  onChange={(e) => setNlQueryText(e.target.value)}
                  placeholder={t('clientDetail.nlQueryPlaceholder', 'e.g., "How has their anxiety been lately?" or "What exercises worked best?"')}
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  maxLength={1000}
                  disabled={nlQueryLoading}
                />
                <button
                  type="submit"
                  disabled={nlQueryLoading || !nlQueryText.trim()}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {nlQueryLoading ? <LoadingSpinner size={16} /> : <span>🔍</span>}
                  {t('clientDetail.nlSearch', 'Search')}
                </button>
              </form>

              {/* Upgrade Required */}
              {nlQueryUpgradeRequired && (
                <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⭐</span>
                    <span className="font-medium text-amber-800">{t('clientDetail.nlProFeature', 'Pro Feature')}</span>
                  </div>
                  <p className="text-sm text-amber-700">{nlQueryError}</p>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                  >
                    {t('clientDetail.nlUpgradeBtn', 'Upgrade Plan')}
                  </button>
                </div>
              )}

              {/* Query Error */}
              {nlQueryError && !nlQueryUpgradeRequired && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  ❌ {nlQueryError}
                </div>
              )}

              {/* Loading */}
              {nlQueryLoading && (
                <div className="mt-3 p-4 text-center text-stone-500">
                  <LoadingSpinner size={24} className="mx-auto mb-2" />
                  <p className="text-sm">{t('clientDetail.nlSearching', 'Searching client records...')}</p>
                </div>
              )}

              {/* Query Results */}
              {nlQueryResult && !nlQueryLoading && (
                <div className="mt-3">
                  {/* Expanded terms visualization */}
                  {nlQueryResult.expanded_terms && nlQueryResult.expanded_terms.length > 0 && (
                    <div className="mb-3 p-3 bg-teal-50 border border-teal-100 rounded-lg">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-medium text-teal-800">{t('clientDetail.nlQueryExpansion', 'Search expansion:')}</span>
                        <span className="text-teal-600 font-medium">"{nlQueryResult.query}"</span>
                        <span className="text-teal-400">→</span>
                        {nlQueryResult.expanded_terms.slice(0, 8).map((term, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">{term}</span>
                        ))}
                        {nlQueryResult.expanded_terms.length > 8 && (
                          <span className="text-teal-500">+{nlQueryResult.expanded_terms.length - 8} {t('clientDetail.nlMore', 'more')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Results header with count, time, and sort */}
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-sm text-stone-500">
                      {nlQueryResult.total_matches > 0
                        ? t('clientDetail.nlResultsFound', 'Found {{count}} relevant results (searched {{total}})', { count: nlQueryResult.total_matches, total: nlQueryResult.total_searched })
                        : t('clientDetail.nlNoResults', 'No relevant results found')}
                      {nlQueryResult.search_time_ms != null && (
                        <span className="text-stone-400 ml-1">
                          ({(nlQueryResult.search_time_ms / 1000).toFixed(1)}s)
                        </span>
                      )}
                    </span>
                    {nlQueryResult.results && nlQueryResult.results.length > 1 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-stone-400">{t('clientDetail.nlSortBy', 'Sort by:')}</span>
                        <button
                          onClick={() => setNlSortBy('relevance')}
                          className={`px-2 py-0.5 rounded ${nlSortBy === 'relevance' ? 'bg-teal-100 text-teal-700 font-medium' : 'text-stone-500 hover:bg-stone-100'}`}
                        >
                          {t('clientDetail.nlSortRelevance', 'Relevance')}
                        </button>
                        <button
                          onClick={() => setNlSortBy('date')}
                          className={`px-2 py-0.5 rounded ${nlSortBy === 'date' ? 'bg-teal-100 text-teal-700 font-medium' : 'text-stone-500 hover:bg-stone-100'}`}
                        >
                          {t('clientDetail.nlSortDate', 'Date')}
                        </button>
                      </div>
                    )}
                  </div>

                  {nlQueryResult.results && nlQueryResult.results.length > 0 && (
                    <div className="space-y-2">
                      {[...nlQueryResult.results]
                        .sort((a, b) => nlSortBy === 'date'
                          ? new Date(b.created_at) - new Date(a.created_at)
                          : (b.similarity_score || b.relevance) - (a.similarity_score || a.relevance)
                        )
                        .map((result, idx) => {
                          const score = result.similarity_score != null ? result.similarity_score : 0;
                          const scoreColor = score > 0.7 ? 'bg-green-500' : score > 0.4 ? 'bg-amber-400' : 'bg-stone-300';
                          const scoreLabelColor = score > 0.7 ? 'text-green-700' : score > 0.4 ? 'text-amber-700' : 'text-stone-500';
                          const scoreLabel = score > 0.7
                            ? t('clientDetail.nlHighRelevance', 'High')
                            : score > 0.4
                            ? t('clientDetail.nlMedRelevance', 'Medium')
                            : t('clientDetail.nlLowRelevance', 'Low');

                          // Highlight matched terms in content
                          const highlightTerms = [...(nlQueryResult.query_tokens || []), ...(nlQueryResult.expanded_terms || []).slice(0, 5)];
                          const highlightContent = (text) => {
                            if (!text || highlightTerms.length === 0) return text;
                            const escapedTerms = highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                            const regex = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
                            const parts = text.split(regex);
                            return parts.map((part, i) => {
                              if (regex.test && highlightTerms.some(ht => part.toLowerCase() === ht.toLowerCase())) {
                                return <mark key={i} className="bg-teal-100 text-teal-900 px-0.5 rounded">{part}</mark>;
                              }
                              return part;
                            });
                          };

                          return (
                            <div
                              key={`${result.type}-${result.id}-${idx}`}
                              className="border border-stone-200 rounded-lg p-3 hover:border-teal-300 transition-colors cursor-pointer"
                              onClick={() => {
                                if (result.type === 'session') navigate(`/sessions/${result.id}`);
                              }}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-sm">
                                  {result.type === 'diary' ? '📝' : result.type === 'note' ? '🗒️' : '🎧'}
                                </span>
                                <span className="text-xs font-medium text-stone-600 uppercase">
                                  {result.type === 'diary' ? (result.entry_type || 'diary') : result.type}
                                </span>
                                <span className="text-xs text-stone-400">{formatUserDateOnly(result.created_at)}</span>
                                <div className="ml-auto flex items-center gap-1.5">
                                  <span className={`text-xs font-medium ${scoreLabelColor}`}>{scoreLabel}</span>
                                  <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden" title={`${Math.round(score * 100)}%`}>
                                    <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${Math.round(score * 100)}%` }}></div>
                                  </div>
                                  <span className="text-xs text-stone-400">{Math.round(score * 100)}%</span>
                                </div>
                              </div>
                              <p className="text-sm text-stone-700 whitespace-pre-wrap line-clamp-3">{highlightContent(result.content)}</p>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {nlQueryResult.total_matches === 0 && (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2">🔍</div>
                      <p className="text-sm text-stone-500">{t('clientDetail.nlNoResultsHint', 'Try different keywords or a broader question.')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">{t('clientDetail.unifiedTimeline', { count: timelineTotal })}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimelineTypeFilter('')}
                  className={`px-3 py-1 rounded text-sm ${!timelineTypeFilter ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >All</button>
                <button
                  onClick={() => setTimelineTypeFilter('diary')}
                  className={`px-3 py-1 rounded text-sm ${timelineTypeFilter === 'diary' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >📝 Diary</button>
                <button
                  onClick={() => setTimelineTypeFilter('note')}
                  className={`px-3 py-1 rounded text-sm ${timelineTypeFilter === 'note' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >🗒️ Notes</button>
                <button
                  onClick={() => setTimelineTypeFilter('session')}
                  className={`px-3 py-1 rounded text-sm ${timelineTypeFilter === 'session' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >🎧 Sessions</button>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-stone-50 rounded-lg">
              <label className="text-sm font-medium text-stone-600">{t('clientDetail.filterByDate')}</label>
              <input
                type="date"
                value={timelineStartDate}
                onChange={(e) => setTimelineStartDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Timeline start date"
              />
              <span className="text-stone-400 text-sm">to</span>
              <input
                type="date"
                value={timelineEndDate}
                onChange={(e) => setTimelineEndDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Timeline end date"
              />
              {(timelineStartDate || timelineEndDate !== todayStr) && (
                <button
                  onClick={() => { setTimelineStartDate(''); setTimelineEndDate(todayStr); }}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                >Clear dates</button>
              )}
              {(timelineTypeFilter || timelineStartDate || timelineEndDate !== todayStr) && (
                <button
                  onClick={() => { setTimelineTypeFilter(''); setTimelineStartDate(''); setTimelineEndDate(todayStr); }}
                  className="ml-auto px-3 py-1.5 text-sm bg-stone-200 hover:bg-stone-300 text-stone-700 rounded font-medium"
                  aria-label="Reset all filters"
                >
                  {t('reset_all_filters', 'Reset all filters')}
                </button>
              )}
            </div>

            {timelineLoading ? (
              <p className="text-stone-500 text-center py-8">Loading timeline...</p>
            ) : timeline.length === 0 ? (
              <p className="text-stone-400 text-center py-8">No timeline items found{(timelineStartDate || timelineEndDate !== todayStr || timelineTypeFilter) ? ' for the selected filters' : ''}</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((item, idx) => {
                  const badge = timelineTypeBadge(item);
                  return (
                    <div key={`${item.type}-${item.id}`} className="border border-stone-200 rounded-lg p-4 relative">
                      {/* Timeline line connector */}
                      {idx < timeline.length - 1 && (
                        <div className="absolute left-8 top-full w-0.5 h-4 bg-stone-200" />
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{timelineTypeIcon(item)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-stone-400 ml-auto">
                          {formatUserDate(item.created_at)}
                        </span>
                      </div>

                      {/* Content based on type */}
                      {item.type === 'diary' && (
                        <div>
                          {/* Audio/Video player for voice and video diary entries */}
                          {item.has_audio_file && (
                            <div className="mb-3">
                              <AudioPlayer
                                sessionId={item.id}
                                audioRef={item.audio_file_ref}
                                streamUrl={`/api/diary/${item.id}/stream`}
                              />
                            </div>
                          )}
                          {/* Transcription status badge for voice/video entries */}
                          {(item.entry_type === 'voice' || item.entry_type === 'video') && (
                            <div className="mb-2">
                              {item.transcription_status === 'completed' || item.transcript ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ Transcribed</span>
                              ) : item.transcription_status === 'processing' ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⏳ Processing</span>
                              ) : item.transcription_status === 'failed' ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">❌ Failed</span>
                              ) : item.transcription_status === 'pending' ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏱ Pending</span>
                              ) : !item.has_audio_file ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">📎 No audio file</span>
                              ) : null}
                            </div>
                          )}
                          <p className="text-stone-700 whitespace-pre-wrap">{item.content}</p>
                          {item.transcript && (
                            <div className="mt-2 p-2 bg-stone-50 rounded text-sm text-stone-600">
                              <span className="font-medium">Transcript:</span> {item.transcript}
                            </div>
                          )}
                        </div>
                      )}

                      {item.type === 'note' && (
                        <div>
                          <p className="text-stone-700 whitespace-pre-wrap">{item.content}</p>
                          {item.session_date && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-2 inline-block">
                              Session: {item.session_date}
                            </span>
                          )}
                        </div>
                      )}

                      {item.type === 'session' && (
                        <div>
                          <div className="flex gap-3 text-xs text-stone-500 mb-2">
                            <span>{item.has_audio ? '🔊 Audio' : '❌ No audio'}</span>
                            <span>{item.has_transcript ? '📄 Transcript' : '❌ No transcript'}</span>
                            <span>{item.summary ? '📋 Summary' : '❌ No summary'}</span>
                          </div>
                          {item.summary && (
                            <div className="p-3 bg-green-50 rounded-lg text-sm text-stone-700">
                              <p className="font-medium text-green-800 mb-1">Session Summary</p>
                              <p className="whitespace-pre-wrap">{item.summary.length > 300 ? item.summary.substring(0, 300) + '...' : item.summary}</p>
                            </div>
                          )}
                          <button
                            onClick={() => navigate(`/sessions/${item.id}`)}
                            className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                          >View Session Details &rarr;</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Pagination: showing count and Load More */}
                <div className="mt-4 text-center">
                  <p className="text-sm text-stone-500 mb-2">
                    Showing {timeline.length} of {timelineTotal} items
                  </p>
                  {timelineHasMore && (
                    <button
                      onClick={() => fetchTimeline(true)}
                      disabled={timelineLoadingMore}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    >
                      {timelineLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">{t('clientDetail.therapistNotes')}</h3>
              <label className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-200 cursor-pointer border border-stone-200">
                {importLoading ? 'Importing...' : 'Import JSON'}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  disabled={importLoading}
                  onChange={(e) => handleImportFile(e, 'notes')}
                />
              </label>
            </div>

            {importError && (
              <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                {importError}
              </div>
            )}
            {importMsg && (
              <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
                {importMsg}
              </div>
            )}

            {/* Search Notes */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={notesSearch}
                  onChange={(e) => {
                    setNotesSearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = notesSearch.trim();
                      setNotesSearch(trimmed);
                      fetchNotes(trimmed);
                    }
                  }}
                  placeholder="Search notes by keyword..."
                  className="w-full border border-stone-300 rounded-lg pl-10 pr-20 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <div className="absolute right-2 top-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => { const trimmed = notesSearch.trim(); setNotesSearch(trimmed); fetchNotes(trimmed); }}
                    className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700"
                  >
                    Search
                  </button>
                  {notesSearch && (
                    <button
                      type="button"
                      onClick={() => { setNotesSearch(''); fetchNotes(''); }}
                      className="px-2 py-1 bg-stone-200 text-stone-600 rounded text-xs font-medium hover:bg-stone-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {notesSearch && (
                <p className="text-xs text-stone-500 mt-1">
                  Showing {notes.length} of {notesTotal} notes matching "{notesSearch}"
                </p>
              )}
            </div>

            {/* Create Note Form */}
            <form onSubmit={handleCreateNote} className="mb-6">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write a private note about this client..."
                className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={creatingNote || !newNoteContent.trim()}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingNote && <LoadingSpinner size={16} className="mr-2" />}
                  {creatingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>

            {/* Notes List */}
            {notes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">{notesSearch ? '🔍' : '🗒️'}</div>
                <h3 className="text-lg font-medium text-stone-600 mb-2">
                  {notesSearch ? t('no_notes_filtered', 'No notes match your search') : t('no_notes_yet', 'No notes yet')}
                </h3>
                <p className="text-sm text-stone-400 max-w-sm mx-auto">
                  {notesSearch
                    ? t('no_notes_filtered_hint', 'Try adjusting your search query to find more notes.')
                    : t('no_notes_hint', 'Use the form above to create your first therapist note for this client.')}
                </p>
                {notesSearch && (
                  <button
                    onClick={() => { setNotesSearch(''); fetchNotes(''); }}
                    className="mt-4 px-4 py-2 text-sm bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors"
                  >
                    {t('clear_search', 'Clear search')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="border border-stone-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-stone-400">
                          {t('created', 'Created')}: {formatUserDate(note.created_at)}
                        </span>
                        {note.updated_at && note.updated_at !== note.created_at && (
                          <span className="text-xs text-stone-400">
                            | {t('updated', 'Updated')}: {formatUserDate(note.updated_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {note.session_date && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Session: {note.session_date}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditingNoteId(editingNoteId === note.id ? null : note.id);
                            setEditingNoteContent(note.content);
                          }}
                          className="text-xs text-teal-600 hover:text-teal-800 cursor-pointer"
                        >
                          {editingNoteId === note.id ? t('cancel', 'Cancel') : t('edit', 'Edit')}
                        </button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          className="w-full border border-stone-300 rounded-lg p-3 text-sm resize-y min-h-[80px]"
                          rows={3}
                        />
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          disabled={updatingNote || !editingNoteContent.trim()}
                          className="mt-2 px-4 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updatingNote ? t('saving', 'Saving...') : t('save', 'Save')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-stone-700 whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Context Tab */}
        {activeTab === 'context' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('clientDetail.clientContext')}</h3>
            {contextMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${contextMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {contextMsg}
              </div>
            )}
            <form onSubmit={handleSaveContext} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Anamnesis / History</label>
                <textarea
                  value={contextForm.anamnesis}
                  onChange={(e) => { setContextForm(f => ({ ...f, anamnesis: e.target.value })); setContextDirty(true); }}
                  placeholder="Patient history, background, relevant medical/psychological information..."
                  className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={4}
                  maxLength={50000}
                />
                <span className="text-xs text-stone-400">{contextForm.anamnesis.length}/50000</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Current Goals</label>
                <textarea
                  value={contextForm.current_goals}
                  onChange={(e) => { setContextForm(f => ({ ...f, current_goals: e.target.value })); setContextDirty(true); }}
                  placeholder="Current therapy goals and objectives..."
                  className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                  maxLength={50000}
                />
                <span className="text-xs text-stone-400">{contextForm.current_goals.length}/50000</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Contraindications</label>
                <textarea
                  value={contextForm.contraindications}
                  onChange={(e) => { setContextForm(f => ({ ...f, contraindications: e.target.value })); setContextDirty(true); }}
                  placeholder="Any contraindications or precautions..."
                  className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                  maxLength={50000}
                />
                <span className="text-xs text-stone-400">{contextForm.contraindications.length}/50000</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">AI Instructions / Boundaries</label>
                <textarea
                  value={contextForm.ai_instructions}
                  onChange={(e) => { setContextForm(f => ({ ...f, ai_instructions: e.target.value })); setContextDirty(true); }}
                  placeholder="Instructions for AI when processing this client's data..."
                  className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                  maxLength={50000}
                />
                <span className="text-xs text-stone-400">{contextForm.ai_instructions.length}/50000</span>
              </div>
              <div className="flex justify-between items-center">
                {context && context.updated_at && (
                  <span className="text-xs text-stone-400">Last updated: {formatUserDate(context.updated_at)}</span>
                )}
                <button
                  type="submit"
                  disabled={contextSaving}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contextSaving && <LoadingSpinner size={16} className="mr-2" />}
                  {contextSaving ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">{t('clientDetail.sessionHistory', { count: sessionsTotal })}</h3>
              <button
                onClick={() => sessionFileInputRef.current && sessionFileInputRef.current.click()}
                disabled={sessionUploading}
                data-testid="session-new-button"
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>🎙️</span> {t('session.upload.newSession', '+ New Session')}
              </button>
              <input
                ref={sessionFileInputRef}
                type="file"
                accept={SESSION_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const v = validateSessionFile(file);
                    if (!v.valid) {
                      setSessionUploadError(v.error);
                      setSessionUploadFile(null);
                      e.target.value = '';
                      return;
                    }
                    setSessionUploadFile(file);
                    setSessionUploadMsg('');
                    setSessionUploadError('');
                  }
                }}
              />
            </div>

            {/* T-02: calendar widget + inquiry filter.
                The calendar shows a dot under every date with at least one
                session for this client; clicking a dot navigates straight to
                that session. The inquiry dropdown narrows the calendar +
                list to a single inquiry thread. */}
            <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-2 border border-stone-200 rounded-lg p-3 bg-stone-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-stone-700">
                    {t('session.calendar.title', 'Session calendar')}
                  </span>
                  <span className="text-xs text-stone-500" data-testid="session-calendar-legend">
                    <span
                      aria-hidden="true"
                      className="inline-block w-2 h-2 rounded-full bg-teal-500 mr-1 align-middle"
                    />
                    {t('session.calendar.legend', 'Days with sessions')}
                  </span>
                </div>
                {/* Inline CSS so the dot decoration travels with the page
                    without a separate stylesheet. Uses .rdp-prtop-hasSession
                    which the SessionCalendar component opts into. */}
                <style>{`
                  .rdp-prtop-wrap .rdp-day_button { position: relative; }
                  .rdp-prtop-hasSession .rdp-day_button::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: 4px;
                    transform: translateX(-50%);
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background-color: #14b8a6;
                  }
                  .rdp-prtop-hasSession .rdp-day_button {
                    font-weight: 600;
                  }
                `}</style>
                <SessionCalendar
                  sessions={sessions}
                  locale={lang}
                  onSelectDate={(date, matched) => {
                    // Open the most recent session on that date (the list is
                    // already sorted by meeting_date DESC, so the first one
                    // sorted-by-id-DESC is fine here).
                    if (matched && matched.length > 0) {
                      const sorted = [...matched].sort((a, b) => (b.id || 0) - (a.id || 0));
                      navigate(`/sessions/${sorted[0].id}`);
                    }
                  }}
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1" htmlFor="sessions-inquiry-filter">
                    {t('session.calendar.filterByInquiry', 'Filter by inquiry')}
                  </label>
                  <select
                    id="sessions-inquiry-filter"
                    data-testid="sessions-inquiry-filter"
                    value={sessionsInquiryFilter}
                    onChange={(e) => setSessionsInquiryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">{t('session.calendar.allInquiries', 'All inquiries')}</option>
                    <option value="none">{t('session.calendar.noInquiry', 'No inquiry')}</option>
                    {inquiries.map(inq => (
                      <option key={inq.id} value={inq.id}>{inq.title}</option>
                    ))}
                  </select>
                </div>
                {sessionsInquiryFilter !== '' && (
                  <button
                    type="button"
                    onClick={() => setSessionsInquiryFilter('')}
                    className="text-xs text-teal-700 hover:text-teal-800 underline"
                    data-testid="sessions-inquiry-filter-clear"
                  >
                    {t('session.calendar.clearFilter', 'Clear inquiry filter')}
                  </button>
                )}
                <p className="text-xs text-stone-500">
                  {t('session.calendar.totalCount', { count: sessionsTotal, defaultValue: '{{count}} session(s)' })}
                </p>
              </div>
            </div>

            {/* Optional metadata form (T-07) — meeting_date, title, inquiry dropdown.
                Hidden during upload progress so users see the progress bar clearly.
                Active inquiries (T-01) populate the dropdown automatically. */}
            {!sessionUploading && (
              <div data-testid="session-meta-form" className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1" htmlFor="session-meeting-date">
                    {t('session.upload.meetingDate', 'Meeting date')}
                  </label>
                  <input
                    id="session-meeting-date"
                    data-testid="session-meeting-date"
                    type="date"
                    value={sessionMeetingDate}
                    onChange={(e) => setSessionMeetingDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1" htmlFor="session-title">
                    {t('session.upload.titleLabel', 'Title (optional)')}
                  </label>
                  <input
                    id="session-title"
                    data-testid="session-title"
                    type="text"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    maxLength={200}
                    placeholder={t('session.upload.titlePlaceholder', 'e.g. Follow-up about anxiety')}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1" htmlFor="session-inquiry">
                    {t('session.upload.inquiryLabel', 'Inquiry (optional)')}
                  </label>
                  <select
                    id="session-inquiry"
                    data-testid="session-inquiry"
                    value={sessionInquiryId}
                    onChange={(e) => setSessionInquiryId(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">{t('session.upload.inquiryNone', '— No inquiry —')}</option>
                    {inquiries
                      .filter(inq => inq.status !== 'closed')
                      .map(inq => (
                        <option key={inq.id} value={inq.id}>{inq.title}</option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {/* T-19: Single-track recording opt-in.
                Used when the client did not consent to recording but the
                therapist still wants AI summary. The system runs speaker
                diarization and only the therapist's voice is transcribed. */}
            {!sessionUploading && (
              <div
                className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50"
                data-testid="session-single-track-opt"
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="session-single-track-checkbox"
                    checked={sessionSingleTrack}
                    onChange={(e) => setSessionSingleTrack(e.target.checked)}
                    className="mt-1 w-4 h-4 text-teal-600 border-stone-300 rounded focus:ring-teal-500"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-amber-900">
                      🎙️ {t('session.upload.singleTrack.label', 'Keep only my voice (single-track)')}
                    </div>
                    <div className="text-xs text-amber-800 mt-1">
                      {t('session.upload.singleTrack.hint',
                        "Use when the client did not consent to recording. After upload you'll pick which detected speaker is your voice; only that voice is transcribed and summarised. The other speaker's audio is discarded.")}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Always-visible Dropzone (drag-n-drop + click-to-select) */}
            {!sessionUploading && !sessionUploadFile && (
              <div
                data-testid="session-dropzone"
                role="button"
                tabIndex={0}
                onClick={() => sessionFileInputRef.current && sessionFileInputRef.current.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sessionFileInputRef.current && sessionFileInputRef.current.click();
                  }
                }}
                onDragOver={handleSessionDragOver}
                onDragEnter={handleSessionDragOver}
                onDragLeave={handleSessionDragLeave}
                onDrop={handleSessionDrop}
                className={`mb-4 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  sessionDragActive
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-stone-300 bg-stone-50 hover:border-teal-400 hover:bg-teal-50'
                }`}
              >
                <div className="text-4xl mb-2">🎙️</div>
                <p className="text-sm font-medium text-stone-700 mb-1">
                  {sessionDragActive
                    ? t('session.upload.dropHere', 'Drop the file here to upload')
                    : t('session.upload.dragDrop', 'Drag & drop a session recording here')}
                </p>
                <p className="text-xs text-stone-500 mb-3">
                  {t('session.upload.clickToBrowse', 'or click to browse')}
                </p>
                <p className="text-xs text-stone-400">
                  {t('session.upload.acceptedFormats', 'Supported: mp3, m4a, wav, mp4, webm, ogg')}
                </p>
                <p className="text-xs text-stone-400">
                  {t('session.upload.sizeLimit', 'Max size: 100MB')}
                </p>
              </div>
            )}

            {/* Selected file (ready to upload) */}
            {sessionUploadFile && !sessionUploading && (
              <div className="mb-4 border-2 border-dashed border-teal-300 rounded-lg p-4 bg-teal-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎧</span>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{sessionUploadFile.name}</p>
                      <p className="text-xs text-stone-500">{(sessionUploadFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSessionUpload}
                      data-testid="session-upload-confirm"
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                    >
                      {t('clientDetail.uploadBtn', 'Upload & Process')}
                    </button>
                    <button
                      onClick={() => { setSessionUploadFile(null); if (sessionFileInputRef.current) sessionFileInputRef.current.value = ''; }}
                      className="px-3 py-2 bg-stone-200 text-stone-600 rounded-lg hover:bg-stone-300 transition-colors text-sm"
                    >
                      {t('cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {sessionUploading && (
              <div className="mb-4 border border-blue-200 rounded-lg p-4 bg-blue-50" data-testid="session-upload-progress">
                <div className="flex items-center gap-3 mb-2">
                  <LoadingSpinner size={20} />
                  <span className="text-sm font-medium text-blue-800">
                    {sessionUploadProgress < 100
                      ? t('session.upload.progress', 'Uploading...') + ` ${sessionUploadProgress}%`
                      : t('clientDetail.processing', 'Processing...')}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${sessionUploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload success message */}
            {sessionUploadMsg && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
                <span>✅</span> {sessionUploadMsg}
              </div>
            )}

            {/* Upload error message */}
            {sessionUploadError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center justify-between" data-testid="session-upload-error">
                <div className="flex items-center gap-2">
                  <span>❌</span> {sessionUploadError}
                </div>
                {sessionUploadFile && (
                  <button
                    onClick={() => { setSessionUploadError(''); handleSessionUpload(); }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium underline"
                  >
                    {t('retry', 'Retry')}
                  </button>
                )}
              </div>
            )}

            {sessionsLoading ? (
              <p className="text-stone-500 text-center py-8">{t('clientDetail.loadingSessions', 'Loading sessions...')}</p>
            ) : sessions.length === 0 && !sessionUploadMsg ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎧</div>
                <h3 className="text-lg font-medium text-stone-600 mb-2">
                  {t('no_sessions_yet', 'No sessions recorded yet')}
                </h3>
                <p className="text-sm text-stone-400 max-w-sm mx-auto">
                  {t('no_sessions_hint', 'Session recordings will appear here once you upload audio files for this client.')}
                </p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="session-list">
                {sessions.map(session => {
                  // T-02: meeting_date is the canonical "session date" — show it
                  // first, fall back to created_at if somehow missing. Title is
                  // optional; when absent the row still renders cleanly.
                  const meetingDate = session.meeting_date || session.scheduled_at || session.created_at;
                  const linkedInquiry = session.inquiry_id
                    ? inquiries.find(inq => inq.id === session.inquiry_id)
                    : null;
                  return (
                    <div
                      key={session.id}
                      data-testid={`session-row-${session.id}`}
                      data-meeting-date={meetingDate || ''}
                      data-inquiry-id={session.inquiry_id || ''}
                      className="border border-stone-200 rounded-lg p-4 hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎧</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            session.status === 'complete' ? 'bg-green-100 text-green-800' :
                            session.status === 'transcribing' ? 'bg-blue-100 text-blue-800' :
                            (session.status === 'transcription_failed' || session.status === 'failed') ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {session.status}
                          </span>
                          {linkedInquiry && (
                            <span
                              data-testid={`session-row-${session.id}-inquiry-badge`}
                              className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800"
                              title={linkedInquiry.title}
                            >
                              📌 {linkedInquiry.title.length > 24 ? linkedInquiry.title.slice(0, 24) + '…' : linkedInquiry.title}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-500" data-testid={`session-row-${session.id}-meeting-date`}>
                          {meetingDate ? formatUserDate(meetingDate) : '—'}
                        </span>
                      </div>
                      {session.title && (
                        <p
                          className="text-sm font-medium text-stone-800 mb-1"
                          data-testid={`session-row-${session.id}-title`}
                        >
                          {session.title}
                        </p>
                      )}
                      <div className="flex gap-3 text-xs text-stone-500 mb-2">
                        <span>{session.has_audio ? '🔊 Audio' : '❌ No audio'}</span>
                        <span>{session.has_transcript ? '📄 Transcript' : '❌ No transcript'}</span>
                        <span>{session.summary ? '📋 Summary' : '❌ No summary'}</span>
                      </div>
                      {session.summary && (
                        <div className="p-3 bg-green-50 rounded-lg text-sm text-stone-700">
                          <p className="whitespace-pre-wrap">{session.summary.length > 300 ? session.summary.substring(0, 300) + '...' : session.summary}</p>
                        </div>
                      )}
                      <button
                        onClick={() => navigate(`/sessions/${session.id}`)}
                        className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >{t('clientDetail.viewSessionDetails', 'View Session Details →')}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Exercises Tab */}
        {activeTab === 'exercises' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">Exercises ({exercisesTotal})</h3>
              <button
                onClick={() => { setShowExercisePicker(!showExercisePicker); fetchExerciseLibrary(); }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                + Send Exercise
              </button>
            </div>
            {exerciseSendMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${exerciseSendMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {exerciseSendMsg}
              </div>
            )}
            {showExercisePicker && (
              <div className="mb-6 border border-teal-200 rounded-lg bg-teal-50 p-4">
                <h4 className="font-medium text-stone-700 mb-3">{t('exercises.selectToSend', 'Select an exercise to send:')}</h4>
                {exerciseLibraryLoading ? (
                  <p className="text-stone-500 text-center py-4">Loading exercise library...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {exerciseLibrary.map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => sendExercise(ex.id)}
                        disabled={sendingExercise === ex.id}
                        className="text-left p-3 bg-white border border-stone-200 rounded-lg hover:border-teal-400 hover:shadow-sm transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{t(`exercises.categories.${ex.category}`, ex.category)}</span>
                          <span className="font-medium text-stone-700 text-sm">{ex[`title_${lang}`] || ex.title || ex.title_en || ''}</span>
                          {ex.is_custom === 1 && (
                            <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">My</span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-1 line-clamp-1">{ex[`description_${lang}`] || ex.description || ex.description_en || ''}</p>
                        {sendingExercise === ex.id && <span className="text-xs text-teal-600 mt-1">Sending...</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowExercisePicker(false)}
                  className="mt-3 text-sm text-stone-500 hover:text-stone-700"
                >Cancel</button>
              </div>
            )}
            {exercisesLoading ? (
              <p className="text-stone-500 text-center py-8">Loading exercises...</p>
            ) : exercises.length === 0 && !showExercisePicker ? (
              <p className="text-stone-400 text-center py-8">No exercises sent to this client yet.</p>
            ) : (
              <div className="space-y-4">
                {exercises.map(delivery => {
                  let storedUser = {};
                  try { storedUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* noop */ }
                  return (
                    <div
                      key={delivery.id}
                      data-testid={`exercise-delivery-${delivery.id}`}
                      className="border border-stone-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💪</span>
                          <span className="font-medium text-stone-700">{delivery.exercise_title}</span>
                          {delivery.exercise_category && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                              {delivery.exercise_category}
                            </span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          delivery.status === 'completed' ? 'bg-green-100 text-green-800' :
                          delivery.status === 'acknowledged' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {delivery.status}
                        </span>
                      </div>
                      {delivery.exercise_description && (
                        <p className="text-sm text-stone-600 mt-1">{delivery.exercise_description}</p>
                      )}
                      <div className="text-xs text-stone-400 mt-2">
                        Sent: {formatUserDate(delivery.sent_at)}
                        {delivery.completed_at && ` • Completed: ${formatUserDate(delivery.completed_at)}`}
                      </div>
                      {/* T-22: per-exercise-run comments — Running notes vs Final tabs.
                          Reuses T-10 /api/comments (entity_type=exercise_completion)
                          for running notes and surfaces delivery.final_response
                          (T-04 response_encrypted) under the Final tab. */}
                      <ExerciseRunComments
                        deliveryId={delivery.id}
                        finalResponse={delivery.final_response}
                        completedAt={delivery.completed_at}
                        userRole={storedUser.role || 'therapist'}
                        currentUserId={storedUser.id}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* T-03: Assignments tab — aggregated homework list across all sessions.
            Lets the therapist create assignments that are not tied to a
            specific session (session_id stays NULL) and review every
            assignment they've ever set for this client. */}
        {activeTab === 'assignments' && (
          <AssignmentsPanel
            mode="client"
            clientId={Number(id)}
            canEdit={true}
          />
        )}

        {/* Diary Tab */}
        {activeTab === 'diary' && <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          {importError && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {importError}
            </div>
          )}
          {importMsg && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
              {importMsg}
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-stone-800">{t('clientDetail.diaryEntries', { count: diaryTotal })}</h3>
            <div className="flex gap-2">
              <button
                onClick={handleExportDiary}
                disabled={diaryTotal === 0}
                className="px-3 py-1 bg-stone-100 text-stone-600 rounded text-sm hover:bg-stone-200 border border-stone-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
                title={t('clientDetail.exportDiary', 'Export diary entries')}
              >
                {t('clientDetail.exportJSON', 'Export JSON')}
              </button>
              <label className="px-3 py-1 bg-stone-100 text-stone-600 rounded text-sm hover:bg-stone-200 cursor-pointer border border-stone-200">
                {importLoading ? 'Importing...' : 'Import JSON'}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  disabled={importLoading}
                  onChange={(e) => handleImportFile(e, 'diary')}
                />
              </label>
              <button
                onClick={() => setTypeFilter('')}
                className={`px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${!typeFilter ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >All</button>
              <button
                onClick={() => setTypeFilter('text')}
                className={`px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${typeFilter === 'text' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >📝 Text</button>
              <button
                onClick={() => setTypeFilter('voice')}
                className={`px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${typeFilter === 'voice' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >🎤 Voice</button>
              <button
                onClick={() => setTypeFilter('video')}
                className={`px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${typeFilter === 'video' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >🎥 Video</button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-stone-50 rounded-lg">
            <label className="text-sm font-medium text-stone-600">Date range:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-stone-300 rounded text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Date from"
            />
            <span className="text-stone-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-stone-300 rounded text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Date to"
            />
            {(dateFrom || dateTo !== todayStr) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(todayStr); }}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
              >Clear dates</button>
            )}
            {(typeFilter || dateFrom || dateTo !== todayStr || diarySearch) && (
              <button
                onClick={() => { setTypeFilter(''); setDateFrom(''); setDateTo(todayStr); setDiarySearch(''); setDiaryPage(1); }}
                className="ml-auto px-3 py-1.5 text-sm bg-stone-200 hover:bg-stone-300 text-stone-700 rounded font-medium"
                aria-label="Reset all filters"
              >
                {t('reset_all_filters', 'Reset all filters')}
              </button>
            )}
          </div>

          {/* Diary Search */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={diarySearch}
                onChange={(e) => setDiarySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = diarySearch.trim();
                    setDiarySearch(trimmed);
                    fetchDiary(false, trimmed);
                  }
                }}
                maxLength={500}
                placeholder={t('search_diary_placeholder', 'Search diary entries...')}
                className="w-full border border-stone-300 rounded-lg pl-10 pr-20 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                aria-label="Search diary entries"
              />
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="absolute right-2 top-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => { const trimmed = diarySearch.trim(); setDiarySearch(trimmed); fetchDiary(false, trimmed); }}
                  className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700"
                >
                  {t('search', 'Search')}
                </button>
                {diarySearch && (
                  <button
                    type="button"
                    onClick={() => { setDiarySearch(''); fetchDiary(false, ''); }}
                    className="px-2 py-1 bg-stone-200 text-stone-600 rounded text-xs font-medium hover:bg-stone-300"
                  >
                    {t('clear', 'Clear')}
                  </button>
                )}
              </div>
            </div>
            {diarySearch && (
              <p className="text-xs text-stone-500 mt-1">
                Showing {diaryTotal} {diaryTotal === 1 ? 'entry' : 'entries'} matching &quot;{diarySearch}&quot;
              </p>
            )}
          </div>

          {diaryError ? (
            <div className="text-center py-8">
              <p className="text-amber-600">{diaryError}</p>
              <button onClick={fetchDiary} className="mt-2 px-3 py-1 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 rounded">Retry</button>
            </div>
          ) : loading && diary.length === 0 ? (
            <p className="text-stone-500">Loading diary entries...</p>
          ) : diary.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">{(typeFilter || dateFrom || dateTo !== todayStr || diarySearch) ? '🔍' : '📓'}</div>
              <h3 className="text-lg font-medium text-stone-600 mb-2">
                {(typeFilter || dateFrom || dateTo !== todayStr || diarySearch) ? t('no_diary_filtered', 'No diary entries match your filters') : t('no_diary_entries', 'No diary entries yet')}
              </h3>
              <p className="text-sm text-stone-400 max-w-sm mx-auto">
                {(typeFilter || dateFrom || dateTo !== todayStr || diarySearch)
                  ? t('no_diary_filtered_hint', 'Try adjusting or clearing your filters to see more entries.')
                  : t('no_diary_hint', 'Diary entries will appear here once the client submits them via the Telegram bot.')}
              </p>
              {(typeFilter || dateFrom || dateTo !== todayStr || diarySearch) && (
                <button
                  onClick={() => { setTypeFilter(''); setDateFrom(''); setDateTo(todayStr); setDiarySearch(''); setDiaryPage(1); }}
                  className="mt-4 px-4 py-2 text-sm bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors"
                >
                  {t('clear_filters', 'Clear all filters')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {diary.map(entry => (
                <DiaryEntryCard
                  key={entry.id}
                  entry={entry}
                  typeIcon={typeIcon}
                  typeBadgeColor={typeBadgeColor}
                  formatUserDate={formatUserDate}
                  deleteDiaryEntry={deleteDiaryEntry}
                  clientId={id}
                  t={t}
                />
              ))}
              {/* Diary Pagination */}
              <div className="mt-4 text-center">
                <p className="text-sm text-stone-500 mb-2">
                  Showing {diary.length} of {diaryTotal} entries
                </p>
                {diaryHasMore && (
                  <button
                    onClick={() => fetchDiary(true)}
                    disabled={diaryLoadingMore}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                  >
                    {diaryLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>}

        {/* Inquiries Tab (T-01) */}
        {activeTab === 'inquiries' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6" data-testid="inquiries-tab">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="text-lg font-bold text-stone-800">🎯 {t('clientDetail.inquiriesTab')} ({inquiriesTotal})</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status filter */}
                <select
                  value={inquiryStatusFilter}
                  onChange={(e) => setInquiryStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  data-testid="inquiry-status-filter"
                >
                  <option value="">{t('inquiry.filterAll')}</option>
                  <option value="active">{t('inquiry.status.active')}</option>
                  <option value="paused">{t('inquiry.status.paused')}</option>
                  <option value="closed">{t('inquiry.status.closed')}</option>
                </select>
                {!showInquiryForm && (
                  <button
                    onClick={() => setShowInquiryForm(true)}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                    data-testid="inquiry-create-btn"
                  >
                    + {t('inquiry.create')}
                  </button>
                )}
              </div>
            </div>

            {inquiriesError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-testid="inquiry-error">
                {inquiriesError}
              </div>
            )}

            {/* Create form */}
            {showInquiryForm && (
              <form onSubmit={handleCreateInquiry} className="mb-6 p-4 border border-stone-200 rounded-lg bg-stone-50" data-testid="inquiry-create-form">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t('inquiry.title')} *</label>
                  <input
                    type="text"
                    value={inquiryFormTitle}
                    onChange={(e) => setInquiryFormTitle(e.target.value)}
                    placeholder={t('inquiry.titlePlaceholder')}
                    maxLength={200}
                    required
                    autoFocus
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    data-testid="inquiry-title-input"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t('inquiry.description')}</label>
                  <textarea
                    value={inquiryFormDescription}
                    onChange={(e) => setInquiryFormDescription(e.target.value)}
                    placeholder={t('inquiry.descriptionPlaceholder')}
                    maxLength={5000}
                    rows={3}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                    data-testid="inquiry-description-input"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={inquirySaving || !inquiryFormTitle.trim()}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    data-testid="inquiry-submit-btn"
                  >
                    {inquirySaving ? '...' : t('inquiry.createSubmit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInquiryForm(false);
                      setInquiryFormTitle('');
                      setInquiryFormDescription('');
                      setInquiriesError('');
                    }}
                    className="px-4 py-2 bg-white text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-100 border border-stone-200"
                  >
                    {t('inquiry.cancel')}
                  </button>
                </div>
              </form>
            )}

            {/* List */}
            {inquiriesLoading ? (
              <div className="text-center py-8 text-stone-500">{t('inquiry.loading')}</div>
            ) : inquiries.length === 0 ? (
              <div className="text-center py-12" data-testid="inquiry-empty-state">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-stone-500">{t('inquiry.empty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.map((inquiry) => {
                  const statusBadge = {
                    active: { color: 'bg-green-100 text-green-700 border-green-200', label: t('inquiry.status.active') },
                    paused: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: t('inquiry.status.paused') },
                    closed: { color: 'bg-stone-100 text-stone-600 border-stone-200', label: t('inquiry.status.closed') },
                  }[inquiry.status] || { color: 'bg-stone-100 text-stone-600 border-stone-200', label: inquiry.status };

                  const isEditing = editingInquiryId === inquiry.id;

                  return (
                    <div
                      key={inquiry.id}
                      className={`border rounded-lg p-4 ${inquiry.status === 'closed' ? 'border-stone-200 bg-stone-50' : 'border-stone-200 bg-white'}`}
                      data-testid={`inquiry-item-${inquiry.id}`}
                    >
                      {isEditing ? (
                        <div>
                          <input
                            type="text"
                            value={editingInquiryTitle}
                            onChange={(e) => setEditingInquiryTitle(e.target.value)}
                            maxLength={200}
                            className="w-full px-3 py-2 mb-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            data-testid={`inquiry-edit-title-${inquiry.id}`}
                          />
                          <textarea
                            value={editingInquiryDescription}
                            onChange={(e) => setEditingInquiryDescription(e.target.value)}
                            maxLength={5000}
                            rows={3}
                            className="w-full px-3 py-2 mb-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                            data-testid={`inquiry-edit-description-${inquiry.id}`}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveInquiryEdit(inquiry.id)}
                              disabled={inquiryActionLoading === inquiry.id || !editingInquiryTitle.trim()}
                              className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                            >
                              {inquiryActionLoading === inquiry.id ? '...' : t('inquiry.save')}
                            </button>
                            <button
                              onClick={cancelEditInquiry}
                              className="px-3 py-1.5 bg-white text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-100 border border-stone-200"
                            >
                              {t('inquiry.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="text-base font-semibold text-stone-800 break-words">{inquiry.title}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusBadge.color}`} data-testid={`inquiry-status-badge-${inquiry.id}`}>
                                  {statusBadge.label}
                                </span>
                              </div>
                              {inquiry.description && (
                                <p className="text-sm text-stone-600 whitespace-pre-wrap mt-1">{inquiry.description}</p>
                              )}
                              <div className="text-xs text-stone-400 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                <span>{t('inquiry.openedAt')}: {formatUserDateOnly(inquiry.opened_at)}</span>
                                {inquiry.closed_at && (
                                  <span>{t('inquiry.closedAt')}: {formatUserDateOnly(inquiry.closed_at)}</span>
                                )}
                                <span>{t('inquiry.updatedAt')}: {formatUserDate(inquiry.updated_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button
                              onClick={() => startEditInquiry(inquiry)}
                              disabled={inquiryActionLoading === inquiry.id}
                              className="px-3 py-1 bg-stone-50 text-stone-700 rounded text-xs font-medium hover:bg-stone-100 border border-stone-200 disabled:opacity-50"
                              data-testid={`inquiry-edit-btn-${inquiry.id}`}
                            >
                              ✏️ {t('inquiry.edit')}
                            </button>
                            {inquiry.status !== 'closed' && (
                              <button
                                onClick={() => handleChangeInquiryStatus(inquiry.id, 'closed')}
                                disabled={inquiryActionLoading === inquiry.id}
                                className="px-3 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium hover:bg-amber-100 border border-amber-200 disabled:opacity-50"
                                data-testid={`inquiry-close-btn-${inquiry.id}`}
                              >
                                {inquiryActionLoading === inquiry.id ? '...' : t('inquiry.close')}
                              </button>
                            )}
                            {inquiry.status === 'closed' && (
                              <button
                                onClick={() => handleChangeInquiryStatus(inquiry.id, 'active')}
                                disabled={inquiryActionLoading === inquiry.id}
                                className="px-3 py-1 bg-green-50 text-green-700 rounded text-xs font-medium hover:bg-green-100 border border-green-200 disabled:opacity-50"
                                data-testid={`inquiry-reopen-btn-${inquiry.id}`}
                              >
                                {t('inquiry.reopen')}
                              </button>
                            )}
                            {inquiry.status === 'active' && (
                              <button
                                onClick={() => handleChangeInquiryStatus(inquiry.id, 'paused')}
                                disabled={inquiryActionLoading === inquiry.id}
                                className="px-3 py-1 bg-stone-50 text-stone-700 rounded text-xs font-medium hover:bg-stone-100 border border-stone-200 disabled:opacity-50"
                              >
                                ⏸ {t('inquiry.status.paused')}
                              </button>
                            )}
                            {inquiry.status === 'paused' && (
                              <button
                                onClick={() => handleChangeInquiryStatus(inquiry.id, 'active')}
                                disabled={inquiryActionLoading === inquiry.id}
                                className="px-3 py-1 bg-green-50 text-green-700 rounded text-xs font-medium hover:bg-green-100 border border-green-200 disabled:opacity-50"
                              >
                                ▶ {t('inquiry.status.active')}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInquiry(inquiry.id)}
                              disabled={inquiryActionLoading === inquiry.id}
                              className="px-3 py-1 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50"
                              data-testid={`inquiry-delete-btn-${inquiry.id}`}
                            >
                              🗑 {t('inquiry.delete')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Comments Tab (T-10 dual-comment) */}
        {activeTab === 'comments' && (() => {
          let storedUser = {};
          try { storedUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* noop */ }
          return (
            <CommentsPanel
              entityType="client"
              entityId={Number(id)}
              userRole={storedUser.role || 'therapist'}
              currentUserId={storedUser.id}
            />
          );
        })()}

        {/* SOS History Tab */}
        {activeTab === 'sos' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">🚨 {t('clientDetail.sosHistory')} ({sosTotal})</h3>
            {sosMsg && <p className="mb-3 text-sm text-green-700 bg-green-50 rounded px-3 py-2">{sosMsg}</p>}
            {sosLoading ? (
              <div className="text-center py-8 text-stone-500">{t('clientDetail.sosLoading')}</div>
            ) : sosEvents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">✅</div>
                <h4 className="text-lg font-medium text-stone-600">{t('clientDetail.sosNoEvents')}</h4>
                <p className="text-sm text-stone-400 mt-1">{t('clientDetail.sosNoEventsHint')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sosEvents.map(event => {
                  const statusConfig = {
                    triggered: { label: t('clientDetail.sosStatusTriggered'), color: 'bg-red-100 text-red-700', icon: '🔴' },
                    acknowledged: { label: t('clientDetail.sosStatusAcknowledged'), color: 'bg-amber-100 text-amber-700', icon: '🟡' },
                    resolved: { label: t('clientDetail.sosStatusResolved'), color: 'bg-green-100 text-green-700', icon: '🟢' }
                  };
                  const config = statusConfig[event.status] || statusConfig.triggered;

                  return (
                    <div key={event.id} className={`border rounded-lg p-4 ${event.status === 'triggered' ? 'border-red-300 bg-red-50' : event.status === 'acknowledged' ? 'border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{config.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${config.color}`}>
                                {config.label}
                              </span>
                              <span className="text-xs text-stone-400">#{event.id}</span>
                            </div>
                            <p className="text-sm text-stone-600 mt-1">
                              {t('clientDetail.sosCreatedAt')}: {formatUserDate(event.created_at)}
                            </p>
                            {event.acknowledged_at && (
                              <p className="text-xs text-stone-400">
                                {t('clientDetail.sosAcknowledgedAt')}: {formatUserDate(event.acknowledged_at)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {event.status === 'triggered' && (
                            <button
                              onClick={() => handleSosAcknowledge(event.id)}
                              disabled={sosActionLoading === event.id}
                              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                            >
                              {sosActionLoading === event.id ? '...' : t('clientDetail.sosAcknowledgeBtn')}
                            </button>
                          )}
                          {(event.status === 'triggered' || event.status === 'acknowledged') && (
                            <button
                              onClick={() => handleSosResolve(event.id)}
                              disabled={sosActionLoading === event.id}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                              {sosActionLoading === event.id ? '...' : t('clientDetail.sosResolveBtn')}
                            </button>
                          )}
                        </div>
                      </div>
                      {event.message && (
                        <div className="mt-3 p-3 bg-white rounded border border-stone-200">
                          <p className="text-sm text-stone-700">{event.message}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default ClientDetail;
