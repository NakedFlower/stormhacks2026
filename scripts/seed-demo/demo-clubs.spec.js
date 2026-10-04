// Seed three demo clubs, each started by a new person (a fresh browser context).
// Each club's invite code is read right after the club is created, before anything
// else can fail: the person is a throwaway anonymous user and only members can read
// the code, so a club whose code wasn't saved can never be reached again.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { BASE_URL, PHONE } from '../../playwright.config.js';

test.describe.configure({ mode: 'serial' });

const CODES_FILE = process.env.CODES_FILE || 'seed-demo-codes.txt';
const CLUBS = ['Sunrise Swim Club', 'Badminton Bunch', 'Res Hall Hikers'];
const contexts = [];

const nav = (page) => page.getByRole('navigation', { name: 'Main' });

async function saveInviteCode(page, club) {
  await nav(page).getByRole('link', { name: 'Clubs' }).click();
  const code = page.locator('.card', { has: page.getByText('My clubs', { exact: true }) })
    .locator('span', { hasText: 'Invite code' }).locator('strong');
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
  const value = (await code.textContent()).trim();
  fs.appendFileSync(CODES_FILE, `${club}: ${value}\n`);
  console.log(`${club}: ${value}`);
}

async function startClub(browser, name, club) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('tab', { name: 'Start a club' }).click();
  await page.getByLabel('Club name').fill(club);
  await page.getByRole('button', { name: 'Start club' }).click();
  await expect(page.getByRole('link', { name: club, exact: true })).toBeVisible();
  await saveInviteCode(page, club);
  await nav(page).getByRole('link', { name: 'Home' }).click();
  return page;
}

async function logActivity(page, activity, minutes) {
  await page.getByRole('button', { name: 'Log an activity' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log an activity' });
  await sheet.getByRole('button', { name: activity, exact: true }).click();
  await sheet.getByRole('button', { name: String(minutes), exact: true }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  // The "+EXP" toast can be replaced by level-up or group-goal toasts, so check the to-do.
  await expect(page.getByRole('checkbox', { name: 'Move for 10 minutes' })).toBeChecked();
}

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()));
});

test('Mia starts Sunrise Swim Club and swims 30 min', async ({ browser }) => {
  const mia = await startClub(browser, 'Mia', 'Sunrise Swim Club');
  await logActivity(mia, 'Swim', 30);
});

test('Leo starts Badminton Bunch, plays 30 min, ticks 3 to-dos, buys Sunglasses', async ({ browser }) => {
  const leo = await startClub(browser, 'Leo', 'Badminton Bunch');
  await logActivity(leo, 'Sport', 30);
  for (const task of ['Drink 2L water', 'Stretch 5 minutes', '10 minutes outside']) {
    const box = leo.getByRole('checkbox', { name: task });
    // Controlled checkbox: it only flips once the database write comes back, so no .check().
    await box.click();
    await expect(box).toBeChecked();
  }
  await nav(leo).getByRole('link', { name: 'Shop' }).click();
  const card = leo.locator('.card', { has: leo.locator('strong', { hasText: /^Sunglasses$/ }) });
  await card.getByRole('button', { name: 'Buy' }).click();
  await expect(card.getByText('Owned')).toBeVisible();
  await expect(leo.getByText('Wearing', { exact: true }).locator('..')).toContainText('Sunglasses');
});

test('Sam starts Res Hall Hikers, walks 20 min, and sees all three in the showcase', async ({ browser }) => {
  const sam = await startClub(browser, 'Sam', 'Res Hall Hikers');
  await logActivity(sam, 'Walk', 20);
  await nav(sam).getByRole('link', { name: 'Clubs' }).click();
  const showcase = sam.locator('.grid2');
  for (const club of CLUBS) {
    await expect(showcase.getByText(new RegExp(`^${club}( \\(us\\))?$`)).first()).toBeVisible();
  }
  await expect(showcase.locator('.card', { hasText: 'Badminton Bunch' }).first()).toContainText('sunglasses');
});
