import { defineConfig } from 'vitest/config';
import path from 'path';

/** Runs scripts/replay.run.ts against live market data. See docs/SIGNAL_ENGINE.md. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/replay.run.ts'],
    silent: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
