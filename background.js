/* ═══════════════════════════════════════════════════════════════
   Siphon Stream Finder — background worker (cross-browser MV3)

   Watches network requests per tab for HLS/DASH manifest URLs and
   stores them in storage.session (survives worker restarts). The
   popup reads them and offers Copy / "Send to Siphon" (Alt+S).

   Uses the `browser.*` promise API via webextension-polyfill so the
   same code runs on Chromium (Chrome/Edge/Brave/Arc/Vivaldi) and
   Firefox. On Chromium the polyfill is loaded here via importScripts;
   on Firefox it is loaded ahead of this file by the manifest's
   background.scripts array (where importScripts is unavailable).
   ═══════════════════════════════════════════════════════════════ */

if (typeof importScripts === 'function') {
  importScripts('browser-polyfill.min.js');
}

const RX = /(\.m3u8|\.mpd|\.f4m)(\?|$)|[?&]format=m3u8|\/manifest(\/|\?|$)/i;
const key = (tabId) => `streams_${tabId}`;

async function getList(tabId) {
  const k = key(tabId);
  const stored = await browser.storage.session.get(k);
  return stored[k] || [];
}

async function setList(tabId, list) {
  await browser.storage.session.set({ [key(tabId)]: list });
  setBadge(tabId, list.length);
}

function setBadge(tabId, n) {
  try {
    browser.action.setBadgeText({ tabId, text: n ? String(n) : '' });
    browser.action.setBadgeBackgroundColor({ tabId, color: '#4FB286' });
  } catch (e) {
    /* tab may be gone */
  }
}

// Collect manifest requests, deduped per tab.
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return; // not tied to a tab (e.g. worker fetches)
    if (!RX.test(details.url)) return;
    getList(details.tabId).then((list) => {
      if (list.some((s) => s.url === details.url)) return;
      list.push({
        url: details.url,
        kind: /\.mpd/i.test(details.url) ? 'dash' : 'hls',
        ts: Date.now(),
      });
      setList(details.tabId, list);
    });
  },
  { urls: ['<all_urls>'] }
);

// Reset a tab's list when it starts loading a new page (full navigations /
// reloads fire status:'loading'; SPA route changes do not, so we keep those).
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') setList(tabId, []);
});

browser.tabs.onRemoved.addListener((tabId) => {
  browser.storage.session.remove(key(tabId));
});

// Popup <-> background messaging. Returning a Promise resolves the response —
// the webextension-polyfill convention that works on Chromium and Firefox.
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg.tabId !== 'number') return;
  if (msg.type === 'getStreams') {
    return getList(msg.tabId).then((streams) => ({ streams }));
  }
  if (msg.type === 'clearStreams') {
    return setList(msg.tabId, []).then(() => ({ ok: true }));
  }
});
