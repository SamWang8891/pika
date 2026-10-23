// Which Pika server the extension talks to. Unlike the web app (always
// same-origin), the backend is user-chosen: it's stored in chrome.storage, needs
// a host permission so the popup can fetch it with the admin session cookie,
// and must pass GET /api/v4/health before it's saved.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ApiResponse, HealthData } from '../../src/shared/types'
import { useToast } from './components/Toast'

export const DEFAULT_BACKEND = __PIKA_DEFAULT_BACKEND__

const BACKEND_KEY = 'backend'
// Set while a connect is waiting on Chrome's permission prompt. On some
// platforms that prompt closes the popup, so the next open finishes the job.
const PENDING_KEY = 'pendingBackend'
const HEALTH_TIMEOUT_MS = 8000

export type HealthResult = { ok: true; info: HealthData } | { ok: false; error: string }
export type Health = { state: 'checking' } | { state: 'ok'; info: HealthData } | { state: 'error'; error: string }

interface BackendValue {
  backend: string // origin, '' until the user connects one
  health: Health
  connect: (origin: string) => Promise<HealthResult>
}

const BackendContext = createContext<BackendValue | null>(null)

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
function hostPattern(origin: string): string {
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
async function releaseAccess(origin: string, keep: string[]): Promise<void> {
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

export function BackendProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<string | null>(null) // null while reading storage
  const [health, setHealth] = useState<Health>({ state: 'checking' })
  const backendRef = useRef('')
  const toast = useToast()

  const connect = useCallback(async (origin: string): Promise<HealthResult> => {
    const result = await checkHealth(origin)
    await chrome.storage.local.remove(PENDING_KEY)
    const prev = backendRef.current
    if (!result.ok) {
      await releaseAccess(origin, [prev])
      return result
    }
    await chrome.storage.local.set({ [BACKEND_KEY]: origin })
    backendRef.current = origin
    setBackend(origin)
    setHealth({ state: 'ok', info: result.info }) // reconnecting the same origin won't re-run the check below
    if (prev && prev !== origin) await releaseAccess(prev, [origin])
    return result
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = await chrome.storage.local.get([BACKEND_KEY, PENDING_KEY])
      if (cancelled) return
      const saved = stored[BACKEND_KEY]
      backendRef.current = typeof saved === 'string' ? saved : DEFAULT_BACKEND
      setBackend(backendRef.current)

      const pending = stored[PENDING_KEY]
      if (typeof pending !== 'string') return
      if (!(await chrome.permissions.contains({ origins: [hostPattern(pending)] }))) {
        await chrome.storage.local.remove(PENDING_KEY) // the prompt was declined
        return
      }
      if (cancelled) return
      const result = await connect(pending)
      if (cancelled) return
      if (result.ok) toast.success(`Connected to ${hostOf(pending)}`)
      else toast.error(result.error)
    })()
    return () => { cancelled = true }
  }, [connect, toast])

  // Re-check on every popup open (and after switching), so the footer can show
  // whether the server is reachable before the user tries anything.
  useEffect(() => {
    if (!backend) return
    let cancelled = false
    setHealth({ state: 'checking' })
    ;(async () => {
      const granted = await chrome.permissions.contains({ origins: [hostPattern(backend)] })
      const result: HealthResult = granted
        ? await checkHealth(backend)
        : { ok: false, error: `Access to ${hostOf(backend)} was removed. Connect again to restore it.` }
      if (!cancelled) setHealth(result.ok ? { state: 'ok', info: result.info } : { state: 'error', error: result.error })
    })()
    return () => { cancelled = true }
  }, [backend])

  if (backend === null) return null

  return <BackendContext.Provider value={{ backend, health, connect }}>{children}</BackendContext.Provider>
}

export function useBackend(): BackendValue {
  return useContext(BackendContext)!
}
