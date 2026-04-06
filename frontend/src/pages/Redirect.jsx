import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { searchRecord } from '../api';

export default function Redirect() {
  const { shortKey } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timerId;

    (async () => {
      try {
        const res = await searchRecord(shortKey);
        if (cancelled) return;
        if (res.ok && res.data?.data?.original_url) {
          window.location.href = res.data.data.original_url;
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
