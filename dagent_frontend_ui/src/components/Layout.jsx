import { useLocation } from 'react-router-dom';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
export default function Layout({ children }) {
  const location = useLocation();

  return (
    <>
      <Header />
      <main className="page-transition" key={location.pathname}>{children}</main>
      <Footer />
    </>
  );
}
