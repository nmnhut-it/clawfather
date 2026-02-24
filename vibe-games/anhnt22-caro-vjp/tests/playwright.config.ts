import { defineConfig, devices } from '@playwright/test';

const PORT = 3737;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx serve .. --listen ${PORT} --single --no-clipboard`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
