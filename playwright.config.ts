import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: isCI ? 120_000 : 60_000,
  expect: {
    timeout: isCI ? 15_000 : 10_000,
  },
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    headless: isCI ? true : false,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    // Additional timeout for CI navigation
    navigationTimeout: isCI ? 60_000 : 30_000,
    actionTimeout: isCI ? 30_000 : 15_000,
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        browserName: 'chromium',
        // Ensure we use the right channel for extension support
        channel: 'chromium',
      },
    },
  ],
});
