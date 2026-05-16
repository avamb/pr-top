import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * T-26: AI source disclaimer
 *
 * Renders a small, neutral disclaimer block whenever an AI-generated artifact
 * (session summary / exercise card) was produced with the help of the
 * therapist's personal knowledge base (T-09 RAG hits). The block contains:
 *
 *   1. A one-line "Generated with AI based on: <KB titles>" header.
 *   2. An expandable "Sources used" list with the underlying KB items.
 *
 * The component is opt-in: it only renders if at least one of these is true:
 *   - `aiGenerated` is true (AI-authored, with or without KB sources), OR
 *   - `sources` is a non-empty array (KB-grounded AI generation).
 *
 * Visibility is gated by the therapist's `show_ai_sources` profile setting:
 * pass `enabled={false}` to suppress rendering entirely. The disclaimer data
 * is always persisted server-side so flipping the toggle back on restores the
 * block without re-running summarization.
 *
 * Props:
 *   - sources: Array<{ kb_id, title, chunk_id, similarity, chunk_index }>
 *   - aiGenerated: boolean — render the AI-generated badge even if `sources` is empty.
 *   - variant: 'summary' | 'exercise' — drives the headline copy.
 *   - testIdPrefix: prefix for data-testid attributes (default: "ai-disclaimer")
 *   - enabled: boolean — when false, returns null (used for the Settings toggle).
 */
function AiSourceDisclaimer({
  sources = [],
  aiGenerated = false,
  variant = 'summary',
  testIdPrefix = 'ai-disclaimer',
  enabled = true
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const list = Array.isArray(sources) ? sources : [];
  const hasSources = list.length > 0;

  // Render nothing when the toggle is off OR there is nothing AI-related to disclose.
  if (!enabled) return null;
  if (!aiGenerated && !hasSources) return null;

  // Build a comma-separated source-titles line for the header so the therapist
  // sees attribution at a glance without expanding the list. Titles are
  // truncated to 60 chars to keep the header on one line.
  const headerTitles = list
    .map(s => (s && s.title ? String(s.title) : ''))
    .filter(Boolean)
    .map(title => (title.length > 60 ? title.slice(0, 60) + '…' : title))
    .join(', ');

  const headlineCopy =
    variant === 'exercise'
      ? t('ai.disclaimer.exerciseGenerated', 'This exercise was generated with AI assistance.')
      : t('ai.disclaimer.summaryGenerated', 'This summary was generated with AI assistance.');

  return (
    <div
      className="mt-3 p-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 text-xs"
      data-testid={`${testIdPrefix}-block`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none" aria-hidden="true">🤖</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium" data-testid={`${testIdPrefix}-headline`}>
            {headlineCopy}
            {hasSources && headerTitles && (
              <span className="font-normal text-violet-700">
                {' '}
                {t('ai.disclaimer.basedOn', 'based on')}: {headerTitles}
              </span>
            )}
          </p>
          <p className="text-[11px] text-violet-700 italic mt-1">
            {t('ai.disclaimer.transparencyNote', 'Sources are listed for transparency. You can hide this block in Settings.')}
          </p>

          {hasSources ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="mt-2 text-xs font-medium text-violet-700 hover:text-violet-900 underline"
                aria-expanded={expanded}
                data-testid={`${testIdPrefix}-toggle`}
              >
                {expanded
                  ? t('ai.disclaimer.hideSources', 'Hide sources')
                  : t('ai.disclaimer.showSources', 'Show sources') + ` (${list.length})`}
              </button>

              {expanded && (
                <ul
                  className="mt-2 space-y-1 pl-1"
                  data-testid={`${testIdPrefix}-list`}
                >
                  {list.map((src, idx) => {
                    const key = `${src.kb_id || 'kb'}-${src.chunk_id || idx}`;
                    const title = src.title || `KB #${src.kb_id || '?'}`;
                    const similarityPct =
                      typeof src.similarity === 'number'
                        ? Math.round(src.similarity * 100)
                        : null;
                    return (
                      <li
                        key={key}
                        className="text-[11px] text-violet-900 flex items-baseline gap-1"
                        data-testid={`${testIdPrefix}-source-${src.kb_id || idx}`}
                      >
                        <span className="font-semibold">{idx + 1}.</span>
                        <span className="font-medium">{title}</span>
                        <span className="text-violet-600">
                          ({t('ai.disclaimer.fromLibrary', 'from your library')})
                        </span>
                        {similarityPct !== null && (
                          <span className="text-violet-500">
                            · {similarityPct}% {t('ai.disclaimer.similarity', 'match')}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p
              className="mt-2 text-[11px] text-violet-700"
              data-testid={`${testIdPrefix}-empty`}
            >
              {t('ai.disclaimer.noSources', 'No sources from your library were used for this generation.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiSourceDisclaimer;
