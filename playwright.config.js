// End-to-end tests. They run against a deployed app and write to its real database,
// so they are NOT part of CI. Run by hand: npm run test:e2e
//   BASE_URL=https://my-preview.vercel.app npm run test:e2e
//   CHROMIUM_PATH=/path/to/chrome npm run test:e2e   (skip `npx playwright install`)
import { defineConfig } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL || 'https://stormhacks2026.vercel.app';
export const PHONE = { width: 390, height: 844 };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    viewport: PHONE,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Optional: use an already-installed Chromium instead of Playwright's download.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
