import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': 'http://127.0.0.1:3737',
      '/base.zip': 'http://127.0.0.1:3737',
      '/base.txt': 'http://127.0.0.1:3737',
      '/base.json': 'http://127.0.0.1:3737',
      '^/base-.*\\.txt$': 'http://127.0.0.1:3737',
      '^/base-.*\\.json$': 'http://127.0.0.1:3737',
    },
  },
});
