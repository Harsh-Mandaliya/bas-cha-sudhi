import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700, // three.js chunk is lazy-loaded behind the loader
  },
});
