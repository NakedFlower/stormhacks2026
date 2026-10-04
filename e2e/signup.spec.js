// L4 sign-up and invite flows (S1-S8). Runs against BASE_URL and writes to the real
// database. Every club name starts with "E2E " so test data is easy to find and delete.
//
// Each person is a fresh browser context that signs up with a throwaway e2e-*@fitkin.test email.
// Cases run in order and share state: later cases reuse S1's invite code and contexts.
import { test, expect } from '@playwright/test';
import { BASE_URL, PHONE } from '../playwright.config.js';

test.describe.configure({ mode: 'serial' });

const CREW = 'E2E Test Crew';
const FLOOR = 'E2E Floor 4';

const people = {};
let inviteCode = '';

const PASSWORD = 'fitkin-e2e-pass';
const RUN = Date.now().toString(36);
const emailFor = (name) => `e2e-${name.toLowerCase()}-${RUN}@fitkin.test`;

// A new person = a fresh browser context that creates an account, landing on the join screen.
async function newPerson(browser, name) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(emailFor(name));
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).last().click();
  await expect(page.getByLabel('Invite code')).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveValue(name); // sign-up name, not the email
  people[name] = { context, page };
  return page;
}

async function startClub(page, name, club) {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('tab', { name: 'Start a club' }).click();
  await page.getByLabel('Club name').fill(club);
  await page.getByRole('button', { name: 'Start club' }).click();
  // New clubs open a "Club created!" card with the invite code first.
  await expect(page.locator('.code-display')).toHaveText(/^[A-Z0-9]{6}$/);
  await page.getByRole('button', { name: /Start our club/ }).click();
}

async function joinClub(page, name, code) {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('tab', { name: 'Join a club' }).click();
  await page.getByLabel('Invite code').pressSequentially(code);
  await page.getByRole('button', { name: 'Join club' }).click();
}

async function expectHome(page, club) {
  await expect(page.getByRole('link', { name: club, exact: true })).toBeVisible();
  await expect(page.getByText("Today's glow")).toBeVisible();
  await expect(page.getByLabel('Invite code')).toHaveCount(0);
}

const myClubs = (page) => page.locator('.card', { has: page.getByText('My clubs', { exact: true }) });

async function openClubs(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Clubs' }).click();
  await expect(myClubs(page)).toBeVisible();
}

test.afterAll(async () => {
  await Promise.all(Object.values(people).map((p) => p.context.close()));
});

test('S1 Start a club', async ({ browser }) => {
  const ana = await newPerson(browser, 'Ana');
  await startClub(ana, 'Ana', CREW);
  await expectHome(ana, CREW);

  await openClubs(ana);
  const code = myClubs(ana).locator('span', { hasText: 'Invite code' }).locator('strong');
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
  inviteCode = (await code.textContent()).trim();
  test.info().annotations.push({ type: 'invite code', description: inviteCode });
});

test('S2 Blank name', async ({ browser }) => {
  const page = await newPerson(browser, 'Blank');
  await page.getByLabel('Your name').fill('');
  await page.getByRole('tab', { name: 'Start a club' }).click();
  await page.getByRole('button', { name: 'Start club' }).click();
  await expect(page.getByText('Add your name so friends know who you are.')).toBeVisible();
  await expect(page.getByLabel('Your name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start club' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('S7 Stays signed in', async () => {
  const { page: ana } = people.Ana;
  await ana.goto('/');
  await ana.reload();
  await expectHome(ana, CREW);
});

test('S3 Join with code', async ({ browser }) => {
  expect(inviteCode, 'needs the invite code from S1').toMatch(/^[A-Z0-9]{6}$/);
  const ben = await newPerson(browser, 'Ben');
  await joinClub(ben, 'Ben', inviteCode);
  await expectHome(ben, CREW);
  await expect(ben.getByRole('button', { name: 'Cheer Ana' })).toBeVisible();
  // Ana sees Ben by his real name, not his email.
  await expect(people.Ana.page.getByRole('button', { name: 'Cheer Ben' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Cheer Ben' })).toBeVisible();
});

test('S4 Lowercase code', async ({ browser }) => {
  const cy = await newPerson(browser, 'Cy');
  await joinClub(cy, 'Cy', inviteCode.toLowerCase());
  await expectHome(cy, CREW);
  await expect(cy.getByRole('button', { name: 'Cheer Cy' })).toBeVisible();
});

test('S5 Wrong code', async ({ browser }) => {
  const dee = await newPerson(browser, 'Dee');
  await joinClub(dee, 'Dee', 'ZZZZZZ');
  await expect(dee.getByText('No club has that invite code.')).toBeVisible();
  await expect(dee.getByRole('button', { name: 'Join club' })).toBeVisible();
  await expect(dee.getByLabel('Your name')).toBeVisible();
});

test('S6 Join twice', async () => {
  const { page: ben } = people.Ben;
  await ben.goto('/join');
  await joinClub(ben, 'Ben', inviteCode);
  await expectHome(ben, CREW);
  await expect(ben.getByRole('button', { name: 'Cheer Ben' })).toHaveCount(1);
  await expect(ben.getByRole('button', { name: 'Cheer Ana' })).toBeVisible();
});

test('S8 Second club', async () => {
  const { page: ana } = people.Ana;
  await ana.goto('/');
  await openClubs(ana);
  await ana.getByRole('link', { name: 'Join or start another club' }).click();
  await startClub(ana, 'Ana', FLOOR);
  await expectHome(ana, FLOOR);

  await openClubs(ana);
  const clubs = myClubs(ana);
  await expect(clubs.getByText(CREW, { exact: true })).toBeVisible();
  await expect(clubs.getByText(FLOOR, { exact: true })).toBeVisible();

  await clubs.locator('.between', { hasText: CREW }).getByRole('button', { name: 'Switch' }).click();
  await expect(clubs.locator('.between', { hasText: CREW }).getByText('Current')).toBeVisible();
  await ana.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
  await expectHome(ana, CREW);
});

// ---------- Accounts (A1-A5): Ko's email sign-up and sign-in ----------

async function authScreen(browser) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  const page = await context.newPage();
  people[`auth-${Object.keys(people).length}`] = { context, page };
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  return page;
}

test('A1 Sign-up needs a name', async ({ browser }) => {
  const page = await authScreen(browser);
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill(emailFor('noname'));
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).last().click();
  await expect(page.getByText('Add your name so friends know who you are.')).toBeVisible();
});

test('A2 Short password is refused', async ({ browser }) => {
  const page = await authScreen(browser);
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Eve');
  await page.getByLabel('Email').fill(emailFor('eve'));
  await page.getByLabel('Password').fill('123');
  await page.getByRole('button', { name: 'Create account' }).last().click();
  await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible();
});

test('A3 Same email twice', async ({ browser }) => {
  const page = await authScreen(browser);
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Ana again');
  await page.getByLabel('Email').fill(emailFor('Ana'));
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).last().click();
  await expect(page.getByText('An account with this email already exists. Please sign in.')).toBeVisible();
});

test('A4 Wrong password', async ({ browser }) => {
  const page = await authScreen(browser);
  await page.getByLabel('Email').fill(emailFor('Ana'));
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
});

test('A5 Sign out, then sign in on a new device gets your clubs back', async ({ browser }) => {
  const { page: ana } = people.Ana;
  await ana.goto('/');
  await openClubs(ana);
  await ana.getByRole('button', { name: 'Sign out' }).click();
  await expect(ana.getByRole('tab', { name: 'Sign in' })).toBeVisible();

  const phone = await authScreen(browser); // a different browser = a new device
  await phone.getByLabel('Email').fill(emailFor('Ana'));
  await phone.getByLabel('Password').fill(PASSWORD);
  await phone.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(phone.getByText("Today's glow")).toBeVisible();
  await openClubs(phone);
  await expect(myClubs(phone).getByText(CREW, { exact: true })).toBeVisible();
  await expect(myClubs(phone).getByText(FLOOR, { exact: true })).toBeVisible();
});
