import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCheck, changePassword } from '../api';
import { useToast } from '../components/Toast';
import PasswordInput from '../components/PasswordInput';

export default function ChangePassword() {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await adminCheck();
        if (!res.ok) {
          navigate('/login');
          return;
        }
        setChecking(false);
      } catch {
        navigate('/login');
      }
    })();
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newPass || !confirmPass) {
      toast.warn('Please fill in all fields');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Passwords do not match');
      setNewPass('');
      setConfirmPass('');
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(newPass);
      if (res.ok) {
        toast.success(res.data.message || 'Password changed!');
        navigate('/login');
      } else if (res.status === 401) {
        navigate('/login');
      } else {
        toast.error(res.data?.message || 'Failed to change password');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
      setNewPass('');
      setConfirmPass('');
    }
  }

  if (checking) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '50vh' }}>
      <div className="card animate-fade-in-up" style={{ maxWidth: 420, width: '100%' }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>Change Password</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label" htmlFor="new-pass">New Password</label>
            <PasswordInput
              id="new-pass"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="input-label" htmlFor="confirm-pass">Confirm Password</label>
            <PasswordInput
              id="confirm-pass"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
