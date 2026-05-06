// BulkUpload - T-20 Auto-link audio by date/metadata.
//
// Feature #378 ("[P3|Sonnet 4.6|M] T-20 — Auto-link audio by date/metadata").
//
// Therapist drops 3+ recordings at once. The browser collects per-file
// metadata (filename + File.lastModified) and POSTs it to
// /api/sessions/auto-match. The backend extracts a date from the filename
// (or falls back to the file mtime) and looks up the therapist's existing
// session.scheduled_at slots (T-02). Each file then carries one of three
// outcomes:
//   - auto_match:        pre-fills the client dropdown, ready to upload
//   - conflict=true:     multi-client picker
//   - needs_new_session: full client picker (T-07 "create new session")
//
// Once the therapist resolves all rows, the upload itself is a per-file
// POST /api/sessions (the same endpoint used by ClientDetail's single
// upload), so the existing security model — consent gate, plan-limit,
// AES-encrypt-on-disk, opaque storage filename — applies unchanged.
// We cap concurrent uploads at 3 to avoid hammering the server.
//
// Comments here intentionally lean technical so the next maintainer can
// see why each piece exists; UI strings are i18n.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../components/LoadingSpinner';

const API = '/api';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // matches backend multer limit
const MAX_BATCH = 20; // matches backend /auto-match cap
const MAX_PARALLEL_UPLOADS = 3;
const ACCEPT = '.mp3,.m4a,.wav,.ogg,.opus,.webm,.mp4,.mov,audio/*,video/*';

// Same media-type validation rules as ClientDetail.jsx — keep in sync so
// users don't get inconsistent rejections.
const ALLOWED_EXT = new Set([
  'mp3', 'm4a', 'wav', 'ogg', 'opus', 'webm', 'mp4', 'mov', 'aac', 'flac'
]);

function validateFile(file, t) {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: t('session.upload.tooLarge', 'File too large. Maximum size is 100MB.') };
  }
  const dot = file.name.lastIndexOf('.');
  const ext = dot > -1 ? file.name.slice(dot + 1).toLowerCase() : '';
  // Trust the mime when present; fall back to the extension for browsers
  // that drop MIME on drag-and-drop (Safari does this for .m4a files).
  if (!file.type && !ALLOWED_EXT.has(ext)) {
    return { valid: false, error: t('session.upload.invalidType', 'Unsupported file type. Use mp3, m4a, wav, mp4, webm, or ogg.') };
  }
  if (file.type && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    return { valid: false, error: t('session.upload.invalidType') };
  }
  return { valid: true };
}

// Build a stable client-side ID per dropped file so React keys remain
// consistent across re-renders even after the auto-match call returns.
let _rowSeq = 0;
function nextRowId() {
  _rowSeq += 1;
  return `f${Date.now()}_${_rowSeq}`;
}

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildClientLabel(client) {
  const fn = (client.first_name || '').trim();
  const ln = (client.last_name || '').trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (client.email) return client.email;
  if (client.telegram_username) return `@${client.telegram_username}`;
  if (client.telegram_id) return `tg:${client.telegram_id}`;
  return `Client #${client.id}`;
}

export default function BulkUpload() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  // Each row: { rowId, file, validationError, parsedDate, parsedMethod,
  //   candidates, autoMatch, conflict, needsNewSession, selectedClientId,
  //   meetingDate, status, progress, error, sessionId }
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Pre-load all linked clients once. We page-fetch up to 200 — the per-page
  // cap is 100, so two requests cover the practical universe of any single
  // therapist's caseload (Premium plan caps clients at much less than 200).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setClientsLoading(true);
        setClientsError('');
        const token = localStorage.getItem('token');
        const collected = [];
        for (let page = 1; page <= 5; page++) {
          const res = await fetch(`${API}/clients?per_page=100&page=${page}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            if (res.status === 401) {
              navigate('/login');
              return;
            }
            throw new Error(`Failed to load clients (${res.status})`);
          }
          const data = await res.json();
          collected.push(...(data.clients || []));
          if (!data.clients || data.clients.length < 100) break;
        }
        if (!alive) return;
        // Filter to consenting clients only — these are the only ones the
        // backend will let us POST a session for anyway.
        setClients(collected.filter(c => c.consent_therapist_access));
      } catch (err) {
        if (alive) setClientsError(err.message);
      } finally {
        if (alive) setClientsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate]);

  const clientsById = useMemo(() => {
    const m = new Map();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  // ---------- File ingest ----------

  function ingestFiles(fileList) {
    setGlobalError('');
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    // Don't blow past the backend's 20-file cap. Truncate with a notice so
    // the therapist still understands what happened.
    const room = Math.max(0, MAX_BATCH - rows.length);
    if (room === 0) {
      setGlobalError(t('session.upload.autoLink.tooManyFiles', { max: MAX_BATCH }));
      return;
    }
    const accepted = incoming.slice(0, room);
    if (incoming.length > room) {
      setGlobalError(t('session.upload.autoLink.tooManyFiles', { max: MAX_BATCH }));
    }

    const newRows = accepted.map(file => {
      const v = validateFile(file, t);
      return {
        rowId: nextRowId(),
        file,
        validationError: v.valid ? '' : v.error,
        parsedDate: '',
        parsedMethod: null,
        candidates: [],
        autoMatch: null,
        conflict: false,
        needsNewSession: false,
        selectedClientId: '',
        meetingDate: todayIsoDate(),
        title: '',
        status: v.valid ? 'idle' : 'invalid',
        progress: 0,
        error: '',
        sessionId: null
      };
    });

    setRows(prev => [...prev, ...newRows]);
    // Kick off the auto-match call only for the just-added valid rows.
    const validNew = newRows.filter(r => r.status !== 'invalid');
    if (validNew.length > 0) {
      void runAutoMatch(validNew);
    }
  }

  async function runAutoMatch(forRows) {
    setIsMatching(true);
    try {
      const token = localStorage.getItem('token');
      const csrfMeta = document.querySelector('meta[name="csrf-token"]');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (csrfMeta) headers['x-csrf-token'] = csrfMeta.content;

      const payload = {
        files: forRows.map(r => ({
          filename: r.file.name,
          last_modified_ms: r.file.lastModified || null
        }))
      };
      const res = await fetch(`${API}/sessions/auto-match`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        const txt = await res.text().catch(() => '');
        throw new Error(`auto-match failed (${res.status}) ${txt}`);
      }
      const data = await res.json();
      const matchesByIndex = new Map();
      for (const m of data.matches || []) {
        matchesByIndex.set(m.file_index, m);
      }

      // Splice the match results back into the corresponding rows. We have
      // to look the row up by rowId (not by index) because the user could
      // have dropped a second batch while this fetch was in-flight.
      setRows(prev => prev.map(row => {
        const idx = forRows.findIndex(r => r.rowId === row.rowId);
        if (idx === -1) return row;
        const m = matchesByIndex.get(idx);
        if (!m) return row;
        const next = {
          ...row,
          parsedDate: m.parsed_date || '',
          parsedMethod: m.parsed_method || null,
          candidates: m.candidates || [],
          autoMatch: m.auto_match || null,
          conflict: !!m.conflict,
          needsNewSession: !!m.needs_new_session
        };
        // Pre-select the client when we have a confident auto-match.
        if (m.auto_match && m.auto_match.client_id) {
          next.selectedClientId = String(m.auto_match.client_id);
        }
        if (m.parsed_date) {
          next.meetingDate = m.parsed_date;
        }
        return next;
      }));
    } catch (err) {
      setGlobalError(t('session.upload.autoLink.autoMatchError', { message: err.message }));
    } finally {
      setIsMatching(false);
    }
  }

  // ---------- Row mutators ----------

  function updateRow(rowId, patch) {
    setRows(prev => prev.map(r => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function removeRow(rowId) {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  }

  function clearAll() {
    if (isUploadingAll) return;
    setRows([]);
    setGlobalError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ---------- Drag-and-drop ----------

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploadingAll) setDragActive(true);
  }
  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      ingestFiles(e.dataTransfer.files);
    }
  }

  // ---------- Upload ----------

  function rowReadyForUpload(row) {
    if (row.status !== 'idle' && row.status !== 'error') return false;
    if (!row.selectedClientId) return false;
    if (!row.meetingDate) return false;
    if (!clientsById.has(parseInt(row.selectedClientId, 10))) return false;
    return true;
  }

  function uploadRow(row) {
    return new Promise((resolve) => {
      const token = localStorage.getItem('token');
      const csrfMeta = document.querySelector('meta[name="csrf-token"]');
      const formData = new FormData();
      formData.append('audio', row.file);
      formData.append('client_id', row.selectedClientId);
      if (row.meetingDate) formData.append('scheduled_at', row.meetingDate);
      const trimmedTitle = (row.title || '').trim();
      if (trimmedTitle) formData.append('title', trimmedTitle.slice(0, 200));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/sessions`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (csrfMeta) xhr.setRequestHeader('x-csrf-token', csrfMeta.content);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          updateRow(row.rowId, { progress: pct });
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            updateRow(row.rowId, {
              status: 'done',
              progress: 100,
              sessionId: data.id || null,
              error: ''
            });
            resolve({ ok: true });
          } else {
            updateRow(row.rowId, {
              status: 'error',
              error: data.error || `HTTP ${xhr.status}`
            });
            resolve({ ok: false });
          }
        } catch {
          updateRow(row.rowId, { status: 'error', error: `HTTP ${xhr.status}` });
          resolve({ ok: false });
        }
      };
      xhr.onerror = () => {
        updateRow(row.rowId, { status: 'error', error: t('session.upload.autoLink.networkError', 'Network error') });
        resolve({ ok: false });
      };
      xhr.ontimeout = () => {
        updateRow(row.rowId, { status: 'error', error: t('session.upload.autoLink.timeout', 'Upload timed out') });
        resolve({ ok: false });
      };
      xhr.timeout = 5 * 60 * 1000;

      updateRow(row.rowId, { status: 'uploading', progress: 0, error: '' });
      xhr.send(formData);
    });
  }

  async function handleUploadAll() {
    if (isUploadingAll) return;
    setIsUploadingAll(true);
    setGlobalError('');

    // Snapshot the current rows in dependency order; we'll process them via
    // a sliding window of MAX_PARALLEL_UPLOADS in-flight requests.
    const queue = rows.filter(rowReadyForUpload).map(r => r.rowId);
    let cursor = 0;

    async function worker() {
      while (cursor < queue.length) {
        const myIdx = cursor++;
        const id = queue[myIdx];
        // Re-read the current row state in case the user just resolved a
        // conflict for this file before the worker picked it up.
        const fresh = (function findRow(rs, rowId) {
          for (const r of rs) if (r.rowId === rowId) return r;
          return null;
        })(rowsRef.current, id);
        if (!fresh || !rowReadyForUpload(fresh)) continue;
        await uploadRow(fresh);
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(MAX_PARALLEL_UPLOADS, queue.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    setIsUploadingAll(false);
  }

  // Keep a ref-mirror of `rows` so the upload worker reads the freshest
  // selectedClientId/meetingDate without relying on stale closure state.
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // ---------- Derived counters ----------

  const counts = useMemo(() => {
    const c = { total: rows.length, ready: 0, conflict: 0, needsManual: 0, done: 0, errored: 0, uploading: 0 };
    for (const r of rows) {
      if (r.status === 'invalid') { c.errored++; continue; }
      if (r.status === 'done') { c.done++; continue; }
      if (r.status === 'error') { c.errored++; continue; }
      if (r.status === 'uploading') { c.uploading++; continue; }
      if (rowReadyForUpload(r)) c.ready++;
      else if (r.conflict && !r.selectedClientId) c.conflict++;
      else if (r.needsNewSession && !r.selectedClientId) c.needsManual++;
    }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, clientsById]);

  const canUploadAll = counts.ready > 0 && !isUploadingAll;

  // ---------- Render ----------

  return (
    <div>
      <a href="#main-content" className="skip-to-content">{t('nav.skipToContent', 'Skip to content')}</a>

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">{t('session.upload.autoLink.pageTitle', 'Bulk session upload')}</h1>
            <p className="text-sm text-stone-500 mt-1">
              {t('session.upload.autoLink.pageDesc', 'Drop several recordings at once — we match each one to a session by date.')}
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-stone-600 hover:text-stone-800 underline"
          >
            ← {t('session.upload.autoLink.backToDashboard', 'Back to dashboard')}
          </button>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {clientsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {clientsError}
          </div>
        )}

        {/* Drop zone */}
        <div
          data-testid="bulk-upload-dropzone"
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current && fileInputRef.current.click();
            }
          }}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-6 ${
            dragActive
              ? 'border-teal-500 bg-teal-50'
              : 'border-stone-300 bg-stone-50 hover:border-teal-400 hover:bg-teal-50'
          }`}
        >
          <div className="text-4xl mb-2">📁</div>
          <p className="text-sm font-medium text-stone-700 mb-1">
            {dragActive
              ? t('session.upload.autoLink.dropHere', 'Release to add the recordings')
              : t('session.upload.autoLink.dragDrop', 'Drag & drop recordings here, or click to browse')}
          </p>
          <p className="text-xs text-stone-500">
            {t('session.upload.autoLink.batchHint', 'Up to {{max}} files at once · 100MB max each · mp3, m4a, wav, mp4, webm, ogg', { max: MAX_BATCH })}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            data-testid="bulk-upload-file-input"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                ingestFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </div>

        {globalError && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm" data-testid="bulk-upload-global-error">
            {globalError}
          </div>
        )}

        {(isMatching || clientsLoading) && (
          <div className="mb-4 flex items-center gap-2 text-sm text-stone-500" data-testid="bulk-upload-matching">
            <LoadingSpinner size={16} />
            <span>
              {clientsLoading
                ? t('session.upload.autoLink.loadingClients', 'Loading clients…')
                : t('session.upload.autoLink.matching', 'Matching files to sessions…')}
            </span>
          </div>
        )}

        {/* Status counters */}
        {rows.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3 text-xs" data-testid="bulk-upload-counts">
            <span className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
              {t('session.upload.autoLink.statusReady', 'Ready: {{n}}', { n: counts.ready })}
            </span>
            <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
              {t('session.upload.autoLink.statusConflict', 'Need selection: {{n}}', { n: counts.conflict + counts.needsManual })}
            </span>
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {t('session.upload.autoLink.statusUploading', 'Uploading: {{n}}', { n: counts.uploading })}
            </span>
            <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {t('session.upload.autoLink.statusDone', 'Done: {{n}}', { n: counts.done })}
            </span>
            {counts.errored > 0 && (
              <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                {t('session.upload.autoLink.statusErrored', 'Errors: {{n}}', { n: counts.errored })}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {rows.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={!canUploadAll}
              data-testid="bulk-upload-go"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingAll
                ? t('session.upload.autoLink.uploadingAll', 'Uploading…')
                : t('session.upload.autoLink.uploadAll', 'Upload all ready ({{n}})', { n: counts.ready })}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={isUploadingAll}
              className="px-4 py-2 bg-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-300 disabled:opacity-50"
              data-testid="bulk-upload-clear"
            >
              {t('session.upload.autoLink.clearAll', 'Clear list')}
            </button>
          </div>
        )}

        {/* Per-file rows */}
        {rows.length === 0 && !clientsLoading && (
          <p className="text-sm text-stone-500 italic">
            {t('session.upload.autoLink.empty', 'No files yet. Drop a few recordings above to get started.')}
          </p>
        )}

        <ul className="space-y-3" data-testid="bulk-upload-rows">
          {rows.map((row) => (
            <FileRow
              key={row.rowId}
              row={row}
              clients={clients}
              onChange={(patch) => updateRow(row.rowId, patch)}
              onRemove={() => removeRow(row.rowId)}
              onRetry={() => uploadRow({ ...row, status: 'idle' })}
              isUploadingAll={isUploadingAll}
              t={t}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

function FileRow({ row, clients, onChange, onRemove, onRetry, isUploadingAll, t }) {
  const sizeMb = (row.file.size / (1024 * 1024)).toFixed(1);
  const isInvalid = row.status === 'invalid';
  const isDone = row.status === 'done';
  const isUploading = row.status === 'uploading';
  const isErrored = row.status === 'error';

  let statusBadge = null;
  if (isInvalid) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">{t('session.upload.autoLink.statusInvalid', 'Invalid')}</span>;
  } else if (isDone) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">{t('session.upload.autoLink.statusUploaded', 'Uploaded')}</span>;
  } else if (isUploading) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">{t('session.upload.autoLink.statusUploading', 'Uploading: {{n}}', { n: 1 }).replace(/:\s*1$/, '')}</span>;
  } else if (isErrored) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">{t('session.upload.autoLink.statusError', 'Error')}</span>;
  } else if (row.autoMatch) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs">{t('session.upload.autoLink.statusAutoMatched', 'Auto-matched')}</span>;
  } else if (row.conflict) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">{t('session.upload.autoLink.statusConflictBadge', 'Conflict')}</span>;
  } else if (row.needsNewSession) {
    statusBadge = <span className="px-2 py-0.5 rounded bg-stone-200 text-stone-700 text-xs">{t('session.upload.autoLink.statusNoMatchBadge', 'No match')}</span>;
  }

  return (
    <li
      data-testid="bulk-upload-row"
      data-status={row.status}
      className={`border rounded-lg p-4 bg-white ${isInvalid || isErrored ? 'border-red-200' : isDone ? 'border-emerald-200' : 'border-stone-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">🎧</span>
            <span className="font-medium text-stone-800 truncate" title={row.file.name}>{row.file.name}</span>
            <span className="text-xs text-stone-500">{sizeMb} MB</span>
            {statusBadge}
          </div>

          {row.parsedDate && (
            <p className="text-xs text-stone-500 mt-1" data-testid="bulk-upload-row-parsed">
              {row.parsedMethod === 'mtime'
                ? t('session.upload.autoLink.parsedMtime', 'Date from file timestamp: {{date}}', { date: row.parsedDate })
                : t('session.upload.autoLink.parsedFilename', 'Date from filename: {{date}}', { date: row.parsedDate })}
            </p>
          )}
          {!row.parsedDate && !isInvalid && (
            <p className="text-xs text-amber-600 mt-1">
              {t('session.upload.autoLink.noDateParsed', 'Could not detect a date — please pick a meeting date below.')}
            </p>
          )}

          {row.validationError && (
            <p className="text-xs text-red-600 mt-1">{row.validationError}</p>
          )}

          {row.error && (
            <p className="text-xs text-red-600 mt-1" data-testid="bulk-upload-row-error">{row.error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={isUploadingAll && isUploading}
          className="text-xs text-stone-500 hover:text-red-600 underline disabled:opacity-50"
          data-testid="bulk-upload-row-remove"
        >
          {t('session.upload.autoLink.removeFile', 'Remove')}
        </button>
      </div>

      {!isInvalid && !isDone && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t('session.upload.autoLink.clientLabel', 'Client')}
            </label>
            <select
              value={row.selectedClientId}
              disabled={isUploading}
              onChange={(e) => onChange({ selectedClientId: e.target.value })}
              data-testid="bulk-upload-row-client"
              className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{t('session.upload.autoLink.clientPick', '— Pick a client —')}</option>
              {/* Conflict candidates first (they all have a same-day session) */}
              {row.candidates && row.candidates.length > 0 && (
                <optgroup label={t('session.upload.autoLink.candidatesGroup', 'Same-day sessions')}>
                  {row.candidates.map(cand => (
                    <option key={`c-${cand.client_id}`} value={cand.client_id}>
                      {cand.display_name}
                      {cand.existing_session_id ? ' · ' + t('session.upload.autoLink.existingSession', 'existing slot') : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t('session.upload.autoLink.allClientsGroup', 'All clients')}>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{buildClientLabel(c)}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t('session.upload.meetingDate', 'Meeting date')}
            </label>
            <input
              type="date"
              value={row.meetingDate}
              disabled={isUploading}
              onChange={(e) => onChange({ meetingDate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              data-testid="bulk-upload-row-date"
              className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t('session.upload.titleLabel', 'Title (optional)')}
            </label>
            <input
              type="text"
              value={row.title}
              maxLength={200}
              disabled={isUploading}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={t('session.upload.titlePlaceholder', 'e.g. Follow-up about anxiety')}
              data-testid="bulk-upload-row-title"
              className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {/* Per-file progress bar */}
      {isUploading && (
        <div className="mt-3" data-testid="bulk-upload-row-progress">
          <div className="w-full bg-stone-200 rounded-full h-2">
            <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${row.progress}%` }} />
          </div>
          <p className="text-xs text-stone-500 mt-1">{row.progress}%</p>
        </div>
      )}

      {/* Retry on failure */}
      {isErrored && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onRetry}
            data-testid="bulk-upload-row-retry"
            className="text-xs text-teal-700 underline hover:text-teal-800"
          >
            {t('session.upload.autoLink.retry', 'Retry upload')}
          </button>
        </div>
      )}
    </li>
  );
}
