import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages deployment
  base: '/swarm-intelligence-1/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'ES2022',
    sourcemap: true
  }
});

