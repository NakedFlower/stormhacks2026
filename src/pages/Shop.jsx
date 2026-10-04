// Locker shop: spend the shared coin pot on add-ons.
import { useState } from 'react';
import Character from '../three/Character.jsx';
import { useClub } from '../components/ClubContext.jsx';
import { api } from '../lib/db.js';
import { ITEMS, priceFor, cannotBuy, challengeProgress } from '../lib/items.js';
import { CoinIcon } from '../components/Icons.jsx';

const TIERS = ['common', 'rare', 'legendary'];

export default function Shop() {
  const { gid, group, info, memberCount, toast } = useClub();
  const [tier, setTier] = useState('common');
  const [busy, setBusy] = useState(null);
  if (!group) return null;
  const owned = group.owned ?? [];
  const equipped = group.equipped ?? [];

  async function act(fn, item, msg) {
    setBusy(item.id);
    try { await fn(gid, item.id); toast(msg); } catch (e) { toast(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="screen">
      <div className="between">
        <h1 className="title">Locker</h1>
        <span className="chip coin"><CoinIcon />{group.coins} in our pot</span>
      </div>

      <div className="card row" style={{ gap: 12 }}>
        <Character stage={info.stage.id} equipped={equipped} size={130} />
        <div className="stack small" style={{ gap: 6 }}>
          <div><strong>Wearing</strong><br /><span className="muted">{equipped.length ? equipped.map((id) => ITEMS.find((i) => i.id === id)?.name).join(', ') : 'Nothing yet'}</span></div>
          <span className="muted">Prices scale with club size ({memberCount} {memberCount === 1 ? 'member' : 'members'}).</span>
        </div>
      </div>

      <div className="seg" role="tablist" aria-label="Item tier">
        {TIERS.map((t) => (
          <button key={t} role="tab" aria-selected={tier === t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div className="grid2">
        {ITEMS.filter((i) => i.tier === tier).map((item) => {
          const isOwned = owned.includes(item.id);
          const isOn = equipped.includes(item.id);
          const legendary = item.tier === 'legendary';
          const unlocked = legendary ? challengeProgress(group, item.challenge).done : isOwned;
          const why = legendary ? null : cannotBuy(item, group, info.level, memberCount);
          return (
            <div key={item.id} className="card stack" style={{ gap: 8 }}>
              <div className={`thumb ${item.tier}`}>{item.name}</div>
              <strong>{item.name}</strong>
              <span className="small" style={{ fontWeight: 900 }}>
                {legendary ? (unlocked ? 'Unlocked' : 'Challenge reward') : isOwned ? 'Owned' : `${priceFor(item, memberCount)} coins`}
              </span>
              {unlocked ? (
                <button className={`btn small${isOn ? ' primary' : ''}`} disabled={busy === item.id}
                  onClick={() => act(api.equip, item, isOn ? `Took off the ${item.name.toLowerCase()}` : `Wearing the ${item.name.toLowerCase()}!`)}>
                  {isOn ? 'Equipped' : 'Wear it'}
                </button>
              ) : legendary ? (
                <button className="btn small ghost" disabled>See Grow page</button>
              ) : (
                <button className="btn small pink" disabled={!!why || busy === item.id}
                  onClick={() => act(api.buy, item, `Bought the ${item.name.toLowerCase()}!`)}>
                  {why ?? 'Buy'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
