// WebSocket Service for real-time notifications
// Provides push notifications to therapist dashboards via ws
const { WebSocketServer } = require('ws');
const { getDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { verifySessionToken, isTokenVersionCurrent } = require('../utils/session');

// Map: therapistId -> Set<WebSocket>
const therapistConnections = new Map();

let wss = null;

// Read one cookie from the raw Cookie header of the upgrade request
// (cookie-parser does not run for websocket upgrades).
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch (e) { return null; }
    }
  }
  return null;
}

// Cookie-authenticated upgrades must come from our own origin (blocks
// cross-site websocket hijacking). A missing Origin (non-browser client) passes.
function originMatchesHost(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    // Compare hostnames only: the reverse proxy may drop the port from Host.
    const hostHeader = String(req.headers.host || '').toLowerCase();
    const hostname = hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.split(':')[0];
    const originHost = new URL(origin).hostname.toLowerCase();
    return originHost === hostname || `[${originHost}]` === hostname;
  } catch (e) {
    return false;
  }
}

/**
 * Initialize WebSocket server attached to existing HTTP server
 */
function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Preferred: the HttpOnly session_token cookie sent with the same-origin upgrade.
    // Deprecated fallback: ws://host/ws?token=JWT (non-browser clients).
    const url = new URL(req.url, 'http://localhost');
    let token = readCookie(req, 'session_token');
    if (token) {
      if (!originMatchesHost(req)) {
        ws.close(4003, 'Origin not allowed');
        return;
      }
    } else {
      token = url.searchParams.get('token');
      if (token) {
        logger.warn('[WS] Deprecated ?token= websocket authentication used; use the session cookie');
      }
    }

    if (!token) {
      ws.close(4001, 'Missing authentication token');
      return;
    }

    let userId, userRole;
    try {
      const decoded = verifySessionToken(token);
      userId = decoded.userId;

      // Verify user exists and is therapist/superadmin
      const db = getDatabase();
      const result = db.exec(
        'SELECT id, role, blocked_at, token_version FROM users WHERE id = ?',
        [userId]
      );

      if (result.length === 0 || result[0].values.length === 0) {
        ws.close(4001, 'User not found');
        return;
      }

      const user = result[0].values[0];
      // H13: token revoked (password reset, admin block, logout-all)
      if (!isTokenVersionCurrent(decoded, user[3])) {
        ws.close(4001, 'Invalid or expired token');
        return;
      }
      if (user[2]) {
        ws.close(4003, 'Account blocked');
        return;
      }

      userRole = user[1];
      if (userRole !== 'therapist' && userRole !== 'superadmin') {
        ws.close(4003, 'Only therapists can receive notifications');
        return;
      }
    } catch (err) {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    // Register connection for this therapist
    if (!therapistConnections.has(userId)) {
      therapistConnections.set(userId, new Set());
    }
    therapistConnections.get(userId).add(ws);

    logger.info(`[WS] Therapist ${userId} connected (${therapistConnections.get(userId).size} connections)`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Real-time notifications active' }));

    // Heartbeat to keep connection alive
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
      const conns = therapistConnections.get(userId);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) {
          therapistConnections.delete(userId);
        }
      }
      logger.info(`[WS] Therapist ${userId} disconnected`);
    });

    ws.on('error', (err) => {
      logger.warn(`[WS] Error for therapist ${userId}: ${err.message}`);
    });
  });

  // Heartbeat interval: ping every 30 seconds, terminate dead connections
  const heartbeat = setInterval(() => {
    if (!wss) { clearInterval(heartbeat); return; }
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  logger.info('[WS] WebSocket server initialized on /ws');
  return wss;
}

/**
 * Send event to a specific therapist (all their connections)
 */
function emitToTherapist(therapistId, event) {
  const conns = therapistConnections.get(therapistId);
  if (!conns || conns.size === 0) return false;

  const payload = JSON.stringify(event);
  let sent = 0;
  for (const ws of conns) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(payload);
        sent++;
      } catch (err) {
        logger.warn(`[WS] Failed to send to therapist ${therapistId}: ${err.message}`);
      }
    }
  }
  return sent > 0;
}

/**
 * Emit SOS alert to therapist
 */
function emitSosAlert(therapistId, data) {
  return emitToTherapist(therapistId, {
    type: 'sos_alert',
    client_id: data.clientId,
    client_name: data.clientName || null,
    sos_id: data.sosId,
    message: data.message || null,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit new diary entry notification
 */
function emitNewDiaryEntry(therapistId, data) {
  return emitToTherapist(therapistId, {
    type: 'new_diary_entry',
    client_id: data.clientId,
    client_name: data.clientName || null,
    entry_id: data.entryId,
    entry_type: data.entryType || 'text',
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit exercise completed notification
 */
function emitExerciseCompleted(therapistId, data) {
  return emitToTherapist(therapistId, {
    type: 'exercise_completed',
    client_id: data.clientId,
    client_name: data.clientName || null,
    delivery_id: data.deliveryId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit session status update (transcription/summarization complete)
 */
function emitSessionStatus(therapistId, data) {
  return emitToTherapist(therapistId, {
    type: 'session_status',
    session_id: data.sessionId,
    client_id: data.clientId,
    status: data.status, // 'complete', 'transcription_failed', etc.
    timestamp: new Date().toISOString()
  });
}

/**
 * Close every open connection of a user (after token revocation or block).
 * Code 4001 stops the dashboard from reconnecting with the revoked token.
 */
function disconnectUser(userId, code = 4001, reason = 'Session revoked') {
  const conns = therapistConnections.get(Number(userId)) || therapistConnections.get(userId);
  if (!conns || conns.size === 0) return 0;
  let closed = 0;
  for (const ws of Array.from(conns)) {
    try {
      ws.close(code, reason);
      closed++;
    } catch (err) {
      logger.warn(`[WS] Failed to close connection for user ${userId}: ${err.message}`);
    }
  }
  return closed;
}

/**
 * Get connection stats (for health endpoint)
 */
function getStats() {
  let totalConnections = 0;
  for (const conns of therapistConnections.values()) {
    totalConnections += conns.size;
  }
  return {
    therapists_connected: therapistConnections.size,
    total_connections: totalConnections
  };
}

module.exports = {
  initWebSocket,
  emitToTherapist,
  emitSosAlert,
  emitNewDiaryEntry,
  emitExerciseCompleted,
  emitSessionStatus,
  disconnectUser,
  getStats
};
