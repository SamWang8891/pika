import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../theme';
import StatusDot from './StatusDot';
import { useBackend, type Health } from '../backend';
import { hostOf } from '../origin';
import { PIKA_VERSION } from '../../../src/shared/types';
import logoUrl from '../../../public/Pika-full-logo.svg';

const ADMIN_PATHS = ['/admin', '/login', '/logout', '/change_pass'];

export default function Layout() {
  const { dark, toggle } = useTheme();
  const { backend, health } = useBackend();
  const navigate = useNavigate();
  const location = useLocation();
  const [resetKey, setResetKey] = useState(0);

  // Nothing works until a backend is connected — first run lands on Settings.
  if (!backend && location.pathname !== '/settings') return <Navigate to="/settings" replace />;

  function handleLogoClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (!backend) return;
    if (location.pathname === '/') {
      setResetKey((k) => k + 1);
    } else {
      navigate('/');
    }
  }

  return (
    <>
      {/* Header: the web app's floating theme toggle and hidden admin link become toolbar icons */}
      <header style={headerStyle}>
        <a href="#" onClick={handleLogoClick} style={logoLinkStyle} aria-label="Home">
          <img src={logoUrl} alt="Pika" style={logoStyle} />
        </a>
        <nav style={navStyle}>
          <IconButton
            label="Admin panel"
            active={ADMIN_PATHS.includes(location.pathname)}
            disabled={!backend}
            onClick={() => navigate('/admin')}
          >
            <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z" />
          </IconButton>
          <IconButton
            label="Settings"
            active={location.pathname === '/settings'}
            onClick={() => navigate('/settings')}
          >
            <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
          </IconButton>
          <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
            {dark ? (
              <path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Zm326-268Z" />
            ) : (
              <path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z" />
            )}
          </IconButton>
        </nav>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet key={resetKey} />
      </main>

      {/* Footer: which server this popup is talking to, and whether it answers */}
      <footer style={footerStyle}>
        <span style={footerVersionStyle}>v{PIKA_VERSION}</span>
        {backend && (
          <a
            href={backend}
            target="_blank"
            rel="noopener noreferrer"
            style={footerLinkStyle}
            title={healthTitle(health)}
          >
            <StatusDot state={health.state} size={7} />
            <span style={hostStyle}>{hostOf(backend)}</span>
          </a>
        )}
        <a
          href="https://github.com/SamWang8891/pika"
          target="_blank"
          rel="noopener noreferrer"
          style={footerLinkStyle}
          aria-label="SamWang8891/pika on GitHub"
          title="SamWang8891/pika"
        >
          <svg width="16" height="16" viewBox="0 0 98 96" fill="currentColor" style={{ flexShrink: 0 }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
          </svg>
        </a>
      </footer>
    </>
  );
}

function IconButton({ label, active, disabled, onClick, children }: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">{children}</svg>
    </button>
  );
}

function healthTitle(health: Health) {
  if (health.state === 'ok') return `Connected — Pika v${health.info.version}`;
  if (health.state === 'error') return health.error;
  return 'Checking server…';
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 14px 12px',
};

const logoLinkStyle: CSSProperties = {
  display: 'block',
};

const logoStyle: CSSProperties = {
  height: 34,
  width: 'auto',
  display: 'block',
};

const navStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 16,
  padding: '4px 14px 16px',
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
};

const footerVersionStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
};

const footerLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  color: 'var(--text-muted)',
  textDecoration: 'none',
  transition: 'color 0.2s',
};

const hostStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
