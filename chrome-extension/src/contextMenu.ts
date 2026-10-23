// Right-click quick copy, without opening the popup: the current page's short
// link or original URL, or a short link for a link on the page. Short links use
// the popup's defaults (a dictionary word, 7 days); the server hands back the
// existing link for a URL it has already shortened, so repeats don't pile up.
import { createApi } from './api'
import { hasAccess, hostOf, loadBackend } from './connection'

const WEB_URLS = ['http://*/*', 'https://*/*']

export function registerMenus(): void {
  chrome.contextMenus.removeAll(() => {
    // Both page items show together, so Chrome nests them under a "Pika URL Shortener" submenu.
    chrome.contextMenus.create({ id: 'copy-short-page', title: 'Copy short link', contexts: ['page'], documentUrlPatterns: WEB_URLS })
    chrome.contextMenus.create({ id: 'copy-original-page', title: 'Copy original URL', contexts: ['page'], documentUrlPatterns: WEB_URLS })
    // Alone in the link menu, so it's shown top-level and has to say "Pika" itself.
    chrome.contextMenus.create({ id: 'copy-short-link', title: 'Copy link as Pika short link', contexts: ['link'], targetUrlPatterns: WEB_URLS })
  })
}

export async function runMenuItem(id: string, info: { pageUrl?: string; linkUrl?: string }, tabId?: number): Promise<void> {
  const feedback = (ok: boolean, title: string, detail = '') => showFeedback(tabId, ok, title, detail)

  if (id === 'copy-original-page') {
    if (!info.pageUrl) return
    return (await copyText(info.pageUrl))
      ? feedback(true, 'Original URL copied', info.pageUrl)
      : feedback(false, "Couldn't copy to the clipboard")
  }

  const url = id === 'copy-short-link' ? info.linkUrl : info.pageUrl
  if (!url) return
  const backend = await loadBackend()
  if (!backend) {
    chrome.action.openPopup().catch(() => {}) // the popup opens on "Connect to Pika"
    return feedback(false, "Pika isn't connected to a server yet", 'Click the Pika icon to pick one.')
  }
  if (!(await hasAccess(backend))) {
    return feedback(false, `Pika lost access to ${hostOf(backend)}`, 'Connect again in Pika’s Settings.')
  }

  let key: string | null | undefined
  try {
    const res = await createApi(backend).createRecord(url)
    key = res.data.data?.shortened_key
    if (!res.ok || !key) return feedback(false, "Couldn't shorten this link", res.data.message)
  } catch {
    return feedback(false, `Couldn't reach ${hostOf(backend)}`)
  }
  const short = `${backend}/${key}`
  return (await copyText(short))
    ? feedback(true, 'Short link copied', short)
    : feedback(false, "Couldn't copy to the clipboard", short)
}

// ── clipboard ───────────────────────────────────────────────────────────────

let creatingOffscreen: Promise<void> | null = null

// A service worker has no clipboard, so an offscreen document does the copy.
// It stays open between copies; hasDocument() covers a worker restart.
async function copyText(text: string): Promise<boolean> {
  try {
    if (!(await chrome.offscreen.hasDocument())) {
      creatingOffscreen ??= chrome.offscreen
        .createDocument({
          url: 'offscreen.html',
          reasons: [chrome.offscreen.Reason.CLIPBOARD],
          justification: 'Copy the link picked from the Pika context menu',
        })
        .finally(() => { creatingOffscreen = null })
      await creatingOffscreen
    }
    return (await chrome.runtime.sendMessage({ target: 'offscreen', type: 'copy', text })) === true
  } catch {
    return false
  }
}

// ── feedback ────────────────────────────────────────────────────────────────

async function showFeedback(tabId: number | undefined, ok: boolean, title: string, detail: string): Promise<void> {
  try {
    if (tabId === undefined) throw new Error('no tab')
    // activeTab, granted by the menu click, is what allows scripting this tab.
    await chrome.scripting.executeScript({ target: { tabId }, func: pageToast, args: [ok, title, detail] })
  } catch {
    // Pages Chrome won't let extensions script (the Web Store, PDFs): flash the toolbar badge instead.
    await chrome.action.setBadgeBackgroundColor({ color: ok ? '#3D8B5F' : '#D94040' })
    await chrome.action.setBadgeText({ text: ok ? '✓' : '!' })
    setTimeout(() => void chrome.action.setBadgeText({ text: '' }), 3000)
  }
}

// Injected into the page, so it must be self-contained. Styled through the
// CSSOM and the Web Animations API, which a page's CSP can't block the way it
// can block an inline <style>; the shadow root keeps the page's CSS out.
function pageToast(ok: boolean, title: string, detail: string) {
  const ID = 'pika-extension-toast';
  document.getElementById(ID)?.remove();
  const host = document.createElement('div');
  host.id = ID;
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  Object.assign(toast.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '2147483647',
    maxWidth: 'min(380px, calc(100vw - 40px))',
    padding: '12px 18px',
    borderRadius: '14px',
    color: '#fff',
    background: ok ? 'rgba(61,139,95,0.95)' : 'rgba(217,64,64,0.95)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    font: "500 14px/1.35 Outfit, system-ui, -apple-system, 'Segoe UI', sans-serif",
    textAlign: 'left',
  });
  const head = document.createElement('div');
  head.textContent = `${ok ? '✅' : '❌'} ${title}`;
  toast.append(head);
  if (detail) {
    const line = document.createElement('div');
    line.textContent = detail;
    Object.assign(line.style, {
      marginTop: '3px',
      font: "12px/1.3 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
      opacity: '0.9',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    toast.append(line);
  }
  host.attachShadow({ mode: 'open' }).append(toast);
  document.documentElement.append(host);
  const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
  toast.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing });
  setTimeout(() => {
    toast.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 300, easing, fill: 'forwards' })
      .finished.then(() => host.remove());
  }, 2800);
}
