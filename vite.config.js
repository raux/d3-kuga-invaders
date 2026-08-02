import { defineConfig } from 'vite';

export default defineConfig({
  base: '/d3-kuga-invaders/',
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    coverage: {
      include: ['src/game/**/*.js'],
    },
  },
});
