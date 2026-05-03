import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * SupervisionView — T-17
 * Public read-only page for supervisors. Authenticates by possession of the
 * opaque token in the URL (no login). Renders client history with sessions,
 * diary entries, inquiries, and shared comments. Excludes private notes,
 * raw audio/video, SOS personal data, and (when anonymize=true) any
 * identifying details.
 */
function SupervisionView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/share/supervision/${encodeURIComponent(token)}`, {
          headers: { Accept: 'application/json' },
        });
        if (cancelled) return;
        if (res.status === 404) {
          setError('not_found');
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const body = await res.json();
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-stone-500">Loading…</div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-semibold text-stone-800 mb-2">Share link not available</h1>
          <p className="text-sm text-stone-600">
            This supervision share link is no longer valid. It may have been revoked by the
            therapist or expired.
          </p>
          <Link
            to="/"
            className="inline-block mt-4 px-4 py-2 bg-stone-700 text-white text-sm rounded hover:bg-stone-800"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md">
          <h1 className="text-lg font-semibold text-stone-800 mb-2">Could not load share</h1>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { view, meta } = data;
  const { client, sessions, diary, inquiries, shared_comments: sharedComments } = view;

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'sessions', label: `🎧 Sessions (${sessions.length})` },
    { id: 'diary', label: `📝 Diary (${diary.length})` },
    { id: 'inquiries', label: `🎯 Inquiries (${inquiries.length})` },
    { id: 'comments', label: `💬 Shared notes (${sharedComments.length})` },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Banner */}
      <div className="bg-indigo-700 text-white py-2 px-4 text-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="mr-1">🔗</span>
            Read-only supervision view
            {client.anonymized && (
              <span className="ml-2 px-2 py-0.5 rounded bg-white/20 text-xs">
                Anonymized
              </span>
            )}
          </span>
          <span className="text-xs opacity-80">
            Expires {formatDate(meta.expires_at)}
          </span>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-4 mb-4">
          <h1 className="text-2xl font-bold text-stone-800">
            {client.display_name}
          </h1>
          <div className="text-sm text-stone-500 mt-1">
            Language: {(client.language || 'en').toUpperCase()}
            {client.anonymized && (
              <span className="ml-2 italic">
                · Personal identifiers redacted in shared text
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-2 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-sm text-stone-700">
              <div>
                <h2 className="text-lg font-semibold text-stone-800 mb-2">Summary</h2>
                <ul className="space-y-1">
                  <li>📊 {sessions.length} session(s) on record</li>
                  <li>📝 {diary.length} diary entry(ies)</li>
                  <li>🎯 {inquiries.length} inquiry(ies)</li>
                  <li>💬 {sharedComments.length} shared note(s)</li>
                </ul>
              </div>
              <div className="border-t border-stone-200 pt-3 text-xs text-stone-500">
                <strong>Privacy note:</strong> This view is read-only and excludes private
                therapist comments, raw audio/video files and SOS personal details. All
                accesses are logged in the therapist's audit trail.
              </div>
              {meta && meta.note && (
                <div className="border-t border-stone-200 pt-3 text-xs italic text-stone-600">
                  Therapist's note: "{meta.note}"
                </div>
              )}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-3">
              {sessions.length === 0 && (
                <div className="text-sm text-stone-500 py-6 text-center">No sessions.</div>
              )}
              {sessions.map((s) => (
                <div key={s.id} className="border border-stone-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="text-sm font-medium text-stone-700">
                      Session #{s.id}
                    </div>
                    <div className="text-xs text-stone-500">
                      {formatDate(s.scheduled_at || s.created_at)}
                      {' · '}
                      <span className="capitalize">{s.status || 'unknown'}</span>
                    </div>
                  </div>
                  {s.summary && (
                    <div className="text-sm text-stone-700 whitespace-pre-wrap mb-2">
                      <strong className="text-stone-600 text-xs">Summary:</strong>
                      {'\n'}
                      {s.summary}
                    </div>
                  )}
                  {s.transcript && (
                    <details className="text-sm text-stone-600">
                      <summary className="cursor-pointer text-xs text-indigo-700 hover:underline">
                        Show transcript
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap text-xs text-stone-700 max-h-80 overflow-y-auto bg-stone-50 p-2 rounded">
                        {s.transcript}
                      </div>
                    </details>
                  )}
                  {!s.summary && !s.transcript && (
                    <div className="text-xs text-stone-400 italic">
                      No summary or transcript available.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'diary' && (
            <div className="space-y-3">
              {diary.length === 0 && (
                <div className="text-sm text-stone-500 py-6 text-center">No diary entries.</div>
              )}
              {diary.map((d) => (
                <div key={d.id} className="border border-stone-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-xs capitalize">
                      {d.entry_type}
                    </span>
                    <span className="text-xs text-stone-500">{formatDate(d.created_at)}</span>
                  </div>
                  {d.content && (
                    <div className="text-sm text-stone-700 whitespace-pre-wrap mb-2">
                      {d.content}
                    </div>
                  )}
                  {d.transcript && (
                    <div className="text-sm text-stone-600 whitespace-pre-wrap mt-1">
                      <strong className="text-stone-500 text-xs">Transcript:</strong>
                      {'\n'}
                      {d.transcript}
                    </div>
                  )}
                  {!d.content && !d.transcript && (
                    <div className="text-xs text-stone-400 italic">
                      Audio/video entries are not surfaced in supervision view.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'inquiries' && (
            <div className="space-y-3">
              {inquiries.length === 0 && (
                <div className="text-sm text-stone-500 py-6 text-center">No inquiries.</div>
              )}
              {inquiries.map((i) => (
                <div key={i.id} className="border border-stone-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="font-medium text-stone-800 text-sm">
                      {i.title || '(untitled)'}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        i.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : i.status === 'paused'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {i.status}
                    </span>
                  </div>
                  {i.description && (
                    <div className="text-sm text-stone-700 whitespace-pre-wrap">
                      {i.description}
                    </div>
                  )}
                  <div className="text-xs text-stone-400 mt-2">
                    Opened {formatDate(i.opened_at || i.created_at)}
                    {i.closed_at && <> · Closed {formatDate(i.closed_at)}</>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-3">
              {sharedComments.length === 0 && (
                <div className="text-sm text-stone-500 py-6 text-center">No shared notes.</div>
              )}
              {sharedComments.map((c) => (
                <div key={c.id} className="border border-stone-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-xs text-stone-500 capitalize">{c.author_role}</span>
                    <span className="text-xs text-stone-500">{formatDate(c.created_at)}</span>
                  </div>
                  {c.content ? (
                    <div className="text-sm text-stone-700 whitespace-pre-wrap">{c.content}</div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">(no content)</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-xs text-stone-400 mt-6">
          Created {formatDate(meta.created_at)} ·
          {' '}Read-only supervision link · Cannot be modified
        </div>
      </main>
    </div>
  );
}

export default SupervisionView;
