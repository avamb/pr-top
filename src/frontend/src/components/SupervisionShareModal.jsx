import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * SupervisionShareModal — T-17
 * Therapist-side modal for creating, listing and revoking read-only supervision
 * share links. Each link points to /share/supervision/:token and grants a
 * supervisor read-only access to a single client's history without sharing
 * a password. Optional anonymization replaces the client's name with "Client A"
 * and redacts emails/phones from displayed text.
 */
function SupervisionShareModal({ open, onClose, clientId, clientLabel, token }) {
  const { t } = useTranslation();
  const API = '/api';

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [revokeBusyId, setRevokeBusyId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Form state
  const [ttl, setTtl] = useState('7d');
  const [anonymize, setAnonymize] = useState(true);
  const [note, setNote] = useState('');

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/clients/${clientId}/supervision-share`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('supervision.errorLoad', 'Failed to load share links'));
      }
      const data = await res.json();
      setLinks(data.links || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, token, t]);

  useEffect(() => {
    if (open && clientId) {
      fetchLinks();
    }
  }, [open, clientId, fetchLinks]);

  async function handleCreate(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API}/clients/${clientId}/supervision-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ttl, anonymize, note: note.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('supervision.errorCreate', 'Failed to create share link'));
      }
      // Reset form & refresh list (the new link will be at the top)
      setNote('');
      await fetchLinks();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(linkId) {
    if (revokeBusyId) return;
    if (!window.confirm(t('supervision.confirmRevoke', 'Revoke this share link? Anyone holding the URL will lose access immediately.'))) {
      return;
    }
    setRevokeBusyId(linkId);
    setError('');
    try {
      const res = await fetch(`${API}/clients/${clientId}/supervision-share/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('supervision.errorRevoke', 'Failed to revoke share link'));
      }
      await fetchLinks();
    } catch (e) {
      setError(e.message);
    } finally {
      setRevokeBusyId(null);
    }
  }

  async function copyLink(link) {
    try {
      const url = link.url || `${window.location.origin}/share/supervision/${link.token}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      setError(t('supervision.errorCopy', 'Failed to copy link to clipboard'));
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  function statusBadge(link) {
    if (link.is_revoked) {
      return (
        <span className="px-2 py-0.5 rounded text-xs bg-stone-200 text-stone-700">
          {t('supervision.statusRevoked', 'Revoked')}
        </span>
      );
    }
    if (link.is_expired) {
      return (
        <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
          {t('supervision.statusExpired', 'Expired')}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
        {t('supervision.statusActive', 'Active')}
      </span>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-800">
            🔗 {t('supervision.modalTitle', 'Share for supervision')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t('common.close', 'Close')}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-stone-600">
            {t(
              'supervision.modalDescription',
              'Generate a read-only link a supervisor can open without an account. The link can be revoked at any time and expires automatically.'
            )}
          </p>
          {clientLabel && (
            <div className="text-sm text-stone-500">
              {t('supervision.clientLabel', 'Client')}: <span className="font-medium text-stone-700">{clientLabel}</span>
            </div>
          )}

          {error && (
            <div className="rounded bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Create form */}
          <form onSubmit={handleCreate} className="space-y-3 border border-stone-200 rounded-lg p-3 bg-stone-50">
            <div className="font-medium text-sm text-stone-700">
              {t('supervision.createTitle', 'Create new share link')}
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {t('supervision.ttlLabel', 'Link lifetime')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['1d', '7d', '30d'].map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm border ${
                      ttl === opt
                        ? 'bg-teal-50 border-teal-400 text-teal-800'
                        : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ttl"
                      value={opt}
                      checked={ttl === opt}
                      onChange={() => setTtl(opt)}
                      className="hidden"
                    />
                    {opt === '1d' && t('supervision.ttl1d', '1 day')}
                    {opt === '7d' && t('supervision.ttl7d', '7 days')}
                    {opt === '30d' && t('supervision.ttl30d', '30 days')}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonymize}
                  onChange={(e) => setAnonymize(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>
                  {t('supervision.anonymizeLabel', 'Anonymize client identity')}
                </span>
              </label>
              <div className="text-xs text-stone-500 mt-1 ml-6">
                {t(
                  'supervision.anonymizeHint',
                  'Replace client name with "Client A" and redact emails/phone numbers in shared text.'
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {t('supervision.noteLabel', 'Internal note (optional)')}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder={t('supervision.notePlaceholder', 'e.g. "Oct supervision with Dr. Ivanov"')}
                className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
            >
              {creating ? t('supervision.creating', 'Creating...') : t('supervision.createBtn', 'Create share link')}
            </button>
          </form>

          {/* Existing links */}
          <div>
            <div className="font-medium text-sm text-stone-700 mb-2">
              {t('supervision.existingTitle', 'Existing share links')}
            </div>

            {loading ? (
              <div className="text-sm text-stone-500 py-4 text-center">
                {t('common.loading', 'Loading...')}
              </div>
            ) : links.length === 0 ? (
              <div className="text-sm text-stone-500 py-6 text-center border border-dashed border-stone-300 rounded">
                {t('supervision.empty', 'No share links yet.')}
              </div>
            ) : (
              <ul className="space-y-2">
                {links.map((link) => {
                  const url = link.url || `${window.location.origin}/share/supervision/${link.token}`;
                  return (
                    <li key={link.id} className="border border-stone-200 rounded p-3 bg-white">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {statusBadge(link)}
                          {link.anonymize && (
                            <span className="px-2 py-0.5 rounded text-xs bg-stone-100 text-stone-700">
                              {t('supervision.badgeAnonymized', 'Anonymized')}
                            </span>
                          )}
                          <span className="text-xs text-stone-500">
                            {t('supervision.createdAt', 'Created')}: {formatDate(link.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-stone-500 mb-2">
                        {link.is_revoked
                          ? t('supervision.revokedAt', 'Revoked')
                          : t('supervision.expiresAt', 'Expires')}
                        : {formatDate(link.is_revoked ? link.revoked_at : link.expires_at)}
                        {' · '}
                        {t('supervision.accessCount', 'Accessed')}: {link.access_count || 0}
                      </div>

                      {link.note && (
                        <div className="text-xs text-stone-600 italic mb-2 break-words">
                          "{link.note}"
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={url}
                          readOnly
                          onClick={(e) => e.target.select()}
                          className="flex-1 min-w-[200px] px-2 py-1.5 border border-stone-300 rounded text-xs font-mono bg-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        {link.is_active ? (
                          <>
                            <button
                              type="button"
                              onClick={() => copyLink(link)}
                              className="px-2 py-1.5 bg-stone-100 text-stone-700 rounded text-xs hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                              {copiedId === link.id ? '✓ ' + t('supervision.copied', 'Copied') : t('supervision.copyBtn', 'Copy')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(link.id)}
                              disabled={revokeBusyId === link.id}
                              className="px-2 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs hover:bg-red-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              {revokeBusyId === link.id
                                ? t('supervision.revoking', '...')
                                : t('supervision.revokeBtn', 'Revoke')}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-stone-400">
                            {t('supervision.inactive', 'Inactive')}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-sm hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SupervisionShareModal;
