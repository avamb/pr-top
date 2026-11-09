// ffmpeg wrapper for transcription (wave 3 follow-up to audit M20).
//
// Long recordings in containers that cannot be cut without a demuxer (M4A,
// MP4/MOV, Ogg/Opus, WebM, FLAC, AAC, ...) are converted to a small speech-
// quality MP3 (mono, 16 kHz, 32 kbit/s ~ 14.4 MB per hour) before they go to
// the transcription API; services/audioSplit.js then cuts that MP3 at frame
// boundaries if it is still over the per-request limit.
//
// ffmpeg parses untrusted, client-uploaded files, so it runs locked down:
//   - spawned with an argument array, never through a shell;
//   - input restricted to the local file protocol (-protocol_whitelist file),
//     no stdin (-nostdin), video / metadata dropped (-vn -map_metadata -1);
//   - a minimal environment (PATH and, on Windows, the system dirs DLL
//     loading needs) — no secrets from process.env reach the child;
//   - killed after FFMPEG_TIMEOUT_MS (default 15 min);
//   - at most one ffmpeg at a time (simple FIFO queue) to bound CPU / memory;
//   - stderr is kept only as a truncated diagnostic (ffmpeg's own messages,
//     never file contents) for the log.
// The output goes to a 0600 file named dec-<uuid>.mp3 in the private tmp dir,
// a prefix the fileCrypto housekeeping sweep deletes after a crash; callers
// delete it in a finally block.
//
// Env: FFMPEG_PATH (binary, default "ffmpeg" on PATH), FFMPEG_TIMEOUT_MS.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { logger } = require('../utils/logger');

const STDERR_LIMIT = 2000;

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

// Tests only: run e.g. `node fake-ffmpeg.js <args>` instead of the binary
// (a script cannot be spawned directly without a shell on Windows).
let commandOverride = null;

function resolveCommand(opts) {
  if (opts.binary) return { command: opts.binary, prefix: [] };
  if (commandOverride) return commandOverride;
  return { command: ffmpegPath(), prefix: [] };
}

/** Argument list for the speech-MP3 conversion (input is never a shell string). */
function buildTranscodeArgs(inputPath, outputPath) {
  return [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    // input may only be read through the local file protocol: no http, ftp,
    // concat, subfile, ... even if the container references other resources
    '-protocol_whitelist', 'file',
    '-i', inputPath,
    // audio only; drop video / subtitle / data streams and all metadata
    '-vn', '-sn', '-dn', '-map_metadata', '-1',
    // speech quality: mono, 16 kHz, 32 kbit/s MP3 (~14.4 MB per hour)
    '-ac', '1', '-ar', '16000',
    '-c:a', 'libmp3lame', '-b:a', '32k',
    '-threads', '1',
    '-f', 'mp3', '-y', outputPath,
  ];
}

function timeoutMs() {
  const v = parseInt(process.env.FFMPEG_TIMEOUT_MS || '', 10);
  return Number.isInteger(v) && v >= 1000 ? v : 15 * 60 * 1000;
}

/** Environment for the child: nothing from process.env except what is needed to start a binary. */
function minimalEnv() {
  const env = { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin' };
  if (process.platform === 'win32') {
    for (const k of ['SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR']) {
      if (process.env[k]) env[k] = process.env[k];
    }
  }
  return env;
}

class FfmpegError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'FfmpegError';
    this.code = details.code || 'FFMPEG_FAILED';
    this.details = details;
  }
}

// --- one ffmpeg at a time -----------------------------------------------------
// live / peak number of ffmpeg children (diagnostics + tests)
const procStats = { active: 0, peak: 0 };
let queueTail = Promise.resolve();
function runExclusive(fn) {
  const run = queueTail.then(fn, fn);
  queueTail = run.then(() => {}, () => {});
  return run;
}

/**
 * Spawn ffmpeg with `args` (no shell), wait for it, kill it on timeout.
 * Resolves { code, signal, timedOut, stderr } — never rejects for a non-zero
 * exit; rejects only if the binary cannot be started.
 */
function runFfmpegRaw(args, opts = {}) {
  const limit = opts.timeoutMs || timeoutMs();
  return new Promise((resolve, reject) => {
    let child;
    try {
      const { command, prefix } = resolveCommand(opts);
      child = spawn(command, [...prefix, ...args], {
        shell: false,
        env: minimalEnv(),
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      reject(e);
      return;
    }
    procStats.active += 1;
    procStats.peak = Math.max(procStats.peak, procStats.active);
    let stderr = '';
    let timedOut = false;
    child.stderr.on('data', (c) => {
      if (stderr.length < STDERR_LIMIT) stderr += c.toString('utf8').slice(0, STDERR_LIMIT - stderr.length);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
    }, limit);
    let settled = false;
    const done = () => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      procStats.active -= 1;
      return true;
    };
    child.once('error', (e) => {
      if (done()) reject(e);
    });
    child.once('close', (code, signal) => {
      if (done()) resolve({ code, signal, timedOut, stderr: stderr.trim() });
    });
  });
}

/** Same as runFfmpegRaw, but queued behind any other ffmpeg run. */
function runFfmpeg(args, opts = {}) {
  return runExclusive(() => runFfmpegRaw(args, opts));
}

// --- availability (probed once, cached) ---------------------------------------
let availability = null;
function isAvailable() {
  if (!availability) {
    availability = runFfmpegRaw(['-hide_banner', '-version'], { timeoutMs: 15000 })
      .then((r) => {
        const ok = r.code === 0 && !r.timedOut;
        if (!ok) logger.warn(`[ffmpeg] not usable (exit ${r.code}); long non-MP3/WAV recordings cannot be transcribed`);
        else logger.info('[ffmpeg] available for transcription transcoding');
        return ok;
      })
      .catch((e) => {
        logger.warn(`[ffmpeg] not found (${e.code || e.message}); long non-MP3/WAV recordings cannot be transcribed`);
        return false;
      });
  }
  return availability;
}

/**
 * Convert any audio/video file ffmpeg understands to mono 16 kHz 32 kbit/s
 * MP3 in `tmpDir` (file mode 0600, name dec-<uuid>.mp3). Throws FfmpegError
 * (code FFMPEG_FAILED / FFMPEG_TIMEOUT) on failure; the partial output is
 * removed. The caller owns (and must delete) the returned file.
 *
 * @returns {Promise<{path:string, size:number, mime:'audio/mpeg', ext:'.mp3'}>}
 */
async function transcodeToSpeechMp3(inputPath, { tmpDir, timeoutMs: limit } = {}) {
  const dir = tmpDir || path.dirname(inputPath);
  await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  const out = path.join(dir, `dec-${crypto.randomUUID()}.mp3`);
  // Create the output first so it is 0600 from the start; ffmpeg's -y then
  // truncates and reuses it (the mode is kept).
  await (await fsp.open(out, 'wx', 0o600)).close();
  const args = buildTranscodeArgs(inputPath, out);
  const t0 = Date.now();
  let r;
  try {
    r = await runFfmpeg(args, { timeoutMs: limit });
  } catch (e) {
    await fsp.unlink(out).catch(() => {});
    throw new FfmpegError(`ffmpeg could not be started: ${e.code || e.message}`, { code: 'FFMPEG_UNAVAILABLE' });
  }
  if (r.timedOut || r.code !== 0) {
    await fsp.unlink(out).catch(() => {});
    const why = r.timedOut ? `timed out after ${limit || timeoutMs()} ms` : `exit ${r.code}${r.signal ? ' ' + r.signal : ''}`;
    logger.warn(`[ffmpeg] transcode failed (${why}): ${r.stderr.slice(0, 500).replace(/\s+/g, ' ')}`);
    throw new FfmpegError(`ffmpeg transcode failed (${why})`, { code: r.timedOut ? 'FFMPEG_TIMEOUT' : 'FFMPEG_FAILED', exitCode: r.code });
  }
  const st = await fsp.stat(out);
  if (st.size === 0) {
    await fsp.unlink(out).catch(() => {});
    throw new FfmpegError('ffmpeg produced no audio', { code: 'FFMPEG_FAILED' });
  }
  logger.info(`[ffmpeg] transcoded to speech MP3: ${Math.round(st.size / 1024)}KB in ${Date.now() - t0}ms`);
  return { path: out, size: st.size, mime: 'audio/mpeg', ext: '.mp3' };
}

module.exports = {
  isAvailable,
  transcodeToSpeechMp3,
  runFfmpeg,
  FfmpegError,
  buildTranscodeArgs,
  _internal: {
    minimalEnv,
    runFfmpegRaw,
    /** Tests only: { command, prefixArgs } or null to restore FFMPEG_PATH. */
    setCommandOverride(o) {
      commandOverride = o ? { command: o.command, prefix: o.prefixArgs || [] } : null;
      availability = null;
    },
    resetAvailability() { availability = null; },
    stats() { return { ...procStats }; },
    resetStats() { procStats.peak = procStats.active; },
  },
};
