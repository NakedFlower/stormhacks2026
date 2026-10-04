// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityExp, applyWorkout, applyWellness, dailyGoal, levelInfo, expToNext,
  freshMember, dayKey, weekKey, makeInviteCode, hasBuddy, DAILY_EXP_CAP,
  WELLNESS_TASKS, WELLNESS_EXP, undoWellness, clubLevel, clubGrowth, addGrowth,
} from './rules.js';
import { ITEMS, cannotBuy, equipList, priceFor, itemById } from './items.js';
import { ITEM_MODELS } from '../three/itemModels.js';

const now = new Date(2026, 9, 3, 18, 0); // Sat Oct 3 2026, local time
// Already logged these types this week, so no variety bonus muddies the numbers.
const regular = { weekStart: weekKey(now), weekTypes: ['run', 'walk', 'bike'] };

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
  const a = applyWorkout(regular, { type: 'run', minutes: 25, intensity: 'vigorous' }, now);
  assert.equal(a.exp, 50);
  const b = applyWorkout(a.member, { type: 'run', minutes: 25, intensity: 'vigorous' }, now);
  assert.equal(b.exp, DAILY_EXP_CAP - 50);
  assert.equal(b.capped, true);
  const c = applyWorkout(b.member, { type: 'walk', minutes: 10, intensity: 'light' }, now);
  assert.equal(c.exp, 0);
  assert.equal(c.coins, 10, 'coins still paid when EXP is capped');
});

test('cap resets the next day', () => {
  const a = applyWorkout(regular, { type: 'run', minutes: 40, intensity: 'vigorous' }, now);
  const tomorrow = new Date(2026, 9, 4, 9, 0);
  const b = applyWorkout(a.member, { type: 'walk', minutes: 20, intensity: 'light' }, tomorrow);
  assert.equal(b.exp, 20);
  assert.equal(b.member.todayDate, dayKey(tomorrow));
});

test('buddy: live broadcast with 2+ going, and you are one of them', () => {
  const t = now.getTime();
  const live = { going: ['me', 'pal'], expiresAt: t + 60e3 };
  assert.equal(hasBuddy([live], 'me', now), true);
  assert.equal(hasBuddy([{ ...live, going: ['me'] }], 'me', now), false, 'alone does not count');
  assert.equal(hasBuddy([{ ...live, expiresAt: t - 1 }], 'me', now), false, 'expired does not count');
  assert.equal(hasBuddy([live], 'stranger', now), false, 'must be going yourself');
  assert.equal(hasBuddy([], 'me', now), false);
  assert.equal(hasBuddy(undefined, 'me', now), false);
});

test('buddy: workout EXP x1.25', () => {
  const a = applyWorkout(regular, { type: 'walk', minutes: 20, intensity: 'light' }, now, { buddy: true });
  assert.equal(a.exp, 25);
  assert.equal(a.buddy, true);
  assert.equal(a.workout.exp, 25);
  const b = applyWorkout(regular, { type: 'walk', minutes: 20, intensity: 'light' }, now);
  assert.equal(b.exp, 20, 'no buddy, no bonus');
});

test('variety: +10 for the first 2 new activity types each week', () => {
  const walk = applyWorkout({}, { type: 'walk', minutes: 10, intensity: 'light' }, now);
  assert.equal(walk.exp, 20);
  assert.equal(walk.variety, true);
  const again = applyWorkout(walk.member, { type: 'walk', minutes: 10, intensity: 'light' }, now);
  assert.equal(again.exp, 10, 'same type twice: no bonus');
  const yoga = applyWorkout(again.member, { type: 'yoga', minutes: 10, intensity: 'light' }, now);
  assert.equal(yoga.exp, 20);
  const nextDay = new Date(2026, 9, 4, 9, 0); // Sunday, same week, fresh daily cap
  const swim = applyWorkout(yoga.member, { type: 'swim', minutes: 10, intensity: 'light' }, nextDay);
  assert.equal(swim.exp, 10, 'third new type: max 2 per week');
  assert.equal(swim.variety, false);
  const monday = new Date(2026, 9, 5, 9, 0);
  const mon = applyWorkout(swim.member, { type: 'walk', minutes: 10, intensity: 'light' }, monday);
  assert.equal(mon.exp, 20, 'resets on Monday');
  assert.deepEqual(mon.member.weekTypes, ['walk']);
});

test('bonuses: buddy multiplies the workout, variety adds after, cap applies last', () => {
  const a = applyWorkout({}, { type: 'walk', minutes: 20, intensity: 'light' }, now, { buddy: true });
  assert.equal(a.exp, 35, '20 x 1.25 + 10 (not (20 + 10) x 1.25)');
  const b = applyWorkout({}, { type: 'run', minutes: 22, intensity: 'vigorous' }, now, { buddy: true });
  assert.equal(b.exp, DAILY_EXP_CAP, '44 x 1.25 + 10 = 65, capped to 60');
  assert.equal(b.capped, true);
  const nearCap = applyWorkout({ todayDate: dayKey(now), todayExp: 50 }, { type: 'walk', minutes: 4, intensity: 'light' }, now, { buddy: true });
  assert.equal(nearCap.exp, 10, 'bonuses never push past the cap');
  assert.equal(nearCap.member.todayExp, DAILY_EXP_CAP);
  assert.equal(nearCap.capped, true);
  const buddyOnly = applyWorkout(regular, { type: 'run', minutes: 26, intensity: 'vigorous' }, now, { buddy: true });
  assert.equal(buddyOnly.variety, false);
  assert.equal(buddyOnly.exp, DAILY_EXP_CAP, '52 x 1.25 = 65, no variety, capped to 60');
  assert.equal(buddyOnly.capped, true);
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
  assert.equal(total, 35);
  assert.throws(() => applyWellness(m, 'water', now));
});

test('wellness: every to-do adds its EXP, never past the daily cap', () => {
  for (const t of WELLNESS_TASKS) {
    assert.ok(t.exp > 0, `${t.id} must add EXP`);
    assert.ok(t.coins > 0, `${t.id} must have a coin value`);
  }
  // Four 5-EXP to-dos: 20 EXP, still room under the cap.
  let m = {};
  for (const id of ['water', 'stretch', 'outside', 'stairs']) m = applyWellness(m, id, now).member;
  assert.equal(m.todayExp, 20);
  // A workout after the to-dos shares the same 60 cap.
  const w = applyWorkout(m, { type: 'run', minutes: 30, intensity: 'vigorous' }, now);
  assert.equal(w.exp, DAILY_EXP_CAP - 20);
  // Ticking everything never goes past the cap, however many to-dos there are.
  let all = {};
  let exp = 0;
  for (const t of WELLNESS_TASKS) {
    const r = applyWellness(all, t.id, now);
    exp += r.exp;
    all = r.member;
  }
  assert.equal(exp, DAILY_EXP_CAP);
  assert.equal(all.todayExp, DAILY_EXP_CAP);
  // Near the cap: only the room left counts, and the flag says so.
  const near = applyWellness({ todayDate: dayKey(now), todayExp: DAILY_EXP_CAP - 2 }, 'steps', now);
  assert.equal(near.exp, 2);
  assert.equal(near.capped, true);
});

test('to-dos from two members level the club together', () => {
  // 2 members need 40 EXP for Lv 2: four 5-EXP to-dos each gets there.
  const perMember = 4 * WELLNESS_EXP;
  assert.equal(levelInfo(perMember, 2).level, 1);
  assert.equal(levelInfo(perMember * 2, 2).level, 2);
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
  assert.match(cannotBuy(itemById('cap'), group, 1, 1), /Lv 2/);
  assert.equal(cannotBuy(itemById('cap'), group, 2, 1), null);
  assert.equal(priceFor(itemById('cap'), 4), 120);
  assert.match(cannotBuy(itemById('cap'), group, 2, 4), /coins/);
  assert.match(cannotBuy(itemById('bow'), { coins: 9999, owned: [] }, 2, 1), /Lv 3/);
  assert.equal(cannotBuy(itemById('cap'), { coins: 100, owned: ['cap'] }, 2, 1), 'Already owned.');
  assert.equal(cannotBuy(itemById('crown'), { coins: 9999 }, 99, 1), 'Not for sale.');
});

test('equip: one item per slot, tap again to take off', () => {
  assert.deepEqual(equipList(['cap'], itemById('bow')), ['bow']);
  assert.deepEqual(equipList(['bow'], itemById('bow')), []);
});

test('every shop item has a 3D model', () => {
  for (const item of ITEMS) assert.ok(ITEM_MODELS[item.id], `${item.id} has no model in src/three/itemModels.js`);
});

test('invite codes are 6 unambiguous characters', () => {
  const code = makeInviteCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
});

test('untick gives back exactly what that tick earned (F3, F4)', () => {
  let m = {};
  const ticks = ['water', 'stretch', 'outside', 'stairs']; // 4th pays EXP but no coins
  let coins = 0;
  for (const id of ticks) { const r = applyWellness(m, id, now); coins += r.coins; m = r.member; }
  assert.equal(coins, 35);
  assert.equal(m.todayExp, 20);
  // Untick the unpaid 4th: coins stay, its 5 EXP comes back off.
  let u = undoWellness(m, 'stairs', now);
  assert.deepEqual([u.coins, u.exp], [0, -5]);
  m = u.member;
  assert.equal(m.todayExp, 15);
  assert.ok(!m.wellnessDone.includes('stairs'));
  // Untick a paid one: its 10 coins come back off.
  u = undoWellness(m, 'water', now);
  assert.deepEqual([u.coins, u.exp], [-10, -5]);
  m = u.member;
  // Re-tick: pays again (only 2 paid ticks are left), never twice at once.
  const again = applyWellness(m, 'water', now);
  assert.equal(again.coins, 10);
  assert.throws(() => undoWellness(again.member, 'sleep', now), /Not ticked/);
});

test('a friend joining never lowers the level (LV4)', () => {
  // Solo club earns 20 EXP: Lv 2.
  let g = { exp: 0, growth: 0, memberCount: 1 };
  g = { ...g, growth: addGrowth(g, 20), exp: 20 };
  assert.equal(clubLevel(g).level, 2);
  // A friend joins: growth is pinned, the club gets bigger, the level stays.
  g = { ...g, growth: clubGrowth(g), memberCount: 2 };
  assert.equal(clubLevel(g).level, 2);
  // EXP now counts at the new size: 2 members need twice the EXP per level.
  assert.equal(clubLevel(g).need, expToNext(2, 2));
  // Old clubs with no growth field fall back to exp / members.
  assert.equal(clubLevel({ exp: 80, memberCount: 4 }).level, 2);
});
