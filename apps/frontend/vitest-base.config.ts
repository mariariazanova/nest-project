import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    pool: 'vmThreads',
    coverage: {
      reportsDirectory: 'coverage/apps/frontend',
    },
  },
});
