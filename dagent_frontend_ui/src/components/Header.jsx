import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Brand from './Brand.jsx';
import Icon from './Icon.jsx';
import { ArrowRight } from "lucide-react";
const items = [
  ['/', 'Overview', true],
  ['/download', 'Download'],
  ['/feedback', 'Feedback'],
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell nav">
        <Brand />

        <button
          className={`menu ${open ? 'active' : ''}`}
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className={open ? 'open' : ''} aria-label="Main navigation">
          {items.map(([to, label, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/scan"
            className="mobile-scan-link"
            onClick={() => setOpen(false)}
          >
            Run a scan<Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
          </NavLink>
        </nav>

        <Link to="/scan" className="nav-cta">
          Run a scan <Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
        </Link>
      </div>
    </header>
  );
}
