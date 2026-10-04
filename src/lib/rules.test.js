// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityExp, applyWorkout, applyWellness, dailyGoal, levelInfo, expToNext,
  freshMember, dayKey, makeInviteCode, DAILY_EXP_CAP,
} from './rules.js';
import { cannotBuy, equipList, priceFor, itemById } from './items.js';

const now = new Date(2026, 9, 3, 18, 0); // Sat Oct 3 2026, local time

test('EXP: minutes x intensity', () => {
  assert.equal(activityExp({ minutes: 30, intensity: 'light' }), 30);
  assert.equal(activityExp({ minutes: 30, intensity: 'moderate' }), 45);
  assert.equal(activityExp({ minutes: 30, intensity: 'vigorous' }), 60);
});

test('EXP: strength takes the higher of sets or minutes, never both', () => {
  assert.equal(activityExp({ minutes: 5, intensity: 'moderate', sets: 10 }), 20);
  assert.equal(activityExp({ minutes: 40, intensity: 'moderate', sets: 3 }), 60);
});

test('daily cap: 60 EXP per member per day', () => {
  const a = applyWorkout({}, { type: 'run', minutes: 25, intensity: 'vigorous' }, now);
  assert.equal(a.exp, 50);
  const b = applyWorkout(a.member, { type: 'run', minutes: 25, intensity: 'vigorous' }, now);
  assert.equal(b.exp, DAILY_EXP_CAP - 50);
  assert.equal(b.capped, true);
  const c = applyWorkout(b.member, { type: 'walk', minutes: 10, intensity: 'light' }, now);
  assert.equal(c.exp, 0);
  assert.equal(c.coins, 10, 'coins still paid when EXP is capped');
});

test('cap resets the next day', () => {
  const a = applyWorkout({}, { type: 'run', minutes: 40, intensity: 'vigorous' }, now);
  const tomorrow = new Date(2026, 9, 4, 9, 0);
  const b = applyWorkout(a.member, { type: 'walk', minutes: 20, intensity: 'light' }, tomorrow);
  assert.equal(b.exp, 20);
  assert.equal(b.member.todayDate, dayKey(tomorrow));
});

test('week minutes reset on Monday', () => {
  const sat = applyWorkout({}, { type: 'walk', minutes: 30, intensity: 'light' }, now);
  const mon = freshMember(sat.member, new Date(2026, 9, 5, 8, 0));
  assert.equal(mon.weekMinutes, 0);
});

test('bad workout input is rejected', () => {
  assert.throws(() => applyWorkout({}, { type: 'walk', minutes: 0, intensity: 'light' }, now));
  assert.throws(() => applyWorkout({}, { type: 'nope', minutes: 10, intensity: 'light' }, now));
  assert.throws(() => applyWorkout({}, { type: 'walk', minutes: 999, intensity: 'light' }, now));
});

test('wellness: coins for the first 3 per day, no repeats', () => {
  let m = {};
  let total = 0;
  for (const id of ['water', 'stretch', 'outside', 'sleep']) {
    const r = applyWellness(m, id, now);
    total += r.coins;
    m = r.member;
  }
  assert.equal(total, 15);
  assert.throws(() => applyWellness(m, 'water', now));
});

test('levels scale with group size', () => {
  assert.equal(expToNext(1, 4), 80);
  assert.equal(levelInfo(0, 4).level, 1);
  assert.equal(levelInfo(80, 4).level, 2);
  assert.equal(levelInfo(79, 4).level, 1);
  assert.equal(levelInfo(20, 1).level, 2, 'a solo member levels 4x faster per EXP');
  assert.equal(levelInfo(100000, 4).stage.id, 'adult');
});

test('daily group goal completes at 75% of members', () => {
  const t = dayKey(now);
  const members = [
    { id: 'a', todayDate: t, todayMinutes: 10 },
    { id: 'b', todayDate: t, todayMinutes: 30 },
    { id: 'c', todayDate: t, todayMinutes: 5 },
    { id: 'd', todayDate: '2026-10-02', todayMinutes: 50 },
  ];
  assert.deepEqual(dailyGoal(members, now).complete, false);
  members[2].todayMinutes = 12;
  const g = dailyGoal(members, now);
  assert.equal(g.complete, true);
  assert.equal(g.everyone, false);
});

test('shop: level gate, coins gate, legendary never sold', () => {
  const group = { coins: 100, owned: [] };
  assert.equal(cannotBuy(itemById('sunglasses'), group, 1, 4), null);
  assert.equal(priceFor(itemById('sunglasses'), 4), 80);
  assert.match(cannotBuy(itemById('jacket'), group, 1, 4), /Lv 3/);
  assert.match(cannotBuy(itemById('jacket'), group, 3, 4), /coins/);
  assert.equal(cannotBuy(itemById('aura'), { coins: 9999 }, 99, 1), 'Not for sale.');
});

test('equip: one item per slot', () => {
  assert.deepEqual(equipList(['cap'], itemById('headband')), ['headband']);
  assert.deepEqual(equipList(['cap', 'sunglasses'], itemById('cap')), ['sunglasses']);
});

test('invite codes are 6 unambiguous characters', () => {
  const code = makeInviteCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
});
