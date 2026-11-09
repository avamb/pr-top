import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendor/locale splitting (H14). Pages are already code-split with
        // React.lazy in App.jsx; these chunks only exist so that stable code
        // (React, the router, the ~750 KB of translation JSON) keeps its
        // content hash - and stays in the browser cache - when only app code
        // changes between deploys.
        manualChunks(id) {
          // Rollup/Vite ids always use forward slashes, also on Windows.
          if (['react', 'react-dom', 'scheduler'].some((m) => id.includes('/node_modules/' + m + '/'))) return 'vendor-react';
          if (['react-router', 'react-router-dom', '@remix-run'].some((m) => id.includes('/node_modules/' + m + '/'))) return 'vendor-router';
          // One chunk per language: en is the eager fallback, ru/es/uk are
          // loaded on demand by src/i18n/index.js (dynamic import).
          const loc = id.match(/\/src\/i18n\/(en|ru|es|uk)\.json$/);
          if (loc) return 'locale-' + loc[1];
          return undefined;
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3091',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:3091',
        ws: true
      },
      // Umami analytics reverse proxy (prevents AdBlock blocking)
      // In production, configure nginx/Caddy to proxy /umami -> umami:3000
      '/umami': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/umami/, '')
      }
    }
  }
});
