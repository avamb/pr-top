/**
 * Recovery from stale code-split chunks.
 *
 * After a deploy the old hashed files under /assets/ are gone (404), so a tab
 * that was opened before the deploy fails to import the next lazy route (or
 * preload a module). The fix is a hard reload that fetches the new index.html.
 * A sessionStorage timestamp guards against reload loops (e.g. when the
 * network is simply down): at most one automatic reload per window.
 */
const RELOAD_KEY = 'chunk_reload_at';
const RELOAD_WINDOW_MS = 30 * 1000;

const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isChunkLoadError(err) {
  const msg = err && (err.message || String(err));
  return typeof msg === 'string' && CHUNK_ERROR_RE.test(msg);
}

/**
 * Reload the page once (guarded). Returns true when a reload was triggered,
 * false when one already happened within the guard window (or storage is
 * unavailable and we cannot prove it is safe).
 */
export function reloadOnceForChunkError() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (last && Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
