import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useToast } from '../components/Toast';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.warn('Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.ok) {
        toast.success('Logged in!');
        navigate('/admin');
      } else if (res.status === 401) {
        toast.error('Wrong username or password');
      } else {
        toast.error(res.data?.message || 'Login failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '50vh' }}>
      <div className="card animate-fade-in-up" style={{ maxWidth: 420, width: '100%' }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>Login</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label" htmlFor="login-user">Username</label>
            <input
              id="login-user"
              className="input-field"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="login-pass">Password</label>
            <PasswordInput
              id="login-pass"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
