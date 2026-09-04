import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'chrome120',
    minify: 'esbuild',
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: false,
    css: false,
  },
});
