// Demo backend: same interface as the Firebase one, but all data lives in this
// browser's localStorage. Each browser TAB is a different person, so you can
// test live sync with two tabs side by side and no Firebase project.
import { applyWorkout, applyWellness, hasBuddy, dailyGoal, levelInfo, makeInviteCode, dayKey, BROADCAST_HOURS, GROUP_GOAL_COINS } from '../rules.js';
import { itemById, cannotBuy, priceFor, equipList, challengeProgress } from '../items.js';

const KEY = 'fitkin-demo-db';
const empty = () => ({ groups: {}, members: {}, workouts: {}, broadcasts: {}, invites: {} });

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? empty(); } catch { return empty(); }
}

export function createDemoBackend() {
  let data = load();
  const listeners = new Set();

  let uid = null;
  try { uid = sessionStorage.getItem('fitkin-demo-uid'); } catch { /* private mode */ }
  if (!uid) {
    uid = `demo-${Math.random().toString(36).slice(2, 10)}`;
    try { sessionStorage.setItem('fitkin-demo-uid', uid); } catch { /* ignore */ }
  }

  const emit = () => listeners.forEach((l) => l());
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* full or blocked */ }
    emit();
  };
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { data = load(); emit(); }
  });

  const watch = (select, cb) => {
    const run = () => cb(structuredClone(select()));
    listeners.add(run);
    queueMicrotask(run);
    return () => listeners.delete(run);
  };
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120)); // feels like a network
  const group = (gid) => {
    const g = data.groups[gid];
    if (!g) throw new Error('Club not found.');
    return g;
  };
  const me = (gid) => {
    const m = data.members[gid]?.[uid];
    if (!m) throw new Error('You are not in this club.');
    return m;
  };

  return {
    mode: 'demo',
    ready: () => Promise.resolve(uid),
    uid: () => uid,

    async createClub(name, displayName) {
      const gid = `g${Date.now().toString(36)}`;
      const code = makeInviteCode();
      const now = Date.now();
      data.groups[gid] = {
        id: gid, name, exp: 0, coins: 0, owned: [], equipped: [], memberCount: 1,
        goalsCompleted: 0, goalPaidDate: null, achievements: [], lastActiveAt: now, createdAt: now, inviteCode: code,
      };
      data.members[gid] = { [uid]: { id: uid, displayName, joinedAt: now } };
      data.invites[code] = gid;
      save();
      return delay({ groupId: gid, name });
    },

    async joinClub(code, displayName) {
      const gid = data.invites[code.trim().toUpperCase()];
      if (!gid) throw new Error('No club has that invite code.');
      if (!data.members[gid][uid]) {
        data.members[gid][uid] = { id: uid, displayName, joinedAt: Date.now() };
        data.groups[gid].memberCount += 1;
        save();
      }
      return delay({ groupId: gid, name: data.groups[gid].name });
    },

    watchGroup: (gid, cb) => watch(() => data.groups[gid] ?? null, cb),
    watchInviteCode: (gid, cb) => watch(() => data.groups[gid]?.inviteCode ?? '', cb),
    watchMembers: (gid, cb) => watch(() => Object.values(data.members[gid] ?? {}), cb),
    watchWorkouts: (gid, cb) => watch(() => [...(data.workouts[gid] ?? [])].reverse().slice(0, 15), cb),
    watchBroadcasts: (gid, cb) => watch(() => [...(data.broadcasts[gid] ?? [])].reverse().slice(0, 10), cb),
    watchShowcase: (cb) => watch(() => Object.values(data.groups).sort((a, b) => b.lastActiveAt - a.lastActiveAt).slice(0, 20), cb),

    async logWorkout(gid, input) {
      const m = me(gid);
      const now = new Date();
      const r = applyWorkout(m, input, now, { buddy: hasBuddy(data.broadcasts[gid], uid, now) });
      data.members[gid][uid] = { ...r.member, id: uid };
      const g = group(gid);
      g.exp += r.exp;
      g.coins += r.coins;
      g.lastActiveAt = Date.now();
      (data.workouts[gid] ??= []).push({ ...r.workout, id: `w${Date.now()}`, uid, name: m.displayName });
      save();
      return delay({ exp: r.exp, coins: r.coins, capped: r.capped, buddy: r.buddy, variety: r.variety });
    },

    async doWellness(gid, taskId) {
      const r = applyWellness(me(gid), taskId, new Date());
      data.members[gid][uid] = { ...r.member, id: uid };
      const g = group(gid);
      g.coins += r.coins;
      if (r.exp) g.exp += r.exp;
      save();
      return delay({ coins: r.coins, exp: r.exp });
    },

    async claimDailyGoal(gid, members) {
      const goal = dailyGoal(members);
      const g = group(gid);
      if (!goal.complete || g.goalPaidDate === dayKey()) return false;
      g.goalPaidDate = dayKey();
      g.coins += GROUP_GOAL_COINS;
      g.goalsCompleted += 1;
      if (goal.everyone && !g.achievements.includes('allActive')) g.achievements.push('allActive');
      save();
      return true;
    },

    async buy(gid, itemId) {
      const g = group(gid);
      const item = itemById(itemId);
      const why = cannotBuy(item, g, levelInfo(g.exp, g.memberCount).level, g.memberCount);
      if (why) throw new Error(why);
      g.coins -= priceFor(item, g.memberCount);
      g.owned.push(itemId);
      g.equipped = equipList(g.equipped, item);
      save();
      return delay();
    },

    async equip(gid, itemId) {
      const g = group(gid);
      const item = itemById(itemId);
      const unlocked = item.tier === 'legendary' ? challengeProgress(g, item.challenge).done : g.owned.includes(itemId);
      if (!unlocked) throw new Error('Not unlocked yet.');
      g.equipped = equipList(g.equipped, item);
      save();
      return delay();
    },

    async headOut(gid, { activity, time, name }) {
      const now = Date.now();
      (data.broadcasts[gid] ??= []).push({
        id: `b${now}`, uid, name, activity, time, going: [uid], createdAt: now, expiresAt: now + BROADCAST_HOURS * 3600e3,
      });
      save();
      return delay();
    },

    async joinBroadcast(gid, broadcastId) {
      const b = data.broadcasts[gid]?.find((x) => x.id === broadcastId);
      if (b && !b.going.includes(uid)) b.going.push(uid);
      save();
      return delay();
    },
  };
}
