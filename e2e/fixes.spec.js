// Akam's fix list (F1-F5), levels (LV1-LV5), cheers (C1) and a no-red-errors check (X1).
// Two-person cases need real shared data (Firebase). In demo mode each browser is its own
// world, so run with: npm run test:e2e -- --grep-invert "@two"
import { test, expect } from '@playwright/test';
import {
  person, startClub, joinClub, logActivity, tick, untick, nav,
  levelPill, expChip, toastText, coins, consoleErrors,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const contexts = [];
const pages = {};
let teamCode = '';
const TEAM = 'E2E Fixes Team';

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()));
});

test('F1 Solo club invites friends instead of "tap a friend to cheer"', async ({ browser }) => {
  const solo = await person(browser, 'Solo', contexts);
  pages.Solo = solo;
  await startClub(solo, 'E2E Fixes Solo');
  await expect(solo.getByText('Invite friends to cheer them on')).toBeVisible();
  await expect(solo.getByText('tap a friend to cheer')).toHaveCount(0);
});

test('F3 Untick a to-do gives its coins and EXP back', async () => {
  const solo = pages.Solo;
  const before = await coins(solo);
  await tick(solo, 'Drink 2L water');
  await expect.poll(() => coins(solo)).toBe(before + 10);
  await expect(expChip(solo)).toContainText('5 EXP');
  await untick(solo, 'Drink 2L water');
  await expect.poll(() => coins(solo)).toBe(before);
  await expect(expChip(solo)).toContainText('0 EXP');
  await tick(solo, 'Drink 2L water'); // re-tick pays once, not twice
  await expect.poll(() => coins(solo)).toBe(before + 10);
});

test('F4 Unticking gives back exactly what that tick paid', async () => {
  const solo = pages.Solo;
  for (const t of ['Stretch 5 minutes', '10 minutes outside']) await tick(solo, t);
  const before = await coins(solo);
  await tick(solo, 'Took the stairs');
  const after = await coins(solo); // stairs paid 10, or 0 if past the daily coin cap
  await untick(solo, 'Took the stairs');
  await expect.poll(() => coins(solo)).toBe(before);
  expect(after).toBeGreaterThanOrEqual(before);
});

test('F5 The workout to-do stays ticked and points to the + button', async () => {
  const solo = pages.Solo;
  await logActivity(solo, 'Walk', 10);
  const box = solo.getByRole('checkbox', { name: 'Move for 10 minutes' });
  await expect(box).toBeChecked();
  await box.click();
  await expect(toastText(solo)).toContainText('Logged today');
  await expect(box).toBeChecked();
});

test('LV5 Daily cap holds and says so', async () => {
  // To-do EXP sits outside the daily cap (#7), so the club total is not a fixed number.
  // What matters: once the cap is hit, another workout adds no EXP and says so.
  const solo = pages.Solo;
  const exp = async () => Number((await expChip(solo).textContent()).replace(/\D/g, ''));
  const before = await exp();
  await logActivity(solo, 'Run', 60, 'Vigorous');
  const first = toastText(solo).filter({ hasText: /\+\d+ EXP/ }).first();
  const paid = Number((await first.textContent()).match(/\+(\d+) EXP/)[1]);
  const atCap = before + paid;
  await expect.poll(exp).toBe(atCap);
  await logActivity(solo, 'Run', 60, 'Vigorous');
  await expect(toastText(solo).filter({ hasText: '+0 EXP' })).toContainText('cap');
  expect(await exp()).toBe(atCap);
});

test('R1 Opening the app does not announce the current level', async () => {
  const solo = pages.Solo;
  await expect(levelPill(solo)).not.toContainText('Level 1');
  await solo.reload();
  await expect(levelPill(solo)).toBeVisible();
  await solo.waitForTimeout(1500);
  await expect(toastText(solo)).toHaveCount(0);
});

test('LV1 @two The whole club levels up together', async ({ browser }) => {
  const ana = await person(browser, 'Ana', contexts);
  pages.Ana = ana;
  teamCode = await startClub(ana, TEAM);
  const ben = await person(browser, 'Ben', contexts);
  pages.Ben = ben;
  await joinClub(ben, teamCode, TEAM);
  await expect(levelPill(ben)).toContainText('Level 1');
  await logActivity(ana, 'Run', 30, 'Vigorous'); // 60 EXP
  for (const p of [ana, ben]) await expect(levelPill(p)).toContainText('Level 2');
  await expect(toastText(ben)).toContainText('Level 2');
});

test('LV2 @two EXP adds up across members', async () => {
  await tick(pages.Ben, 'Drink 2L water');
  for (const p of [pages.Ana, pages.Ben]) await expect(expChip(p)).toContainText('65 EXP');
});

test('LV3 @two Reaching Lv 2 unlocks the Club cap', async () => {
  const ana = pages.Ana;
  await nav(ana).getByRole('link', { name: 'Shop' }).click();
  const cap = ana.locator('.card', { has: ana.locator('strong', { hasText: /^Club cap$/ }) });
  await expect(cap).not.toContainText('Unlocks at Lv 2');
  await nav(ana).getByRole('link', { name: 'Home' }).click();
});

test('F2 + C1 @two A friend shows up to cheer, and the cheer reaches them', async () => {
  const { Ana: ana, Ben: ben } = pages;
  await expect(ana.getByText('tap a friend to cheer')).toBeVisible();
  await ana.getByRole('button', { name: 'Cheer Ben' }).click();
  await expect(toastText(ana)).toContainText('You cheered Ben');
  await expect(toastText(ben)).toContainText('Ana cheered you on!');
});

test('T1 @two The to-do list shows who in the club did each one', async () => {
  const { Ana: ana, Ben: ben } = pages;
  // Ben ticked "Drink 2L water" in LV2; Ana logged a 30-minute run in LV1.
  await expect(ana.locator('label.todo', { hasText: 'Drink 2L water' })).toContainText('Done by Ben');
  await expect(ben.locator('label.todo', { hasText: 'Drink 2L water' })).toContainText('Done by You');
  await expect(ben.locator('label.todo', { hasText: 'Move for 10 minutes' })).toContainText('Done by Ana');
});

test('LV4 @two A friend joining never lowers the level', async ({ browser }) => {
  const dee = await person(browser, 'Dee', contexts);
  const club = 'E2E Fixes Grow';
  const code = await startClub(dee, club);
  for (const t of ['Drink 2L water', 'Stretch 5 minutes', '10 minutes outside', 'Took the stairs']) await tick(dee, t);
  await expect(levelPill(dee)).toContainText('Level 2');
  const eve = await person(browser, 'Eve', contexts);
  await joinClub(eve, code, club);
  for (const p of [dee, eve]) await expect(levelPill(p)).toContainText('Level 2');
});

test('X1 No red errors in the browser console on any screen', async () => {
  const p = pages.Ana ?? pages.Solo;
  for (const tab of ['Grow', 'Shop', 'Clubs', 'Home']) {
    await nav(p).getByRole('link', { name: tab }).click();
    await p.waitForTimeout(800);
  }
  expect(consoleErrors).toEqual([]);
});
