// Home: the character, today's glow, heading out, group goal, to-do list.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Character from '../three/Character.jsx';
import { useClub } from '../components/ClubContext.jsx';
import { api, useSession } from '../lib/db.js';
import { ACTIVITIES, WELLNESS_TASKS, WELLNESS_MAX_PER_DAY, WELLNESS_EXP, dailyGoal, isActiveToday, dayKey, GROUP_GOAL_MINUTES } from '../lib/rules.js';
import { BoltIcon, CoinIcon, ChevronRight } from '../components/Icons.jsx';

export default function Home({ onLog }) {
  const { gid, group, members, me, info, broadcasts, inviteCode, toast } = useClub();
  const session = useSession();
  const [popKey, setPopKey] = useState(0);
  const lastLevel = useRef(null);
  const sentCheers = useRef({}); // friend id -> when I last cheered them

  // Level-up: pop the character on every phone that's watching.
  // Only once the club has loaded, so opening the app doesn't announce the current level.
  useEffect(() => {
    if (!group) return;
    if (lastLevel.current !== null && info.level > lastLevel.current) {
      setPopKey((k) => k + 1);
      toast(`Level ${info.level}! Your little guy grew.`);
    }
    lastLevel.current = info.level;
  }, [group, info.level, toast]);

  if (!group) return <div className="screen center muted">Loading your club…</div>;

  const awake = members.some((m) => isActiveToday(m));
  const goal = dailyGoal(members);
  const today = dayKey();
  const myWellness = me?.todayDate === today ? me.wellnessDone ?? [] : [];
  const iWorkedOut = me?.todayDate === today && (me.todayMinutes ?? 0) >= GROUP_GOAL_MINUTES;
  const paid = me?.todayDate === today ? me.wellnessPaid ?? {} : {};
  const alone = members.length <= 1;
  const live = broadcasts.filter((b) => b.expiresAt > Date.now());

  async function wellness(id) {
    try {
      const r = await api.doWellness(gid, id);
      const parts = [];
      if (r.exp) parts.push(`+${r.exp} EXP`);
      if (r.coins) parts.push(`+${r.coins} coins`);
      toast(parts.length ? `${parts.join(' · ')} for the club` : 'Done! (you hit today’s EXP and coin caps)');
    } catch (e) { toast(e.message); }
  }

  async function untick(id) {
    try {
      const r = await api.undoWellness(gid, id);
      const parts = [];
      if (r.exp) parts.push(`${r.exp} EXP`);
      if (r.coins) parts.push(`${r.coins} coins`);
      toast(parts.length ? `Unticked · ${parts.join(' · ')}` : 'Unticked');
    } catch (e) { toast(e.message); }
  }

  async function cheer(m) {
    if (m.id === me?.id) return toast('You got this!');
    const last = sentCheers.current[m.id] ?? 0;
    if (Date.now() - last < 30000) return toast(`You just cheered ${m.displayName}`);
    sentCheers.current[m.id] = Date.now();
    try {
      await api.cheer(gid, m.id);
      toast(`You cheered ${m.displayName}`);
    } catch (e) { toast(e.message); }
  }

  return (
    <div className="screen">
      <div className="between">
        <span className="chip"><BoltIcon />{group.exp.toLocaleString()} EXP</span>
        <span className="chip coin"><CoinIcon />{group.coins} coins</span>
      </div>

      <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
        <Link to="/grow" className="pill-link">Level {info.level} · {info.stage.name}<ChevronRight /></Link>
        <Character stage={info.stage.id} equipped={group.equipped ?? []} awake={awake} popKey={popKey} onTap={() => setPopKey((k) => k + 1)} />
        <Link to="/clubs" className="title" style={{ fontSize: 20, textDecoration: 'none', color: 'inherit' }}>{group.name}</Link>
        <span className="muted small">{awake ? 'Bouncing, thanks to you all' : 'Napping. Wake them with a walk?'}</span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="between small" style={{ fontWeight: 800 }}>
          <span>Lv {info.level} → Lv {info.level + 1}</span>
          <span className="muted">{info.into} / {info.need} EXP</span>
        </div>
        <div className="bar"><div style={{ width: `${info.progress * 100}%` }} /></div>
      </div>

      <HeadingOut gid={gid} live={live} myName={session.name} members={members} />

      <div className="stack">
        <div className="between"><p className="label">Today's glow</p>{!alone && <span className="muted small">tap a friend to cheer</span>}</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
          {members.map((m) => (
            <div key={m.id} className="stack center small" style={{ gap: 4, alignItems: 'center', fontWeight: 700 }}>
              <button className={`avatar${isActiveToday(m) ? ' glow' : ''}`} aria-label={`Cheer ${m.displayName}`}
                onClick={() => cheer(m)}>
                {m.displayName.slice(0, 1).toUpperCase()}
              </button>
              {m.id === me?.id ? 'You' : m.displayName}
            </div>
          ))}
          {alone && (
            <div className="stack small" style={{ flex: 1, gap: 4 }}>
              <strong>Invite friends to cheer them on</strong>
              <span className="muted">Share code <strong style={{ letterSpacing: '0.12em' }}>{inviteCode}</strong> from the Clubs tab.</span>
            </div>
          )}
        </div>
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <p className="label">Group goal · today</p>
        <strong style={{ fontSize: 16 }}>Everyone moves {GROUP_GOAL_MINUTES} minutes</strong>
        <div className="bar"><div style={{ width: `${Math.min(1, goal.done / goal.need) * 100}%` }} /></div>
        <span className="muted small">
          {group.goalPaidDate === today ? 'Done for today. +20 coins went to the pot.'
            : `${goal.need - goal.done} more check-in${goal.need - goal.done === 1 ? '' : 's'} finishes it · +20 coins`}
        </span>
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 4 }}><p className="label">My to-do list</p><span className="muted small">no pressure</span></div>
        <label className="todo">
          <input type="checkbox" checked={iWorkedOut}
            onChange={() => (iWorkedOut ? toast('Logged today. Log another from the + button.') : onLog())} />
          <span style={{ flex: 1, fontWeight: 700 }}>Move for {GROUP_GOAL_MINUTES} minutes</span>
          <span className="reward">EXP + 10 c</span>
        </label>
        {WELLNESS_TASKS.map((t) => {
          const done = myWellness.includes(t.id);
          return (
            <label key={t.id} className="todo">
              <input type="checkbox" checked={done} onChange={() => (done ? untick(t.id) : wellness(t.id))} />
              <span style={{ flex: 1, fontWeight: 700 }}>{t.label}</span>
              <span className="reward">+{t.exp ?? WELLNESS_EXP} EXP{(done ? (paid[t.id]?.coins ?? 0) > 0 : myWellness.length < WELLNESS_MAX_PER_DAY) ? ` + ${t.coins} c` : ''}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function HeadingOut({ gid, live, myName, members }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState('walk');
  const [time, setTime] = useState('Now');
  const uid = api.uid();
  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'Someone';

  async function post() {
    await api.headOut(gid, { activity, time, name: myName || nameOf(uid) });
    setOpen(false);
  }

  return (
    <div className="card blue stack">
      {!open ? (
        <button className="btn primary block" style={{ minHeight: 52, fontSize: 16 }} onClick={() => setOpen(true)}>Heading out, who's in?</button>
      ) : (
        <div className="stack">
          <div className="choices">
            {ACTIVITIES.slice(0, 6).map((a) => (
              <button key={a.id} className={`choice${activity === a.id ? ' on' : ''}`} onClick={() => setActivity(a.id)}>{a.label}</button>
            ))}
          </div>
          <div className="seg">
            {['Now', 'In 30 min', 'Tonight'].map((t) => (
              <button key={t} className={time === t ? 'on' : ''} onClick={() => setTime(t)}>{t}</button>
            ))}
          </div>
          <div className="row"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" style={{ flex: 1 }} onClick={post}>Tell the club</button></div>
        </div>
      )}
      {live.slice(0, 3).map((b) => {
        const going = b.going.includes(uid);
        const label = ACTIVITIES.find((a) => a.id === b.activity)?.label ?? b.activity;
        return (
          <div key={b.id} className="row">
            <div className="avatar sm">{b.name.slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.3 }}>
              <strong>{b.uid === uid ? 'You' : b.name}</strong> · {label}, {b.time.toLowerCase()}<br />
              <span className="muted">{b.going.length} going</span>
            </div>
            {!going && <button className="btn small" onClick={() => api.joinBroadcast(gid, b.id)}>I'm in</button>}
            {going && b.uid !== uid && <span className="muted small" style={{ fontWeight: 800 }}>You're in</span>}
          </div>
        );
      })}
    </div>
  );
}
