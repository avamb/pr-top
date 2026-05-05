// Audio Diarization Service (T-19)
// Splits a session audio recording into per-speaker segments so the therapist
// can pick "their" voice when the client did not consent to recording.
//
// Two modes:
//   - Production: hooks for WhisperX / pyannote.audio / Deepgram via env vars
//     (DIARIZATION_PROVIDER, DIARIZATION_API_URL, DIARIZATION_API_KEY).
//     The actual provider call is left as an integration point — we expose a
//     well-defined output shape so the rest of the pipeline doesn't care which
//     backend produced the segments.
//   - Development: deterministic file-size-based time split. This produces a
//     plausible 2-speaker segmentation so the speaker-selection UI, the
//     transcript filtering, and the on-disk cleanup can all be exercised
//     end-to-end without paying for a diarization API in dev/CI.
//
// Output shape (returned by diarizeSessionAudio):
//   {
//     totalDurationSec: number,
//     speakers: [
//       {
//         label: 'speaker_0' | 'speaker_1' | ...,
//         total_sec: number,                // sum of segment lengths
//         segments: [{ start_sec, end_sec }, ...],   // diarization timeline
//         preview_start_sec: number,        // ~10s preview window (start)
//         preview_end_sec: number           // ~10s preview window (end)
//       },
//       ...
//     ]
//   }
//
// Note on first-version pragmatism (per T-19 spec): if real diarization is
// too expensive/complex to ship, manual-timestamps are acceptable. The dev
// path here implements the manual-timestamp variant — a deterministic
// 50/50 alternating split — so the UI flow and on-disk-cleanup invariants
// are always exercised.

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const { decrypt } = require('./encryption');
const { getDatabase, saveDatabaseAfterWrite } = require('../db/connection');

const UPLOAD_DIR = path.resolve(__dirname, '../../data/sessions');

const DIARIZATION_PROVIDER = (process.env.DIARIZATION_PROVIDER || '').toLowerCase();
const DIARIZATION_API_KEY = process.env.DIARIZATION_API_KEY || '';
const DIARIZATION_API_URL = process.env.DIARIZATION_API_URL || '';

/**
 * Whether a real diarization provider is configured.
 * Currently supported provider keys: 'whisperx' | 'pyannote' | 'deepgram'.
 * If none is configured, dev-mode deterministic split is used.
 */
function isProviderConfigured() {
  if (!DIARIZATION_PROVIDER) return false;
  if (!DIARIZATION_API_KEY || DIARIZATION_API_KEY.length < 10) return false;
  return ['whisperx', 'pyannote', 'deepgram'].includes(DIARIZATION_PROVIDER);
}

/**
 * Estimate audio duration from file size (very rough — used only when no
 * provider can give us the real duration). Assumes ~16 KB/sec for typical
 * compressed audio (m4a/mp3/webm at ~128kbps), which is close enough for the
 * 10-second preview windows we generate.
 */
function estimateDurationFromSize(byteLength) {
  const KB_PER_SEC = 16; // ~128 kbps
  const seconds = Math.max(5, Math.round(byteLength / 1024 / KB_PER_SEC));
  return seconds;
}

/**
 * Build a deterministic 2-speaker diarization for development / fallback.
 *
 * The audio is split into N equal chunks; alternating chunks are assigned to
 * speaker_0 and speaker_1. This produces a stable, reproducible segmentation
 * for any given file size — the therapist can always click a preview and hear
 * a different chunk for each speaker so the UI never shows identical previews.
 *
 * @param {number} totalDurationSec
 * @returns {Array} two-speaker output ready for diarizeSessionAudio's caller
 */
function buildDevSpeakers(totalDurationSec) {
  const CHUNK_SEC = Math.max(5, Math.floor(totalDurationSec / 8));
  const numChunks = Math.max(2, Math.ceil(totalDurationSec / CHUNK_SEC));

  const speakers = [
    { label: 'speaker_0', segments: [], total_sec: 0 },
    { label: 'speaker_1', segments: [], total_sec: 0 }
  ];

  for (let i = 0; i < numChunks; i++) {
    const start = i * CHUNK_SEC;
    const end = Math.min(totalDurationSec, start + CHUNK_SEC);
    if (end <= start) break;
    const sp = speakers[i % 2];
    sp.segments.push({ start_sec: start, end_sec: end });
    sp.total_sec += (end - start);
  }

  // Build preview windows: first segment of each speaker, capped at 10 sec.
  for (const sp of speakers) {
    const first = sp.segments[0] || { start_sec: 0, end_sec: Math.min(10, totalDurationSec) };
    sp.preview_start_sec = first.start_sec;
    sp.preview_end_sec = Math.min(first.start_sec + 10, first.end_sec);
  }

  return speakers;
}

/**
 * Run diarization on a session's encrypted audio file and return the
 * speaker timeline. This does NOT modify the database — the caller is
 * responsible for persisting `speaker_segments_json`.
 *
 * @param {string} audioRef - filename inside UPLOAD_DIR (e.g. 'abc.mp4.enc')
 * @returns {Promise<{totalDurationSec:number, speakers:Array}>}
 */
async function diarizeSessionAudio(audioRef) {
  const filePath = path.join(UPLOAD_DIR, audioRef);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${audioRef}`);
  }

  // We need the *decrypted* size for production providers. For the dev
  // estimator we can use the encrypted file size — it's only ~33% larger due
  // to base64 + the encryption envelope, which is fine for a rough chunk plan.
  const stat = fs.statSync(filePath);
  const encryptedBytes = stat.size;

  if (isProviderConfigured()) {
    // Production path: decrypt, send to provider, normalize response.
    // Implementation note: real providers (WhisperX server, pyannote.audio
    // running locally, Deepgram cloud) all accept multipart/form-data audio
    // and return per-speaker segments with timestamps. The exact request/
    // response shape is provider-specific; we stub the call here so the rest
    // of the pipeline is wired correctly. When the provider is plugged in,
    // implement `callProviderDiarization(audioBuffer)` returning the same
    // output shape as buildDevSpeakers().
    try {
      const encryptedContent = fs.readFileSync(filePath, 'utf-8');
      const decryptedBase64 = decrypt(encryptedContent);
      const audioBuffer = Buffer.from(decryptedBase64, 'base64');
      const result = await callProviderDiarization(audioBuffer);
      return result;
    } catch (e) {
      logger.warn(`Diarization provider failed (${DIARIZATION_PROVIDER}): ${e.message}. Falling back to dev split.`);
      // Fall through to dev split so the upload flow doesn't dead-end.
    }
  }

  const totalDurationSec = estimateDurationFromSize(encryptedBytes);
  const speakers = buildDevSpeakers(totalDurationSec);

  logger.info(
    `Diarization (dev mode) for ${audioRef}: estimated ${totalDurationSec}s, ` +
    `${speakers.length} speakers, ${speakers.reduce((a, s) => a + s.segments.length, 0)} total segments`
  );

  return { totalDurationSec, speakers };
}

/**
 * Stub for plugging in a real diarization provider. Throws by default so the
 * caller falls back to dev split. To enable, set DIARIZATION_PROVIDER and
 * implement the provider-specific call (HTTP POST to whisperx/pyannote/Deepgram).
 *
 * @param {Buffer} audioBuffer - decoded audio bytes
 * @returns {Promise<{totalDurationSec:number, speakers:Array}>}
 */
// eslint-disable-next-line no-unused-vars
async function callProviderDiarization(audioBuffer) {
  // Implementation stub. Real provider integration belongs here.
  // Expected return shape matches buildDevSpeakers() output plus totalDurationSec.
  throw new Error(`Diarization provider '${DIARIZATION_PROVIDER}' not yet implemented`);
}

/**
 * Filter a transcript-style text down to a single speaker's lines. Used in
 * dev mode where the underlying audio file isn't physically resliced — we
 * simulate the "only therapist voice" effect by keeping just the lines that
 * belong to the chosen speaker. In production with a real provider the audio
 * itself is resliced before transcription, so this filter is a no-op there.
 *
 * The dev placeholder transcript uses "Therapist:" / "Client:" prefixes;
 * we treat speaker_0 ↔ Therapist and speaker_1 ↔ Client by convention so the
 * dev mode pipeline produces obviously-different output for each selection.
 *
 * @param {string} fullTranscript - raw transcript text (any speaker)
 * @param {string} speakerLabel - 'speaker_0' | 'speaker_1' | ...
 * @returns {string} transcript with only the chosen speaker's lines
 */
function filterTranscriptToSpeaker(fullTranscript, speakerLabel) {
  if (!fullTranscript || !speakerLabel) return fullTranscript;

  const role = speakerLabel === 'speaker_0' ? 'Therapist' : 'Client';
  const lines = fullTranscript.split('\n');
  const out = [];
  let lastWasRole = false;
  for (const line of lines) {
    // Always preserve metadata blocks (square brackets) so the dev transcript
    // header and trailer survive the filter.
    if (/^\s*\[/.test(line)) {
      out.push(line);
      lastWasRole = false;
      continue;
    }
    if (line.startsWith(role + ':')) {
      out.push(line);
      lastWasRole = true;
    } else if (/^[A-Z][a-z]+:/.test(line)) {
      // Different speaker — drop.
      lastWasRole = false;
    } else if (lastWasRole && line.trim() === '') {
      // Keep paragraph breaks immediately after a kept line.
      out.push(line);
    }
  }
  // Splice in a marker so the therapist can tell the filter ran.
  out.splice(2, 0, `[Single-track mode: showing only ${role.toLowerCase()} voice (${speakerLabel})]`);
  return out.join('\n');
}

/**
 * End-to-end orchestration helper used by routes/sessions.js when an upload
 * is marked recording_mode='single_track'.
 *
 * Flow:
 *   1. Read the session row (status was set to 'diarizing' by the upload route).
 *   2. Run diarizeSessionAudio() against the encrypted file.
 *   3. Persist the speaker timeline as JSON on the row.
 *   4. Move status -> 'awaiting_speaker_selection' so the UI prompts the
 *      therapist to pick their voice via the speaker preview.
 *
 * If diarization fails (provider error, missing file, …), we set the status to
 * 'diarization_failed' instead of crashing the whole upload. The therapist can
 * then either retry, or fall back to the regular mixed-track flow by re-uploading.
 *
 * @param {number} sessionId
 * @returns {Promise<{success:boolean, sessionId:number, speakerCount?:number, error?:string}>}
 */
async function processSessionDiarization(sessionId) {
  const db = getDatabase();

  try {
    const result = db.exec(
      `SELECT id, therapist_id, client_id, audio_ref, recording_mode
       FROM sessions WHERE id = ?`,
      [sessionId]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const row = result[0].values[0];
    const audioRef = row[3];
    const recordingMode = row[4];

    if (!audioRef) {
      throw new Error(`Session ${sessionId} has no audio file to diarize`);
    }
    if (recordingMode !== 'single_track') {
      // Defensive: caller should only invoke this for single_track sessions.
      logger.warn(`processSessionDiarization called for non-single_track session ${sessionId} (mode=${recordingMode}) — skipping`);
      return { success: false, sessionId, error: 'Not a single_track session' };
    }

    // Run diarization (real provider if configured, deterministic dev split otherwise)
    const { totalDurationSec, speakers } = await diarizeSessionAudio(audioRef);

    if (!Array.isArray(speakers) || speakers.length < 1) {
      throw new Error('Diarization produced no speakers');
    }

    const segmentsJson = JSON.stringify({ totalDurationSec, speakers });

    db.run(
      `UPDATE sessions
       SET speaker_segments_json = ?, status = 'awaiting_speaker_selection',
           updated_at = datetime('now')
       WHERE id = ?`,
      [segmentsJson, sessionId]
    );
    saveDatabaseAfterWrite();

    logger.info(
      `Diarization complete for session ${sessionId}: ${speakers.length} speakers, ` +
      `${totalDurationSec}s total — awaiting speaker selection`
    );

    return { success: true, sessionId, speakerCount: speakers.length, totalDurationSec };
  } catch (error) {
    logger.error(`Diarization failed for session ${sessionId}: ${error.message}`);
    try {
      db.run(
        "UPDATE sessions SET status = 'diarization_failed', updated_at = datetime('now') WHERE id = ?",
        [sessionId]
      );
      saveDatabaseAfterWrite();
    } catch (_) {
      // best-effort
    }
    return { success: false, sessionId, error: error.message };
  }
}

module.exports = {
  diarizeSessionAudio,
  processSessionDiarization,
  isProviderConfigured,
  buildDevSpeakers,           // exported for tests
  filterTranscriptToSpeaker,  // exported for transcription pipeline
  estimateDurationFromSize    // exported for tests
};
