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
  importScripts('browser-polyfill.js');
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

/* Reading the list, appending to it and writing it back spans an await, so two
   manifests arriving in the same tick would both read the same list and the
   second write would silently discard the first. That is the normal case, not
   an edge one - a master playlist and its variants, or DASH video and audio,
   arrive together. Chain each tab's updates so the read-modify-write runs as
   one critical section. */
const queues = new Map();

function withTab(tabId, fn) {
  const next = (queues.get(tabId) || Promise.resolve()).then(fn, fn);
  queues.set(tabId, next);
  // Drop the chain once it goes idle, so closed tabs leave nothing behind.
  next.finally(() => {
    if (queues.get(tabId) === next) queues.delete(tabId);
  });
  return next;
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
    withTab(details.tabId, async () => {
      const list = await getList(details.tabId);
      if (list.some((s) => s.url === details.url)) return;
      list.push({
        url: details.url,
        kind: /\.mpd/i.test(details.url) ? 'dash' : 'hls',
        ts: Date.now(),
      });
      await setList(details.tabId, list);
    });
  },
  { urls: ['<all_urls>'] }
);

// Reset a tab's list when it starts loading a new page (full navigations /
// reloads fire status:'loading'; SPA route changes do not, so we keep those).
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Through the same queue as the appends, or a detection still in flight
  // lands after the clear and the new page starts with a stale stream.
  if (changeInfo.status === 'loading') withTab(tabId, () => setList(tabId, []));
});

browser.tabs.onRemoved.addListener((tabId) => {
  withTab(tabId, () => browser.storage.session.remove(key(tabId)));
});

// Popup <-> background messaging. Returning a Promise resolves the response —
// the webextension-polyfill convention that works on Chromium and Firefox.
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg.tabId !== 'number') return;
  // Also queued, so the popup reads a settled list rather than one mid-write,
  // and Clear cannot be undone by a detection that was already in flight.
  if (msg.type === 'getStreams') {
    return withTab(msg.tabId, () => getList(msg.tabId)).then((streams) => ({ streams }));
  }
  if (msg.type === 'clearStreams') {
    return withTab(msg.tabId, () => setList(msg.tabId, [])).then(() => ({ ok: true }));
  }
});
