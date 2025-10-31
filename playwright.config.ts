import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: isCI ? 60_000 : 60_000,
  expect: {
    timeout: isCI ? 10_000 : 10_000,
  },
  fullyParallel: true,
  retries: isCI ? 1 : 0,
  workers: isCI ? 4 : undefined,
  reporter: isCI ? 'blob' : [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    headless: isCI ? true : false,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    navigationTimeout: isCI ? 30_000 : 30_000,
    actionTimeout: isCI ? 15_000 : 15_000,
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
      },
    },
  ],
  webServer: undefined,
});
