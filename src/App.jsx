// App shell: phone frame, routes, bottom nav, log sheet.
// Owner: Akam. Shared file: say so in the team chat before editing.
import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, useReady, useSession } from './lib/db.js';
import { ClubProvider } from './components/ClubContext.jsx';
import NavBar from './components/NavBar.jsx';
import LogSheet from './components/LogSheet.jsx';
import Join from './pages/Join.jsx';
import Home from './pages/Home.jsx';
import Grow from './pages/Grow.jsx';
import Shop from './pages/Shop.jsx';
import Clubs from './pages/Clubs.jsx';

function Phone({ children }) {
  return (
    <div className="stage">
      <aside className="desk-note">
        <h1>Fitkin</h1>
        <p>Raise a little guy together. Fitkin is made for phones; this is the phone view on a bigger screen.</p>
        <p>{api.mode === 'demo' ? 'Demo mode: open a second tab to join as a second friend and watch both screens sync.' : 'Scan or open this link on your phone to join.'}</p>
      </aside>
      <main className="phone">{children}</main>
    </div>
  );
}

export default function App() {
  const { uid, error } = useReady();
  const session = useSession();
  const [logOpen, setLogOpen] = useState(false);

  if (error) return <Phone><div className="screen center"><p className="error">Couldn't sign in: {error.message}</p></div></Phone>;
  if (!uid) return <Phone><div className="screen center muted">Waking up…</div></Phone>;

  if (!session.current) {
    return (
      <Phone>
        <Routes><Route path="*" element={<Join />} /></Routes>
      </Phone>
    );
  }

  return (
    <Phone>
      <ClubProvider key={session.current} gid={session.current}>
        <Routes>
          <Route path="/" element={<Home onLog={() => setLogOpen(true)} />} />
          <Route path="/grow" element={<Grow />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/join" element={<Join canGoBack />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NavBar onLog={() => setLogOpen(true)} />
        {logOpen && <LogSheet onClose={() => setLogOpen(false)} />}
      </ClubProvider>
    </Phone>
  );
}
