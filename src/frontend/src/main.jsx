import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

// Self-hosted fonts (F6): replaces the render-blocking Google Fonts <link>.
// @fontsource CSS ships with `font-display: swap` by default.
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './i18n/index.js';
import App from './App';
import './styles/index.css';

// F9 — Hydration correctness:
// Some public routes are prerendered at build time (see scripts/prerender.mjs)
// so #root already contains server-rendered markup on first paint. In that
// case we must hydrateRoot(...) to reuse the existing DOM instead of
// createRoot(...).render(...), which would throw away the prerendered content
// (visible as a flash) and can also produce duplicated <h1>/hero markup while
// React reconciles. For non-prerendered (empty shell) routes we fall back to
// createRoot so the SPA continues to boot normally.
const rootEl = document.getElementById('root');
const appTree = (
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);

// hydrateRoot only when the prerendered markup was produced for the current
// URL. The prerender pipeline stamps <div id="root" data-prerendered-path="…">
// so that SPA-fallback routes (e.g. /dashboard served from the Landing shell)
// don't attempt to hydrate mismatched markup — they fall back to createRoot,
// which replaces the stale prerender before the SPA boots the real route.
const prerenderedPath = rootEl && rootEl.getAttribute('data-prerendered-path');
const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
const normalize = (p) => (p && p.length > 1 ? p.replace(/\/+$/, '') : (p || '/'));
const shouldHydrate =
  !!rootEl &&
  !!prerenderedPath &&
  rootEl.hasChildNodes() &&
  normalize(prerenderedPath) === normalize(currentPath);

if (shouldHydrate) {
  hydrateRoot(rootEl, appTree);
} else {
  // Clear any stale prerendered markup before mounting so the user never sees
  // a flash of the wrong route's content.
  if (rootEl && rootEl.hasChildNodes()) {
    rootEl.innerHTML = '';
  }
  createRoot(rootEl).render(appTree);
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates periodically
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // New version available - dispatch event for UI to handle
              window.dispatchEvent(new CustomEvent('sw-updated'));
            }
          });
        }
      });
    }).catch(() => {
      // SW registration failed - non-critical, app works without it
    });
  });
}
