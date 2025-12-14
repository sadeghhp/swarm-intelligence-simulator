import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages deployment (must match GitHub repo name)
  base: '/swarm-intelligence-simulator/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'ES2022',
    sourcemap: true
  }
});

