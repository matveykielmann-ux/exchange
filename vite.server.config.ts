/** Builds the API server (server/main.ts) and operations CLI (server/cli.ts) into dist-server/ for Node 22. */
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  publicDir: false,
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist-server',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: { main: 'server/main.ts', cli: 'server/cli.ts' },
      output: { format: 'esm', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
