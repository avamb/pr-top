// In-process memory watchdog.
//
// Background: the production API once grew slowly for ~7 weeks, then spent
// two days wedged at 100% CPU in garbage-collection thrash with the event
// loop blocked. A blocked event loop cannot run any JS-level recovery, so the
// only reliable strategy is to leave *before* that point: watch RSS on a
// timer, log a memory line periodically (so growth is visible in the logs),
// and exit with a non-zero code once RSS crosses a threshold. The container
// restart policy brings the process back in seconds with the on-disk DB.
//
// Defaults are conservative and configurable through env:
//   MEMORY_WATCHDOG_MAX_RSS_MB   exit threshold (default 1024, 0 disables)
//   MEMORY_WATCHDOG_INTERVAL_S   check interval in seconds (default 60)
//   MEMORY_WATCHDOG_LOG_EVERY    log a memory line every N checks (default 60)

const { logger } = require('./logger');

const MB = 1024 * 1024;

function toMb(bytes) {
  return Math.round(bytes / MB);
}

function snapshot() {
  const m = process.memoryUsage();
  return {
    rss_mb: toMb(m.rss),
    heap_used_mb: toMb(m.heapUsed),
    heap_total_mb: toMb(m.heapTotal),
    external_mb: toMb(m.external),
    array_buffers_mb: toMb(m.arrayBuffers || 0),
    uptime_s: Math.round(process.uptime())
  };
}

function formatLine(s) {
  return `rss=${s.rss_mb}MB heap=${s.heap_used_mb}/${s.heap_total_mb}MB external=${s.external_mb}MB arrayBuffers=${s.array_buffers_mb}MB uptime=${s.uptime_s}s`;
}

let timer = null;

/**
 * Start the watchdog.
 * @param {Object} [opts]
 * @param {Function} [opts.beforeExit] - sync hook run before process.exit (e.g. flush DB to disk)
 */
function start(opts) {
  const options = opts || {};
  const maxRssMb = parseInt(process.env.MEMORY_WATCHDOG_MAX_RSS_MB || '1024', 10);
  const intervalS = Math.max(5, parseInt(process.env.MEMORY_WATCHDOG_INTERVAL_S || '60', 10));
  const logEvery = Math.max(1, parseInt(process.env.MEMORY_WATCHDOG_LOG_EVERY || '60', 10));

  if (timer) return;

  logger.info(`[MEMORY] Watchdog started: max_rss=${maxRssMb > 0 ? maxRssMb + 'MB' : 'disabled'} interval=${intervalS}s (${formatLine(snapshot())})`);

  let tick = 0;
  timer = setInterval(() => {
    tick++;
    const s = snapshot();

    if (tick % logEvery === 0) {
      logger.info(`[MEMORY] ${formatLine(s)}`);
    }

    if (maxRssMb > 0 && s.rss_mb >= maxRssMb) {
      logger.error(`[MEMORY] RSS ${s.rss_mb}MB exceeded limit ${maxRssMb}MB — exiting so the container restarts (${formatLine(s)})`);
      try {
        if (typeof options.beforeExit === 'function') options.beforeExit();
      } catch (e) {
        logger.error('[MEMORY] beforeExit hook failed: ' + e.message);
      }
      // Give winston a moment to flush the console transport, then exit.
      setTimeout(() => process.exit(1), 250).unref();
    }
  }, intervalS * 1000);
  timer.unref();
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, snapshot };
