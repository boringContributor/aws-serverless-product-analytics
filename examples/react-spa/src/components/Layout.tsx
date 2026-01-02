import { Link, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

export function Layout() {
  const location = useLocation();

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-container">
          <h1 className="logo">Analytics Demo</h1>
          <ul className="nav-links">
            <li>
              <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/products" className={location.pathname === '/products' ? 'active' : ''}>
                Products
              </Link>
            </li>
            <li>
              <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
                Settings
              </Link>
            </li>
          </ul>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <p>Analytics Tracker Demo • Current Route: <code>{location.pathname}</code></p>
      </footer>
    </div>
  );
}
