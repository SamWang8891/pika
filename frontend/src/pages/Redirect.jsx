import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { searchRecord } from '../api';

export default function Redirect() {
  const { shortKey } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [maskedUrl, setMaskedUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timerId;

    (async () => {
      try {
        const res = await searchRecord(shortKey);
        if (cancelled) return;
        if (res.ok && res.data?.data?.original_url && /^https?:\/\//i.test(res.data.data.original_url)) {
          if (res.data.data.mask) {
            setMaskedUrl(res.data.data.original_url);
          } else {
            window.location.href = res.data.data.original_url;
          }
        } else {
          setError(true);
          timerId = setTimeout(() => navigate('/'), 2000);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          timerId = setTimeout(() => navigate('/'), 2000);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [shortKey, navigate]);

  if (maskedUrl) {
    return (
      <iframe
        src={maskedUrl}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', border: 'none', zIndex: 9999 }}
        title="Masked content"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    );
  }

  return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div className="animate-fade-in" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Link not found</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting to home...</p>
          </>
        ) : (
          <>
            <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
            <h2 style={{ color: 'var(--text-secondary)' }}>Redirecting...</h2>
          </>
        )}
      </div>
    </div>
  );
}
