import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../theme';

export default function Layout() {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [resetKey, setResetKey] = useState(0);

  function handleLogoClick(e) {
    e.preventDefault();
    if (location.pathname === '/') {
      setResetKey((k) => k + 1);
    } else {
      navigate('/');
    }
  }

  return (
    <>
      {/* Header */}
      <header style={headerStyle}>
        <a href="/" onClick={handleLogoClick} style={logoLinkStyle}>
          <img
            src="/Pika-full-logo.svg"
            alt="Pika"
            style={logoStyle}
          />
        </a>
      </header>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        style={themeToggleStyle}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
      >
        {dark ? (
          <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Zm326-268Z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z" />
          </svg>
        )}
      </button>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet key={resetKey} />
      </main>

      {/* Hidden admin access */}
      <Link
        to="/admin"
        style={hiddenAdminStyle}
        aria-label="Admin panel"
      />

      {/* Footer */}
      <footer style={footerStyle}>
        <span style={footerVersionStyle}>v3.0.0</span>
        <a
          href="https://github.com/SamWang8891/pika"
          target="_blank"
          rel="noopener noreferrer"
          style={footerLinkStyle}
        >
          <svg width="16" height="16" viewBox="0 0 98 96" fill="currentColor" style={{ flexShrink: 0 }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
          </svg>
          SamWang8891/pika
        </a>
      </footer>
    </>
  );
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'center',
  padding: '28px 20px 8px',
};

const logoLinkStyle = {
  display: 'block',
  transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
};

const logoStyle = {
  height: 56,
  width: 'auto',
  display: 'block',
};

const themeToggleStyle = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 100,
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '1.5px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'var(--shadow-md)',
  transition: 'all 0.3s',
};

const footerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 20,
  padding: '24px 20px',
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
};

const footerVersionStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.75rem',
};

const footerLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--text-muted)',
  textDecoration: 'none',
  transition: 'color 0.2s',
};

const hiddenAdminStyle = {
  display: 'block',
  width: 40,
  height: 40,
  margin: '0 auto',
  opacity: 0,
};
