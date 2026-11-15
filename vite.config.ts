import { defineConfig } from 'vite';

// GitHub Pages serves this project under /lumen-blade/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lumen-blade/' : '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
}));
