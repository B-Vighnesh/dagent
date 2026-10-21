import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

const columns = [
  {
    heading: 'EXPLORE',
    links: [
      ['/#about', 'About dark patterns'],
      ['/#overview', 'Pattern examples'],
      ['/#pipeline', 'Detection pipeline'],
      ['/#roadmap', 'Roadmap'],
      ['/#how-it-works', 'How it works'],
    ],
  },
  {
    heading: 'PRODUCT',
    links: [
      ['/scan', 'Live demo'],
      ['/download', 'Download extension'],
      ['/feedback', 'Give feedback'],
    ],
  },
  {
    heading: 'GET STARTED',
    links: [
      ['/scan', 'Run a scan'],
      ['/download', 'Get the extension'],
    ],
  },
];

function FooterLink({ to, label }) {
  if (to.startsWith('/#')) {
    return <a href={to}>{label}</a>;
  }
  return <Link to={to}>{label}</Link>;
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>Spot the manipulation, choose freely. DAGENT is a browser extension that reasons before it warns you.</p>
        </div>

        {columns.map((column) => (
          <div className="footer-col" key={column.heading}>
            <h4>{column.heading}</h4>
            {column.links.map(([to, label]) => (
              <FooterLink to={to} label={label} key={label} />
            ))}
          </div>
        ))}
      </div>

      <div className="shell footer-bottom">
        <span>&copy; {year} DAGENT. All rights reserved.</span>
        <span className="footer-contact">Mangaluru, Karnataka | <a href="mailto:bvighneshkumar@gmail.com">bvighneshkumar@gmail.com</a></span>
      </div>
    </footer>
  );
}