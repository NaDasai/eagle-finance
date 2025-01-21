/// <reference types="vitest" />

import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true, // Enables global APIs like `describe`, `it`, `expect`.
    environment: 'node', // Set to 'node' for backend testing.
    include: ['tests/**/*.test.ts'], // Define where your test files are located.
    testTimeout: 60_000, // Set a timeout for tests.
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8', // Enable coverage reports.
      enabled: false,
      include: ['assembly/**/*.ts'],
      reporter: ['text', 'html', 'json'], // Output types for coverage reports.
    },
    logHeapUsage: true,
  },
});
