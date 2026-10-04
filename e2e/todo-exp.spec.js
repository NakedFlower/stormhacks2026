// To-dos add EXP (W1-W4). Every to-do adds 5 EXP to the club, so members' to-dos
// add up to new levels, and levels unlock the shop. Runs against BASE_URL and writes
// to the real database; every club name starts with "E2E ".
// W2 needs real shared data (Firebase): it fails in demo mode, where each browser is its own world.
import { test, expect } from '@playwright/test';
import { BASE_URL, PHONE } from '../playwright.config.js';

test.describe.configure({ mode: 'serial' });

const SOLO = 'E2E To-dos Solo';
const TEAM = 'E2E To-dos Team';
const FOUR = ['Drink 2L water', 'Stretch 5 minutes', '10 minutes outside', 'Took the stairs'];
const ALL = [...FOUR, 'Slept 7+ hours', 'Ate a veggie-packed meal', '5 minutes of deep breathing', 'Phone-free hour before bed'];

const contexts = [];
const pages = {};
let teamCode = '';
const RUN = Date.now().toString(36);

const nav = (page) => page.getByRole('navigation', { name: 'Main' });
const levelPill = (page) => page.locator('.pill-link').first();
const expChip = (page) => page.locator('.chip', { hasText: 'EXP' }).first();

async function person(browser, name) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto('/');
  // Sign up first (throwaway e2e account), which lands on the join screen.
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(`e2e-todo-${name.toLowerCase()}-${RUN}@fitkin.test`);
  await page.getByLabel('Password').fill('fitkin-e2e-pass');
  await page.getByRole('button', { name: 'Create account' }).last().click();
  await expect(page.getByLabel('Invite code')).toBeVisible();
  pages[name] = page;
  return page;
}

async function startClub(page, club) {
  await page.getByRole('tab', { name: 'Start a club' }).click();
  await page.getByLabel('Club name').fill(club);
  await page.getByRole('button', { name: 'Start club' }).click();
  await page.getByRole('button', { name: /Start our club/ }).click(); // "Club created!" card
  await expect(page.getByRole('link', { name: club, exact: true })).toBeVisible();
}

async function tick(page, tasks) {
  for (const task of tasks) {
    const box = page.getByRole('checkbox', { name: task });
    await box.click(); // controlled checkbox: flips once the write comes back
    await expect(box).toBeChecked();
  }
}

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()));
});

test('W1 Every to-do shows +5 EXP and four of them level a solo club', async ({ browser }) => {
  const ana = await person(browser, 'Ana');
  await startClub(ana, SOLO);
  for (const task of ALL) {
    await expect(ana.locator('label.todo', { hasText: task })).toContainText('+5 EXP');
  }
  await expect(levelPill(ana)).toContainText('Level 1');
  await tick(ana, FOUR);
  await expect(expChip(ana)).toContainText('20 EXP');
  await expect(levelPill(ana)).toContainText('Level 2');
});

test('W2 Two members\' to-dos add up to the next level on both phones', async ({ browser }) => {
  const ben = await person(browser, 'Ben');
  await startClub(ben, TEAM);
  await nav(ben).getByRole('link', { name: 'Clubs' }).click();
  const code = ben.locator('.card', { has: ben.getByText('My clubs', { exact: true }) })
    .locator('span', { hasText: 'Invite code' }).locator('strong');
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
  teamCode = (await code.textContent()).trim();
  await nav(ben).getByRole('link', { name: 'Home' }).click();

  const cy = await person(browser, 'Cy');
  await cy.getByRole('tab', { name: 'Join a club' }).click();
  await cy.getByLabel('Invite code').pressSequentially(teamCode);
  await cy.getByRole('button', { name: 'Join club' }).click();
  await expect(cy.getByRole('link', { name: TEAM, exact: true })).toBeVisible();

  // 2 members need 40 EXP for Lv 2. Ben's 20 alone isn't enough.
  await tick(ben, FOUR);
  await expect(expChip(cy)).toContainText('20 EXP');
  await expect(levelPill(cy)).toContainText('Level 1');
  await tick(cy, FOUR);
  for (const page of [ben, cy]) {
    await expect(expChip(page)).toContainText('40 EXP');
    await expect(levelPill(page)).toContainText('Level 2');
  }
});

test('W3 The level from to-dos unlocks the Club cap', async () => {
  const ana = pages.Ana;
  // Lv 2 from W1, 15 coins. A 10-minute walk adds 10 coins and finishes the group goal (+20).
  await ana.getByRole('button', { name: 'Log an activity' }).click();
  const sheet = ana.getByRole('dialog', { name: 'Log an activity' });
  await sheet.getByRole('button', { name: 'Walk', exact: true }).click();
  await sheet.getByRole('button', { name: '10', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await nav(ana).getByRole('link', { name: 'Shop' }).click();
  const cap = ana.locator('.card', { has: ana.locator('strong', { hasText: /^Club cap$/ }) });
  await cap.getByRole('button', { name: 'Buy' }).click();
  await expect(cap.getByText('Owned')).toBeVisible();
  await expect(ana.getByText('Wearing', { exact: true }).locator('..')).toContainText('Club cap');
});

test('W4 Shop stays locked below the level', async ({ browser }) => {
  const dee = await person(browser, 'Dee');
  await startClub(dee, 'E2E To-dos Locked');
  await tick(dee, ['Drink 2L water']); // 5 EXP: still Lv 1
  await nav(dee).getByRole('link', { name: 'Shop' }).click();
  const cap = dee.locator('.card', { has: dee.locator('strong', { hasText: /^Club cap$/ }) });
  await expect(cap.getByRole('button', { name: 'Unlocks at Lv 2' })).toBeDisabled();
});
