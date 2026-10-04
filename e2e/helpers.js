// Shared steps for the e2e specs. Every person is a fresh browser context that signs
// up with a throwaway e2e-*@fitkin.test account. Every club name starts with "E2E ".
import { expect } from '@playwright/test';
import { BASE_URL, PHONE } from '../playwright.config.js';

export const PASSWORD = 'fitkin-e2e-pass';
export const RUN = Date.now().toString(36);

// Red errors on any page fail the run (K7). Missing fonts and similar resource loads are ignored.
export const consoleErrors = [];

export async function person(browser, name, contexts) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(`${name}: ${m.text()}`);
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(`e2e-${name.toLowerCase()}-${RUN}@fitkin.test`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).last().click();
  await expect(page.getByLabel('Invite code')).toBeVisible();
  // The join screen must greet you by your sign-up name, never your email.
  await expect(page.getByLabel('Your name')).toHaveValue(name);
  return page;
}

export const nav = (page) => page.getByRole('navigation', { name: 'Main' });

export async function startClub(page, club) {
  await page.getByRole('tab', { name: 'Start a club' }).click();
  await page.getByLabel('Club name').fill(club);
  await page.getByRole('button', { name: 'Start club' }).click();
  const code = (await page.locator('.code-display').textContent()).trim();
  await page.getByRole('button', { name: /Start our club/ }).click();
  await expect(page.getByRole('link', { name: club, exact: true })).toBeVisible();
  return code;
}

export async function joinClub(page, code, club) {
  await page.getByRole('tab', { name: 'Join a club' }).click();
  await page.getByLabel('Invite code').pressSequentially(code);
  await page.getByRole('button', { name: 'Join club' }).click();
  await expect(page.getByRole('link', { name: club, exact: true })).toBeVisible();
}

export async function logActivity(page, activity, minutes, intensity) {
  await page.getByRole('button', { name: 'Log an activity' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log an activity' });
  await sheet.getByRole('button', { name: activity, exact: true }).click();
  await sheet.getByRole('button', { name: String(minutes), exact: true }).click();
  if (intensity) await sheet.getByRole('button', { name: intensity, exact: true }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
}

export async function tick(page, task) {
  const box = page.getByRole('checkbox', { name: task });
  await box.click(); // controlled checkbox: flips once the write comes back
  await expect(box).toBeChecked();
}

export async function untick(page, task) {
  const box = page.getByRole('checkbox', { name: task });
  await box.click();
  await expect(box).not.toBeChecked();
}

export const levelPill = (page) => page.locator('.pill-link').first();
export const expChip = (page) => page.locator('.chip', { hasText: 'EXP' }).first();
export const coinChip = (page) => page.locator('.chip.coin').first();
export const toastText = (page) => page.locator('.toast');
export async function coins(page) {
  return Number((await coinChip(page).textContent()).replace(/\D/g, ''));
}
