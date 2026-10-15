/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
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
