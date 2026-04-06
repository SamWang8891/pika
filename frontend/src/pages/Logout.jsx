import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api';
import { useToast } from '../components/Toast';

export default function Logout() {
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await logout();
        if (!cancelled) {
          toast.success('Logged out');
          navigate('/');
        }
      } catch {
        if (!cancelled) {
          toast.error('Logout failed');
          navigate('/');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, toast]);

  return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div className="animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
        <h2 style={{ color: 'var(--text-secondary)' }}>Logging out...</h2>
      </div>
    </div>
  );
}
