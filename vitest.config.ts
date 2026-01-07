import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/lib/ultaura/__tests__/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/lib/ultaura/__tests__/setup.ts'],
  },
});
