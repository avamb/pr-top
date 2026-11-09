import React from 'react';
import i18n from '../i18n';
import { isChunkLoadError, reloadOnceForChunkError } from '../utils/chunkReload';

/**
 * Top-level error boundary for the route tree: a render/chunk failure shows a
 * localized message with a Reload button instead of a blank white page.
 * It renders only its children while healthy, so it adds no DOM and cannot
 * affect hydration of prerendered pages.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) reloadOnceForChunkError();
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = (k) => i18n.t(k);
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4" role="alert">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-stone-800 mb-3">{t('errorBoundary.title')}</h1>
          <p className="text-stone-600 mb-6">{t('errorBoundary.message')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            {t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    );
  }
}
