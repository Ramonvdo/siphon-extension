"""Render the store listing images.

Four annotated 1280x800 cards plus the two Chrome promo tiles. The popup in
every card is the **real popup.html**, loaded in an iframe with a stubbed
`chrome.*` and two seeded streams — not a mock-up of it. A listing image is the
only picture most people ever see of a product, and an imitation drifts the
moment the popup changes; this cannot, because it is the popup.

Sample URLs use example.com deliberately. A real site's address in a listing
image implies a relationship with that site, and invites a reviewer to ask
whether the extension targets it.

Run: python scripts/store-cards.py   (after `node build.mjs`)
"""

import functools
import http.server
import os
import socketserver
import sys
import threading

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("playwright is not installed for this Python. Try: pip install playwright")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVE = os.path.join(ROOT, "dist", "chrome")
OUT_DIR = os.path.join(ROOT, "store-assets")

ACCENT = "#4FB286"

# Measured against the real popup with three streams: its content bottoms out
# at 451px. Sized to that, so the window in the card is full rather than a
# third empty.
FRAME_H = 467

# Enough of chrome.* for the polyfill to wrap, plus two seeded streams so the
# popup renders populated rather than empty.
STUB = """
window.chrome = {
  runtime: {
    id: 'store-card',
    lastError: null,
    sendMessage: (msg, cb) => cb({ streams: [
      { url: 'https://cdn.example.com/vod/master.m3u8', kind: 'hls', ts: Date.now() },
      { url: 'https://cdn.example.com/live/index.m3u8', kind: 'hls', ts: Date.now() },
      { url: 'https://cdn.example.com/vod/manifest.mpd', kind: 'dash', ts: Date.now() },
    ]}),
    onMessage: { addListener(){}, removeListener(){} },
  },
  tabs: { query: (q, cb) => cb([{ id: 1, url: 'https://example.com' }]) },
  storage: { session: { get: (k, cb) => cb({}), set: (o, cb) => cb && cb() } },
};
"""

SHELL = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{{margin:0;padding:0;background:#0b0c10;color:#e9edf1;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}}
  ::-webkit-scrollbar{{width:0;height:0}}
  main{{width:1280px;height:800px;padding:56px 60px;box-sizing:border-box;
    display:grid;grid-template-columns:1fr 430px;gap:56px;align-items:center;
    background:radial-gradient(80% 60% at 6% -10%,#12281f 0%,transparent 60%),#0b0c10}}
  h1{{margin:0 0 14px;font-size:38px;line-height:1.15;letter-spacing:-0.02em;font-weight:650}}
  .sub{{margin:0 0 28px;font-size:17px;line-height:1.5;color:#8d97a1;max-width:34ch}}
  ul{{margin:0;padding:0;list-style:none}}
  li{{position:relative;padding-left:26px;margin-bottom:14px;font-size:15.5px;
    line-height:1.5;color:#c3ccd4}}
  li:before{{content:"";position:absolute;left:0;top:8px;width:9px;height:9px;
    border-radius:50%;background:{accent}}}
  li b{{color:#e9edf1;font-weight:600}}
  /* The popup, at its real width, lifted off the background so a dark panel on
     a dark ground still reads as a window. */
  .frame{{width:420px;height:{frame_h}px;border-radius:14px;overflow:hidden;
    border:1px solid #262b31;box-shadow:0 26px 60px -24px rgba(0,0,0,.9)}}
  iframe{{width:420px;height:{frame_h}px;border:0;display:block}}
</style></head><body><main>
  <div><h1>{title}</h1><p class="sub">{sub}</p><ul>{bullets}</ul></div>
  <div class="frame"><iframe src="popup.html"></iframe></div>
</main></body></html>"""

TILE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{{margin:0;padding:0;background:#0b0c10}}
  ::-webkit-scrollbar{{width:0;height:0}}
  main{{width:{w}px;height:{h}px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;box-sizing:border-box;
    color:#e9edf1;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
    background:radial-gradient(70% 90% at 50% -20%,#12281f 0%,transparent 65%),#0b0c10}}
  .chip{{display:flex;gap:{gap}px;align-items:center;margin-bottom:{cmb}px}}
  .badge{{background:rgba(79,178,134,.16);color:{accent};border:1px solid rgba(79,178,134,.35);
    border-radius:6px;padding:{bp};font-size:{bf}px;font-weight:700;letter-spacing:.08em}}
  .url{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:{uf}px;
    color:#c3ccd4}}
  .name{{font-size:{nf}px;font-weight:650;letter-spacing:-0.02em}}
  .tag{{font-size:{tf}px;color:#8d97a1;margin-top:{tmt}px}}
</style></head><body><main>
  <div class="chip"><span class="badge">HLS</span><span class="url">master.m3u8</span></div>
  <div class="name">Siphon Stream Finder</div>
  <div class="tag">See the manifests a page requests</div>
</main></body></html>"""

CARDS = [
    (
        "01-what-it-finds",
        "See every manifest<br>the page requests",
        "A background listener watches the tab's own network traffic and lists "
        "the HLS and DASH manifests it goes past.",
        [
            "<b>HLS and DASH</b> — .m3u8, .mpd and .f4m",
            "<b>Per tab</b>, with a badge count on the toolbar icon",
            "<b>Cleared on navigation</b>, so the list is always this page",
            "Reads request <b>addresses only</b> — never page content",
        ],
        FRAME_H,
    ),
    (
        "02-copy-or-send",
        "Copy it, or hand it<br>to Siphon",
        "Every row has both. Copy puts the address on your clipboard; Send to "
        "Siphon opens the desktop app with it already filled in.",
        [
            "<b>Copy</b> or <b>Copy all</b> — nothing else installed needed",
            "<b>Send to Siphon</b> opens the app via a <b>siphon://</b> link",
            "The handoff is <b>local</b> — nothing travels over the network",
            "Works fully <b>without</b> the desktop app",
        ],
        FRAME_H,
    ),
    (
        "03-privacy",
        "Nothing leaves<br>your device",
        "There is no server behind this, no account, and no analytics. Nothing "
        "is collected, so there is nothing to share.",
        [
            "<b>No network requests</b> of its own, ever",
            "Matches live in <b>session storage</b> — never written to disk",
            "The browser <b>clears everything</b> when you quit",
            "<b>No tracking</b>, no profile, no history",
        ],
        FRAME_H,
    ),
    (
        "04-built-for-debugging",
        "Built for people who<br>work with streams",
        "Checking that your own player emits the manifest you expect, or that a "
        "CDN is serving the right variant, without opening devtools.",
        [
            "<b>Observe-only</b> — it cannot block or alter a request",
            "<b>Not aimed at any site</b>; it has no per-service logic",
            "<b>Manifest V3</b>, and no remote code of any kind",
            "<b>Open source</b>, MIT — every line is readable",
        ],
        FRAME_H,
    ),
]

TILES = [
    ("promo-tile-440x280", 440, 280,
     dict(gap=8, cmb=20, bp="3px 7px", bf=10, uf=13, nf=23, tf=12, tmt=7)),
    ("promo-marquee-1400x560", 1400, 560,
     dict(gap=16, cmb=44, bp="7px 14px", bf=19, uf=30, nf=54, tf=22, tmt=14)),
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args: object) -> None:
        return


def main() -> None:
    if not os.path.exists(os.path.join(SERVE, "popup.html")):
        sys.exit("No dist/chrome/popup.html. Build it first: node build.mjs")

    os.makedirs(OUT_DIR, exist_ok=True)
    handler = functools.partial(QuietHandler, directory=SERVE)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    port = httpd.server_address[1]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(device_scale_factor=1)
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.add_init_script(STUB)

            for name, title, sub, bullets, frame_h in CARDS:
                page.set_viewport_size({"width": 1280, "height": 800})
                page.goto(f"http://127.0.0.1:{port}/popup.html")
                page.set_content(
                    SHELL.format(
                        title=title,
                        sub=sub,
                        bullets="".join(f"<li>{b}</li>" for b in bullets),
                        accent=ACCENT,
                        frame_h=frame_h,
                    )
                )
                page.wait_for_timeout(900)
                out = os.path.join(OUT_DIR, f"{name}.png")
                page.screenshot(path=out)
                print(f"  {name + '.png':30s} 1280x800  {os.path.getsize(out)/1024:6.0f} KB")

            for name, w, h, sizes in TILES:
                page.set_viewport_size({"width": w, "height": h})
                page.set_content(TILE.format(w=w, h=h, accent=ACCENT, **sizes))
                page.wait_for_timeout(500)
                out = os.path.join(OUT_DIR, f"{name}.png")
                page.screenshot(path=out)
                print(f"  {name + '.png':30s} {w}x{h}  {os.path.getsize(out)/1024:6.0f} KB")

            browser.close()
            for line in errors:
                print(f"page error: {line}", file=sys.stderr)
            if errors:
                sys.exit("a card raised an error; the images are unreliable")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
