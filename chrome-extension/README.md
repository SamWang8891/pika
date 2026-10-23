# Pika Chrome Extension 🧩

The Pika web app as a toolbar popup (Manifest V3). It has the same pages and API calls as `src/client`:
shorten, random string, QR only, expiry, and the admin panel (login, delete, purge, change password,
logout). The differences:

- **The backend is user-chosen.** Settings takes a server address. Connecting asks Chrome for access to
  that site, then calls `GET /api/v4/health` and saves the server only if it answers as a Pika backend.
  The footer dot shows whether the saved server answers each time the popup opens.
- **The URL field starts with the current tab's URL** (through `activeTab`), selected so a paste replaces it.
- **Right-click quick copy, no popup needed.** On a page, Pika ▸ **Copy short link** / **Copy original URL**.
  On a link, **Copy link as Pika short link**. Short links use the popup's defaults (dictionary word,
  7 days), and the server returns the existing link for a URL it already shortened. A toast in the page
  confirms the copy, or the toolbar badge does on pages extensions can't script.
- **Layout fits a 400px popup.** The theme toggle and admin link move to header icons, the admin table
  becomes a stacked list, and "Purge All" confirms inline because `window.confirm` is unreliable in popups.

## Scripts

```bash
pnpm install
pnpm build   # → dist/, load it via chrome://extensions → Developer mode → Load unpacked
pnpm dev     # rebuild on change; then press ↻ on the extension in chrome://extensions
pnpm check   # type-check + build
pnpm zip     # build + pika-extension.zip for the Chrome Web Store
```

To try it against a local server, run `pnpm dev` (or `pnpm preview`) at the repo root and connect the
extension to the URL it prints.

## Default backend

`VITE_PIKA_DEFAULT_BACKEND` (env var or `.env`, see `.env.example`) bakes a server into the build. That
server becomes the initial backend, and `vite.config.ts` adds it to the manifest's `host_permissions`, so it
needs no runtime prompt. Without it, the popup opens on the "Connect to Pika" screen until a server is set.

## Publishing to the Chrome Web Store

**First release (by hand):**
- Build with `pnpm zip`, then create the item in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and upload `pika-extension.zip`.
- Fill in the store listing, privacy answers and distribution there; the API can only update an existing item.
- For the privacy policy URL, use your server's `/privacy` page. The terms of use are at `/terms`.

**Later releases are automated** by `.github/workflows/chrome-web-store.yml`:
- Publishing a GitHub release tagged `v<PIKA_VERSION>` builds the zip, uploads it, and submits it for review. You can also run it by hand from the Actions tab.
- A release whose tag doesn't match `PIKA_VERSION` fails before uploading, because the store rejects versions it already has.
- The upload and submit steps are `scripts/cws-publish.mjs` (Chrome Web Store API v2), which needs no dependencies.

One-time setup:

1. In Google Cloud, enable the **Chrome Web Store API**, create a service account, and download a JSON key for it.
2. In the Developer Dashboard, go to **Account** and add the service account's email.
3. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:
   - the secret `CWS_SERVICE_ACCOUNT_KEY`, containing the whole JSON key file
   - the variables `CWS_PUBLISHER_ID` (Dashboard → Publisher → Settings) and `CWS_EXTENSION_ID` (the item's ID)
   - optionally the variable `PIKA_DEFAULT_BACKEND`, the server baked into store builds

The workflow is skipped until `CWS_EXTENSION_ID` is set. Each submission still goes through Google's review before it goes live. If you change the listing's visibility in the dashboard, publish once by hand before the API can publish again.

## How it fits together

- `vite.config.ts` writes `manifest.json` at build time. The version comes from `PIKA_VERSION` in
  `src/shared/types.ts`, so the extension and the server share one version number.
- The design system is the web app's own `src/client/style.css`, imported as-is. `src/popup.css` only adapts
  it to the popup. Fonts are bundled through `@fontsource` rather than loaded from Google Fonts at runtime.
- `src/connection.ts` owns the chosen server without React (storage, host permissions, the health check),
  so the popup and the background worker share it. `src/backend.tsx` is the popup's React side: the provider,
  the footer status, and `useApi()`.
- `src/api.ts` mirrors `src/client/api.ts`, bound to the chosen origin and sending `credentials: 'include'`.
  Chrome attaches the backend's session cookie to these requests because the extension holds host
  permission for that site. That is why the admin login works and is shared with the web app in the same
  profile.
- `src/background.ts` is the service worker. It only wires up the context menu in `src/contextMenu.ts`.
  Service workers have no clipboard, so copies go through `offscreen.html` (`src/offscreen.ts`).

### Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers the chosen backend. |
| `activeTab` | Reads the current tab's URL when the popup opens, to pre-fill it. Also lets a context-menu click inject its "copied" toast into that tab. |
| `contextMenus` | The right-click quick-copy items. |
| `scripting` | Shows the "copied" toast in the page. |
| `offscreen`, `clipboardWrite` | Lets the background worker copy to the clipboard through an offscreen document. |
| `optional_host_permissions` (`http(s)://*/*`) | Requested for one host only, when the user connects to it. A previous backend's access is released on switch. |
| `host_permissions` | Only present when built with a default backend, and limited to that host. |

`chrome.permissions.request` has to run inside the click's user gesture, so it's called before any
`await`. On some platforms Chrome's permission prompt closes the popup. The pending server is saved
first, and the next popup open finishes connecting to it.
