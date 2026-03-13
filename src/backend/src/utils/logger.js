// Logger utility using winston with in-memory ring buffer for system logs viewer
const winston = require('winston');

// Ring buffer to store recent logs for the admin system logs viewer
const MAX_LOG_ENTRIES = 2000;
const logBuffer = [];

// Custom transport that captures logs into the ring buffer
class MemoryTransport extends winston.Transport {
  log(info, callback) {
    const entry = {
      id: logBuffer.length + 1,
      level: info.level,
      message: info.message,
      timestamp: info.timestamp || new Date().toISOString(),
      service: info.service || 'prtop-api',
      stack: info.stack || null,
      meta: {}
    };
    // Copy extra fields into meta
    for (const [key, val] of Object.entries(info)) {
      if (!['level', 'message', 'timestamp', 'service', 'stack', 'Symbol(level)', 'Symbol(splat)'].includes(key) &&
          typeof key === 'string' && !key.startsWith('Symbol')) {
        entry.meta[key] = val;
      }
    }
    logBuffer.push(entry);
    // Trim to ring buffer size
    while (logBuffer.length > MAX_LOG_ENTRIES) {
      logBuffer.shift();
    }
    callback();
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'prtop-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new MemoryTransport({ level: 'debug' })
  ]
});

/**
 * Get recent system logs with optional filtering
 * @param {Object} options - { level, search, limit, offset }
 * @returns {{ logs: Array, total: number }}
 */
function getSystemLogs({ level, search, limit = 50, offset = 0 } = {}) {
  let filtered = [...logBuffer];

  if (level) {
    filtered = filtered.filter(l => l.level === level);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(l =>
      (l.message && l.message.toLowerCase().includes(searchLower)) ||
      (l.stack && l.stack.toLowerCase().includes(searchLower))
    );
  }

  // Sort newest first
  filtered.reverse();

  const total = filtered.length;
  const logs = filtered.slice(offset, offset + limit);

  return { logs, total };
}

module.exports = { logger, getSystemLogs };
