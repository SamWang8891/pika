// Clipboard for the background worker, which has none (see contextMenu.ts).
// execCommand rather than navigator.clipboard: an offscreen document can't take
// focus, and the async clipboard API needs it.
interface CopyMessage {
  target: 'offscreen'
  type: 'copy'
  text: string
}

const isCopy = (msg: unknown): msg is CopyMessage =>
  typeof msg === 'object' && msg !== null && (msg as CopyMessage).target === 'offscreen' && (msg as CopyMessage).type === 'copy'

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isCopy(msg)) return
  const area = document.getElementById('clipboard') as HTMLTextAreaElement
  area.value = msg.text
  area.select()
  sendResponse(document.execCommand('copy'))
})
