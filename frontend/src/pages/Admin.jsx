import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCheck, getAllRecords, deleteRecord, deleteAllRecords, getWebHostname } from '../api';
import { useToast } from '../components/Toast';

export default function Admin() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(null); // short key being deleted
  const [webHost, setWebHost] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  const fetchRecords = useCallback(async () => {
    try {
      const res = await getAllRecords();
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (res.ok) {
        setRecords(res.data.data.records);
      }
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    (async () => {
      const authRes = await adminCheck();
      if (!authRes.ok) {
        navigate('/login');
        return;
      }
      const host = await getWebHostname();
      setWebHost(host);
      await fetchRecords();
    })();
  }, [navigate, fetchRecords]);

  async function handleDelete(shortKey) {
    setDeleting(shortKey);
    try {
      const stripped = removeBaseUrl(shortKey, webHost);
      const res = await deleteRecord(stripped);
      if (res.status === 401) { navigate('/login'); return; }
      if (res.status === 300) { toast.warn('Multiple records found. Be more specific.'); }
      else if (res.status === 404) { toast.error('Record not found'); }
      else if (!res.ok) { toast.error(res.data?.message || 'Delete failed'); }
      await fetchRecords();
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(null);
    }
  }

  async function handleSearchDelete(e) {
    e.preventDefault();
    const val = deleteInput.trim();
    if (!val) return;
    await handleDelete(val);
    setDeleteInput('');
  }

  async function handlePurgeAll() {
    if (!window.confirm('Are you sure you want to delete ALL records? This cannot be undone.')) return;
    try {
      const res = await deleteAllRecords();
      if (res.status === 401) { navigate('/login'); return; }
      if (res.ok) { toast.success('All records purged'); }
      else { toast.error(res.data?.message || 'Purge failed'); }
      await fetchRecords();
    } catch {
      toast.error('Network error');
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="animate-fade-in-up" style={{ marginBottom: 20, marginTop: 8 }}>Admin Panel</h2>

      {/* Action bar */}
      <div className="card animate-fade-in-up delay-1" style={{ marginBottom: 16 }}>
        <div style={actionBarStyle}>
          <button className="btn btn-secondary" onClick={() => navigate('/logout')}>
            <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z" />
            </svg>
            Logout
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/change_pass')}>
            <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z" />
            </svg>
            Password
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-danger" onClick={handlePurgeAll}>
            <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Z" />
            </svg>
            Purge All
          </button>
        </div>
      </div>

      {/* Search delete */}
      <div className="card animate-fade-in-up delay-2" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearchDelete} style={searchFormStyle}>
          <label className="input-label" style={{ marginBottom: 0 }}>Search to delete</label>
          <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
            <input
              className="input-field"
              type="text"
              placeholder="Original URL, short key, or full link..."
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button type="submit" className="btn btn-danger" style={{ flexShrink: 0 }}>Delete</button>
          </div>
        </form>
      </div>

      {/* Records */}
      <div className="card animate-fade-in-up delay-3">
        <label className="input-label" style={{ marginBottom: 16 }}>
          Redirection URLs ({records.length})
        </label>

        {records.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No records yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="records-table">
              <thead>
                <tr>
                  <th>Original</th>
                  <th>Short</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th style={{ width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.short} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                    <td>
                      <a
                        href={r.orig}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="url-text"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {r.orig}
                      </a>
                    </td>
                    <td>
                      <span className="url-text" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                        {r.short}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {r.created_at ? formatDate(r.created_at) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.expires_at ? (
                        <span className={`badge ${isExpired(r.expires_at) ? 'badge-danger' : isExpiringSoon(r.expires_at) ? 'badge-amber' : 'badge-green'}`}>
                          {isExpired(r.expires_at) ? 'Expired' : formatDate(r.expires_at)}
                        </span>
                      ) : (
                        <span className="badge badge-green">Never</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => handleDelete(r.short)}
                        disabled={deleting === r.short}
                      >
                        {deleting === r.short ? '...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function removeBaseUrl(url, webHost) {
  const noProto = webHost.replace(/^https?:\/\//, '');
  const escaped = noProto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('^(?:https?://)?' + escaped + '/?', 'i');
  return url.replace(pattern, '').replace(/^\//, '');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d <= Date.now();
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const hoursLeft = (d - Date.now()) / (1000 * 60 * 60);
  return hoursLeft < 24 && hoursLeft > 0;
}

const actionBarStyle = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const searchFormStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};
