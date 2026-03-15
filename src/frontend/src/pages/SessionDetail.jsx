import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatUserDate } from '../utils/formatDate';
import AudioPlayer from '../components/AudioPlayer';

const API = '/api';

function SessionDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSession();
  }, [id]);

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
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const statusBadge = (status) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800';
      case 'transcribing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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

            {/* Summary Section */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sessionDetail.sessionSummary')}</h3>
              {session.has_summary && session.summary ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-stone-700 whitespace-pre-wrap text-sm">{session.summary}</p>
                </div>
              ) : session.has_summary ? (
                <p className="text-stone-500 text-sm">{t('sessionDetail.summaryDecryptFail')}</p>
              ) : (
                <p className="text-stone-400">{t('sessionDetail.noSummaryYet')}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-stone-400">{t('sessionDetail.sessionNotFound')}</p>
        )}
      </main>
    </div>
  );
}

export default SessionDetail;
