import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
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
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
