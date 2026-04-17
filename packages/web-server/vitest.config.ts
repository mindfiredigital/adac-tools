import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/types.ts',
        '**/scripts/**',
        '**/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 65, // Error handler middleware patterns are complex to fully test
        branches: 70,
        statements: 80,
      },
    },
  },
});
