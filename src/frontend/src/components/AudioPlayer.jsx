import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

  const token = localStorage.getItem('token');
  const streamUrl = customStreamUrl || `/api/sessions/${sessionId}/stream`;

  // Detect media type from audio_ref extension
  // Only treat explicitly video-only formats as video; webm/ogg default to audio
  useEffect(() => {
    if (audioRef) {
      const ext = audioRef.replace('.enc', '').split('.').pop().toLowerCase();
      const videoOnlyExts = ['mp4', 'mov', 'mkv'];
      setIsVideo(videoOnlyExts.includes(ext));
    }
  }, [audioRef]);

  // Cleanup blob URL on unmount or when URL changes to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [mediaUrl]);

  // Fetch the audio blob with auth header since <audio> can't send Bearer tokens
  useEffect(() => {
    let cancelled = false;
    async function loadMedia() {
      setLoading(true);
      setError('');
      // Revoke previous URL before loading new one
      setMediaUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      try {
        const res = await fetch(streamUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load media');
        }
        const blob = await res.blob();
        if (cancelled) return;
        // Determine if video from blob type
        const blobIsVideo = blob.type && blob.type.startsWith('video/');
        if (blobIsVideo) {
          setIsVideo(true);
        }
        // Store blob URL in state — React will assign it as src attribute
        // after the media element is rendered, avoiding the race condition
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setMediaUrl(url);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token && (sessionId || customStreamUrl)) loadMedia();
    return () => { cancelled = true; };
  }, [sessionId, token, streamUrl]);

  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
      setLoading(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback(() => {
    // Only show error if we have a mediaUrl (otherwise it's just an empty element)
    if (mediaUrl) {
      setError(t('player.loadError'));
    }
    setLoading(false);
  }, [t, mediaUrl]);

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
