// Authentication screen: Email/Password (Sign in / Sign up) and Google sign-in.
import { useState } from 'react';
import { useAuth, setSession } from '../lib/db.js';

function friendlyAuthError(err) {
  if (!err) return null;
  const msg = err.message || '';
  const code = err.code || '';
  if (code.includes('email-already-in-use')) return 'An account with this email already exists. Please sign in.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password.';
  }
  if (code.includes('popup-closed-by-user')) return 'Google sign-in popup was closed. Please try again.';
  if (code.includes('network-request-failed')) return 'Network error. Please check your connection.';
  if (code.includes('operation-not-allowed')) {
    return 'This sign-in method is not enabled in Firebase console.';
  }
  return msg || 'Sign in failed. Please try again.';
}

export default function Auth() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError('Please enter your email.');
    if (!password) return setError('Please enter your password.');

    if (mode === 'signup') {
      if (!displayName.trim()) return setError('Add your name so friends know who you are.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, displayName.trim());
        // Firebase sets the profile name a moment after sign-up, so hand it to the join screen directly.
        setSession({ name: displayName.trim() });
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="center stack" style={{ alignItems: 'center' }}>
        <div className="blob" style={{ width: 96, height: 96 }} />
        <h1 className="title" style={{ fontSize: 34 }}>Fitkin</h1>
        <p className="muted" style={{ margin: 0 }}>
          Raise a little guy together.<br />Move with friends, no pressure.
        </p>
      </div>

      <div className="seg" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'on' : ''}
          onClick={() => { setMode('signin'); setError(null); }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'on' : ''}
          onClick={() => { setMode('signup'); setError(null); }}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleEmailSubmit} className="stack" style={{ gap: 12 }}>
        {mode === 'signup' && (
          <label className="field">
            Your name
            <input
              className="input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex"
              maxLength={20}
              autoComplete="name"
              disabled={busy}
            />
          </label>
        )}

        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
            autoComplete="email"
            disabled={busy}
          />
        </label>

        <label className="field">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={busy}
          />
        </label>

        {error && <p className="error small" style={{ margin: '4px 0 0' }}>{error}</p>}

        <button type="submit" className="btn primary block" style={{ minHeight: 50, marginTop: 4 }} disabled={busy}>
          {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="divider">or</div>

      <button
        type="button"
        className="btn google block"
        style={{ minHeight: 48 }}
        onClick={handleGoogleSignIn}
        disabled={busy}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27A7.18 7.18 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.987 11.987 0 0 0 0 12c0 1.94.46 3.77 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>
    </div>
  );
}
