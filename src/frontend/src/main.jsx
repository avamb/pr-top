import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/index.js';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

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
