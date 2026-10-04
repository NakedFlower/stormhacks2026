// Everything a screen needs about the current club, live.
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api, useGroup, useMembers, useWorkouts, useBroadcasts, useInviteCode } from '../lib/db.js';
import { levelInfo, dailyGoal, dayKey } from '../lib/rules.js';

const Ctx = createContext(null);
export const useClub = () => useContext(Ctx);

export function ClubProvider({ gid, children }) {
  const group = useGroup(gid);
  const members = useMembers(gid);
  const workouts = useWorkouts(gid);
  const broadcasts = useBroadcasts(gid);
  const inviteCode = useInviteCode(gid);
  const [toastMsg, setToastMsg] = useState(null);
  const timer = useRef();

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const uid = api.uid();
  const me = members.find((m) => m.id === uid) ?? null;
  const memberCount = group?.memberCount ?? Math.max(1, members.length);
  const info = useMemo(() => levelInfo(group?.exp ?? 0, memberCount), [group?.exp, memberCount]);

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
