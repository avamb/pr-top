import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchApi } from '../utils/fetchApi';

// Superadmin: encryption key versions, what is still stored under an older
// key version, and the resumable re-encryption job (audit wave 3, M16).
// Backend: GET /api/encryption/rotation/status, POST /rotation/start|pause.

const CHECK_STYLES = {
  ok: 'bg-green-50 text-green-700',
  mismatch: 'bg-red-50 text-red-700',
  unavailable: 'bg-amber-50 text-amber-700',
  unverified: 'bg-stone-100 text-secondary',
  error: 'bg-red-50 text-red-700',
};

const JOB_STYLES = {
  running: 'bg-blue-50 text-blue-700',
  paused: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  completed_with_errors: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
};

function Badge({ className, children }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>{children}</span>;
}

export default function EncryptionKeyRotationPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchApi('/api/encryption/rotation/status');
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await res.json());
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
    return () => clearTimeout(timerRef.current);
  }, [load]);

  // Poll while the job runs.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (status && status.running) {
      timerRef.current = setTimeout(load, 3000);
    }
  }, [status, load]);

  const post = async (url, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetchApi(url, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || t('admin.encryption.actionFailed') });
      }
    } catch (e) {
      setMessage({ type: 'error', text: t('admin.encryption.actionFailed') });
    } finally {
      setBusy(false);
      load();
    }
  };

  if (loadError && !status) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 text-sm text-red-700">{t('admin.encryption.loadFailed')}</div>
    );
  }
  if (!status) {
    return <div className="bg-white rounded-lg shadow-md p-6 mb-8 text-sm text-secondary">{t('common.loading', 'Loading...')}</div>;
  }

  const job = status.job;
  const inv = status.inventory || {};
  const files = inv.files || {};
  const backups = inv.backups || {};
  const jobStatus = job ? (job.interrupted ? 'interrupted' : job.status) : null;
  const canResume = job && ['paused', 'failed'].includes(job.status) || (job && job.interrupted);
  const reenc = job && job.stats ? job.stats.values_reencrypted || 0 : 0;
  const failedValues = job && job.stats ? job.stats.values_failed || 0 : 0;
  const outdated = inv.column_values_outdated || 0;
  const progressTotal = reenc + outdated;
  const progress = status.running && progressTotal > 0 ? Math.round((reenc / progressTotal) * 100) : null;
  const failures = job && job.stats && Array.isArray(job.stats.failures) ? job.stats.failures.slice(0, 5) : [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">🔑</span>
          <div>
            <p className="font-medium text-text">
              {t('admin.encryption.activeVersion')}: <span className="font-bold">v{status.active_version}</span>{' '}
              <Badge className={CHECK_STYLES[status.active_key_check] || CHECK_STYLES.unverified}>
                {t(`admin.encryption.check_${status.active_key_check}`)}
              </Badge>
            </p>
            <p className="text-sm text-secondary mt-1">
              {t('admin.encryption.previousKey')}:{' '}
              {status.key_ring && status.key_ring.previous_configured
                ? t('admin.encryption.previousConfigured', { from: status.key_ring.previous_from_version, to: status.key_ring.current_from_version - 1 })
                : t('admin.encryption.previousNotConfigured')}
            </p>
            <p className="text-xs text-secondary mt-1">{t('admin.encryption.runbookHint')}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {status.running ? (
            <button
              type="button"
              onClick={() => post('/api/encryption/rotation/pause')}
              disabled={busy}
              className="px-4 py-2 border border-gray-300 text-text rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {t('admin.encryption.pause')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => post('/api/encryption/rotation/start', t('admin.encryption.confirmStart'))}
              disabled={busy || status.active_key_check === 'mismatch'}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {canResume ? t('admin.encryption.resume') : t('admin.encryption.start')}
            </button>
          )}
        </div>
      </div>

      {status.key_ring && Array.isArray(status.key_ring.warnings) && status.key_ring.warnings.length > 0 && (
        <ul className="mb-4 px-3 py-2 rounded bg-amber-50 text-amber-800 text-sm list-disc list-inside">
          {status.key_ring.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      {/* Key versions */}
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-secondary border-b border-gray-200">
              <th className="py-2 pr-4 font-medium">{t('admin.encryption.colVersion')}</th>
              <th className="py-2 pr-4 font-medium">{t('admin.encryption.colStatus')}</th>
              <th className="py-2 pr-4 font-medium">{t('admin.encryption.colSource')}</th>
              <th className="py-2 pr-4 font-medium">{t('admin.encryption.colCheck')}</th>
              <th className="py-2 pr-4 font-medium">{t('admin.encryption.colFingerprint')}</th>
            </tr>
          </thead>
          <tbody>
            {(status.keys || []).map((k) => (
              <tr key={k.key_version} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium text-text">v{k.key_version}</td>
                <td className="py-2 pr-4 text-text">{t(`admin.encryption.status_${k.status}`, k.status)}</td>
                <td className="py-2 pr-4 text-text">{t(`admin.encryption.source_${k.key_source}`, k.key_source)}</td>
                <td className="py-2 pr-4">
                  <Badge className={CHECK_STYLES[k.key_check] || CHECK_STYLES.unverified}>{t(`admin.encryption.check_${k.key_check}`, k.key_check)}</Badge>
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-secondary">{k.fingerprint || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* What still uses an older key version */}
      <p className="text-sm font-medium text-text mb-2">{t('admin.encryption.remainingTitle')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-4">
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs text-secondary">{t('admin.encryption.remainingValues')}</p>
          <p className="text-lg font-bold text-text">{outdated}</p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs text-secondary">{t('admin.encryption.remainingBackups')}</p>
          <p className="text-lg font-bold text-text">{backups.outdated ?? 0}</p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs text-secondary">{t('admin.encryption.remainingFiles')}</p>
          <p className="text-lg font-bold text-text">{files.outdated ?? 0}</p>
          {files.unknown > 0 && (
            <p className="text-xs text-amber-700 mt-1" title={(files.unknown_files || []).join('\n')}>{t('admin.encryption.unknownFiles', { n: files.unknown })}</p>
          )}
        </div>
      </div>

      <div className={`px-3 py-2 rounded text-sm mb-4 ${status.safe_to_retire_previous ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
        {status.safe_to_retire_previous ? t('admin.encryption.safeToRetire') : t('admin.encryption.notSafeToRetire')}
      </div>

      {inv.unlisted_columns_with_ciphertext && inv.unlisted_columns_with_ciphertext.length > 0 && (
        <div className="px-3 py-2 rounded text-sm mb-4 bg-amber-50 text-amber-800">
          {t('admin.encryption.unlistedWarning')}: <span className="font-mono">{inv.unlisted_columns_with_ciphertext.join(', ')}</span>
        </div>
      )}

      {/* Job */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-text mb-2">{t('admin.encryption.jobTitle')}</p>
        {!job ? (
          <p className="text-sm text-secondary">{t('admin.encryption.noJob')}</p>
        ) : (
          <div className="text-sm text-text space-y-1">
            <p>
              <Badge className={JOB_STYLES[job.status] || JOB_STYLES.paused}>{t(`admin.encryption.job_${jobStatus}`, jobStatus)}</Badge>{' '}
              <span className="text-secondary">
                #{job.id} · v{job.target_version}
                {job.phase && job.phase !== 'done' ? ` · ${t(`admin.encryption.phase_${job.phase}`, job.phase)}` : ''}
                {job.current_table ? ` · ${job.current_table}` : ''}
              </span>
            </p>
            {progress !== null && (
              <div className="w-full bg-stone-100 rounded h-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="bg-primary h-2 rounded" style={{ width: `${progress}%` }} />
              </div>
            )}
            <p className="text-secondary">
              {t('admin.encryption.reencrypted')}: <span className="text-text font-medium">{reenc}</span>
              {' · '}
              {t('admin.encryption.failedValues')}: <span className={failedValues ? 'text-red-700 font-medium' : 'text-text font-medium'}>{failedValues}</span>
              {job.stats && job.stats.backups ? (
                <>
                  {' · '}
                  {t('admin.encryption.backupsReencrypted')}: <span className="text-text font-medium">{job.stats.backups.rewrapped || 0}</span>
                </>
              ) : null}
              {job.stats && job.stats.files_reencrypt ? (
                <>
                  {' · '}
                  {t('admin.encryption.filesReencrypted')}: <span className="text-text font-medium">{job.stats.files_reencrypt.reencrypted || 0}</span>
                </>
              ) : null}
            </p>
            {job.finished_at && (
              <p className="text-xs text-secondary">{t('admin.encryption.finishedAt')}: {new Date(job.finished_at).toLocaleString()}</p>
            )}
            {job.error && <p className="text-xs text-red-700">{job.error}</p>}
            {failures.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-text">{t('admin.encryption.failuresTitle')}</p>
                <ul className="text-xs font-mono text-secondary">
                  {failures.map((f) => (
                    <li key={f.file ? `file:${f.file}` : `${f.table}.${f.column}.${f.rowid}`}>
                      {f.file ? f.file : `${f.table}.${f.column} #${f.rowid}`}{f.key_version != null ? ` (v${f.key_version})` : ''}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={`mt-3 px-3 py-2 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
