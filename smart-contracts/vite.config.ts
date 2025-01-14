/// <reference types="vitest" />

import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true, // Enables global APIs like `describe`, `it`, `expect`.
    environment: 'node', // Set to 'node' for backend testing.
    include: ['tests/**/*.test.ts'], // Define where your test files are located.
    coverage: {
      provider: 'v8', // Enable coverage reports.
      reporter: ['text', 'html', 'json'], // Output types for coverage reports.
    },
  },
});
