// Background service worker: just the right-click menu (see contextMenu.ts).
import { registerMenus, runMenuItem } from './contextMenu'

chrome.runtime.onInstalled.addListener(registerMenus)

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void runMenuItem(String(info.menuItemId), info, tab?.id)
})
