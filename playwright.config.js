// End-to-end tests. They run against a deployed app and write to its real database,
// so they are NOT part of CI. Run by hand: npm run test:e2e
//   BASE_URL=https://my-preview.vercel.app npm run test:e2e
//   CHROMIUM_PATH=/path/to/chrome npm run test:e2e   (skip `npx playwright install`)
import { defineConfig } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL || 'https://stormhacks2026.vercel.app';

// Behind an HTTPS proxy (Claude Code cloud sessions, some office networks), Chromium
// does not pick up HTTPS_PROXY by itself, so Firebase sign-in fails with
// "Network error". Route the browser through the same proxy; keep localhost direct
// so a local `vite preview` still works. TLS stays verified: the proxy's CA must be
// trusted by the system/NSS store, as it is in Claude Code sessions.
// On a laptop with no proxy, HTTPS_PROXY is unset and nothing changes.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxy = PROXY ? { server: PROXY, bypass: 'localhost,127.0.0.1,::1' } : undefined;
export const PHONE = { width: 390, height: 844 };

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js', // trusts the HTTPS proxy CA in cloud sessions; no-op elsewhere
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
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      ...(proxy ? { proxy } : {}),
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
