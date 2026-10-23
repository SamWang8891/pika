// Uploads a packaged build to the Chrome Web Store and submits it for review
// (Chrome Web Store API v2), authenticated as a service account. Used by
// .github/workflows/chrome-web-store.yml; runs on plain Node, no dependencies.
//
//   node scripts/cws-publish.mjs [zip]   (default: pika-extension.zip)
//
// Env:
//   CWS_SERVICE_ACCOUNT_KEY  the service account's JSON key (the whole file)
//   CWS_PUBLISHER_ID         Developer Dashboard → Publisher → Settings
//   CWS_EXTENSION_ID         the item ID of the already-created store listing
import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const API = 'https://chromewebstore.googleapis.com'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const POLL_INTERVAL_MS = 5_000
const POLL_ATTEMPTS = 36 // 3 minutes

function fail(message) {
  console.error(`::error::${message}`)
  process.exit(1)
}

const { CWS_SERVICE_ACCOUNT_KEY, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env
for (const [name, value] of Object.entries({ CWS_SERVICE_ACCOUNT_KEY, CWS_PUBLISHER_ID, CWS_EXTENSION_ID })) {
  if (!value) fail(`${name} is not set`)
}
const zipPath = process.argv[2] ?? 'pika-extension.zip'
const item = `publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}`

// Service-account JWT → access token (the "JSON key" method in Google's docs).
async function accessToken() {
  let key
  try {
    key = JSON.parse(CWS_SERVICE_ACCOUNT_KEY)
  } catch {
    fail('CWS_SERVICE_ACCOUNT_KEY is not valid JSON (paste the whole key file)')
  }
  const now = Math.floor(Date.now() / 1000)
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) fail(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`)
  return body.access_token
}

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/zip' }) },
    body,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) fail(`${method} ${url} → ${res.status}: ${JSON.stringify(json.error ?? json)}`)
  return json
}

// The upload reference names the pending state UPLOAD_IN_PROGRESS, the UploadState
// enum IN_PROGRESS; accept either.
const inProgress = (state) => state === 'IN_PROGRESS' || state === 'UPLOAD_IN_PROGRESS'

const token = await accessToken()

const zip = await readFile(zipPath).catch(() => fail(`Can't read ${zipPath} (run pnpm zip first)`))
console.log(`Uploading ${zipPath} (${(zip.length / 1024).toFixed(0)} KiB) to item ${CWS_EXTENSION_ID}…`)
const upload = await call(token, 'POST', `${API}/upload/v2/${item}:upload`, zip)
let state = upload.uploadState
for (let attempt = 0; inProgress(state) && attempt < POLL_ATTEMPTS; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  state = (await call(token, 'GET', `${API}/v2/${item}:fetchStatus`)).lastAsyncUploadState
}
if (state !== 'SUCCEEDED') {
  fail(`Upload did not succeed (state: ${state}). Check the item in the Developer Dashboard; a version not higher than the store's is the usual cause.`)
}
console.log(`Uploaded version ${upload.crxVersion ?? '(processed asynchronously)'}.`)

const published = await call(token, 'POST', `${API}/v2/${item}:publish`)
for (const warning of published.warningInfo?.warnings ?? []) {
  console.log(`::warning::${warning.reason}: ${warning.description}`)
}
console.log(`Submitted for review — state: ${published.state}. It goes live once Google approves it.`)
