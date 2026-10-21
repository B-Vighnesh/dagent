import { Link } from 'react-router-dom';

export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Dagent home">
      <img className="brand-mark" src="public/dagent_logo.png" alt="" width="27" height="27" />
      <span>DAGENT</span>
    </Link>
  );
}