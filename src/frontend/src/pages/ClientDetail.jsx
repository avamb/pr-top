import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API = 'http://localhost:3001/api';

function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filter state from URL query parameters
  const [client, setClient] = useState(null);
  const [diary, setDiary] = useState([]);
  const [diaryTotal, setDiaryTotal] = useState(0);
  const [notes, setNotes] = useState([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);
  const [notesSearch, setNotesSearch] = useState('');
  const [context, setContext] = useState(null);
  const [contextForm, setContextForm] = useState({ anamnesis: '', current_goals: '', contraindications: '', ai_instructions: '' });
  const [contextSaving, setContextSaving] = useState(false);
  const [contextMsg, setContextMsg] = useState('');
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diaryError, setDiaryError] = useState('');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');
  const [timeline, setTimeline] = useState([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineStartDate, setTimelineStartDate] = useState(searchParams.get('tl_start') || '');
  const [timelineEndDate, setTimelineEndDate] = useState(searchParams.get('tl_end') || '');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState(searchParams.get('tl_type') || '');
  const [sessions, setSessions] = useState([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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
  const token = localStorage.getItem('token');

  // Sync filter state to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab && activeTab !== 'timeline') params.set('tab', activeTab);
    if (typeFilter) params.set('type', typeFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (timelineStartDate) params.set('tl_start', timelineStartDate);
    if (timelineEndDate) params.set('tl_end', timelineEndDate);
    if (timelineTypeFilter) params.set('tl_type', timelineTypeFilter);
    setSearchParams(params, { replace: true });
  }, [activeTab, typeFilter, dateFrom, dateTo, timelineStartDate, timelineEndDate, timelineTypeFilter]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchClient();
    fetchDiary();
    fetchNotes();
    fetchContext();
    fetchTimeline();
    fetchSessions();
    fetchExercises();
  }, [id, typeFilter, dateFrom, dateTo, timelineStartDate, timelineEndDate, timelineTypeFilter]);

  async function fetchClient() {
    try {
      const res = await fetch(`${API}/clients/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch client');
      const data = await res.json();
      setClient(data.client);
    } catch (e) {
      setError(e.message);
    }
  }

  async function fetchDiary() {
    try {
      setLoading(true);
      setDiaryError('');
      const params = new URLSearchParams();
      if (typeFilter) params.set('entry_type', typeFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const qs = params.toString();
      const url = `${API}/clients/${id}/diary${qs ? '?' + qs : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDiaryError(data.error || 'Failed to fetch diary');
        return;
      }
      const data = await res.json();
      setDiary(data.entries);
      setDiaryTotal(data.total);
    } catch (e) {
      setDiaryError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotes(search) {
    try {
      const params = new URLSearchParams();
      const q = search !== undefined ? search : notesSearch;
      if (q) params.set('search', q);
      const qs = params.toString();
      const res = await fetch(`${API}/clients/${id}/notes${qs ? '?' + qs : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(data.notes);
      setNotesTotal(data.total);
    } catch (e) {
      console.error('Notes fetch error:', e.message);
    }
  }

  async function handleCreateNote(e) {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
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

  async function fetchContext() {
    try {
      const res = await fetch(`${API}/clients/${id}/context`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch context');
      const data = await res.json();
      setContext(data.context);
      setContextForm({
        anamnesis: data.context.anamnesis || '',
        current_goals: data.context.current_goals || '',
        contraindications: data.context.contraindications || '',
        ai_instructions: data.context.ai_instructions || ''
      });
    } catch (e) {
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

      const res = await fetch(`${API}/clients/${id}/context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save context');
      }
      const data = await res.json();
      setContext(data.context);
      setContextMsg('Context saved successfully!');
    } catch (e) {
      setContextMsg('Error: ' + e.message);
    } finally {
      setContextSaving(false);
    }
  }

  async function fetchTimeline() {
    try {
      setTimelineLoading(true);
      const params = new URLSearchParams();
      if (timelineStartDate) params.set('start_date', timelineStartDate);
      if (timelineEndDate) params.set('end_date', timelineEndDate);
      if (timelineTypeFilter) params.set('type', timelineTypeFilter);
      const qs = params.toString();
      const url = `${API}/clients/${id}/timeline${qs ? '?' + qs : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Timeline error:', data.error);
        setTimeline([]);
        setTimelineTotal(0);
        return;
      }
      const data = await res.json();
      setTimeline(data.timeline);
      setTimelineTotal(data.total);
    } catch (e) {
      console.error('Timeline fetch error:', e.message);
    } finally {
      setTimelineLoading(false);
    }
  }

  async function fetchSessions() {
    try {
      setSessionsLoading(true);
      const res = await fetch(`${API}/clients/${id}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data.sessions);
      setSessionsTotal(data.total);
    } catch (e) {
      console.error('Sessions fetch error:', e.message);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function fetchExercises() {
    try {
      setExercisesLoading(true);
      const res = await fetch(`${API}/clients/${id}/exercises`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch exercises');
      const data = await res.json();
      setExercises(data.deliveries);
      setExercisesTotal(data.total);
    } catch (e) {
      console.error('Exercises fetch error:', e.message);
    } finally {
      setExercisesLoading(false);
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
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <main id="main-content" className="max-w-6xl mx-auto px-6 py-8">
        {client && (
          <div className="mb-6">
            <button onClick={() => navigate('/clients')} className="text-teal-600 hover:text-teal-700 text-sm mb-2 inline-block">{t('nav.backToClients')}</button>
            <h2 className="text-2xl font-bold text-stone-800">
              Client: {client.email || client.telegram_id || `#${client.id}`}
            </h2>
            <div className="flex gap-4 mt-2 text-sm text-stone-500">
              <span>{t('clientDetail.language')}: {(client.language || 'en').toUpperCase()}</span>
              <span>{t('clientDetail.consent')}: {client.consent_therapist_access ? t('clientDetail.consentGranted') : t('clientDetail.consentNotGranted')}</span>
              <span>{t('clientDetail.joined')}: {new Date(client.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'timeline' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >📊 {t('clientDetail.timeline')} ({timelineTotal})</button>
          <button
            onClick={() => setActiveTab('diary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'diary' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >📝 {t('clientDetail.diary')} ({diaryTotal})</button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'notes' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🗒️ {t('clientDetail.notesTab')} ({notesTotal})</button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'sessions' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🎧 {t('clientDetail.sessionsTab')} ({sessionsTotal})</button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'exercises' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >💪 {t('clientDetail.exercisesTab')} ({exercisesTotal})</button>
          <button
            onClick={() => setActiveTab('context')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'context' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🧠 {t('clientDetail.contextTab')}</button>
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
              {(timelineStartDate || timelineEndDate) && (
                <button
                  onClick={() => { setTimelineStartDate(''); setTimelineEndDate(''); }}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                >Clear dates</button>
              )}
            </div>

            {timelineLoading ? (
              <p className="text-stone-500 text-center py-8">Loading timeline...</p>
            ) : timeline.length === 0 ? (
              <p className="text-stone-400 text-center py-8">No timeline items found{(timelineStartDate || timelineEndDate || timelineTypeFilter) ? ' for the selected filters' : ''}</p>
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
                          {new Date(item.created_at).toLocaleString()}
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
                      fetchNotes(notesSearch);
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
                    onClick={() => fetchNotes(notesSearch)}
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
                  {creatingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>

            {/* Notes List */}
            {notes.length === 0 ? (
              <p className="text-stone-400 text-center py-8">No notes yet. Write your first note above.</p>
            ) : (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="border border-stone-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-stone-400">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                      {note.session_date && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          Session: {note.session_date}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-700 whitespace-pre-wrap">{note.content}</p>
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
                  onChange={(e) => setContextForm(f => ({ ...f, anamnesis: e.target.value }))}
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
                  onChange={(e) => setContextForm(f => ({ ...f, current_goals: e.target.value }))}
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
                  onChange={(e) => setContextForm(f => ({ ...f, contraindications: e.target.value }))}
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
                  onChange={(e) => setContextForm(f => ({ ...f, ai_instructions: e.target.value }))}
                  placeholder="Instructions for AI when processing this client's data..."
                  className="w-full border border-stone-300 rounded-lg p-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                  maxLength={50000}
                />
                <span className="text-xs text-stone-400">{contextForm.ai_instructions.length}/50000</span>
              </div>
              <div className="flex justify-between items-center">
                {context && context.updated_at && (
                  <span className="text-xs text-stone-400">Last updated: {new Date(context.updated_at).toLocaleString()}</span>
                )}
                <button
                  type="submit"
                  disabled={contextSaving}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contextSaving ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('clientDetail.sessionHistory', { count: sessionsTotal })}</h3>
            {sessionsLoading ? (
              <p className="text-stone-500 text-center py-8">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-stone-400 text-center py-8">No sessions recorded yet.</p>
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
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400">
                        {new Date(session.created_at).toLocaleString()}
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
                      Sent: {new Date(delivery.sent_at).toLocaleString()}
                      {delivery.completed_at && ` • Completed: ${new Date(delivery.completed_at).toLocaleString()}`}
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
                className={`px-3 py-1 rounded text-sm ${!typeFilter ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >All</button>
              <button
                onClick={() => setTypeFilter('text')}
                className={`px-3 py-1 rounded text-sm ${typeFilter === 'text' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >📝 Text</button>
              <button
                onClick={() => setTypeFilter('voice')}
                className={`px-3 py-1 rounded text-sm ${typeFilter === 'voice' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >🎤 Voice</button>
              <button
                onClick={() => setTypeFilter('video')}
                className={`px-3 py-1 rounded text-sm ${typeFilter === 'video' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
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
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
              >Clear dates</button>
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
            <p className="text-stone-400 text-center py-8">No diary entries found</p>
          ) : (
            <div className="space-y-4">
              {diary.map(entry => (
                <div key={entry.id} className="border border-stone-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{typeIcon(entry.entry_type)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(entry.entry_type)}`}>
                      {entry.entry_type}
                    </span>
                    <span className="text-xs text-stone-400 ml-auto">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-stone-700 whitespace-pre-wrap">{entry.content}</p>
                  {entry.transcript && (
                    <div className="mt-2 p-2 bg-stone-50 rounded text-sm text-stone-600">
                      <span className="font-medium">Transcript:</span> {entry.transcript}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>}
      </main>
    </div>
  );
}

export default ClientDetail;
