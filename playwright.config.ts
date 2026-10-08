import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'npx vite e2e/demo --port 5199 --strictPort', port: 5199, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5199' },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
