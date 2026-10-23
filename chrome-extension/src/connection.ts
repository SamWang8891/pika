// Which Pika server the extension talks to, without React, so the popup and the
// background worker share it. Unlike the web app (always same-origin), the
// backend is user-chosen: it's stored in chrome.storage, needs a host permission
// so requests can carry the admin session cookie, and must pass
// GET /api/v4/health before it's saved.
import type { ApiResponse, HealthData } from '../../src/shared/types'

export const DEFAULT_BACKEND = __PIKA_DEFAULT_BACKEND__

export const BACKEND_KEY = 'backend'
// Set while a connect is waiting on Chrome's permission prompt. On some
// platforms that prompt closes the popup, so the next open finishes the job.
export const PENDING_KEY = 'pendingBackend'
const HEALTH_TIMEOUT_MS = 8000

export type HealthResult = { ok: true; info: HealthData } | { ok: false; error: string }

/** User input → bare origin (Pika serves at the root, so any path is dropped), or null. */
export function normalizeBackend(input: string): string | null {
  let raw = input.trim()
  if (!raw) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`
  try {
    const url = new URL(raw)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) return null
    return url.origin
  } catch {
    return null
  }
}

export const hostOf = (origin: string) => new URL(origin).host

// Chrome match patterns carry no port, so this covers every port on the host.
export function hostPattern(origin: string): string {
  const { protocol, hostname } = new URL(origin)
  return `${protocol}//${hostname}/*`
}

/**
 * Ask for access to `origin`. Must be called synchronously from a click/submit
 * handler: chrome.permissions.request needs the user gesture, which an earlier
 * await would lose. Resolves immediately when access is already granted.
 */
export function requestAccess(origin: string): Promise<boolean> {
  void chrome.storage.local.set({ [PENDING_KEY]: origin })
  return chrome.permissions.request({ origins: [hostPattern(origin)] }).then(async (granted) => {
    if (!granted) await chrome.storage.local.remove(PENDING_KEY)
    return granted
  })
}

// Drop access we no longer need, unless another origin we keep shares the host
// pattern. The build-time default is a required permission and can't be removed.
export async function releaseAccess(origin: string, keep: string[]): Promise<void> {
  const pattern = hostPattern(origin)
  if ([DEFAULT_BACKEND, ...keep].some((o) => o && hostPattern(o) === pattern)) return
  await chrome.permissions.remove({ origins: [pattern] }).catch(() => {})
}

export async function checkHealth(origin: string): Promise<HealthResult> {
  const host = hostOf(origin)
  let res: Response
  try {
    res = await fetch(`${origin}/api/v4/health`, {
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    return { ok: false, error: timedOut ? `${host} took too long to answer.` : `Couldn't reach ${host}.` }
  }
  const body = (await res.json().catch(() => null)) as ApiResponse<Partial<HealthData> | null> | null
  const info = body?.data
  if (info?.service !== 'pika') {
    return { ok: false, error: `${host} isn't a Pika server (or runs a version without /api/v4/health).` }
  }
  if (info.api !== 'v4') return { ok: false, error: `${host} speaks Pika API ${info.api}; this extension needs v4.` }
  if (!info.configured) {
    return { ok: false, error: `${host} is a Pika server, but its SECRET_KEY / BEARER_TOKEN aren't set yet.` }
  }
  return { ok: true, info: info as HealthData }
}

export const hasAccess = (origin: string) => chrome.permissions.contains({ origins: [hostPattern(origin)] })

/** The saved backend, else the build-time default ('' when neither exists). */
export async function loadBackend(): Promise<string> {
  const saved = (await chrome.storage.local.get(BACKEND_KEY))[BACKEND_KEY]
  return typeof saved === 'string' ? saved : DEFAULT_BACKEND
}
