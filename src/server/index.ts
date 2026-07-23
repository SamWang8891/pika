import { Hono } from 'hono'
import type { Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { FORBIDDEN_KEYWORDS, KEYWORD_RE } from '../shared/types'

type AppContext = { Bindings: Env }

const NOT_EXPIRED = "(expires_at IS NULL OR expires_at > datetime('now'))"
const SESSION_COOKIE = 'session'
const SESSION_MAX_AGE = 1800 // seconds, same 30-min lifetime as the old Starlette session
const PRESET_MINUTES: Record<string, number> = { '1h': 60, '12h': 720, '1d': 1440, '7d': 10080 }
// Client-side routes that are valid [A-Za-z0-9]+ path segments; skip the D1
// lookup for them (they are forbidden as keywords, so they can never match).
const SPA_ROUTES = new Set(['admin', 'login', 'logout'])

// ── crypto helpers ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000 // Workers caps PBKDF2 at 100k iterations

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

const b64encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const b64decode = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(hash)}`
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  return crypto.subtle.timingSafeEqual(a, b)
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const derived = await pbkdf2(password, b64decode(salt), Number(iterations))
  return timingSafeEqual(derived, b64decode(hash))
}

// ── auth ────────────────────────────────────────────────────────────────────

type Ctx = Context<AppContext>

async function verifyAdminPassword(c: Ctx, password: string): Promise<boolean> {
  const row = await c.env.DB.prepare('SELECT password FROM login WHERE username = ?1')
    .bind('admin')
    .first<{ password: string }>()
  return row !== null && (await verifyPassword(password, row.password))
}

async function hasSession(c: Ctx): Promise<boolean> {
  const value = await getSignedCookie(c, c.env.SECRET_KEY, SESSION_COOKIE)
  return typeof value === 'string' && Number(value) > Date.now()
}

async function startSession(c: Ctx): Promise<void> {
  await setSignedCookie(c, SESSION_COOKIE, String(Date.now() + SESSION_MAX_AGE * 1000), c.env.SECRET_KEY, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    maxAge: SESSION_MAX_AGE,
  })
}

function hasBearer(c: Ctx): boolean {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const enc = new TextEncoder()
  return timingSafeEqual(enc.encode(auth.slice(7)), enc.encode(c.env.BEARER_TOKEN))
}

// Session OR static bearer token, same as the old backend.
const isAuthed = async (c: Ctx) => hasBearer(c) || (await hasSession(c))

// ── time / expiry ───────────────────────────────────────────────────────────

const fmtUTC = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

function computeExpiresAt(expiresIn: string): string | null {
  if (expiresIn === 'never') return null
  // Unknown values are tried as integer minutes (Python int() semantics:
  // whitespace and a leading sign are fine); garbage silently becomes 7d,
  // matching the old backend.
  const trimmed = expiresIn.trim()
  const minutes = PRESET_MINUTES[expiresIn] ?? (/^[+-]?\d+$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : PRESET_MINUTES['7d'])
  return fmtUTC(new Date(Date.now() + minutes * 60_000))
}

async function cleanupExpired(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("UPDATE dict SET used = 0 WHERE word IN (SELECT short FROM urls WHERE expires_at IS NOT NULL AND expires_at <= datetime('now'))"),
    db.prepare("DELETE FROM urls WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')"),
  ])
}

// ── API ─────────────────────────────────────────────────────────────────────

const api = new Hono<AppContext>()

const reply = (c: Ctx, message: string, status = 200) => c.json({ message, data: null }, status as 200)
const body = (c: Ctx) => c.req.json().catch(() => ({}) as Record<string, unknown>)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

api.get('/status', (c) => reply(c, "It's alive!"))

api.post('/login', async (c) => {
  const { username, password } = await body(c)
  const row = await c.env.DB.prepare('SELECT password FROM login WHERE username = ?1')
    .bind(str(username))
    .first<{ password: string }>()
  if (row === null || !(await verifyPassword(str(password), row.password))) {
    // A failed login also destroys any existing session, like the old backend.
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return reply(c, 'Unauthorized, wrong username or password.', 401)
  }
  await startSession(c)
  return reply(c, 'Successfully logged in!')
})

api.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return reply(c, 'Successfully logged out!')
})

// Deliberately session-only (no bearer), same as the old backend.
api.get('/admin_check', async (c) =>
  (await hasSession(c)) ? reply(c, 'User permitted!') : reply(c, 'Unauthorized', 401),
)

api.post('/change_pass', async (c) => {
  const b = await body(c)
  // The old backend 422'd on a missing field (but accepted an empty string);
  // without this check a typo'd bearer request would silently set an empty password.
  if (typeof b.new_pass !== 'string') return reply(c, 'new_pass is required', 400)
  if (hasBearer(c)) {
    // Bearer token bypasses the current-password check entirely.
  } else if (await hasSession(c)) {
    if (!(await verifyAdminPassword(c, str(b.current_pass)))) return reply(c, 'Current password is incorrect.', 401)
  } else {
    return reply(c, 'Unauthorized', 401)
  }
  await c.env.DB.prepare('UPDATE login SET password = ?1 WHERE username = ?2')
    .bind(await hashPassword(str(b.new_pass)), 'admin')
    .run()
  return reply(c, 'Password changed successfully!')
})

api.post('/create_record', async (c) => {
  const b = await body(c)
  const keyed = (message: string, key: string | null, status = 200) =>
    c.json({ message, data: { shortened_key: key } }, status as 200)

  let url = str(b.url)
  const keyword = str(b.custom_keyword).trim()
  if (!url) return keyed('url is required', null, 400)
  if (url.includes(' ')) return keyed('URL must not contain spaces!', null, 400)
  if (!url.startsWith('https://') && !url.startsWith('http://')) url = `https://${url}`

  const db = c.env.DB
  await cleanupExpired(db)
  const expiresAt = computeExpiresAt(str(b.expires_in) || '7d')

  if (keyword !== '') {
    if (FORBIDDEN_KEYWORDS.has(keyword) || !KEYWORD_RE.test(keyword)) return keyed('Keyword is illegal!', null, 400)
    const existing = await db.prepare(`SELECT orig FROM urls WHERE short = ?1 AND ${NOT_EXPIRED}`)
      .bind(keyword)
      .first<{ orig: string }>()
    if (existing !== null) {
      // Same keyword + same URL is idempotent and keeps the original expiry.
      if (existing.orig === url) return keyed('Custom record same as last request!', keyword)
      return keyed('Keyword is occupied!', null, 409)
    }
    try {
      await db.batch([
        // If the keyword is a dictionary word, take it out of the random pool.
        db.prepare('UPDATE dict SET used = 1 WHERE word = ?1').bind(keyword),
        db.prepare('INSERT INTO urls (orig, short, created_at, expires_at) VALUES (?1, ?2, datetime(\'now\'), ?3)').bind(url, keyword, expiresAt),
      ])
    } catch {
      return keyed('Keyword is occupied!', null, 409) // concurrent claim hit the UNIQUE constraint
    }
    return keyed('Custom record created!', keyword)
  }

  // Random path: dedup by exact original URL first.
  const dup = await db.prepare(`SELECT short FROM urls WHERE orig = ?1 AND ${NOT_EXPIRED}`)
    .bind(url)
    .first<{ short: string }>()
  if (dup !== null) return keyed('Existing record found!', dup.short)

  for (let attempt = 0; attempt < 5; attempt++) {
    const pick = await db.prepare('SELECT word FROM dict WHERE used = 0 ORDER BY RANDOM() LIMIT 1').first<{ word: string }>()
    if (pick === null) return keyed('No available words left in the dictionary!', null, 503)
    try {
      // The UNIQUE constraint on urls.short is the concurrency guard: if another
      // request claimed this word, the INSERT fails and the batch rolls back.
      await db.batch([
        db.prepare('UPDATE dict SET used = 1 WHERE word = ?1').bind(pick.word),
        db.prepare('INSERT INTO urls (orig, short, created_at, expires_at) VALUES (?1, ?2, datetime(\'now\'), ?3)').bind(url, pick.word, expiresAt),
      ])
      return keyed('Record created!', pick.word)
    } catch {
      // lost the race for this word — re-pick
    }
  }
  return keyed('Could not allocate a key, please retry.', null, 503)
})

api.get('/search_record', async (c) => {
  const shortKey = c.req.query('short_key')
  const found = (message: string, orig: string | null, status = 200) =>
    c.json({ message, data: { original_url: orig } }, status as 200)
  if (shortKey === undefined) return found('short_key is required', null, 400)
  const row = await c.env.DB.prepare(`SELECT orig FROM urls WHERE short = ?1 AND ${NOT_EXPIRED}`)
    .bind(shortKey)
    .first<{ orig: string }>()
  return row !== null ? found('Got one record', row.orig) : found('No matching record found', null, 404)
})

api.delete('/delete_record', async (c) => {
  if (!(await isAuthed(c))) return reply(c, 'Unauthorized', 401)
  const input = str((await body(c)).url).replace(/^\/+/, '')
  if (!input) return reply(c, 'No matching record found.', 404)

  const db = c.env.DB
  const hasProtocol = input.startsWith('https://') || input.startsWith('http://')
  // Match attempts in order, first hit wins; expired rows are only reachable
  // by short key. Same observable order as the old backend.
  const attempts = [
    ...(hasProtocol ? [] : [{ sql: `SELECT short FROM urls WHERE orig = ?1 AND ${NOT_EXPIRED}`, value: `https://${input}` }]),
    { sql: `SELECT short FROM urls WHERE orig = ?1 AND ${NOT_EXPIRED}`, value: input },
    { sql: 'SELECT short FROM urls WHERE short = ?1', value: input },
  ]
  for (const { sql, value } of attempts) {
    const { results } = await db.prepare(sql).bind(value).all<{ short: string }>()
    if (results.length === 0) continue
    if (results.length > 1) return reply(c, 'Multiple found', 300)
    await db.batch([
      db.prepare('DELETE FROM urls WHERE short = ?1').bind(results[0].short),
      db.prepare('UPDATE dict SET used = 0 WHERE word = ?1').bind(results[0].short),
    ])
    return reply(c, 'Got one record')
  }
  return reply(c, 'No matching record found.', 404)
})

api.get('/get_all_records', async (c) => {
  if (!(await isAuthed(c))) return reply(c, 'Unauthorized', 401)
  await cleanupExpired(c.env.DB)
  const { results } = await c.env.DB.prepare('SELECT orig, short, created_at, expires_at FROM urls').all()
  return c.json({ message: 'Success', data: { records: results } })
})

api.delete('/delete_all_records', async (c) => {
  if (!(await isAuthed(c))) return reply(c, 'Unauthorized', 401)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM urls'),
    c.env.DB.prepare('UPDATE dict SET used = 0'),
  ])
  return reply(c, 'All records deleted!')
})

// ── app: API + short-link redirects + SPA assets ────────────────────────────

const app = new Hono<AppContext>()

app.route('/api/v4', api)
app.all('/api/*', (c) => c.json({ message: 'Not found', data: null }, 404))

// Short links resolve server-side to a real 307 (works in curl and for HEAD
// from link previewers); everything else falls through to the SPA / assets.
// 307 and not 301: expired keywords are reclaimed and reissued, a cached
// permanent redirect would go stale.
app.on(['GET', 'HEAD'], '*', async (c) => {
  const match = new URL(c.req.url).pathname.match(/^\/([A-Za-z0-9]+)$/)
  if (match && !SPA_ROUTES.has(match[1])) {
    const row = await c.env.DB.prepare(`SELECT orig FROM urls WHERE short = ?1 AND ${NOT_EXPIRED}`)
      .bind(match[1])
      .first<{ orig: string }>()
    if (row !== null) return c.redirect(row.orig, 307)
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
