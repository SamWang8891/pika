// API client for the user-chosen backend. Same calls and envelope handling as
// the web app's src/client/api.ts, but cross-origin: every request sends
// credentials so the admin session cookie (set by /login) rides along — the
// extension's host permission for the backend is what lets Chrome do that.
import type { ApiResponse, ExpiresIn, UrlRecord } from '../../src/shared/types'

export interface ApiResult<T = null> {
  ok: boolean
  status: number
  data: ApiResponse<T>
}

const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function createApi(origin: string) {
  const base = `${origin}/api/v4`

  async function request<T = null>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
    const res = await fetch(`${base}${path}`, { credentials: 'include', ...init })
    // A worker 500 (text/plain) or a Cloudflare edge error (HTML) isn't JSON; fall
    // back to a synthetic envelope so callers can still branch on res.status.
    const data = await res.json().catch(() => ({ message: res.statusText || 'Server error', data: null }) as ApiResponse<T>)
    return { ok: res.ok, status: res.status, data }
  }

  return {
    createRecord: (url: string, customKeyword = '', expiresIn: ExpiresIn = '7d', randomString = false) =>
      request<{ shortened_key: string | null }>('/create_record', json({ url, custom_keyword: customKeyword, expires_in: expiresIn, random_string: randomString })),

    login: (username: string, password: string) => request('/login', json({ username, password })),

    logout: () => request('/logout', { method: 'POST' }),

    async adminCheck(): Promise<{ ok: boolean; status: number }> {
      const res = await fetch(`${base}/admin_check`, { credentials: 'include' })
      return { ok: res.ok, status: res.status }
    },

    changePassword: (currentPass: string, newPass: string) =>
      request('/change_pass', json({ current_pass: currentPass, new_pass: newPass })),

    getAllRecords: () => request<{ records: UrlRecord[] }>('/get_all_records'),

    deleteRecord: (url: string) => request('/delete_record', json({ url }, 'DELETE')),

    // Exact delete by short key (admin row buttons) — skips the server's fuzzy matching.
    deleteRecordByShort: (short: string) => request('/delete_record', json({ short }, 'DELETE')),

    deleteAllRecords: () => request('/delete_all_records', { method: 'DELETE' }),
  }
}

export type Api = ReturnType<typeof createApi>
