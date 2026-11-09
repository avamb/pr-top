import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchApi } from '../utils/fetchApi';

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// The player never downloads the recording itself (audit H8). It asks the
// backend for a short-lived signed stream URL (GET .../media-url, normal
// cookie auth + the same ownership/consent checks as the stream) and hands
// that URL to <audio>/<video src>, so the browser streams the file with
// Range requests and only the requested part is decrypted server-side.
// `streamUrl` (diary entries) is mapped to its sibling /media-url endpoint.
function mediaUrlEndpoint(sessionId, streamUrl) {
  if (streamUrl) return streamUrl.replace(/\/stream(\?.*)?$/, '/media-url');
  return `/api/sessions/${sessionId}/media-url`;
}

// Refresh a signed URL at most once per this window after a media error
// (e.g. the 10-minute link expired while paused, then the user seeks).
const REFRESH_COOLDOWN_MS = 30 * 1000;

function AudioPlayer({ sessionId, audioRef, streamUrl: customStreamUrl }) {
  const { t } = useTranslation();
  const mediaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const lastRefreshRef = useRef(0);
  // Position / play state to restore after a URL refresh.
  const resumeRef = useRef(null);

  const endpoint = mediaUrlEndpoint(sessionId, customStreamUrl);

  // Initial guess from the audio_ref extension until the server reports the
  // stored content type. Only explicitly video formats count as video.
  useEffect(() => {
    if (audioRef) {
      const ext = audioRef.replace('.enc', '').split('.').pop().toLowerCase();
      const videoOnlyExts = ['mp4', 'mov', 'mkv'];
      setIsVideo(videoOnlyExts.includes(ext));
    }
  }, [audioRef]);

  const fetchSignedUrl = useCallback(async () => {
    const res = await fetchApi(endpoint);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      throw new Error(data.error || t('player.loadError'));
    }
    return data;
  }, [endpoint, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setMediaUrl(null);
    resumeRef.current = null;
    fetchSignedUrl()
      .then((data) => {
        if (cancelled) return;
        if (typeof data.is_video === 'boolean') setIsVideo(data.is_video);
        setMediaUrl(data.url);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [fetchSignedUrl]);

  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    setDuration(el.duration);
    setLoading(false);
    el.volume = volume;
    el.playbackRate = playbackSpeed;
    const resume = resumeRef.current;
    if (resume) {
      resumeRef.current = null;
      if (resume.time) el.currentTime = resume.time;
      if (resume.playing) {
        el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  }, [volume, playbackSpeed]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback(() => {
    // Only meaningful once a src is set (otherwise it's just an empty element)
    if (!mediaUrl) {
      setLoading(false);
      return;
    }
    // The signed link may have expired: get a fresh one once and continue
    // from the same position.
    const now = Date.now();
    if (now - lastRefreshRef.current > REFRESH_COOLDOWN_MS) {
      lastRefreshRef.current = now;
      const el = mediaRef.current;
      resumeRef.current = { time: el ? el.currentTime : 0, playing: isPlaying };
      fetchSignedUrl()
        .then((data) => setMediaUrl(data.url))
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
      return;
    }
    setError(t('player.loadError'));
    setIsPlaying(false);
    setLoading(false);
  }, [t, mediaUrl, isPlaying, fetchSignedUrl]);

  const togglePlay = async () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await mediaRef.current.play();
        setIsPlaying(true);
      } catch (e) {
        // AbortError is benign (e.g., media removed from DOM during tab switch)
        if (e.name === 'AbortError') return;
        console.error('Playback failed:', e);
        setError('Playback failed: ' + e.message);
      }
    }
  };

  const handleSeek = (e) => {
    if (!mediaRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    mediaRef.current.currentTime = pct * duration;
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (mediaRef.current) mediaRef.current.volume = val;
  };

  const cycleSpeed = () => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackSpeed(next);
    if (mediaRef.current) mediaRef.current.playbackRate = next;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Media element — always rendered so ref is never null */}
      {isVideo ? (
        <video
          ref={mediaRef}
          src={mediaUrl || undefined}
          className={`w-full rounded-lg bg-black max-h-96 ${loading ? 'hidden' : ''}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
        />
      ) : (
        <audio
          ref={mediaRef}
          src={mediaUrl || undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
          className="hidden"
        />
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm text-red-700 font-medium">{t('player.error')}</p>
            <p className="text-xs text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg">
          <div className="animate-spin w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full"></div>
          <p className="text-sm text-stone-500">{t('player.loading')}</p>
        </div>
      )}

      {/* Controls — shown when not loading */}
      {!loading && (
        <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={!!error || !mediaUrl}
            className="w-10 h-10 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isPlaying ? t('player.pause') : t('player.play')}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Time + Seek bar */}
          <div className="flex-1 min-w-0">
            <div
              className="h-2 bg-stone-200 rounded-full cursor-pointer relative group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-teal-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-stone-500">{formatTime(currentTime)}</span>
              <span className="text-xs text-stone-500">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-sm" aria-label={t('player.volume')}>
              {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-teal-600"
              aria-label={t('player.volume')}
            />
          </div>

          {/* Playback Speed */}
          <button
            onClick={cycleSpeed}
            className="text-xs font-semibold text-stone-600 bg-stone-200 hover:bg-stone-300 px-2 py-1 rounded transition-colors flex-shrink-0"
            aria-label={t('player.speed')}
            title={t('player.speed')}
          >
            {playbackSpeed}x
          </button>
        </div>
      )}
    </div>
  );
}

export default AudioPlayer;
