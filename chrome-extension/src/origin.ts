// Pure helpers for backend addresses, shared by the extension and vite.config.ts
// (which writes the default backend's host permission into the manifest), so the
// install-time and runtime host patterns can't drift apart. No chrome.* here.

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
