// The one place screens get data from. Pages import `api` and the hooks below;
// they never call Firestore directly.
//
// With Firebase keys in .env.local (or Vercel settings) -> real shared data.
// Without them -> demo mode: data stays in this browser, each tab is a person.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createFirebaseBackend } from './backend/firebaseBackend.js';
import { createDemoBackend } from './backend/demoBackend.js';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const api = firebaseConfig.apiKey && firebaseConfig.projectId
  ? createFirebaseBackend(firebaseConfig)
  : createDemoBackend();

// ---------- which club am I looking at (per person, per device) ----------

const sessionListeners = new Set();
function sessionKey() { return `fitkin-session-${api.uid() ?? 'anon'}`; }
function readSession() {
  try { return JSON.parse(localStorage.getItem(sessionKey())) ?? { current: null, clubs: [], name: '' }; }
  catch { return { current: null, clubs: [], name: '' }; }
}
let session = { current: null, clubs: [], name: '' };
api.ready().then(() => { session = readSession(); sessionListeners.forEach((l) => l()); });

export function setSession(patch) {
  session = { ...session, ...patch };
  try { localStorage.setItem(sessionKey(), JSON.stringify(session)); } catch { /* ignore */ }
  sessionListeners.forEach((l) => l());
}

export function rememberClub({ groupId, name }, displayName) {
  const clubs = [...session.clubs.filter((c) => c.id !== groupId), { id: groupId, name }];
  setSession({ current: groupId, clubs, name: displayName ?? session.name });
}

export function useSession() {
  return useSyncExternalStore(
    (l) => { sessionListeners.add(l); return () => sessionListeners.delete(l); },
    () => session,
  );
}

export function useReady() {
  const [uid, setUid] = useState(api.uid());
  const [error, setError] = useState(null);
  useEffect(() => { api.ready().then(setUid, setError); }, []);
  return { uid, error };
}

// ---------- live data hooks ----------

function useWatch(watchFn, arg, initial) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (arg === null) return undefined;
    return watchFn(arg, setValue);
  }, [arg]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export const useGroup = (gid) => useWatch(api.watchGroup, gid ?? null, null);
export const useMembers = (gid) => useWatch(api.watchMembers, gid ?? null, []);
export const useWorkouts = (gid) => useWatch(api.watchWorkouts, gid ?? null, []);
export const useBroadcasts = (gid) => useWatch(api.watchBroadcasts, gid ?? null, []);
export const useInviteCode = (gid) => useWatch(api.watchInviteCode, gid ?? null, '');
export function useShowcase() {
  const [value, setValue] = useState([]);
  useEffect(() => api.watchShowcase(setValue), []);
  return value;
}
