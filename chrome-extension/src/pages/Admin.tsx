import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiResult } from '../api';
import { useApi, useBackend } from '../backend';
import { useToast } from '../components/Toast';
import type { UrlRecord } from '../../../src/shared/types';

export default function Admin() {
  const [records, setRecords] = useState<UrlRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null); // short key being deleted
  // window.confirm is unreliable in an extension popup, so Purge All confirms inline.
  const [confirmPurge, setConfirmPurge] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const api = useApi();
  const { backend } = useBackend();

  const fetchRecords = useCallback(async () => {
    try {
      const res = await api.getAllRecords();
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (res.ok) {
        setRecords(res.data.data.records);
      } else {
        // Don't let a 5xx pass for an empty list ("No records yet.").
        toast.error(res.data?.message || 'Failed to load records');
      }
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [api, navigate, toast]);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await api.adminCheck();
        if (!authRes.ok) {
          navigate('/login');
          return;
        }
        await fetchRecords();
      } catch {
        // The network dropped — don't strand the page on the loading spinner
        // forever; send the user to login to retry.
        navigate('/login');
      }
    })();
  }, [api, navigate, fetchRecords]);

  async function runDelete(key: string, doDelete: () => Promise<ApiResult>) {
    if (deleting) return; // one delete in flight at a time
    setDeleting(key);
    try {
      const res = await doDelete();
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

  // Row buttons delete the exact record by its short key (no fuzzy matching, so a
  // key that collides with some other record's original URL can't misfire).
  const handleRowDelete = (short: string) => runDelete(short, () => api.deleteRecordByShort(short));

  async function handleSearchDelete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = deleteInput.trim();
    if (!val) return;
    // A full short link names exactly one record, so delete it by key. Anything else
    // (original URL or bare key) keeps the server's fuzzy match.
    const key = shortKeyOf(val, backend);
    await runDelete(val, key ? () => api.deleteRecordByShort(key) : () => api.deleteRecord(val));
    setDeleteInput('');
  }

  async function handlePurgeAll() {
    setConfirmPurge(false);
    try {
      const res = await api.deleteAllRecords();
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
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="animate-fade-in-up" style={{ marginBottom: 14, alignSelf: 'flex-start' }}>Admin Panel</h2>

      {/* Action bar */}
      <div className="card animate-fade-in-up delay-1" style={{ marginBottom: 12, padding: 12 }}>
        {confirmPurge ? (
          <div style={actionBarStyle}>
            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)' }}>
              Delete all {records.length} {records.length === 1 ? 'record' : 'records'}? This can't be undone.
            </span>
            <button className="btn btn-secondary" style={compactBtnStyle} onClick={() => setConfirmPurge(false)} autoFocus>
              Cancel
            </button>
            <button className="btn btn-danger" style={compactBtnStyle} onClick={handlePurgeAll}>
              Delete all
            </button>
          </div>
        ) : (
          <div style={actionBarStyle}>
            <button className="btn btn-secondary" style={compactBtnStyle} onClick={() => navigate('/logout')}>
              <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z" />
              </svg>
              Logout
            </button>
            <button className="btn btn-secondary" style={compactBtnStyle} onClick={() => navigate('/change_pass')}>
              <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z" />
              </svg>
              Password
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-danger" style={compactBtnStyle} onClick={() => setConfirmPurge(true)}>
              <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Z" />
              </svg>
              Purge All
            </button>
          </div>
        )}
      </div>

      {/* Search delete */}
      <div className="card animate-fade-in-up delay-2" style={{ marginBottom: 12 }}>
        <form onSubmit={handleSearchDelete} style={searchFormStyle}>
          <label className="input-label" htmlFor="delete-input" style={{ marginBottom: 0 }}>Search to delete</label>
          <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
            <input
              id="delete-input"
              className="input-field"
              type="text"
              placeholder="Original URL, short key, or link..."
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              style={{ flex: 1, minWidth: 0, marginBottom: 0 }}
              spellCheck={false}
            />
            <button type="submit" className="btn btn-danger" style={{ flexShrink: 0 }}>Delete</button>
          </div>
        </form>
      </div>

      {/* Records — a stacked list instead of the web's table, which needs ~700px */}
      <div className="card animate-fade-in-up delay-3" style={{ paddingBottom: 8 }}>
        <label className="input-label" style={{ marginBottom: 4 }}>
          Redirection URLs ({records.length})
        </label>

        {records.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No records yet.
          </p>
        ) : (
          <ul className="record-list">
            {records.map((r, i) => (
              <li key={r.short} className="record-item animate-fade-in" style={{ animationDelay: `${Math.min(i, 20) * 0.03}s` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={recordTopStyle}>
                    <a
                      href={`${backend}/${r.short}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="url-text"
                      style={{ color: 'var(--accent)', fontWeight: 500 }}
                    >
                      {r.short}
                    </a>
                    {r.expires_at ? (
                      <span className={`badge ${isExpired(r.expires_at) ? 'badge-danger' : isExpiringSoon(r.expires_at) ? 'badge-amber' : 'badge-green'}`}>
                        {isExpired(r.expires_at) ? 'Expired' : formatDate(r.expires_at)}
                      </span>
                    ) : (
                      <span className="badge badge-green">Never</span>
                    )}
                  </div>
                  <a
                    href={r.orig}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="url-text record-orig"
                    title={r.orig}
                  >
                    {r.orig}
                  </a>
                  <div style={recordMetaStyle}>
                    Created {r.created_at ? formatDate(r.created_at) : '—'}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: '5px 12px', fontSize: '0.78rem', flexShrink: 0 }}
                  onClick={() => handleRowDelete(r.short)}
                  disabled={deleting === r.short}
                >
                  {deleting === r.short ? '...' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// "https://<backend host>/<key>" → key. Not stripped down to a bare key for the
// fuzzy match: that tries original URLs first, so a record pointing at
// https://<key> would be deleted instead of the link that was pasted.
function shortKeyOf(input: string, backend: string) {
  const escaped = new URL(backend).host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = input.match(new RegExp('^(?:https?://)?' + escaped + '/([A-Za-z0-9]+)/?$', 'i'));
  return match ? match[1] : null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d.getTime() <= Date.now();
}

function isExpiringSoon(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const hoursLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursLeft < 24 && hoursLeft > 0;
}

const actionBarStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

const compactBtnStyle: CSSProperties = {
  padding: '8px 12px',
  fontSize: '0.8rem',
  gap: 6,
};

const searchFormStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const recordTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 2,
};

const recordMetaStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  marginTop: 2,
};
