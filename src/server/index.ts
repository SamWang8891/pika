import { Hono } from 'hono'
import type { Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { FORBIDDEN_KEYWORDS, KEYWORD_RE } from '../shared/types'

type AppContext = { Bindings: Env }

const NOT_EXPIRED = "(expires_at IS NULL OR expires_at > datetime('now'))"
const SESSION_COOKIE = 'session'
const SESSION_MAX_AGE = 1800 // seconds, same 30-min lifetime as the old Starlette session
const PRESET_MINUTES = new Map<string, number>([['1h', 60], ['12h', 720], ['1d', 1440], ['7d', 10080]])
const DEFAULT_MINUTES = 10080 // 7d
const MAX_MINUTES = 100 * 365 * 24 * 60 // ~100 years; larger values overflow the Date or sort below "now"
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

// The signed cookie carries "<expiryMs>.<marker>", where marker is a slice of the
// stored password hash. Checking the marker lets a password change invalidate every
// outstanding cookie with no server-side session state.
const sessionMarker = (passwordHash: string) => passwordHash.slice(-16)

// Returns the stored password hash if the session cookie is valid (signature ok,
// not expired, marker still matches the current password), else null.
async function sessionUser(c: Ctx): Promise<string | null> {
  const value = await getSignedCookie(c, c.env.SECRET_KEY, SESSION_COOKIE)
  if (typeof value !== 'string') return null
  const dot = value.lastIndexOf('.')
  if (dot < 0 || !(Number(value.slice(0, dot)) > Date.now())) return null
  const row = await c.env.DB.prepare('SELECT password FROM login WHERE username = ?1')
    .bind('admin')
    .first<{ password: string }>()
  if (row === null || value.slice(dot + 1) !== sessionMarker(row.password)) return null
  return row.password
}

async function hasSession(c: Ctx): Promise<boolean> {
  const hash = await sessionUser(c)
  if (hash === null) return false
  await startSession(c, hash) // sliding window: every valid check re-issues the 30-min cookie
  return true
}

async function startSession(c: Ctx, passwordHash: string): Promise<void> {
  const value = `${Date.now() + SESSION_MAX_AGE * 1000}.${sessionMarker(passwordHash)}`
  await setSignedCookie(c, SESSION_COOKIE, value, c.env.SECRET_KEY, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    maxAge: SESSION_MAX_AGE,
  })
}

function hasBearer(c: Ctx): boolean {
  const token = c.env.BEARER_TOKEN
  const auth = c.req.header('Authorization')
  // Fail closed if the secret is unset: encode(undefined) === encode('') is empty,
  // so an empty "Bearer " token would otherwise compare equal.
  if (!token || !auth?.startsWith('Bearer ')) return false
  const enc = new TextEncoder()
  return timingSafeEqual(enc.encode(auth.slice(7)), enc.encode(token))
}

// Session OR static bearer token, same as the old backend.
const isAuthed = async (c: Ctx) => hasBearer(c) || (await hasSession(c))

// ── time / expiry ───────────────────────────────────────────────────────────

const fmtUTC = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

function computeExpiresAt(expiresIn: string): string | null {
  if (expiresIn === 'never') return null
  // Unknown values are tried as integer minutes; garbage — and anything outside
  // (0, MAX_MINUTES], which would overflow the Date or sort below "now" — silently
  // becomes 7d, matching the old backend's garbage-to-7d fallback.
  const trimmed = expiresIn.trim()
  const parsed = /^[+-]?\d+$/.test(trimmed) ? Number(trimmed) : 0
  const minutes = PRESET_MINUTES.get(expiresIn) ?? (parsed > 0 && parsed <= MAX_MINUTES ? parsed : DEFAULT_MINUTES)
  return fmtUTC(new Date(Date.now() + minutes * 60_000))
}

async function cleanupExpired(db: D1Database): Promise<void> {
  // Bind one timestamp to both statements: datetime('now') is re-evaluated per
  // statement, so a second ticking over between them could delete a row whose word
  // the UPDATE hadn't yet freed, leaking that word from the pool.
  const now = fmtUTC(new Date())
  await db.batch([
    db.prepare('UPDATE dict SET used = 0 WHERE word IN (SELECT short FROM urls WHERE expires_at IS NOT NULL AND expires_at <= ?1)').bind(now),
    db.prepare('DELETE FROM urls WHERE expires_at IS NOT NULL AND expires_at <= ?1').bind(now),
  ])
}

// ── API ─────────────────────────────────────────────────────────────────────

const api = new Hono<AppContext>()

// Lowercase only, so a key can be read aloud or typed with no case to guess.
// Keys are public identifiers, not secrets, so the slight modulo bias is fine.
const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789'
const randomKey = (len: number): string =>
  [...crypto.getRandomValues(new Uint8Array(len))].map((b) => ALNUM[b % ALNUM.length]).join('')

const reply = (c: Ctx, message: string, status = 200) => c.json({ message, data: null }, status as 200)
const body = (c: Ctx) => c.req.json().catch(() => ({}) as Record<string, unknown>)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

// Fail loudly (one clear 500) if the deploy forgot `wrangler secret put` — the old
// backend refused to boot without these; here bearer auth would otherwise silently
// disable and session signing would throw deep in the cookie layer.
api.use('*', async (c, next) => {
  if (!c.env.SECRET_KEY || !c.env.BEARER_TOKEN) {
    return reply(c, 'Server misconfigured: SECRET_KEY and BEARER_TOKEN must be set.', 500)
  }
  await next()
})

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
  await startSession(c, row.password)
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
  if (b.new_pass.length < 8) return reply(c, 'New password must be at least 8 characters.', 400)
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
  // Reject spaces and control chars (\r \n \0 etc): a control char in a stored URL
  // makes the 307 Location header throw on every later visit to the short link.
  if (/[\u0000-\u0020\u007f]/.test(url)) return keyed('URL must not contain spaces or control characters!', null, 400)
  if (!url.startsWith('https://') && !url.startsWith('http://')) url = `https://${url}`

  const db = c.env.DB
  await cleanupExpired(db)
  // Accept a JSON number for expires_in (the natural encoding for custom minutes) too.
  const expiresRaw = typeof b.expires_in === 'number' ? String(b.expires_in) : str(b.expires_in)
  const expiresAt = computeExpiresAt(expiresRaw || '7d')

  if (b.random_string === true) {
    // Random-string mode: no dictionary, no dedup — always mints a fresh key.
    // The UNIQUE constraint on urls.short is the collision check; start at 4
    // chars and grow one char after 10 straight collisions (36^4 ≈ 1.7M keys,
    // so growth only matters for a pathologically full table).
    for (let len = 4; len <= 16; len++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const key = randomKey(len)
        if (FORBIDDEN_KEYWORDS.has(key)) continue
        try {
          await db.batch([
            // If it happens to be a dictionary word, take it out of the random pool.
            db.prepare('UPDATE dict SET used = 1 WHERE word = ?1').bind(key),
            db.prepare('INSERT INTO urls (orig, short, created_at, expires_at) VALUES (?1, ?2, datetime(\'now\'), ?3)').bind(url, key, expiresAt),
          ])
          return keyed('Record created!', key)
        } catch (e) {
          if (!String(e).includes('UNIQUE')) throw e // real DB error, not a collision
          // collision — re-roll
        }
      }
    }
    return keyed('Could not allocate a key, please retry.', null, 503)
  }

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
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e // real DB error, not a collision
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
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e // real DB error, not a collision
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
  const b = await body(c)
  const db = c.env.DB
  // Only reclaim the dictionary word if no row still holds the short key — guards
  // against a concurrently-reissued key being un-reserved by a stale delete.
  const reclaim = (short: string) =>
    db.prepare('UPDATE dict SET used = 0 WHERE word = ?1 AND NOT EXISTS (SELECT 1 FROM urls WHERE short = ?1)').bind(short)

  // Exact delete by short key: the admin row buttons know the precise record, so
  // they send { short } and skip the fuzzy orig-vs-short matching below.
  if (typeof b.short === 'string' && b.short !== '') {
    const { results } = await db.prepare('SELECT short FROM urls WHERE short = ?1').bind(b.short).all<{ short: string }>()
    if (results.length === 0) return reply(c, 'No matching record found.', 404)
    await db.batch([db.prepare('DELETE FROM urls WHERE short = ?1').bind(b.short), reclaim(b.short)])
    return reply(c, 'Got one record')
  }

  const input = str(b.url).replace(/^\/+/, '')
  if (!input) return reply(c, 'No matching record found.', 404)

  const hasProtocol = input.startsWith('https://') || input.startsWith('http://')
  // Match attempts in order, first hit wins; expired rows are only reachable by
  // short key. Same observable order as the old backend. `orig` is the URL to
  // re-bind on delete (null for the short-key attempt) so the DELETE removes the
  // exact row the SELECT matched, not one that took over the key meanwhile.
  const byOrig = (v: string) => ({ sql: `SELECT short FROM urls WHERE orig = ?1 AND ${NOT_EXPIRED}`, value: v, orig: v })
  const attempts = [
    ...(hasProtocol ? [] : [byOrig(`https://${input}`)]),
    byOrig(input),
    { sql: 'SELECT short FROM urls WHERE short = ?1', value: input, orig: null as string | null },
  ]
  for (const { sql, value, orig } of attempts) {
    const { results } = await db.prepare(sql).bind(value).all<{ short: string }>()
    if (results.length === 0) continue
    if (results.length > 1) return reply(c, 'Multiple found', 300)
    const short = results[0].short
    const del =
      orig === null
        ? db.prepare('DELETE FROM urls WHERE short = ?1').bind(short)
        : db.prepare('DELETE FROM urls WHERE short = ?1 AND orig = ?2').bind(short, orig)
    await db.batch([del, reclaim(short)])
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

// Any uncaught error returns the standard JSON envelope (not Hono's text/plain
// default) so the SPA's response.json() never chokes on an error body.
app.onError((err, c) => {
  console.error(err)
  return c.json({ message: 'Internal server error', data: null }, 500)
})

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
