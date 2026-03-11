import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = 'http://localhost:3001/api';

function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [diary, setDiary] = useState([]);
  const [diaryTotal, setDiaryTotal] = useState(0);
  const [notes, setNotes] = useState([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);
  const [context, setContext] = useState(null);
  const [contextForm, setContextForm] = useState({ anamnesis: '', current_goals: '', contraindications: '', ai_instructions: '' });
  const [contextSaving, setContextSaving] = useState(false);
  const [contextMsg, setContextMsg] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diaryError, setDiaryError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineStartDate, setTimelineStartDate] = useState('');
  const [timelineEndDate, setTimelineEndDate] = useState('');
  const token = localStorage.getItem('token');

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
  }, [id, typeFilter, dateFrom, dateTo, timelineStartDate, timelineEndDate]);

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

  async function fetchNotes() {
    try {
      const res = await fetch(`${API}/clients/${id}/notes`, {
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
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white shadow-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-stone-800">PsyLink</h1>
            <nav className="flex gap-2" aria-label="Main navigation">
              <button onClick={() => navigate('/dashboard')} className="px-3 py-1 rounded text-sm text-stone-600 hover:bg-stone-100">Dashboard</button>
              <button onClick={() => navigate('/clients')} className="px-3 py-1 rounded text-sm text-stone-600 hover:bg-stone-100">Clients</button>
            </nav>
          </div>
          <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} className="text-sm text-stone-500 hover:text-stone-700">Log out</button>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-8">
        {client && (
          <div className="mb-6">
            <button onClick={() => navigate('/clients')} className="text-teal-600 hover:text-teal-700 text-sm mb-2 inline-block">&larr; Back to Clients</button>
            <h2 className="text-2xl font-bold text-stone-800">
              Client: {client.email || client.telegram_id || `#${client.id}`}
            </h2>
            <div className="flex gap-4 mt-2 text-sm text-stone-500">
              <span>Language: {(client.language || 'en').toUpperCase()}</span>
              <span>Consent: {client.consent_therapist_access ? '✅ Granted' : '❌ Not granted'}</span>
              <span>Joined: {new Date(client.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'timeline' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >📊 Timeline ({timelineTotal})</button>
          <button
            onClick={() => setActiveTab('diary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'diary' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >📝 Diary ({diaryTotal})</button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'notes' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🗒️ Notes ({notesTotal})</button>
          <button
            onClick={() => setActiveTab('context')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'context' ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >🧠 Context</button>
        </div>

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">Unified Timeline ({timelineTotal})</h3>
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-stone-50 rounded-lg">
              <label className="text-sm font-medium text-stone-600">Filter by date:</label>
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
              <p className="text-stone-400 text-center py-8">No timeline items found{(timelineStartDate || timelineEndDate) ? ' for the selected date range' : ''}</p>
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
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Therapist Notes</h3>

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
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Client Context</h3>
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

        {/* Diary Tab */}
        {activeTab === 'diary' && <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-stone-800">Diary Entries ({diaryTotal})</h3>
            <div className="flex gap-2">
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
            <p className="text-amber-600 text-center py-8">{diaryError}</p>
          ) : loading ? (
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
