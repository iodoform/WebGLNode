import { defineConfig } from 'vite';

export default defineConfig({
  base: '/WebGLNode/',
  server: {
    port: 3000,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/vite.config.ts'],
    }
  },
  build: {
    target: 'esnext'
  },
  configFile: false,
});

