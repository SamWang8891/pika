// Same-origin API client. The worker serves both the SPA and /api/v4, so the
// old conf.yaml runtime-config mechanism is gone; shortened links display as
// `${location.origin}/${key}`.
import type { ApiResponse, ExpiresIn, UrlRecord } from '../shared/types'

const BASE = '/api/v4'

export interface ApiResult<T = null> {
  ok: boolean
  status: number
  data: ApiResponse<T>
}

async function request<T = null>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, init)
  const data = (await res.json()) as ApiResponse<T>
  return { ok: res.ok, status: res.status, data }
}

const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const createRecord = (url: string, customKeyword = '', expiresIn: ExpiresIn = '7d', randomString = false) =>
  request<{ shortened_key: string | null }>('/create_record', json({ url, custom_keyword: customKeyword, expires_in: expiresIn, random_string: randomString }))

export const searchRecord = (shortKey: string) =>
  request<{ original_url: string | null }>(`/search_record?${new URLSearchParams({ short_key: shortKey })}`)

export const login = (username: string, password: string) => request('/login', json({ username, password }))

export const logout = () => request('/logout', { method: 'POST' })

export async function adminCheck(): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${BASE}/admin_check`)
  return { ok: res.ok, status: res.status }
}

export const changePassword = (currentPass: string, newPass: string) =>
  request('/change_pass', json({ current_pass: currentPass, new_pass: newPass }))

export const getAllRecords = () => request<{ records: UrlRecord[] }>('/get_all_records')

export const deleteRecord = (url: string) => request('/delete_record', json({ url }, 'DELETE'))

export const deleteAllRecords = () => request('/delete_all_records', { method: 'DELETE' })
