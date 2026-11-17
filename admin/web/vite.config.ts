import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Веб-админка: отдаётся сервером админки под /admin/.
export default defineConfig({
  root: resolve(import.meta.dirname),
  base: '/admin/',
  plugins: [react()],
  build: { outDir: resolve(import.meta.dirname, 'dist'), emptyOutDir: true },
  server: { proxy: { '/admin/api': 'http://localhost:8787' } },
});
