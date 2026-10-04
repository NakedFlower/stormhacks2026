// K5 privacy check (AC11), automated: a signed-in person who is NOT in a club tries
// to read and write that club directly, the way a curious hacker would. The published
// Firestore rules must refuse every attempt. Needs the VITE_FIREBASE_* env vars; it
// talks to Firebase straight from Node, no browser.
import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, query, orderBy, limit,
} from 'firebase/firestore';

const env = process.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

test.describe.configure({ mode: 'serial' });
test.skip(!config.apiKey || !config.projectId, 'Needs the VITE_FIREBASE_* env vars');

let app;
let db;
let uid;
let target; // a club this person is not in

const denied = async (promise) => {
  const err = await promise.then(() => null, (e) => e);
  expect(err, 'should have been refused').not.toBeNull();
  expect(err.code).toBe('permission-denied');
};

test.beforeAll(async () => {
  app = initializeApp(config, `privacy-${Date.now()}`);
  const cred = await createUserWithEmailAndPassword(getAuth(app), `e2e-outsider-${Date.now().toString(36)}@fitkin.test`, 'fitkin-e2e-pass');
  uid = cred.user.uid;
  db = getFirestore(app);
  const clubs = await getDocs(query(collection(db, 'groups'), orderBy('lastActiveAt', 'desc'), limit(5)));
  target = clubs.docs[0]?.id;
});

test.afterAll(async () => { if (app) await deleteApp(app); });

test('P1 Showcase is visible to any signed-in person', async () => {
  expect(target, 'needs at least one club in the database').toBeTruthy();
  const g = await getDoc(doc(db, 'groups', target));
  expect(g.exists()).toBe(true);
});

test('P2 A non-member cannot read workouts, members, cheers or the invite code', async () => {
  await denied(getDocs(collection(db, 'groups', target, 'workouts')));
  await denied(getDocs(collection(db, 'groups', target, 'members')));
  await denied(getDocs(collection(db, 'groups', target, 'cheers')));
  await denied(getDoc(doc(db, 'groups', target, 'meta', 'invite')));
});

test('P3 A non-member cannot join without the code or change the club', async () => {
  await denied(setDoc(doc(db, 'groups', target, 'members', uid), { displayName: 'Hacker', joinedAt: Date.now(), inviteCode: 'ZZZZZZ' }));
  await denied(updateDoc(doc(db, 'groups', target), { coins: 999999 }));
});

test('P4 Nobody can list all invite codes or read another person\'s profile', async () => {
  await denied(getDocs(collection(db, 'invites')));
  await denied(getDoc(doc(db, 'users', 'someone-else')));
});
