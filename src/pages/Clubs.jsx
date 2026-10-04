// Clubs: my clubs + invite code, this week's club goal, and the showcase.
// The showcase has no rankings: newest activity first, that's all.
import { Link } from 'react-router-dom';
import { useClub } from '../components/ClubContext.jsx';
import { useSession, setSession, useShowcase, useAuth } from '../lib/db.js';
import { weeklyGoal, clubLevel } from '../lib/rules.js';
import { ITEMS } from '../lib/items.js';

function lastSeen(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 15) return 'Moving now';
  if (min < 60) return `Active ${min} min ago`;
  if (min < 1440) return `Active ${Math.round(min / 60)}h ago`;
  return 'Napping';
}

export default function Clubs() {
  const { gid, group, members, inviteCode, toast } = useClub();
  const session = useSession();
  const { user, signOut } = useAuth();
  const showcase = useShowcase();
  if (!group) return null;
  const week = weeklyGoal(members);

  async function share() {
    const text = `Join my Fitkin club "${group.name}" with code ${inviteCode}: ${window.location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Invite copied'); }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="screen">
      <h1 className="title">Clubs</h1>

      <div className="card stack">
        <p className="label">My clubs</p>
        {session.clubs.map((c) => (
          <div key={c.id} className="between">
            <strong>{c.name}</strong>
            {c.id === gid
              ? <span style={{ color: 'var(--pink)', fontWeight: 900, fontSize: 13 }}>Current</span>
              : <button className="btn small" onClick={() => setSession({ current: c.id })}>Switch</button>}
          </div>
        ))}
        <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <span className="small">Invite code <strong style={{ letterSpacing: '0.15em', fontSize: 16 }}>{inviteCode}</strong></span>
          <button className="btn small primary" onClick={share}>Invite friends</button>
        </div>
        <Link to="/join" className="btn ghost block">Join or start another club</Link>
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <p className="label">My account</p>
        <div className="between">
          <div>
            <strong>{user?.displayName || 'Signed in'}</strong>
            {user?.email && <p className="muted small" style={{ margin: 0 }}>{user.email}</p>}
          </div>
          <button type="button" className="btn small ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>

      <div className="card pink stack" style={{ gap: 8 }}>
        <p className="label">Our club goal · this week</p>
        <strong style={{ fontSize: 16 }}>Move {week.target} minutes together</strong>
        <div className="bar"><div style={{ width: `${week.progress * 100}%` }} /></div>
        <span className="muted small">{week.total} so far · {Math.max(0, week.target - week.total)} to go</span>
      </div>

      <div className="between"><p className="label">Showcase</p><span className="muted small">no rankings, just vibes</span></div>
      <div className="grid2">
        {showcase.map((c) => {
          const { stage } = clubLevel(c);
          const outfit = (c.equipped ?? []).map((id) => ITEMS.find((i) => i.id === id)?.name.toLowerCase()).filter(Boolean);
          return (
            <div key={c.id} className="card stack" style={{ gap: 4 }}>
              <div className="thumb" style={{ height: 96 }}><img src="/logo.png" alt="" width="80" height="80" style={{ transform: `scale(${0.7 + ['baby', 'kid', 'teen', 'adult'].indexOf(stage.id) * 0.12})` }} /></div>
              <strong style={{ fontSize: 15 }}>{c.name}{c.id === gid ? ' (us)' : ''}</strong>
              <span className="muted small">{stage.name}{outfit.length ? ` · ${outfit.join(', ')}` : ''}</span>
              <span className="small" style={{ fontWeight: 800, color: Date.now() - c.lastActiveAt < 900000 ? 'var(--pink)' : 'var(--muted)' }}>{lastSeen(c.lastActiveAt)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
