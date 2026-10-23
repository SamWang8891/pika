// React side of the chosen backend (see connection.ts): loads it, finishes a
// connect interrupted by the permission prompt, and keeps a live health status
// for the footer and Settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HealthData } from '../../src/shared/types'
import { createApi, type Api } from './api'
import { useToast } from './components/Toast'
import {
  BACKEND_KEY,
  PENDING_KEY,
  checkHealth,
  hasAccess,
  hostOf,
  loadBackend,
  releaseAccess,
  type HealthResult,
} from './connection'

export type Health = { state: 'checking' } | { state: 'ok'; info: HealthData } | { state: 'error'; error: string }

interface BackendValue {
  backend: string // origin, '' until the user connects one
  health: Health
  connect: (origin: string) => Promise<HealthResult>
}

const BackendContext = createContext<BackendValue | null>(null)

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
      const [saved, stored] = await Promise.all([loadBackend(), chrome.storage.local.get(PENDING_KEY)])
      if (cancelled) return
      backendRef.current = saved
      setBackend(saved)

      const pending = stored[PENDING_KEY]
      if (typeof pending !== 'string') return
      if (!(await hasAccess(pending))) {
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
      const result: HealthResult = (await hasAccess(backend))
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

export function useApi(): Api {
  const { backend } = useBackend()
  return useMemo(() => createApi(backend), [backend])
}
