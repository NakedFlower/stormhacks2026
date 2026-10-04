// Grow: level, evolution path, legendary challenges, this week together.
import Character from '../three/Character.jsx';
import { useClub } from '../components/ClubContext.jsx';
import { STAGES, ACTIVITIES, weeklyGoal, weekKey, WEEKLY_MINUTES_PER_MEMBER } from '../lib/rules.js';
import { ITEMS, challengeProgress } from '../lib/items.js';

function ago(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `${Math.max(1, min)}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

export default function Grow() {
  const { group, members, me, info, workouts } = useClub();
  if (!group) return null;
  const week = weeklyGoal(members);
  const myWeek = me?.weekStart === weekKey() ? me.weekMinutes ?? 0 : 0;
  const legendaries = ITEMS.filter((i) => i.tier === 'legendary');

  return (
    <div className="screen">
      <h1 className="title">Our little guy</h1>

      <div className="card row" style={{ gap: 14 }}>
        <Character stage={info.stage.id} equipped={group.equipped ?? []} size={110} />
        <div className="stack" style={{ flex: 1, gap: 6 }}>
          <strong style={{ fontSize: 22 }}>Level {info.level}</strong>
          <span className="muted small" style={{ fontWeight: 700 }}>Stage: {info.stage.name}</span>
          <div className="bar"><div style={{ width: `${info.progress * 100}%` }} /></div>
          <span className="muted small">{info.into} / {info.need} EXP to Level {info.level + 1}</span>
        </div>
      </div>

      <div className="stack">
        <p className="label">Evolution path</p>
        <div className="timeline">
          {STAGES.map((s) => {
            const reached = info.level >= s.level;
            const current = info.stage.id === s.id;
            return (
              <div key={s.id} className={`stage-row${current ? ' current' : ''}`}>
                <span className={`dot${reached ? ' done' : ''}`} />
                <div className="thumb" style={{ width: 52, height: 52, flex: 'none', fontSize: reached ? 12 : 22 }}>{reached ? s.name : '?'}</div>
                <div style={{ flex: 1, fontSize: 14 }}>
                  <strong>{s.name}</strong> · Lv {s.level}{current && <span style={{ color: 'var(--pink)', fontWeight: 900 }}> · you are here</span>}<br />
                  <span className="muted small">{s.blurb}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stack">
        <div className="between"><p className="label">Legendary challenges</p><span className="muted small">complete to unlock</span></div>
        <div className="card stack" style={{ gap: 14 }}>
          {legendaries.map((item) => {
            const c = challengeProgress(group, item.challenge);
            return (
              <div key={item.id} className="row" style={{ gap: 12 }}>
                <div className="thumb legendary" style={{ width: 52, height: 52, flex: 'none', fontSize: 11 }}>{item.name.split(' ').pop()}</div>
                <div className="stack" style={{ flex: 1, gap: 4, fontSize: 14 }}>
                  <div className="between"><strong>{item.name}</strong>
                    {c.done ? <span style={{ color: 'var(--pink)', fontWeight: 900, fontSize: 12 }}>Unlocked</span>
                      : <span className="muted small">{c.value} / {c.target}</span>}
                  </div>
                  <span className="muted small">{c.label}</span>
                  {!c.done && <div className="bar thin"><div style={{ width: `${(c.value / c.target) * 100}%` }} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card stack">
        <p className="label">This week, together</p>
        <div style={{ fontSize: 28, fontWeight: 900 }}>{week.total} <span style={{ fontSize: 16 }}>active minutes</span></div>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }} className="stack">
          <div className="between small" style={{ fontWeight: 800 }}><span>You · {myWeek} / {WEEKLY_MINUTES_PER_MEMBER} min</span><span className="muted">only you see this</span></div>
          <div className="bar thin"><div style={{ width: `${Math.min(1, myWeek / WEEKLY_MINUTES_PER_MEMBER) * 100}%` }} /></div>
          <span className="muted small">WHO guideline: 150 to 300 active minutes a week</span>
        </div>
      </div>

      <div className="stack" style={{ gap: 0 }}>
        <p className="label" style={{ marginBottom: 6 }}>Recent moments</p>
        {workouts.length === 0 && <p className="muted small">Nothing yet. Log the first walk!</p>}
        {workouts.map((w) => (
          <div key={w.id} className="row" style={{ minHeight: 44, borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <div className="avatar sm">{w.name.slice(0, 1).toUpperCase()}</div>
            <span style={{ flex: 1 }}>{w.uid === me?.id ? 'You' : w.name} went for a {ACTIVITIES.find((a) => a.id === w.type)?.label.toLowerCase() ?? w.type}</span>
            <span className="muted small">{ago(w.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
