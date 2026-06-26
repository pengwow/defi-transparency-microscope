import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      // Exclude pure data / type-only files from coverage.
      exclude: [
        'src/server.ts', // bootstrapped only in production; covered by e2e
        'src/types.ts', // type-only
        'src/chain/types.ts', // type-only
        'src/experiments/types.ts', // type-only
        'src/logger.ts', // singleton; no logic to test
        'src/config.ts', // env parsing; covered indirectly
      ],
      // Global floor. Per-glob targets (chain ≥80%, experiments ≥90%,
      // routes ≥70%) are asserted by `pnpm coverage:check` after the
      // run, since vitest's threshold keys are not glob-aware.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
