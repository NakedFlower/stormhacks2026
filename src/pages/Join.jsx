// Screen for starting a club or joining one with an invite code.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, rememberClub, useSession, useAuth } from '../lib/db.js';

export default function Join({ canGoBack = false }) {
  const session = useSession();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const defaultName = session.name || user?.displayName || (user?.email ? user.email.split('@')[0] : '');
  const [name, setName] = useState(defaultName);
  const [clubName, setClubName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('join');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Modal state when a new club is created
  const [createdClub, setCreatedClub] = useState(null);
  const [copied, setCopied] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Add your name so friends know who you are.');
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        const club = await api.createClub(clubName.trim() || `${name.trim()}'s club`, name.trim());
        // Show celebration modal with the generated invite code
        setCreatedClub({ ...club, displayName: name.trim() });
      } else {
        const club = await api.joinClub(code, name.trim());
        rememberClub(club, name.trim());
        navigate('/');
      }
    } catch (err) {
      setError(err.message === 'No club has that invite code.' ? 'No club has that invite code.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyCode() {
    if (!createdClub?.inviteCode) return;
    const text = createdClub.inviteCode;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleEnterClub() {
    if (createdClub) {
      rememberClub(createdClub, createdClub.displayName);
      navigate('/');
    }
  }

  return (
    <>
      <form className="screen" onSubmit={submit} style={{ justifyContent: 'center' }}>
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="blob" style={{ width: 96, height: 96 }} />
          <h1 className="title" style={{ fontSize: 34 }}>Fitkin</h1>
          <p className="muted" style={{ margin: 0 }}>
            Raise a little guy together.<br />Move with friends, no pressure.
          </p>
        </div>

        {api.mode === 'demo' && (
          <p className="banner">Demo mode: data stays in this browser. Open a second tab to be a second friend.</p>
        )}

        <label className="field">
          Your name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Alex"
            autoComplete="given-name"
          />
        </label>

        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={mode === 'join' ? 'on' : ''}
            onClick={() => { setMode('join'); setError(null); }}
          >
            Join a club
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={mode === 'create' ? 'on' : ''}
            onClick={() => { setMode('create'); setError(null); }}
          >
            Start a club
          </button>
        </div>

        {mode === 'join' ? (
          <label className="field">
            Invite code
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}
              autoCapitalize="characters"
            />
          </label>
        ) : (
          <label className="field">
            Club name
            <input
              className="input"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              maxLength={30}
              placeholder="Thunder Campus Crew"
            />
          </label>
        )}

        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

        <button className="btn primary block" style={{ minHeight: 52 }} disabled={busy}>
          {busy ? 'One sec…' : mode === 'join' ? 'Join club' : 'Start club'}
        </button>

        {canGoBack ? (
          <button type="button" className="btn ghost block" onClick={() => navigate(-1)}>
            Back
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost small block"
            style={{ marginTop: 8, color: 'var(--muted)', border: 'none' }}
            onClick={() => signOut()}
          >
            Sign out (use another account)
          </button>
        )}
      </form>

      {/* Group Creation Celebration Modal */}
      {createdClub && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ gap: 16 }}>
            <div className="blob" style={{ width: 72, height: 72, margin: '0 auto' }} />
            <div>
              <h2 className="title" style={{ fontSize: 22, margin: '0 0 6px' }}>🎉 Club created!</h2>
              <p className="muted small" style={{ margin: 0 }}>
                Invite friends to <strong>"{createdClub.name}"</strong>.<br />
                Share this 6-letter code so they can join!
              </p>
            </div>

            <div className="code-display">
              {createdClub.inviteCode}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ minHeight: 48 }}
              onClick={handleCopyCode}
            >
              {copied ? '✓ Invite code copied!' : '📋 Copy invite code'}
            </button>

            <button
              type="button"
              className="btn pink block"
              style={{ minHeight: 48 }}
              onClick={handleEnterClub}
            >
              Start our club →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
