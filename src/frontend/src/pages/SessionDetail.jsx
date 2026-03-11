import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API = 'http://localhost:3001/api';

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

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-stone-500">{t('sessionDetail.loadingSession')}</p>
        ) : error ? (
          <div className="text-red-600">{error}</div>
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
              <span>{t('sessionDetail.created', { date: new Date(session.created_at).toLocaleString() })}</span>
              {session.scheduled_at && <span>{t('sessionDetail.scheduled', { date: new Date(session.scheduled_at).toLocaleString() })}</span>}
            </div>

            {/* Audio Player Section */}
            <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sessionDetail.audioRecording')}</h3>
              {session.audio_ref ? (
                <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg">
                  <span className="text-2xl">🔊</span>
                  <div>
                    <p className="text-sm text-stone-700 font-medium">{t('sessionDetail.audioAvailable')}</p>
                    <p className="text-xs text-stone-500">{t('sessionDetail.audioReference', { ref: session.audio_ref })}</p>
                  </div>
                </div>
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
