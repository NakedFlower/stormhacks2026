// First screen: pick a name, then start a club or join one with a code.
// No passwords: Firebase anonymous sign-in keeps you signed in on this device.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, rememberClub, useSession } from '../lib/db.js';

export default function Join({ canGoBack = false }) {
  const session = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState(session.name ?? '');
  const [clubName, setClubName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('join');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Add your name so friends know who you are.');
    setBusy(true); setError(null);
    try {
      const club = mode === 'create'
        ? await api.createClub(clubName.trim() || `${name.trim()}'s club`, name.trim())
        : await api.joinClub(code, name.trim());
      rememberClub(club, name.trim());
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={submit} style={{ justifyContent: 'center' }}>
      <div className="center stack" style={{ alignItems: 'center' }}>
        <div className="blob" style={{ width: 96, height: 96 }} />
        <h1 className="title" style={{ fontSize: 34 }}>Fitkin</h1>
        <p className="muted" style={{ margin: 0 }}>Raise a little guy together.<br />Move with friends, no pressure.</p>
      </div>

      {api.mode === 'demo' && (
        <p className="banner">Demo mode: data stays in this browser. Open a second tab to be a second friend.</p>
      )}

      <label className="field">Your name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="given-name" />
      </label>

      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>Join a club</button>
        <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Start a club</button>
      </div>

      {mode === 'join' ? (
        <label className="field">Invite code
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6}
            placeholder="ABC123" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }} autoCapitalize="characters" />
        </label>
      ) : (
        <label className="field">Club name
          <input className="input" value={clubName} onChange={(e) => setClubName(e.target.value)} maxLength={30} placeholder="Thunder Campus Crew" />
        </label>
      )}

      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn primary block" style={{ minHeight: 52 }} disabled={busy}>
        {busy ? 'One sec…' : mode === 'join' ? 'Join club' : 'Start club'}
      </button>
      {canGoBack && <button type="button" className="btn ghost block" onClick={() => navigate(-1)}>Back</button>}
    </form>
  );
}
