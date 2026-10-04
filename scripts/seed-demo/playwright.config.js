// Seeds the demo clubs (Sunrise Swim Club, Badminton Bunch, Res Hall Hikers) on BASE_URL.
// Writes to the real database and every run creates NEW clubs, so run it once, by hand:
//   npm run seed:demo
// Invite codes are printed and appended to seed-demo-codes.txt as soon as each club exists.
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.js';

export default defineConfig({
  ...base,
  testDir: '.',
  outputDir: '../../test-results/seed-demo',
  timeout: 90_000,
  reporter: 'list',
});
