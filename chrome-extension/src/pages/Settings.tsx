import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../backend';
import { DEFAULT_BACKEND, hostOf, normalizeBackend, requestAccess, type HealthResult } from '../connection';
import StatusDot from '../components/StatusDot';
import { useToast } from '../components/Toast';

export default function Settings() {
  const { backend, health, connect } = useBackend();
  const [input, setInput] = useState(backend || DEFAULT_BACKEND);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const firstRun = !backend;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const origin = normalizeBackend(input);
    if (!origin) {
      toast.error('Enter a valid http(s) address, e.g. https://pika.example.com');
      return;
    }
    setBusy(true);
    // No await before requestAccess: the permission prompt needs this submit's user gesture.
    requestAccess(origin)
      .then((granted): Promise<HealthResult> | HealthResult =>
        granted ? connect(origin) : { ok: false, error: `Pika needs access to ${hostOf(origin)} to use it.` })
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setInput(origin);
        toast.success(`Connected to ${hostOf(origin)}`);
        if (firstRun) navigate('/');
      })
      .catch(() => toast.error('Something went wrong. Please try again.'))
      .finally(() => setBusy(false));
  }

  return (
    <div className="page">
      <div className="card animate-fade-in-up">
        <h2 style={{ marginBottom: 8 }}>{firstRun ? 'Connect to Pika' : 'Settings'}</h2>
        <p style={introStyle}>
          {firstRun
            ? 'Point the extension at your Pika server — the address you open the Pika web app at.'
            : 'The Pika server this extension shortens links with.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="input-label" htmlFor="backend-input">Backend server</label>
          <input
            id="backend-input"
            className="input-field"
            type="text"
            inputMode="url"
            placeholder="https://pika.example.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus={firstRun}
            spellCheck={false}
            autoComplete="url"
          />
          <p className="hint">
            Chrome asks to let Pika access the site, then the server is checked to confirm it runs Pika before it's saved.
          </p>

          <div style={buttonRowStyle}>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ flex: 1 }}>
              {busy ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Connect'}
            </button>
            {DEFAULT_BACKEND && normalizeBackend(input) !== DEFAULT_BACKEND && (
              <button type="button" className="btn btn-secondary" onClick={() => setInput(DEFAULT_BACKEND)}>
                Use default
              </button>
            )}
          </div>
        </form>

        {backend && (
          <div style={statusBoxStyle} className="animate-fade-in" role="status">
            <StatusDot state={health.state} size={9} />
            <div style={{ minWidth: 0 }}>
              <div className="url-text" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{hostOf(backend)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {health.state === 'ok' && `Connected · Pika v${health.info.version}`}
                {health.state === 'checking' && 'Checking…'}
                {health.state === 'error' && health.error}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const introStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.88rem',
  lineHeight: 1.5,
  marginBottom: 18,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 16,
};

const statusBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 18,
  padding: '12px 14px',
  background: 'var(--bg-tertiary)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--radius-md)',
};
