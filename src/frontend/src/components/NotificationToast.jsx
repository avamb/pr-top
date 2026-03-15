import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useWebSocket from '../hooks/useWebSocket';

const SOS_SOUND_FREQUENCY = 880; // Hz
const SOS_SOUND_DURATION = 200; // ms

/**
 * Check if current time is within quiet hours.
 */
function isQuietHours(prefs) {
  if (!prefs || !prefs.quiet_hours_enabled) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = (prefs.quiet_hours_start || '22:00').split(':').map(Number);
  const [endH, endM] = (prefs.quiet_hours_end || '08:00').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Crosses midnight
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Play SOS alert sound using Web Audio API
 */
function playSosSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Play three short beeps
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = SOS_SOUND_FREQUENCY;
      gain.gain.value = 0.3;
      const start = ctx.currentTime + i * 0.3;
      osc.start(start);
      osc.stop(start + SOS_SOUND_DURATION / 1000);
    }
  } catch (e) {
    // Audio not available — silent fallback
  }
}

const TOAST_CONFIGS = {
  sos_alert: {
    icon: '🚨',
    colorClass: 'bg-red-50 border-red-400 text-red-800',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
    urgent: true,
    autoClose: 0 // SOS stays until dismissed
  },
  new_diary_entry: {
    icon: '📓',
    colorClass: 'bg-blue-50 border-blue-400 text-blue-800',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    urgent: false,
    autoClose: 8000
  },
  exercise_completed: {
    icon: '✅',
    colorClass: 'bg-green-50 border-green-400 text-green-800',
    buttonClass: 'bg-green-600 hover:bg-green-700 text-white',
    urgent: false,
    autoClose: 8000
  },
  session_status: {
    icon: '🎧',
    colorClass: 'bg-purple-50 border-purple-400 text-purple-800',
    buttonClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    urgent: false,
    autoClose: 8000
  }
};

function Toast({ notification, onDismiss, onAction, t }) {
  const config = TOAST_CONFIGS[notification.type] || TOAST_CONFIGS.new_diary_entry;
  const timerRef = useRef(null);

  useEffect(() => {
    if (config.autoClose > 0) {
      timerRef.current = setTimeout(() => onDismiss(notification.id), config.autoClose);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notification.id, config.autoClose, onDismiss]);

  function getMessage() {
    switch (notification.type) {
      case 'sos_alert':
        return t('notifications.sosAlert', { client: notification.client_name || t('notifications.unknownClient') });
      case 'new_diary_entry':
        return t('notifications.newDiary', { client: notification.client_name || t('notifications.unknownClient') });
      case 'exercise_completed':
        return t('notifications.exerciseCompleted', { client: notification.client_name || t('notifications.unknownClient') });
      case 'session_status':
        return t('notifications.sessionReady', { status: notification.status || 'complete' });
      default:
        return t('notifications.newEvent');
    }
  }

  function getActionLabel() {
    switch (notification.type) {
      case 'sos_alert': return t('notifications.viewClient');
      case 'new_diary_entry': return t('notifications.viewClient');
      case 'exercise_completed': return t('notifications.viewClient');
      case 'session_status': return t('notifications.viewSession');
      default: return t('notifications.view');
    }
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 border-l-4 rounded-lg shadow-lg max-w-sm w-full animate-slide-in ${config.colorClass}`}
      role="alert"
    >
      <span className="text-2xl flex-shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{getMessage()}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onAction(notification)}
            className={`px-3 py-1 text-xs font-medium rounded ${config.buttonClass}`}
          >
            {getActionLabel()}
          </button>
          <button
            onClick={() => onDismiss(notification.id)}
            className="px-3 py-1 text-xs font-medium rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {t('notifications.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationToast() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { on, connected } = useWebSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [quietHoursPrefs, setQuietHoursPrefs] = useState(null);
  const nextIdRef = useRef(1);

  // Load escalation preferences (quiet hours)
  useEffect(() => {
    async function loadPrefs() {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/settings/escalation', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setQuietHoursPrefs(data.escalation_preferences || null);
        }
      } catch (e) {
        // Non-critical
      }
    }
    loadPrefs();
  }, []);

  const handleEvent = useCallback((event) => {
    if (!TOAST_CONFIGS[event.type]) return;

    const quiet = isQuietHours(quietHoursPrefs);

    // During quiet hours, suppress visual toasts (still count as unread)
    setUnreadCount(prev => prev + 1);

    // Dispatch custom event for sidebar badge
    window.dispatchEvent(new CustomEvent('ws-notification', { detail: event }));

    if (quiet) return;

    // Play SOS sound if enabled
    if (event.type === 'sos_alert') {
      const soundEnabled = !quietHoursPrefs || quietHoursPrefs.sos_sound_alert !== false;
      if (soundEnabled) {
        playSosSound();
      }
    }

    const id = nextIdRef.current++;
    setNotifications(prev => [...prev, { ...event, id }]);
  }, [quietHoursPrefs]);

  useEffect(() => {
    const unsub = on('*', handleEvent);
    return unsub;
  }, [on, handleEvent]);

  const handleDismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleAction = useCallback((notification) => {
    // Navigate to relevant page
    if (notification.client_id && notification.type !== 'session_status') {
      navigate(`/clients/${notification.client_id}`);
    } else if (notification.session_id) {
      navigate(`/sessions/${notification.session_id}`);
    }
    handleDismiss(notification.id);
  }, [navigate, handleDismiss]);

  // Expose unread count for sidebar
  useEffect(() => {
    window.__wsUnreadCount = unreadCount;
    window.dispatchEvent(new CustomEvent('ws-unread-update', { detail: { count: unreadCount } }));
  }, [unreadCount]);

  // Allow clearing unread count
  useEffect(() => {
    const handler = () => {
      setUnreadCount(0);
    };
    window.addEventListener('ws-clear-unread', handler);
    return () => window.removeEventListener('ws-clear-unread', handler);
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
      {notifications.map(n => (
        <Toast
          key={n.id}
          notification={n}
          onDismiss={handleDismiss}
          onAction={handleAction}
          t={t}
        />
      ))}
    </div>
  );
}

// Export for sidebar badge usage
export function useNotificationCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handler = (e) => setCount(e.detail.count);
    window.addEventListener('ws-unread-update', handler);
    return () => window.removeEventListener('ws-unread-update', handler);
  }, []);

  const clearCount = useCallback(() => {
    window.dispatchEvent(new CustomEvent('ws-clear-unread'));
  }, []);

  return { count, clearCount };
}
