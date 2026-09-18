import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// src/core is pure TypeScript with zero React Native imports, so it runs
// directly in node under vitest. Nothing outside src/core is tested here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@db': resolve(__dirname, 'src/db'),
      '@': resolve(__dirname, 'src'),
    },
  },
});
