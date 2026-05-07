// Therapist Knowledge Base section for the Settings page (T-09 / Feature #367)
// -----------------------------------------------------------------------------
// - Lists uploaded reference documents with status badges (queued / ingesting /
//   ready / failed) and chunk_count.
// - Drag-and-drop or file-picker upload (PDF / DOCX / TXT / MD / EPUB, ≤50MB).
// - Polls every 4s while at least one document is in queued/ingesting state.
// - Tier-gated: shows an upgrade prompt for non-Pro/Premium therapists.

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from './LoadingSpinner';
import { formatUserDate } from '../utils/formatDate';

const API_URL = '/api';

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.epub,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/epub+zip';

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status, t }) {
  const map = {
    queued: { bg: 'bg-amber-100', text: 'text-amber-800', label: t('kb.status.queued') },
    ingesting: { bg: 'bg-blue-100', text: 'text-blue-800', label: t('kb.status.ingesting') },
    ready: { bg: 'bg-green-100', text: 'text-green-800', label: t('kb.status.ready') },
    failed: { bg: 'bg-red-100', text: 'text-red-800', label: t('kb.status.failed') }
  };
  const cfg = map[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`} data-testid={`kb-status-${status}`}>
      {cfg.label}
    </span>
  );
}

export default function KnowledgeBaseSection() {
  const { t } = useTranslation();

  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ total_documents: 0, ready_documents: 0, total_chunks: 0 });
  const [maxBytes, setMaxBytes] = useState(50 * 1024 * 1024);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tierBlocked, setTierBlocked] = useState(false);
  const [tierMessage, setTierMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  function authHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async function loadDocs() {
    try {
      const res = await fetch(`${API_URL}/kb`, { headers: authHeader() });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data && data.code === 'tier_gate') {
          setTierBlocked(true);
          setTierMessage(data.message || t('kb.tierGate.message'));
          setLoading(false);
          return;
        }
      }
      if (!res.ok) {
        throw new Error('Failed to load knowledge base');
      }
      const data = await res.json();
      setDocuments(data.documents || []);
      setStats(data.stats || { total_documents: 0, ready_documents: 0, total_chunks: 0 });
      if (typeof data.max_file_bytes === 'number') setMaxBytes(data.max_file_bytes);
      setTierBlocked(false);
    } catch (e) {
      setError(e.message || t('kb.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while any document is still ingesting
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const inFlight = documents.some(d => d.status === 'queued' || d.status === 'ingesting');
    if (inFlight && !tierBlocked) {
      pollRef.current = setInterval(loadDocs, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, tierBlocked]);

  async function handleUpload(file) {
    if (!file) return;
    if (file.size > maxBytes) {
      setError(t('kb.errors.tooLarge', { mb: Math.round(maxBytes / 1024 / 1024) }));
      return;
    }
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/kb/upload`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data && data.code === 'tier_gate') {
        setTierBlocked(true);
        setTierMessage(data.message || t('kb.tierGate.message'));
        return;
      }
      if (res.status === 429 && data && data.code === 'spending_limit') {
        setError(data.message || t('kb.errors.spendingLimit'));
        return;
      }
      if (res.status === 413) {
        setError(data.message || t('kb.errors.tooLarge', { mb: Math.round(maxBytes / 1024 / 1024) }));
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || t('kb.errors.uploadFailed'));
      }
      setSuccess(t('kb.uploadQueued'));
      setTimeout(() => setSuccess(''), 4000);
      await loadDocs();
    } catch (e) {
      setError(e.message || t('kb.errors.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id, title) {
    if (!confirm(t('kb.deleteConfirm', { title }))) return;
    try {
      const res = await fetch(`${API_URL}/kb/${id}`, {
        method: 'DELETE',
        headers: authHeader()
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('kb.errors.deleteFailed'));
      }
      setSuccess(t('kb.deleteSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      await loadDocs();
    } catch (e) {
      setError(e.message || t('kb.errors.deleteFailed'));
    }
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleUpload(f);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 mb-6" data-testid="kb-section-loading">
        <h3 className="text-lg font-semibold text-stone-700 mb-4">{t('kb.title')}</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-12 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (tierBlocked) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 mb-6" data-testid="kb-tier-gate">
        <h3 className="text-lg font-semibold text-stone-700 mb-2">{t('kb.title')}</h3>
        <p className="text-sm text-stone-500 mb-4">{t('kb.desc')}</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium mb-1">{t('kb.tierGate.heading')}</p>
          <p className="text-sm text-amber-700">{tierMessage || t('kb.tierGate.message')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8 mb-6" data-testid="kb-section">
      <h3 className="text-lg font-semibold text-stone-700 mb-2">{t('kb.title')}</h3>
      <p className="text-sm text-stone-500 mb-4">{t('kb.desc')}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="kb-error">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm" data-testid="kb-success">
          {success}
        </div>
      )}

      {/* Stats banner */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 rounded px-3 py-2" data-testid="kb-stat-docs">
          <div className="text-stone-400 text-xs uppercase">{t('kb.stats.documents')}</div>
          <div className="font-semibold text-stone-700">{stats.total_documents}</div>
        </div>
        <div className="bg-gray-50 rounded px-3 py-2" data-testid="kb-stat-ready">
          <div className="text-stone-400 text-xs uppercase">{t('kb.stats.ready')}</div>
          <div className="font-semibold text-stone-700">{stats.ready_documents}</div>
        </div>
        <div className="bg-gray-50 rounded px-3 py-2" data-testid="kb-stat-chunks">
          <div className="text-stone-400 text-xs uppercase">{t('kb.stats.chunks')}</div>
          <div className="font-semibold text-stone-700">{stats.total_chunks}</div>
        </div>
      </div>

      {/* Upload dropzone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center mb-6 transition-colors ${
          dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
        }`}
        data-testid="kb-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => handleUpload(e.target.files && e.target.files[0])}
          className="hidden"
          data-testid="kb-file-input"
        />
        <p className="text-sm text-stone-600 mb-2">{t('kb.upload.dropHint')}</p>
        <p className="text-xs text-stone-400 mb-3">
          {t('kb.upload.formats')} · {t('kb.upload.maxSize', { mb: Math.round(maxBytes / 1024 / 1024) })}
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          data-testid="kb-upload-btn"
        >
          {uploading && <LoadingSpinner size={14} className="mr-2" />}
          {uploading ? t('kb.upload.uploading') : t('kb.upload.button')}
        </button>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-sm text-stone-500 italic" data-testid="kb-empty">{t('kb.empty')}</p>
      ) : (
        <ul className="space-y-2" data-testid="kb-list">
          {documents.map(doc => (
            <li
              key={doc.id}
              className="flex items-start justify-between gap-3 border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50"
              data-testid={`kb-doc-${doc.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-stone-700 truncate" title={doc.title}>
                    {doc.title}
                  </span>
                  <StatusBadge status={doc.status} t={t} />
                </div>
                <div className="text-xs text-stone-500 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{fmtBytes(doc.file_size)}</span>
                  {doc.status === 'ready' && (
                    <span data-testid={`kb-chunks-${doc.id}`}>
                      {t('kb.chunkCount', { count: doc.chunk_count })}
                    </span>
                  )}
                  {(doc.status === 'queued' || doc.status === 'ingesting') && (
                    <span className="italic">{t('kb.processing')}</span>
                  )}
                  <span>{formatUserDate(doc.created_at)}</span>
                </div>
                {doc.status === 'failed' && doc.error_message && (
                  <p className="text-xs text-red-600 mt-1">{doc.error_message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id, doc.title)}
                className="text-xs text-red-600 hover:text-red-700 hover:underline whitespace-nowrap"
                data-testid={`kb-delete-${doc.id}`}
              >
                {t('kb.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
