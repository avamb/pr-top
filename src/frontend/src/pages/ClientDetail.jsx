import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../components/Breadcrumb';
import useNavigationBlocker from '../hooks/useNavigationBlocker';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatUserDate, formatUserDateOnly, getUserTimezone } from '../utils/formatDate';

const API = '/api';

function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [sessionUploadFile, setSessionUploadFile] = useState(null);
  const [sessionUploading, setSessionUploading] = useState(false);
  const [sessionUploadProgress, setSessionUploadProgress] = useState(0);
  const [sessionUploadMsg, setSessionUploadMsg] = useState('');
  const [sessionUploadError, setSessionUploadError] = useState('');
  const sessionFileInputRef = useRef(null);
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

  // Validate client ID is a positive integer
  const isValidId = /^\d+$/.test(id) && Number(id) > 0;
  const clientAbortRef = useRef(null);

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
      }
    });

    return () => {
      controller.abort();
    };
  }, [id, typeFilter, dateFrom, dateTo, timelineStartDate, timelineEndDate, timelineTypeFilter]);

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

  async function fetchSessions(signal) {
    try {
      setSessionsLoading(true);
      const res = await fetch(`${API}/clients/${id}/sessions`, {
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
      if (sessionFileInputRef.current) sessionFileInputRef.current.value = '';

      // Refresh sessions list after a short delay to let transcription start
      setTimeout(() => {
        fetchSessions();
      }, 2000);

      // Refresh again after longer delay to catch completed transcription
      setTimeout(() => {
        fetchSessions();
      }, 8000);

    } catch (e) {
      setSessionUploadError(e.message);
    } finally {
      setSessionUploading(false);
      setSessionUploadProgress(0);
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
      const res = await fetch(`${API}/exercises`, {
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
              { label: client.email || client.telegram_id || `#${client.id}` }
            ]} />
            <h2 className="text-2xl font-bold text-stone-800">
              Client: {client.email || client.telegram_id || `#${client.id}`}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-stone-500">
              <span>{t('clientDetail.language')}: {(client.language || 'en').toUpperCase()}</span>
              <span>{t('clientDetail.consent')}: {client.consent_therapist_access ? t('clientDetail.consentGranted') : t('clientDetail.consentNotGranted')}</span>
              <span>{t('clientDetail.joined')}: {formatUserDateOnly(client.created_at)}</span>
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
              {exportMsg && (
                <span className={`text-sm ${exportMsg.includes(t('clientDetail.exportSuccess', 'success')) || exportMsg === t('clientDetail.exportSuccess') ? 'text-green-600' : 'text-amber-600'}`}>
                  {exportMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'timeline' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >📊 {t('clientDetail.timeline')} ({timelineTotal})</button>
          <button
            onClick={() => setActiveTab('diary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'diary' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >📝 {t('clientDetail.diary')} ({diaryTotal})</button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'notes' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🗒️ {t('clientDetail.notesTab')} ({notesTotal})</button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'sessions' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🎧 {t('clientDetail.sessionsTab')} ({sessionsTotal})</button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'exercises' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >💪 {t('clientDetail.exercisesTab')} ({exercisesTotal})</button>
          <button
            onClick={() => setActiveTab('context')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${activeTab === 'context' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🧠 {t('clientDetail.contextTab')}</button>
        </div>

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
                                <span className="text-xs text-stone-400">{new Date(result.created_at).toLocaleDateString()}</span>
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
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>🎙️</span> {t('clientDetail.uploadSession', 'Upload Session Recording')}
              </button>
              <input
                ref={sessionFileInputRef}
                type="file"
                accept="audio/*,video/*,.webm,.mp3,.mp4,.wav,.ogg,.m4a"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setSessionUploadFile(file);
                    setSessionUploadMsg('');
                    setSessionUploadError('');
                  }
                }}
              />
            </div>

            {/* Upload area */}
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
              <div className="mb-4 border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center gap-3 mb-2">
                  <LoadingSpinner size={20} />
                  <span className="text-sm font-medium text-blue-800">
                    {sessionUploadProgress < 100
                      ? t('clientDetail.uploading', 'Uploading...') + ` ${sessionUploadProgress}%`
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
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>❌</span> {sessionUploadError}
                </div>
                <button
                  onClick={() => { setSessionUploadError(''); handleSessionUpload(); }}
                  className="text-red-600 hover:text-red-800 text-sm font-medium underline"
                >
                  {t('retry', 'Retry')}
                </button>
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
              <div className="space-y-4">
                {sessions.map(session => (
                  <div key={session.id} className="border border-stone-200 rounded-lg p-4 hover:border-teal-300 transition-colors">
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
                      </div>
                      <span className="text-xs text-stone-400">
                        {formatUserDate(session.created_at)}
                      </span>
                    </div>
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
                    >View Session Details &rarr;</button>
                  </div>
                ))}
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
                <h4 className="font-medium text-stone-700 mb-3">Select an exercise to send:</h4>
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
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{ex.category}</span>
                          <span className="font-medium text-stone-700 text-sm">{ex.title_en}</span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1 line-clamp-1">{ex.description_en}</p>
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
                {exercises.map(delivery => (
                  <div key={delivery.id} className="border border-stone-200 rounded-lg p-4">
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
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <div key={entry.id} className="border border-stone-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{typeIcon(entry.entry_type)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(entry.entry_type)}`}>
                      {entry.entry_type}
                    </span>
                    {/* Transcription status badge for voice/video entries */}
                    {(entry.entry_type === 'voice' || entry.entry_type === 'video') && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        entry.transcript
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {entry.transcript ? '✅ Transcribed' : '⏳ Pending transcription'}
                      </span>
                    )}
                    <span className="text-xs text-stone-400 ml-auto">
                      {formatUserDate(entry.created_at)}
                    </span>
                    <button
                      onClick={() => deleteDiaryEntry(entry.id)}
                      className="ml-2 text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      title="Delete diary entry"
                    >🗑️ Delete</button>
                  </div>
                  <p className="text-stone-700 whitespace-pre-wrap">{entry.content}</p>
                  {entry.transcript && (
                    <div className="mt-2 p-2 bg-stone-50 rounded text-sm text-stone-600">
                      <span className="font-medium">📝 Transcript:</span> {entry.transcript}
                    </div>
                  )}
                </div>
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
      </main>
    </div>
  );
}

export default ClientDetail;
