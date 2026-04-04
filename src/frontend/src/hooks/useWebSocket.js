import { useEffect, useRef, useState, useCallback } from 'react';

// Singleton WebSocket connection shared across all components
let globalWs = null;
let globalListeners = new Map();
let globalReconnectTimer = null;
let globalReconnectAttempts = 0;
let globalConnected = false;
let globalConnecting = false;
let connectSubscribers = new Set();

function notifySubscribers() {
  connectSubscribers.forEach(fn => fn(globalConnected));
}

function globalConnect() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Prevent concurrent connection attempts
  if (globalConnecting) return;
  if (globalWs && (globalWs.readyState === 0 || globalWs.readyState === 1)) {
    return; // Already connecting or connected
  }

  globalConnecting = true;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // includes port (goes through Vite proxy in dev)
  const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

  try {
    const ws = new WebSocket(wsUrl);
    globalWs = ws;

    ws.onopen = () => {
      globalConnected = true;
      globalConnecting = false;
      globalReconnectAttempts = 0;
      notifySubscribers();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Dispatch to type-specific listeners
        const typeListeners = globalListeners.get(data.type);
        if (typeListeners) {
          typeListeners.forEach(fn => {
            try { fn(data); } catch (e) { console.warn('WS listener error:', e); }
          });
        }
        // Dispatch to wildcard listeners
        const wildcardListeners = globalListeners.get('*');
        if (wildcardListeners) {
          wildcardListeners.forEach(fn => {
            try { fn(data); } catch (e) { console.warn('WS listener error:', e); }
          });
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = (event) => {
      globalConnected = false;
      globalConnecting = false;
      globalWs = null;
      notifySubscribers();

      // Don't reconnect on auth failures
      if (event.code === 4001 || event.code === 4003) return;

      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
      globalReconnectAttempts++;
      globalReconnectTimer = setTimeout(globalConnect, delay);
    };

    ws.onerror = () => {
      // Will trigger onclose
    };
  } catch (err) {
    globalConnecting = false;
  }
}

function globalDisconnect() {
  if (globalReconnectTimer) {
    clearTimeout(globalReconnectTimer);
    globalReconnectTimer = null;
  }
  if (globalWs) {
    globalWs.close();
    globalWs = null;
  }
  globalConnected = false;
  notifySubscribers();
}

// Listen for logout across tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
      if (e.newValue) {
        globalDisconnect();
        setTimeout(globalConnect, 100);
      } else {
        globalDisconnect();
      }
    }
  });
}

/**
 * Custom hook for WebSocket real-time notifications.
 * Uses a singleton connection shared across components.
 */
export default function useWebSocket() {
  const [connected, setConnected] = useState(globalConnected);
  const mountedRef = useRef(true);

  // Subscribe to connection state changes
  useEffect(() => {
    mountedRef.current = true;
    const handler = (isConnected) => {
      if (mountedRef.current) setConnected(isConnected);
    };
    connectSubscribers.add(handler);

    // Ensure connection exists
    if (!globalWs || globalWs.readyState > 1) {
      globalConnect();
    }

    return () => {
      mountedRef.current = false;
      connectSubscribers.delete(handler);
    };
  }, []);

  // Subscribe to event type(s). Returns unsubscribe function.
  const on = useCallback((eventType, callback) => {
    if (!globalListeners.has(eventType)) {
      globalListeners.set(eventType, new Set());
    }
    globalListeners.get(eventType).add(callback);
    return () => {
      const set = globalListeners.get(eventType);
      if (set) set.delete(callback);
    };
  }, []);

  return { connected, on, disconnect: globalDisconnect, reconnect: globalConnect };
}
