import { useState, useRef, useEffect } from 'react';
import type { CSSProperties, FormEvent, MouseEvent } from 'react';
import type QRCodeStyling from 'qr-code-styling';
import { useTheme } from '../theme';
import { useToast } from '../components/Toast';
import ExpirySelector from '../components/ExpirySelector';
import { createRecord } from '../api';
import type { ExpiresIn } from '../../shared/types';

interface Result {
  shortenedUrl: string | null;
  originalUrl: string;
  isOriginalQR: boolean;
  isRandom: boolean;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>('7d');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { dark } = useTheme();
  const toast = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstance = useRef<QRCodeStyling | null>(null);

  // Generate QR whenever result changes
  useEffect(() => {
    if (!result || !qrRef.current) return;
    let cancelled = false;

    (async () => {
      const QRCodeStyling = (await import('qr-code-styling')).default;
      if (cancelled || !qrRef.current) return;

      const qrData = result.shortenedUrl || result.originalUrl;
      const dotColor = getComputedStyle(document.documentElement).getPropertyValue('--qr-dot').trim();
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--qr-bg').trim();

      qrInstance.current = new QRCodeStyling({
        width: 400,
        height: 400,
        data: qrData,
        type: 'canvas',
        image: '/icon-QR.png',
        dotsOptions: { color: dotColor, type: 'rounded' },
        backgroundOptions: { color: bgColor },
        imageOptions: { crossOrigin: 'anonymous', margin: 3, imageSize: 0.4, hideBackgroundDots: true },
      });

      qrRef.current.innerHTML = '';
      qrInstance.current.append(qrRef.current);
    })();

    return () => { cancelled = true; };
  }, [result, dark]);

  async function shorten(randomString: boolean) {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes(' ')) {
      toast.error('URL must not contain spaces');
      return;
    }
    const kw = randomString ? '' : keyword.trim();
    if (kw && /[^a-zA-Z0-9]/.test(kw)) {
      toast.error('Custom keyword can only contain letters and numbers');
      return;
    }

    setLoading(true);
    try {
      const res = await createRecord(trimmed, kw, expiresIn, randomString);
      if (!res.ok) {
        toast.error(res.data.message || 'Failed to create link');
        return;
      }
      const shortened = `${location.origin}/${res.data.data.shortened_key}`;
      const origForDisplay = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      setResult({ shortenedUrl: shortened, originalUrl: origForDisplay, isOriginalQR: false, isRandom: randomString });
      setUrl('');
      setKeyword('');
      toast.success('Link created!');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleShorten(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void shorten(false);
  }

  function handleOriginalQR(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes(' ')) {
      toast.error('URL must not contain spaces');
      return;
    }
    const origUrl = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    setResult({ shortenedUrl: null, originalUrl: origUrl, isOriginalQR: true, isRandom: false });
    setUrl('');
    toast.success('QR code generated!');
  }

  async function handleCopy() {
    if (!result) return;
    const text = result.shortenedUrl || result.originalUrl;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // navigator.clipboard is undefined on non-secure origins (plain HTTP/LAN),
        // where accessing it directly would throw before any .catch could fire.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy command failed');
      }
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed. Please copy manually.');
    }
  }

  return (
    <div className="page">
      {/* URL Input Card */}
      <div className="card animate-fade-in-up" style={{ marginTop: 16 }}>
        <form onSubmit={handleShorten}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="input-label" htmlFor="url-input">Paste your URL</label>
              <input
                id="url-input"
                className="input-field"
                type="text"
                placeholder="https://example.com/very-long-url..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="input-label" htmlFor="keyword-input">Custom keyword (optional)</label>
              <input
                id="keyword-input"
                className="input-field"
                type="text"
                placeholder="mycustomword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <ExpirySelector value={expiresIn} onChange={setExpiresIn} />

            <div style={buttonRowStyle}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (
                  <>
                    <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h320v80H320Zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H520Z" />
                    </svg>
                    Shorten
                  </>
                )}
              </button>
              <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void shorten(true)}>
                <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z" />
                </svg>
                Shorten with random string
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleOriginalQR}>
                <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M120-520v-320h320v320H120Zm80-80h160v-160H200v160Zm-80 480v-320h320v320H120Zm80-80h160v-160H200v160Zm320-320v-320h320v320H520Zm80-80h160v-160H600v160ZM760-120v-80h80v80h-80Zm-240-160v-80h80v80h-80Zm80 80v-80h80v80h-80Zm-80 80v-80h80v80h-80Zm80 0v-80h80v80h-80Zm80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm80 80v-80h80v80h-80Z" />
                </svg>
                QR Only
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Result Card */}
      {result && (
        <div className="card animate-scale-in" style={{ marginTop: 20, textAlign: 'center' }}>
          {/* Non-ASCII warning */}
          {/[^\x00-\x7F]/.test(result.originalUrl) && (
            <div style={warningBoxStyle} className="animate-fade-in">
              <span className="warning-text">Your URL contains non-ASCII characters. Please verify it!</span>
            </div>
          )}

          {/* Original URL */}
          <a
            href={result.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="url-text"
            style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 16 }}
          >
            {result.originalUrl}
          </a>

          {/* Arrow */}
          {result.shortenedUrl && (
            <div className="animate-bounce-in" style={{ margin: '4px 0 16px', color: 'var(--text-muted)' }}>
              <svg width="36" height="36" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M480-200 240-440l56-56 184 183 184-183 56 56-240 240Zm0-240L240-680l56-56 184 183 184-183 56 56-240 240Z" />
              </svg>
            </div>
          )}

          {/* Shortened URL + Copy */}
          {result.shortenedUrl && (
            <div style={resultRowStyle} className="animate-fade-in-up delay-2">
              <button
                onClick={handleCopy}
                className="btn btn-primary btn-icon"
                title="Copy to clipboard"
              >
                <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Z" />
                </svg>
              </button>
              <a
                href={result.shortenedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="url-big"
              >
                {result.shortenedUrl.slice(0, result.shortenedUrl.lastIndexOf('/') + 1)}
                <code className="key-chip">{result.shortenedUrl.slice(result.shortenedUrl.lastIndexOf('/') + 1)}</code>
              </a>
              {result.isRandom && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>all lowercase</span>
              )}
            </div>
          )}

          {/* QR code */}
          <div
            ref={qrRef}
            className="qr-container animate-bounce-in delay-3"
            style={qrContainerStyle}
          />
        </div>
      )}
    </div>
  );
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const warningBoxStyle: CSSProperties = {
  background: 'var(--amber-soft)',
  border: '1.5px solid var(--amber)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 16px',
  marginBottom: 16,
  textAlign: 'center',
};

const resultRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  flexWrap: 'wrap',
  marginBottom: 24,
};

const qrContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  margin: '8px auto 0',
  width: '100%',
  maxWidth: 280,
  overflow: 'hidden',
};
