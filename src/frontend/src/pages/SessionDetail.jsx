import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatUserDate } from '../utils/formatDate';
import AudioPlayer from '../components/AudioPlayer';
import AssignmentsPanel from '../components/AssignmentsPanel';
// T-26: AI source disclaimer block rendered under the summary when the AI
// pipeline pulled passages from the therapist's personal KB (T-09 RAG).
import AiSourceDisclaimer from '../components/AiSourceDisclaimer';

const API = '/api';

function SessionDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  // T-26: therapist's `show_ai_sources` preference. Fetched once on mount;
  // defaults to true (transparency on) so the disclaimer renders unless the
  // therapist has explicitly hidden it via Settings.
  const [showAiSources, setShowAiSources] = useState(true);

  // T-15: post-session therapist notes ("на что обратить внимание в следующий раз")
  // Therapist-only field. Voice -> transcription -> textarea, then save via PATCH.
  // After saving, optionally re-run summarization so the AI reflects the focus notes.
  const [postNotes, setPostNotes] = useState('');
  const [postNotesDirty, setPostNotesDirty] = useState(false);
  const [postNotesSaving, setPostNotesSaving] = useState(false);
  const [postNotesError, setPostNotesError] = useState('');
  const [postNotesStatus, setPostNotesStatus] = useState(''); // saved | recording | transcribing | resummarizing
  const [resumarizing, setResumarizing] = useState(false);

  // Voice recorder state — uses the browser MediaRecorder API. We don't keep
  // the audio anywhere; on stop we POST it once to the transcribe-voice-note
  // endpoint and append the resulting text to the textarea.
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  // T-19: Single-track speaker selection state.
  // When recording_mode='single_track' and status='awaiting_speaker_selection',
  // the therapist must pick which detected speaker is their own voice. We use
  // a hidden <audio> element to play the 10-second preview window for each
  // speaker, then POST /select-speaker once they confirm.
  // The audio is fetched as a Blob (same approach as AudioPlayer) because the
  // <audio> element can't carry an Authorization header on its src URL.
  const previewAudioRef = useRef(null);
  const previewBlobUrlRef = useRef(null);
  const previewLoadingRef = useRef(false);
  const previewTimeUpdateRef = useRef(null);
  const [previewPlayingLabel, setPreviewPlayingLabel] = useState('');
  const [selectingSpeaker, setSelectingSpeaker] = useState('');
  const [speakerSelectError, setSpeakerSelectError] = useState('');

  // Release the blob URL when the component unmounts so we don't leak memory.
  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        try { URL.revokeObjectURL(previewBlobUrlRef.current); } catch (_) {}
        previewBlobUrlRef.current = null;
      }
    };
  }, []);
  // Auto-poll while diarization or transcription is running so the UI advances
  // to the next state without the user having to refresh.
  useEffect(() => {
    if (!session) return;
    const transientStatuses = ['diarizing', 'transcribing', 'pending'];
    if (transientStatuses.includes(session.status)) {
      const t = setTimeout(() => fetchSession(), 4000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session && session.status]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSession();
    fetchShowAiSourcesPreference();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // T-26: read the therapist's transparency toggle so we know whether to render
  // the AI source disclaimer next to the summary. Treat a missing field or
  // failed fetch as "show" (transparency-on by default).
  async function fetchShowAiSourcesPreference() {
    try {
      const res = await fetch(`${API}/settings/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.profile && Object.prototype.hasOwnProperty.call(data.profile, 'show_ai_sources')) {
        setShowAiSources(!!data.profile.show_ai_sources);
      }
    } catch (_) {
      // Default to true on any error — transparency-on is the safer fallback.
    }
  }

  // Make sure we release the microphone if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      stopMediaTracks();
    };
  }, []);

  function stopMediaTracks() {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      } catch (_) {
        // ignore
      }
      mediaStreamRef.current = null;
    }
  }

  async function fetchSession() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      if (res.status === 404) {
        throw new Error('This session has been deleted or is no longer available.');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch session');
      }
      const data = await res.json();
      setSession(data);
      setPostNotes(data.post_session_notes || '');
      setPostNotesDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePostNotes(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (postNotesSaving) return;
    setPostNotesSaving(true);
    setPostNotesError('');
    setPostNotesStatus('');
    try {
      const res = await fetch(`${API}/sessions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_session_notes: postNotes })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('session.postNotes.errorSave'));
      }
      const data = await res.json();
      setPostNotes(data.post_session_notes || '');
      setPostNotesDirty(false);
      setPostNotesStatus('saved');
      // Refresh session so the latest notes are reflected on next render
      await fetchSession();
    } catch (err) {
      setPostNotesError(err.message);
    } finally {
      setPostNotesSaving(false);
    }
  }

  async function handleStartRecording() {
    setPostNotesError('');
    setPostNotesStatus('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPostNotesError(t('session.postNotes.errorNoMic'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stopMediaTracks();
        setRecording(false);
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        if (blob.size === 0) {
          setPostNotesError(t('session.postNotes.errorEmptyRecording'));
          return;
        }
        await transcribeRecording(blob, finalMime);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setPostNotesStatus('recording');
    } catch (err) {
      stopMediaTracks();
      setRecording(false);
      setPostNotesError(err.message || t('session.postNotes.errorMic'));
    }
  }

  function pickRecorderMime() {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  }

  function handleStopRecording() {
    if (!mediaRecorderRef.current) return;
    try {
      mediaRecorderRef.current.stop();
    } catch (_) {
      // ignore — already stopped
    }
  }

  async function transcribeRecording(blob, mime) {
    setPostNotesStatus('transcribing');
    try {
      const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'bin';
      const fd = new FormData();
      fd.append('audio', blob, `voice-note.${ext}`);
      const res = await fetch(`${API}/sessions/${id}/transcribe-voice-note`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('session.postNotes.errorTranscribe'));
      }
      const data = await res.json();
      const transcript = (data.transcript || '').trim();
      if (transcript) {
        setPostNotes((prev) => {
          const sep = prev && prev.trim() ? (prev.endsWith('\n') ? '' : '\n') : '';
          return `${prev}${sep}${transcript}`;
        });
        setPostNotesDirty(true);
      }
      setPostNotesStatus('');
    } catch (err) {
      setPostNotesError(err.message);
      setPostNotesStatus('');
    }
  }

  async function handleResummarize() {
    if (resumarizing) return;
    setResumarizing(true);
    setPostNotesError('');
    setPostNotesStatus('resummarizing');
    try {
      const res = await fetch(`${API}/sessions/${id}/summarize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('session.postNotes.errorResummarize'));
      }
      await fetchSession();
      setPostNotesStatus('saved');
    } catch (err) {
      setPostNotesError(err.message);
      setPostNotesStatus('');
    } finally {
      setResumarizing(false);
    }
  }

  const statusBadge = (status) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800';
      case 'transcribing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'diarizing': return 'bg-indigo-100 text-indigo-800';
      case 'awaiting_speaker_selection': return 'bg-amber-100 text-amber-800';
      case 'diarization_failed':
      case 'transcription_failed': return 'bg-rose-100 text-rose-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // T-19 helpers: play the preview window for a single speaker, stop on end.
  // We fetch the decrypted audio once as a blob (same trick AudioPlayer uses
  // because <audio src> can't carry the Bearer header) and seek to the preview
  // start. A timeupdate listener stops playback once we cross the end boundary.
  async function ensurePreviewBlob() {
    if (previewBlobUrlRef.current) return previewBlobUrlRef.current;
    if (previewLoadingRef.current) {
      // Spin until loaded
      while (previewLoadingRef.current) {
        await new Promise(r => setTimeout(r, 50));
      }
      return previewBlobUrlRef.current;
    }
    previewLoadingRef.current = true;
    try {
      const res = await fetch(`${API}/sessions/${id}/stream`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('session.upload.singleTrack.noPreviewAvailable'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewBlobUrlRef.current = url;
      return url;
    } finally {
      previewLoadingRef.current = false;
    }
  }

  async function handlePreviewSpeaker(label, startSec, endSec) {
    setSpeakerSelectError('');
    const audio = previewAudioRef.current;
    if (!audio) return;
    // Toggle off if the same speaker's preview is currently playing
    if (previewPlayingLabel === label) {
      try { audio.pause(); } catch (_) {}
      setPreviewPlayingLabel('');
      return;
    }
    // Tear down any previous preview window listener
    try { audio.pause(); } catch (_) {}
    if (previewTimeUpdateRef.current) {
      audio.removeEventListener('timeupdate', previewTimeUpdateRef.current);
      previewTimeUpdateRef.current = null;
    }

    let url;
    try {
      url = await ensurePreviewBlob();
    } catch (err) {
      setSpeakerSelectError(err.message);
      return;
    }
    if (audio.src !== url) {
      audio.src = url;
      // Wait for metadata before seeking — currentTime can't be set until then.
      await new Promise((resolve, reject) => {
        const onLoaded = () => { audio.removeEventListener('error', onErr); resolve(); };
        const onErr = () => { audio.removeEventListener('loadedmetadata', onLoaded); reject(new Error('audio_load_failed')); };
        audio.addEventListener('loadedmetadata', onLoaded, { once: true });
        audio.addEventListener('error', onErr, { once: true });
        try { audio.load(); } catch (_) {}
      }).catch(() => {});
    }

    try { audio.currentTime = Number(startSec) || 0; } catch (_) {}

    const stopAt = Number(endSec) || ((Number(startSec) || 0) + 10);
    const onTime = () => {
      if (audio.currentTime >= stopAt) {
        try { audio.pause(); } catch (_) {}
        setPreviewPlayingLabel('');
        audio.removeEventListener('timeupdate', onTime);
        previewTimeUpdateRef.current = null;
      }
    };
    audio.addEventListener('timeupdate', onTime);
    previewTimeUpdateRef.current = onTime;
    const onEnded = () => setPreviewPlayingLabel('');
    audio.addEventListener('ended', onEnded, { once: true });

    try {
      await audio.play();
      setPreviewPlayingLabel(label);
    } catch (err) {
      setSpeakerSelectError(err.message || t('session.upload.singleTrack.noPreviewAvailable'));
      setPreviewPlayingLabel('');
    }
  }

  async function handleSelectSpeaker(label) {
    if (selectingSpeaker) return;
    setSelectingSpeaker(label);
    setSpeakerSelectError('');
    try {
      const audio = previewAudioRef.current;
      if (audio) {
        try { audio.pause(); } catch (_) {}
      }
      setPreviewPlayingLabel('');
      const res = await fetch(`${API}/sessions/${id}/select-speaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ speaker_label: label })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('session.upload.singleTrack.selectError'));
      }
      // Re-fetch so the page reflects the new status (transcribing).
      await fetchSession();
    } catch (err) {
      setSpeakerSelectError(err.message);
    } finally {
      setSelectingSpeaker('');
    }
  }

  function speakerNumberFromLabel(label) {
    const m = /^speaker_(\d+)$/.exec(label || '');
    return m ? (parseInt(m[1], 10) + 1) : '?';
  }

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-teal-600 text-white px-4 py-2 rounded z-50">{t('nav.skipToContent')}</a>

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <p className="text-stone-500">{t('sessionDetail.loadingSession')}</p>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 text-center">
            <h2 className="text-xl font-semibold text-stone-800 mb-2">Record Unavailable</h2>
            <p className="text-stone-600 mb-4">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >← Go Back</button>
          </div>
        ) : session ? (
          <div>
            <button
              onClick={() => session.client_id ? navigate(`/clients/${session.client_id}`) : navigate('/dashboard')}
              className="text-teal-600 hover:text-teal-700 text-sm mb-4 inline-block"
            >
              {t('sessionDetail.backToClient')}
            </button>

            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-stone-800">{t('sessionDetail.sessionTitle', { id: session.id })}</h2>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusBadge(session.status)}`}>
                {session.status}
              </span>
              {session.recording_mode === 'single_track' && (
                <span
                  data-testid="session-single-track-badge"
                  className="text-xs px-3 py-1 rounded-full font-medium bg-amber-100 text-amber-800"
                  title={t('session.upload.singleTrack.hint')}
                >
                  🎙️ {t('session.upload.singleTrack.badge', 'Single-track')}
                </span>
              )}
            </div>

            <div className="flex gap-4 mb-6 text-sm text-stone-500">
              <span>{t('sessionDetail.clientId', { id: session.client_id })}</span>
              <span>{t('sessionDetail.created', { date: formatUserDate(session.created_at) })}</span>
              {session.scheduled_at && <span>{t('sessionDetail.scheduled', { date: formatUserDate(session.scheduled_at) })}</span>}
            </div>

            {/* Audio/Video Player Section */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sessionDetail.audioRecording')}</h3>
              {session.audio_ref ? (
                <AudioPlayer sessionId={session.id} audioRef={session.audio_ref} />
              ) : (
                <p className="text-stone-400">{t('sessionDetail.noAudioRecording')}</p>
              )}
            </div>

            {/* T-19: Single-track speaker selection panel.
                Visible only while we're waiting for the therapist to confirm
                their voice. Once they pick, the panel disappears and the
                regular transcript / summary sections take over. */}
            {session.recording_mode === 'single_track' && session.status === 'diarizing' && (
              <div
                data-testid="single-track-diarizing"
                className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center gap-3"
              >
                <span className="inline-block w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></span>
                <span className="text-sm text-indigo-900">
                  {t('session.upload.singleTrack.diarizing', 'Detecting speakers in the recording…')}
                </span>
              </div>
            )}

            {session.recording_mode === 'single_track' && session.status === 'diarization_failed' && (
              <div
                data-testid="single-track-diarization-failed"
                className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6 text-sm text-rose-800"
              >
                {t('session.upload.singleTrack.diarizationFailed')}
              </div>
            )}

            {session.recording_mode === 'single_track' &&
             session.status === 'awaiting_speaker_selection' &&
             Array.isArray(session.speakers) && session.speakers.length > 0 && (
              <section
                data-testid="single-track-speaker-picker"
                className="bg-white rounded-lg shadow-sm border border-amber-300 p-6 mb-6"
              >
                <h3 className="text-lg font-semibold text-stone-800">
                  {t('session.upload.singleTrack.awaitingSelection', 'Pick your voice')}
                </h3>
                <p className="text-sm text-stone-600 mt-1 mb-4">
                  {t('session.upload.singleTrack.awaitingSelectionHint')}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {session.speakers.map((sp) => {
                    const startSec = Math.max(0, Math.round(Number(sp.preview_start_sec) || 0));
                    const endSec = Math.max(
                      startSec + 1,
                      Math.round(Number(sp.preview_end_sec) || (startSec + 10))
                    );
                    const isPlaying = previewPlayingLabel === sp.label;
                    const isSelecting = selectingSpeaker === sp.label;
                    const num = speakerNumberFromLabel(sp.label);
                    return (
                      <div
                        key={sp.label}
                        data-testid={`speaker-card-${sp.label}`}
                        className="border border-stone-200 rounded-lg p-4 bg-stone-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-stone-800">
                            {t('session.upload.singleTrack.speakerLabel', { n: num, defaultValue: 'Speaker {{n}}' })}
                          </span>
                          <span className="text-xs text-stone-500" data-testid={`speaker-preview-window-${sp.label}`}>
                            {t('session.upload.singleTrack.previewWindow', { start: startSec, end: endSec })}
                          </span>
                        </div>
                        {typeof sp.total_sec === 'number' && (
                          <div className="text-xs text-stone-500 mb-3">
                            {t('session.upload.singleTrack.totalSpoken', { seconds: Math.round(sp.total_sec) })}
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            data-testid={`speaker-preview-btn-${sp.label}`}
                            onClick={() => handlePreviewSpeaker(sp.label, startSec, endSec)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              isPlaying
                                ? 'bg-stone-700 text-white hover:bg-stone-800'
                                : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            {isPlaying
                              ? t('session.upload.singleTrack.stopPreview', '⏹ Stop')
                              : t('session.upload.singleTrack.playPreview', '▶ Play preview')}
                          </button>
                          <button
                            type="button"
                            data-testid={`speaker-select-btn-${sp.label}`}
                            onClick={() => handleSelectSpeaker(sp.label)}
                            disabled={!!selectingSpeaker}
                            className="px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                          >
                            {isSelecting
                              ? t('session.upload.singleTrack.selecting', 'Confirming…')
                              : t('session.upload.singleTrack.selectThisVoice', 'This is my voice')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {speakerSelectError && (
                  <p
                    data-testid="single-track-select-error"
                    className="text-rose-600 text-sm mt-3"
                  >{speakerSelectError}</p>
                )}

                {/* Hidden audio element used by handlePreviewSpeaker.
                    We don't show the controls — the preview is gated to the
                    10-sec window via timeupdate. */}
                <audio
                  ref={previewAudioRef}
                  data-testid="speaker-preview-audio"
                  className="hidden"
                  preload="none"
                />
              </section>
            )}

            {session.recording_mode === 'single_track' && session.selected_speaker_label && (
              <div
                data-testid="single-track-selected-banner"
                className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-6 text-sm text-emerald-900 flex items-center gap-2"
              >
                <span>✓</span>
                <span>
                  {t('session.upload.singleTrack.selectedThisVoice', 'Selected as your voice')}
                  : <strong>{t('session.upload.singleTrack.speakerLabel', { n: speakerNumberFromLabel(session.selected_speaker_label) })}</strong>
                </span>
              </div>
            )}

            {/* Transcript Section */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sessionDetail.transcript')}</h3>
              {session.has_transcript && session.transcript ? (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-stone-700 whitespace-pre-wrap text-sm">{session.transcript}</p>
                </div>
              ) : session.has_transcript ? (
                <p className="text-stone-500 text-sm">{t('sessionDetail.transcriptDecryptFail')}</p>
              ) : (
                <p className="text-stone-400">{t('sessionDetail.noTranscriptYet')}{session.status === 'pending' ? t('sessionDetail.transcriptionInProgress') : ''}</p>
              )}
            </div>

            {/* T-15: Post-Session Notes — therapist-only quick "what to focus on next time" */}
            <section
              data-testid="post-session-notes-section"
              className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-stone-800">{t('session.postNotes.title')}</h3>
                  <p className="text-xs text-stone-500 mt-1">{t('session.postNotes.privacyHint')}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                  {t('session.postNotes.therapistOnlyBadge')}
                </span>
              </div>
              <p className="text-sm text-stone-600 mb-3">{t('session.postNotes.helperText')}</p>

              <textarea
                data-testid="post-session-notes-textarea"
                value={postNotes}
                onChange={(e) => { setPostNotes(e.target.value); setPostNotesDirty(true); }}
                placeholder={t('session.postNotes.placeholder')}
                rows={6}
                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={postNotesSaving}
              />

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {!recording ? (
                  <button
                    type="button"
                    data-testid="post-session-notes-record-start"
                    onClick={handleStartRecording}
                    disabled={postNotesSaving || postNotesStatus === 'transcribing' || postNotesStatus === 'resummarizing'}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    🎙 {t('session.postNotes.recordStart')}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="post-session-notes-record-stop"
                    onClick={handleStopRecording}
                    className="px-3 py-2 bg-stone-700 hover:bg-stone-800 text-white rounded-lg text-sm font-medium flex items-center gap-2 animate-pulse"
                  >
                    ⏹ {t('session.postNotes.recordStop')}
                  </button>
                )}

                <button
                  type="button"
                  data-testid="post-session-notes-save"
                  onClick={handleSavePostNotes}
                  disabled={!postNotesDirty || postNotesSaving}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {postNotesSaving ? t('session.postNotes.saving') : t('session.postNotes.save')}
                </button>

                <button
                  type="button"
                  data-testid="post-session-notes-resummarize"
                  onClick={handleResummarize}
                  disabled={resumarizing || !session.has_transcript}
                  title={!session.has_transcript ? t('session.postNotes.needTranscript') : ''}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {resumarizing ? t('session.postNotes.regenerating') : t('session.postNotes.regenerateSummary')}
                </button>

                <div className="ml-auto text-xs text-stone-500">
                  {postNotesStatus === 'recording' && (
                    <span data-testid="post-session-notes-status-recording" className="text-rose-600 font-medium">● {t('session.postNotes.statusRecording')}</span>
                  )}
                  {postNotesStatus === 'transcribing' && (
                    <span data-testid="post-session-notes-status-transcribing">{t('session.postNotes.statusTranscribing')}</span>
                  )}
                  {postNotesStatus === 'resummarizing' && (
                    <span data-testid="post-session-notes-status-resummarizing">{t('session.postNotes.statusResummarizing')}</span>
                  )}
                  {postNotesStatus === 'saved' && !postNotesDirty && (
                    <span data-testid="post-session-notes-status-saved" className="text-green-600">✓ {t('session.postNotes.statusSaved')}</span>
                  )}
                </div>
              </div>

              {postNotesError && (
                <p data-testid="post-session-notes-error" className="text-rose-600 text-sm mt-2">{postNotesError}</p>
              )}
            </section>

            {/* Summary Section */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sessionDetail.sessionSummary')}</h3>
              {session.has_summary && session.summary ? (
                <div data-testid="session-summary-body" className="p-4 bg-green-50 rounded-lg">
                  <p className="text-stone-700 whitespace-pre-wrap text-sm">{session.summary}</p>
                </div>
              ) : session.has_summary ? (
                <p className="text-stone-500 text-sm">{t('sessionDetail.summaryDecryptFail')}</p>
              ) : (
                <p className="text-stone-400">{t('sessionDetail.noSummaryYet')}</p>
              )}

              {/* T-26: AI source disclaimer. Renders whenever the summary was
                  generated with KB hits (summary_kb_sources is non-empty) and
                  the therapist hasn't disabled the transparency toggle. */}
              {session.has_summary && session.summary && (
                <AiSourceDisclaimer
                  sources={Array.isArray(session.summary_kb_sources) ? session.summary_kb_sources : []}
                  aiGenerated={Array.isArray(session.summary_kb_sources) && session.summary_kb_sources.length > 0}
                  variant="summary"
                  testIdPrefix="session-summary-ai-sources"
                  enabled={showAiSources}
                />
              )}
            </div>

            {/* T-03: Assignments attached to this session.
                Therapist picks one or more pieces of homework (library exercise
                OR freeform) at the end of the session. The client gets a
                Telegram + WebSocket notification on create and can view the
                list with /assignments inside the bot. */}
            {session.client_id && (
              <AssignmentsPanel
                mode="session"
                sessionId={Number(id)}
                clientId={session.client_id}
                canEdit={true}
              />
            )}
          </div>
        ) : (
          <p className="text-stone-400">{t('sessionDetail.sessionNotFound')}</p>
        )}
      </main>
    </div>
  );
}

export default SessionDetail;
