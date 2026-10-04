// Firebase backend. Owner: Ko (auth, joining) + Kelsie (transactions).
// Every write that touches EXP or coins runs in a transaction, so two phones
// logging at the same moment can't overwrite each other.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, doc, collection, getDoc, getDocs, where, onSnapshot, query, orderBy, limit,
  runTransaction, writeBatch, increment, arrayUnion, addDoc, updateDoc,
} from 'firebase/firestore';
import { applyWorkout, applyWellness, hasBuddy, dailyGoal, levelInfo, makeInviteCode, dayKey, BROADCAST_HOURS, GROUP_GOAL_COINS } from '../rules.js';
import { itemById, cannotBuy, priceFor, equipList, challengeProgress } from '../items.js';

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = null;

  const ready = new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) { uid = user.uid; stop(); resolve(uid); }
    });
    signInAnonymously(auth).catch(reject);
  });

  const groupRef = (gid) => doc(db, 'groups', gid);
  const memberRef = (gid, id = uid) => doc(db, 'groups', gid, 'members', id);
  const withId = (snap) => ({ id: snap.id, ...snap.data() });

  return {
    mode: 'firebase',
    ready: () => ready,
    uid: () => uid,

    async createClub(name, displayName) {
      await ready;
      const code = makeInviteCode();
      const gRef = doc(collection(db, 'groups'));
      const now = Date.now();
      const batch = writeBatch(db);
      batch.set(gRef, {
        name, exp: 0, coins: 0, owned: [], equipped: [], memberCount: 1,
        goalsCompleted: 0, goalPaidDate: null, achievements: [], lastActiveAt: now, createdAt: now,
      });
      batch.set(doc(gRef, 'meta', 'invite'), { code });
      batch.set(doc(db, 'invites', code), { groupId: gRef.id });
      batch.set(memberRef(gRef.id), { displayName, joinedAt: now, inviteCode: code });
      await batch.commit();
      return { groupId: gRef.id, name };
    },

    async joinClub(code, displayName) {
      await ready;
      const clean = code.trim().toUpperCase();
      const invite = await getDoc(doc(db, 'invites', clean));
      if (!invite.exists()) throw new Error('No club has that invite code.');
      const { groupId } = invite.data();
      const group = await getDoc(groupRef(groupId));
      const existing = await getDoc(memberRef(groupId)).catch(() => null);
      if (existing?.exists()) return { groupId, name: group.data().name };
      const batch = writeBatch(db);
      batch.set(memberRef(groupId), { displayName, joinedAt: Date.now(), inviteCode: clean });
      batch.update(groupRef(groupId), { memberCount: increment(1) });
      await batch.commit();
      return { groupId, name: group.data().name };
    },

    watchGroup(gid, cb) {
      return onSnapshot(groupRef(gid), (s) => cb(s.exists() ? withId(s) : null));
    },
    watchInviteCode(gid, cb) {
      return onSnapshot(doc(db, 'groups', gid, 'meta', 'invite'), (s) => cb(s.data()?.code ?? ''));
    },
    watchMembers(gid, cb) {
      return onSnapshot(collection(db, 'groups', gid, 'members'), (s) => cb(s.docs.map(withId)));
    },
    watchWorkouts(gid, cb) {
      const q = query(collection(db, 'groups', gid, 'workouts'), orderBy('createdAt', 'desc'), limit(15));
      return onSnapshot(q, (s) => cb(s.docs.map(withId)));
    },
    watchBroadcasts(gid, cb) {
      const q = query(collection(db, 'groups', gid, 'broadcasts'), orderBy('createdAt', 'desc'), limit(10));
      return onSnapshot(q, (s) => cb(s.docs.map(withId)));
    },
    watchShowcase(cb) {
      const q = query(collection(db, 'groups'), orderBy('lastActiveAt', 'desc'), limit(20));
      return onSnapshot(q, (s) => cb(s.docs.map(withId)));
    },

    async logWorkout(gid, input) {
      // Live broadcasts are read before the transaction: queries can't run inside one.
      const now = new Date();
      const live = await getDocs(query(collection(db, 'groups', gid, 'broadcasts'), where('expiresAt', '>', now.getTime())));
      const buddy = hasBuddy(live.docs.map((d) => d.data()), uid, now);
      return runTransaction(db, async (tx) => {
        const mSnap = await tx.get(memberRef(gid));
        if (!mSnap.exists()) throw new Error('You are not in this club.');
        const me = mSnap.data();
        const r = applyWorkout(me, input, now, { buddy });
        tx.set(memberRef(gid), r.member, { merge: true });
        tx.update(groupRef(gid), { exp: increment(r.exp), coins: increment(r.coins), lastActiveAt: Date.now() });
        tx.set(doc(collection(db, 'groups', gid, 'workouts')), { ...r.workout, uid, name: me.displayName });
        return { exp: r.exp, coins: r.coins, capped: r.capped, buddy: r.buddy, variety: r.variety };
      });
    },

    async doWellness(gid, taskId) {
      return runTransaction(db, async (tx) => {
        const mSnap = await tx.get(memberRef(gid));
        const r = applyWellness(mSnap.data(), taskId, new Date());
        tx.set(memberRef(gid), r.member, { merge: true });
        const patch = {};
        if (r.coins) patch.coins = increment(r.coins);
        if (r.exp) patch.exp = increment(r.exp);
        if (Object.keys(patch).length) tx.update(groupRef(gid), patch);
        return { coins: r.coins, exp: r.exp };
      });
    },

    async claimDailyGoal(gid, members) {
      const goal = dailyGoal(members);
      if (!goal.complete) return false;
      const today = dayKey();
      return runTransaction(db, async (tx) => {
        const g = (await tx.get(groupRef(gid))).data();
        if (g.goalPaidDate === today) return false;
        const patch = { goalPaidDate: today, coins: increment(GROUP_GOAL_COINS), goalsCompleted: increment(1) };
        if (goal.everyone) patch.achievements = arrayUnion('allActive');
        tx.update(groupRef(gid), patch);
        return true;
      });
    },

    async buy(gid, itemId) {
      return runTransaction(db, async (tx) => {
        const g = (await tx.get(groupRef(gid))).data();
        const item = itemById(itemId);
        const { level } = levelInfo(g.exp, g.memberCount);
        const why = cannotBuy(item, g, level, g.memberCount);
        if (why) throw new Error(why);
        tx.update(groupRef(gid), {
          coins: increment(-priceFor(item, g.memberCount)),
          owned: arrayUnion(itemId),
          equipped: equipList(g.equipped ?? [], item),
        });
      });
    },

    async equip(gid, itemId) {
      return runTransaction(db, async (tx) => {
        const g = (await tx.get(groupRef(gid))).data();
        const item = itemById(itemId);
        const unlocked = item.tier === 'legendary' ? challengeProgress(g, item.challenge).done : (g.owned ?? []).includes(itemId);
        if (!unlocked) throw new Error('Not unlocked yet.');
        tx.update(groupRef(gid), { equipped: equipList(g.equipped ?? [], item) });
      });
    },

    async headOut(gid, { activity, time, name }) {
      const now = Date.now();
      await addDoc(collection(db, 'groups', gid, 'broadcasts'), {
        uid, name, activity, time, going: [uid], createdAt: now, expiresAt: now + BROADCAST_HOURS * 3600e3,
      });
    },

    async joinBroadcast(gid, broadcastId) {
      await updateDoc(doc(db, 'groups', gid, 'broadcasts', broadcastId), { going: arrayUnion(uid) });
    },
  };
}
