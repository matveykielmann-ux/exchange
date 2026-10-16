/// <reference types="vitest/config" />
import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/** Local production dual-host (deploy/configure-local-production.sh): HTTPS for localhost + 127.0.0.1. */
function localHttps() {
  if (process.env.LOCAL_HTTPS !== '1') return undefined;
  const keyPath = process.env.LOCAL_TLS_KEY;
  const certPath = process.env.LOCAL_TLS_CERT;
  if (!keyPath || !certPath || !fs.existsSync(keyPath) || !fs.existsSync(certPath)) return undefined;
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    https: localHttps(),
    // The API server (pnpm dev starts both) handles /api; the browser sees one origin.
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT ?? 8787}`, changeOrigin: false } },
  },
  preview: { port: 4173, strictPort: true },
  test: {
    globals: true,
    css: false,
    projects: [
      {
        extends: true,
        test: { name: 'web', environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
      },
      {
        extends: true,
        test: { name: 'server', environment: 'node', include: ['server/**/*.test.ts'] },
      },
    ],
  },
});
