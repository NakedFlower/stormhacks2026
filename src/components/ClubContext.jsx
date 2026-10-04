// Everything a screen needs about the current club, live.
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api, useGroup, useMembers, useWorkouts, useBroadcasts, useInviteCode, useCheers } from '../lib/db.js';
import { clubLevel, dailyGoal, dayKey } from '../lib/rules.js';

const Ctx = createContext(null);
export const useClub = () => useContext(Ctx);

export function ClubProvider({ gid, children }) {
  const group = useGroup(gid);
  const members = useMembers(gid);
  const workouts = useWorkouts(gid);
  const broadcasts = useBroadcasts(gid);
  const inviteCode = useInviteCode(gid);
  const cheers = useCheers(gid);
  const [toastMsg, setToastMsg] = useState(null);
  const queue = useRef([]);
  const timer = useRef();

  // Toasts queue up, so a level-up or group-goal message never hides the "+EXP" one.
  const showNext = useCallback(() => {
    const next = queue.current.shift();
    setToastMsg(next ?? null);
    timer.current = next ? setTimeout(showNext, 2000) : null;
  }, []);
  const toast = useCallback((msg) => {
    if (queue.current.includes(msg)) return;
    queue.current.push(msg);
    if (queue.current.length > 2) queue.current.shift(); // keep it snappy: at most 2 waiting
    if (!timer.current) showNext();
  }, [showNext]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Cheers from friends: toast the ones that arrive while the app is open.
  const openedAt = useRef(Date.now());
  const seen = useRef(new Set());
  useEffect(() => {
    for (const c of cheers) {
      if (seen.current.has(c.id) || c.createdAt < openedAt.current) continue;
      seen.current.add(c.id);
      toast(`${c.fromName} cheered you on!`);
    }
  }, [cheers, toast]);

  const uid = api.uid();
  const me = members.find((m) => m.id === uid) ?? null;
  const memberCount = group?.memberCount ?? Math.max(1, members.length);
  const info = useMemo(() => clubLevel(group ? { ...group, memberCount } : null), [group, memberCount]);

  // Pay the daily group goal once, from whichever phone notices first.
  useEffect(() => {
    if (!group || members.length === 0) return;
    if (group.goalPaidDate === dayKey() || !dailyGoal(members).complete) return;
    api.claimDailyGoal(gid, members).then((paid) => paid && toast('Group goal done! +20 coins to the pot')).catch(() => {});
  }, [gid, group, members, toast]);

  const value = { gid, group, members, me, memberCount, info, workouts, broadcasts, inviteCode, toast };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
