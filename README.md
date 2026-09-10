<p align="center">
  <img src="icon-128.png" width="96" alt="Siphon Stream Finder" />
</p>

<h1 align="center">Siphon Stream Finder</h1>

<p align="center">
  A tiny Manifest V3 browser extension that finds downloadable video/audio streams
  (<code>.m3u8</code> / <code>.mpd</code>) on the page you're viewing and copies them into the
  <a href="https://github.com/Ramonvdo/siphon">Siphon desktop app</a>.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="https://github.com/Ramonvdo/siphon-extension/releases/latest"><img src="https://img.shields.io/github/v/release/Ramonvdo/siphon-extension" alt="Latest release"></a>
  <a href="https://github.com/Ramonvdo/siphon-extension/releases"><img src="https://img.shields.io/github/downloads/Ramonvdo/siphon-extension/total" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/browsers-Chrome%20%7C%20Edge%20%7C%20Firefox-blue" alt="Browsers">
</p>

---

It's the browser-side twin of Siphon's **Advanced Search** tab: a background
worker watches the tab's network traffic for HLS/DASH manifests, and the popup
lists them with **Copy** and **Send to Siphon** buttons.

> Loaded **unpacked** — it is not published to any web store. One codebase runs on
> Chromium and Firefox via
> [webextension-polyfill](https://github.com/mozilla/webextension-polyfill).

## Supported browsers

| Browser | Engine | Status |
|---|---|---|
| Chrome · Edge · Brave · Arc · Vivaldi | Chromium | ✅ Use the Chromium build directly |
| Firefox | Gecko | ✅ Use the Firefox build (`npm run build`) |
| Orion | WebKit | ⚠️ Best-effort — install the Chrome or Firefox build; depends on Orion's WebExtension support |
| Safari | WebKit | ❌ Not supported — needs an Xcode app wrapper + Apple Developer account, and Safari's native HLS handling bypasses `webRequest` |

## Download

Grab the latest packaged build from the
[**Releases**](https://github.com/Ramonvdo/siphon-extension/releases) page:

| Browser | Package |
|---|---|
| **Chrome · Edge · Brave · Arc · Vivaldi** | [`siphon-extension-chrome.zip`](https://github.com/Ramonvdo/siphon-extension/releases/latest/download/siphon-extension-chrome.zip) |
| **Firefox** | [`siphon-extension-firefox.zip`](https://github.com/Ramonvdo/siphon-extension/releases/latest/download/siphon-extension-firefox.zip) |

Unzip it, then load it unpacked — see **Install** below. (Not published to web stores; you
can also build the packages yourself with `npm run build`.)

> **Disclaimer:** This extension is for **lawful, personal use only** — media you own or
> have permission to download, and testing against **private platforms you control
> yourself**. The author does not condone or promote unlawful use. Downloading copyrighted
> content without permission may be illegal and may violate a site's terms of service. See
> [DISCLAIMER.md](DISCLAIMER.md).

## Install (Chrome / Edge / Brave / Arc / Vivaldi)

1. Go to `chrome://extensions` (or `edge://extensions`, `brave://extensions`,
   `arc://extensions`, `vivaldi://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and pick the unzipped **chrome** folder from the
   [downloaded zip](#download) (or this repo folder, or `dist/chrome/` after building).
4. Pin the Siphon icon to the toolbar if you like.

## Install (Firefox)

Firefox needs its own manifest. Use the downloaded `siphon-extension-firefox.zip`
(unzip it), or build the packages yourself:

```bash
npm run build      # writes dist/chrome/ and dist/firefox/ (+ zips)
```

Then:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick the unzipped folder's `manifest.json`
   (or `dist/firefox/manifest.json` after building).
3. Open the add-on's details and **grant the host permission** when prompted —
   Firefox treats `<all_urls>` as opt-in for MV3.

> Temporary add-ons are removed when Firefox restarts. For a permanent install,
> submit `dist/siphon-extension-firefox.zip` to [AMO](https://addons.mozilla.org)
> (free) or self-distribute a signed `.xpi`.

## Build (per-browser packages)

```bash
npm run build      # or: node build.mjs
```

Produces `dist/chrome/` and `dist/firefox/` — each a complete, loadable extension —
plus matching `.zip` files for store submission. Both share all code and differ only
in the manifest (Chromium uses a service worker; Firefox uses `background.scripts` +
a `gecko` id).

## Use

1. Open a page with video/audio and **press Play** (manifests usually load only
   after playback starts). A green badge count appears on the icon as streams
   are found.
2. Click the icon → the popup lists each detected stream.
3. **Send to Siphon** copies the link **and opens Siphon's quick window** (via the
   `siphon://` protocol), with the `.m3u8` already pasted — just pick a format and
   download. **Copy** / **Copy all** copy the link(s) without opening Siphon.

> The first time you use **Send to Siphon**, Chrome asks "Open Siphon?" — tick
> **Always allow** and it's seamless after that. (Siphon must have been launched
> at least once so it can register the `siphon://` handler.) If the prompt is
> dismissed, the link is still on your clipboard, so **Alt+S** in Siphon also works.

## Permissions

- `webRequest` + `<all_urls>` — to observe request URLs and spot manifests.
- `storage` — per-tab found-stream lists (`storage.session`).

That is the whole list. Tracking the active tab and clearing a tab's list on
navigation needs no `tabs` permission, because only tab **ids** are read — never
a tab's URL, title or favicon.

Nothing is sent anywhere; detection and storage are entirely local.

## Disclaimer & legal

Any platform logos or sample content shown in screenshots or marketing material are **for
demonstration only** and do not imply endorsement or affiliation. You are solely
responsible for ensuring your use complies with applicable laws and third-party terms of
service. See [DISCLAIMER.md](DISCLAIMER.md) for the full statement and
[SECURITY.md](SECURITY.md) to report vulnerabilities.

## License

[MIT](LICENSE) © 2026 Siphon
