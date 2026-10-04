// Firebase backend. Owner: Ko (auth, joining) + Kelsie (transactions).
// Every write that touches EXP or coins runs in a transaction, so two phones
// logging at the same moment can't overwrite each other.
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, where, onSnapshot, query, orderBy, limit,
  runTransaction, writeBatch, increment, arrayUnion, addDoc, updateDoc,
} from 'firebase/firestore';
import { applyWorkout, applyWellness, undoWellness, hasBuddy, dailyGoal, clubLevel, clubGrowth, addGrowth, makeInviteCode, dayKey, BROADCAST_HOURS, GROUP_GOAL_COINS } from '../rules.js';
import { itemById, cannotBuy, priceFor, equipList, challengeProgress } from '../items.js';

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let uid = null;
  let currentUser = null;
  const authListeners = new Set();
  const notifyAuth = () => authListeners.forEach((l) => l(currentUser));

  let initialAuthResolved = false;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    uid = user ? user.uid : null;
    if (!initialAuthResolved) {
      initialAuthResolved = true;
      resolveReady(uid);
    }
    notifyAuth();
  });

  const currentUid = () => auth.currentUser?.uid || uid;
  const groupRef = (gid) => doc(db, 'groups', gid);
  const memberRef = (gid, id = currentUid()) => doc(db, 'groups', gid, 'members', id);
  const userRef = (id = currentUid()) => doc(db, 'users', id);
  const withId = (snap) => ({ id: snap.id, ...snap.data() });

  return {
    mode: 'firebase',
    ready: () => ready,
    uid: () => currentUid(),
    currentUser: () => currentUser,

    onAuthChange(cb) {
      authListeners.add(cb);
      if (initialAuthResolved) cb(currentUser);
      return () => authListeners.delete(cb);
    },

    async signUpWithEmail(email, password, displayName) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      currentUser = auth.currentUser;
      uid = currentUser.uid;
      await setDoc(userRef(uid), { displayName: displayName || email.split('@')[0], email, clubs: [] }, { merge: true }).catch(() => {});
      return currentUser;
    },

    async signInWithEmail(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      currentUser = cred.user;
      uid = currentUser.uid;
      return currentUser;
    },

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      currentUser = cred.user;
      uid = currentUser.uid;
      await setDoc(userRef(uid), { displayName: currentUser.displayName || currentUser.email.split('@')[0], email: currentUser.email }, { merge: true }).catch(() => {});
      return currentUser;
    },

    async signOut() {
      await fbSignOut(auth);
      currentUser = null;
      uid = null;
      notifyAuth();
    },

    async getUserClubs(userId = currentUid()) {
      if (!userId) return [];
      try {
        const snap = await getDoc(userRef(userId));
        return snap.exists() ? snap.data().clubs ?? [] : [];
      } catch {
        return [];
      }
    },

    async createClub(name, displayName) {
      await ready;
      const myUid = currentUid();
      if (!myUid) throw new Error('You must be signed in to create a club.');
      const code = makeInviteCode();
      const gRef = doc(collection(db, 'groups'));
      const now = Date.now();
      const batch = writeBatch(db);
      batch.set(gRef, {
        name, exp: 0, growth: 0, coins: 0, owned: [], equipped: [], memberCount: 1,
        goalsCompleted: 0, goalPaidDate: null, achievements: [], lastActiveAt: now, createdAt: now,
      });
      batch.set(doc(gRef, 'meta', 'invite'), { code });
      batch.set(doc(db, 'invites', code), { groupId: gRef.id });
      batch.set(doc(db, 'groups', gRef.id, 'members', myUid), { displayName, joinedAt: now, inviteCode: code });
      await batch.commit();

      setDoc(doc(db, 'users', myUid), {
        clubs: arrayUnion({ id: gRef.id, name }),
        name: displayName,
      }, { merge: true }).catch(() => {});

      return { groupId: gRef.id, name, inviteCode: code };
    },

    async joinClub(code, displayName) {
      await ready;
      const myUid = currentUid();
      if (!myUid) throw new Error('You must be signed in to join a club.');
      const clean = code.trim().toUpperCase();
      const invite = await getDoc(doc(db, 'invites', clean));
      if (!invite.exists()) throw new Error('No club has that invite code.');
      const { groupId } = invite.data();
      const group = await getDoc(groupRef(groupId));
      const existing = await getDoc(doc(db, 'groups', groupId, 'members', myUid)).catch(() => null);
      if (existing?.exists()) {
        setDoc(doc(db, 'users', myUid), { clubs: arrayUnion({ id: groupId, name: group.data().name }) }, { merge: true }).catch(() => {});
        return { groupId, name: group.data().name, inviteCode: clean };
      }
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', groupId, 'members', myUid), { displayName, joinedAt: Date.now(), inviteCode: clean });
      // Pin growth before the club gets bigger, so a new member never lowers the level.
      batch.update(groupRef(groupId), { memberCount: increment(1), growth: clubGrowth(group.data()) });
      await batch.commit();

      setDoc(doc(db, 'users', myUid), { clubs: arrayUnion({ id: groupId, name: group.data().name }), name: displayName }, { merge: true }).catch(() => {});
      return { groupId, name: group.data().name, inviteCode: clean };
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
        const g = (await tx.get(groupRef(gid))).data();
        const me = mSnap.data();
        const r = applyWorkout(me, input, now, { buddy });
        tx.set(memberRef(gid), r.member, { merge: true });
        tx.update(groupRef(gid), { exp: increment(r.exp), growth: addGrowth(g, r.exp), coins: increment(r.coins), lastActiveAt: Date.now() });
        tx.set(doc(collection(db, 'groups', gid, 'workouts')), { ...r.workout, uid, name: me.displayName });
        return { exp: r.exp, coins: r.coins, capped: r.capped, buddy: r.buddy, variety: r.variety };
      });
    },

    async doWellness(gid, taskId) {
      return runTransaction(db, async (tx) => {
        const mSnap = await tx.get(memberRef(gid));
        const g = (await tx.get(groupRef(gid))).data();
        const r = applyWellness(mSnap.data(), taskId, new Date());
        tx.set(memberRef(gid), r.member, { merge: true });
        tx.update(groupRef(gid), {
          coins: increment(r.coins), exp: increment(r.exp), growth: addGrowth(g, r.exp), lastActiveAt: Date.now(),
        });
        return { coins: r.coins, exp: r.exp, capped: r.capped };
      });
    },

    async undoWellness(gid, taskId) {
      return runTransaction(db, async (tx) => {
        const mSnap = await tx.get(memberRef(gid));
        const g = (await tx.get(groupRef(gid))).data();
        const r = undoWellness(mSnap.data(), taskId, new Date());
        const coins = -Math.min(-r.coins, g.coins ?? 0); // never below an empty pot
        const exp = -Math.min(-r.exp, g.exp ?? 0);
        tx.set(memberRef(gid), r.member);
        tx.update(groupRef(gid), { coins: increment(coins), exp: increment(exp), growth: addGrowth(g, exp) });
        return { coins, exp };
      });
    },

    async cheer(gid, toUid) {
      const mine = await getDoc(memberRef(gid));
      await addDoc(collection(db, 'groups', gid, 'cheers'), {
        from: currentUid(), fromName: mine.data()?.displayName ?? 'A friend', to: toUid, createdAt: Date.now(),
      });
    },

    // Cheers sent to me. Filtered by recipient only, so no extra Firestore index is needed.
    watchCheers(gid, cb) {
      const q = query(collection(db, 'groups', gid, 'cheers'), where('to', '==', currentUid()));
      return onSnapshot(q, (s) => cb(s.docs.map(withId)), () => cb([]));
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
        const { level } = clubLevel(g);
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
