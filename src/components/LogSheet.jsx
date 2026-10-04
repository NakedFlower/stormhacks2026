// Log a workout in two taps: pick activity, Save. Everything else has a default.
import { useState } from 'react';
import { ACTIVITIES, INTENSITY, MOODS, activityExp, DAILY_EXP_CAP } from '../lib/rules.js';
import { api } from '../lib/db.js';
import { useClub } from './ClubContext.jsx';

const MINUTE_PRESETS = [10, 20, 30, 45, 60];

export default function LogSheet({ onClose }) {
  const { gid, toast, me } = useClub();
  const [type, setType] = useState('walk');
  const [minutes, setMinutes] = useState(20);
  const [intensity, setIntensity] = useState('light');
  const [sets, setSets] = useState(0);
  const [mood, setMood] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const activity = ACTIVITIES.find((a) => a.id === type);
  const preview = activityExp({ minutes, intensity, sets });
  const room = Math.max(0, DAILY_EXP_CAP - (me?.todayExp ?? 0));

  const pick = (a) => { setType(a.id); setIntensity(a.intensity); if (!a.usesSets) setSets(0); };

  async function save() {
    setBusy(true); setError(null);
    try {
      const r = await api.logWorkout(gid, { type, minutes: Number(minutes), intensity, sets: Number(sets), mood });
      toast(r.capped
        ? `+${r.exp} EXP (daily cap reached) · +${r.coins} coins`
        : `+${r.exp} EXP · +${r.coins} coins. Nice one!`);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Log an activity" onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2 className="title" style={{ fontSize: 22 }}>Log an activity</h2>
          <button className="btn ghost small" onClick={onClose}>Close</button>
        </div>

        <div className="stack">
          <p className="label">What did you do?</p>
          <div className="choices">
            {ACTIVITIES.map((a) => (
              <button key={a.id} className={`choice${type === a.id ? ' on' : ''}`} onClick={() => pick(a)}>{a.label}</button>
            ))}
          </div>
        </div>

        <div className="stack">
          <p className="label">Minutes</p>
          <div className="choices">
            {MINUTE_PRESETS.map((m) => (
              <button key={m} className={`choice${Number(minutes) === m ? ' on' : ''}`} onClick={() => setMinutes(m)}>{m}</button>
            ))}
            <input className="input" style={{ width: 90, minHeight: 40 }} type="number" min="1" max="300" inputMode="numeric"
              aria-label="Custom minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        </div>

        {activity?.usesSets && (
          <label className="field">Sets (optional)
            <input className="input" type="number" min="0" max="50" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </label>
        )}

        <div className="stack">
          <p className="label">How hard?</p>
          <div className="seg">
            {Object.keys(INTENSITY).map((k) => (
              <button key={k} className={intensity === k ? 'on' : ''} onClick={() => setIntensity(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
        </div>

        <div className="stack">
          <p className="label">How do you feel? (optional)</p>
          <div className="seg">
            {MOODS.map((m) => (
              <button key={m} className={mood === m ? 'on' : ''} onClick={() => setMood(mood === m ? null : m)}>{m[0].toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
        </div>

        <p className="muted small center" style={{ margin: 0 }}>
          About +{Math.min(preview, room)} EXP for the group{preview > room ? ' (you hit today’s cap)' : ''} and +10 coins
        </p>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <button className="btn pink block" style={{ minHeight: 52 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}
