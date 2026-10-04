// Demo backend: same interface as the Firebase one, but all data lives in this
// browser's localStorage. Each browser TAB is a different person, so you can
// test live sync with two tabs side by side and no Firebase project.
import { applyWorkout, applyWellness, undoWellness, hasBuddy, dailyGoal, clubLevel, clubGrowth, addGrowth, makeInviteCode, dayKey, BROADCAST_HOURS, GROUP_GOAL_COINS } from '../rules.js';
import { itemById, cannotBuy, priceFor, equipList, challengeProgress } from '../items.js';

const KEY = 'fitkin-demo-db';
const empty = () => ({ groups: {}, members: {}, workouts: {}, broadcasts: {}, invites: {}, cheers: {} });

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? empty(); } catch { return empty(); }
}

// Demo accounts: one person per email, so signing back in finds your clubs.
const demoUid = (email) => `demo-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

export function createDemoBackend() {
  let data = load();
  const listeners = new Set();

  let currentUser = null;
  try {
    const raw = sessionStorage.getItem('fitkin-demo-user');
    if (raw) currentUser = JSON.parse(raw);
  } catch { /* ignore */ }
  let uid = currentUser ? currentUser.uid : null;
  const authListeners = new Set();
  const notifyAuth = () => authListeners.forEach((l) => l(currentUser));

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
    currentUser: () => currentUser,

    onAuthChange(cb) {
      authListeners.add(cb);
      cb(currentUser);
      return () => authListeners.delete(cb);
    },

    async signUpWithEmail(email, password, displayName) {
      uid = demoUid(email);
      currentUser = { uid, email, displayName: displayName || email.split('@')[0] };
      try { sessionStorage.setItem('fitkin-demo-user', JSON.stringify(currentUser)); } catch {}
      notifyAuth();
      return delay(currentUser);
    },

    async signInWithEmail(email, password) {
      uid = demoUid(email); // same email = same person, so your clubs come back
      currentUser = { uid, email, displayName: email.split('@')[0] };
      try { sessionStorage.setItem('fitkin-demo-user', JSON.stringify(currentUser)); } catch {}
      notifyAuth();
      return delay(currentUser);
    },

    async signInWithGoogle() {
      uid = `demo-google-${Math.random().toString(36).slice(2, 10)}`;
      currentUser = { uid, email: 'google.demo@fitkin.app', displayName: 'Fitkin Demo User' };
      try { sessionStorage.setItem('fitkin-demo-user', JSON.stringify(currentUser)); } catch {}
      notifyAuth();
      return delay(currentUser);
    },

    async signOut() {
      currentUser = null;
      uid = null;
      try { sessionStorage.removeItem('fitkin-demo-user'); } catch {}
      notifyAuth();
      return delay();
    },

    async createClub(name, displayName) {
      const gid = `g${Date.now().toString(36)}`;
      const code = makeInviteCode();
      const now = Date.now();
      data.groups[gid] = {
        id: gid, name, exp: 0, growth: 0, coins: 0, owned: [], equipped: [], memberCount: 1,
        goalsCompleted: 0, goalPaidDate: null, achievements: [], lastActiveAt: now, createdAt: now, inviteCode: code,
      };
      data.members[gid] = { [uid]: { id: uid, displayName, joinedAt: now } };
      data.invites[code] = gid;
      save();
      return delay({ groupId: gid, name, inviteCode: code });
    },

    async joinClub(code, displayName) {
      const clean = code.trim().toUpperCase();
      const gid = data.invites[clean];
      if (!gid) throw new Error('No club has that invite code.');
      if (!data.members[gid][uid]) {
        data.members[gid][uid] = { id: uid, displayName, joinedAt: Date.now() };
        const g = data.groups[gid];
        g.growth = clubGrowth(g); // pin growth before the club gets bigger
        g.memberCount += 1;
        save();
      }
      return delay({ groupId: gid, name: data.groups[gid].name, inviteCode: clean });
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
      g.growth = addGrowth(g, r.exp);
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
      g.growth = addGrowth(g, r.exp);
      g.coins += r.coins;
      g.exp += r.exp;
      g.lastActiveAt = Date.now();
      save();
      return delay({ coins: r.coins, exp: r.exp, capped: r.capped });
    },

    async undoWellness(gid, taskId) {
      const r = undoWellness(me(gid), taskId, new Date());
      data.members[gid][uid] = { ...r.member, id: uid };
      const g = group(gid);
      const coins = -Math.min(-r.coins, g.coins); // never below an empty pot
      g.growth = addGrowth(g, r.exp);
      g.coins += coins;
      g.exp = Math.max(0, g.exp + r.exp);
      save();
      return delay({ coins, exp: r.exp });
    },

    async cheer(gid, toUid) {
      const from = data.members[gid]?.[uid];
      (data.cheers[gid] ??= []).push({ id: `c${Date.now()}`, from: uid, fromName: from?.displayName ?? 'A friend', to: toUid, createdAt: Date.now() });
      save();
      return delay();
    },

    watchCheers(gid, cb) {
      return watch(() => (data.cheers?.[gid] ?? []).filter((c) => c.to === uid), cb);
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
      const why = cannotBuy(item, g, clubLevel(g).level, g.memberCount);
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
