import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:3001',
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
