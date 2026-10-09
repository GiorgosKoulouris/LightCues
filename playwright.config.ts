import { defineConfig } from '@playwright/test';

// End-to-end tests: the built app in `out/`, launched as Electron. Not part
// of `npm run check`: they need a display and the host's native modules.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.test.ts',
  // One app at a time: each launch starts its own engine process.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? 'github' : 'list',
});
