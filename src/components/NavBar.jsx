import { NavLink } from 'react-router-dom';
import { HomeIcon, GrowIcon, ShopIcon, ClubsIcon, PlusIcon } from './Icons.jsx';

const cls = ({ isActive }) => `tab${isActive ? ' active' : ''}`;

export default function NavBar({ onLog }) {
  return (
    <nav className="tabs" aria-label="Main">
      <NavLink to="/" end className={cls}><HomeIcon />Home</NavLink>
      <NavLink to="/grow" className={cls}><GrowIcon />Grow</NavLink>
      <div className="stack" style={{ gap: 2, alignItems: 'center' }}>
        <button className="logbtn" onClick={onLog} aria-label="Log an activity"><PlusIcon /></button>
        <span className="tab" style={{ minHeight: 0 }}>Log</span>
      </div>
      <NavLink to="/shop" className={cls}><ShopIcon />Shop</NavLink>
      <NavLink to="/clubs" className={cls}><ClubsIcon />Clubs</NavLink>
    </nav>
  );
}
