// WebSocket Service for real-time notifications
// Provides push notifications to therapist dashboards via ws
const { WebSocketServer } = require('ws');
const { getDatabase } = require('../db/connection');
const { logger } = require('../utils/logger');
const { verifySessionToken, isTokenVersionCurrent } = require('../utils/session');

// Map: therapistId -> Set<WebSocket>
const therapistConnections = new Map();

let wss = null;

/**
 * Initialize WebSocket server attached to existing HTTP server
 */
function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Extract token from query string: ws://host/ws?token=JWT
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

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
