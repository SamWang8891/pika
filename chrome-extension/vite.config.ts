import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { PIKA_VERSION } from '../src/shared/types.ts'
import { hostPattern, normalizeBackend } from './src/origin.ts'

// Anchor everything to this directory, so a build started from elsewhere (e.g.
// `vite build --config chrome-extension/vite.config.ts`) still finds index.html and .env.
const root = fileURLToPath(new URL('.', import.meta.url))

// Normalize the optional build-time default backend to a bare origin, and fail
// the build (not the user) if it's malformed.
function defaultBackend(raw: string | undefined): string {
  if (!raw) return ''
  const origin = normalizeBackend(raw)
  if (!origin) throw new Error(`VITE_PIKA_DEFAULT_BACKEND must be an http(s) URL: ${raw}`)
  return origin
}

// Emit manifest.json from here rather than keeping a static file, so the
// version tracks PIKA_VERSION and a baked-in default backend gets its host
// permission at install time instead of a runtime prompt.
function manifest(backend: string): Plugin {
  return {
    name: 'pika-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(
          {
            manifest_version: 3,
            name: 'Pika URL Shortener',
            short_name: 'Pika',
            version: PIKA_VERSION,
            description: 'Shorten the current page into an easy-to-remember link on your own Pika server.',
            minimum_chrome_version: '116',
            icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
            action: {
              default_title: 'Shorten with Pika',
              default_popup: 'index.html',
              default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
            },
            background: { service_worker: 'background.js', type: 'module' },
            permissions: [
              'storage',
              // Read the current tab's URL to pre-fill the popup, and script the tab a
              // context-menu click came from to show its "copied" toast.
              'activeTab',
              'contextMenus',
              'scripting',
              // The background worker copies through an offscreen document.
              'offscreen',
              'clipboardWrite',
            ],
            ...(backend && { host_permissions: [hostPattern(backend)] }),
            // Any other server is granted on demand when the user connects to it.
            optional_host_permissions: ['https://*/*', 'http://*/*'],
          },
          null,
          2,
        ),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const backend = defaultBackend(loadEnv(mode, root, 'VITE_').VITE_PIKA_DEFAULT_BACKEND)
  return {
    root,
    // Relative asset URLs: the popup is served from chrome-extension://<id>/.
    base: './',
    plugins: [react(), manifest(backend)],
    define: { __PIKA_DEFAULT_BACKEND__: JSON.stringify(backend) },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rolldownOptions: {
        input: {
          popup: `${root}index.html`,
          offscreen: `${root}offscreen.html`,
          background: `${root}src/background.ts`,
        },
        // The manifest names the service worker, so it needs a stable, unhashed path.
        output: { entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js') },
      },
    },
    // style.css and the shared types live in the web app's src/.
    server: { fs: { allow: [`${root}..`] } },
  }
})
