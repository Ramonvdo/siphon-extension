# Disclaimer

The Siphon Stream Finder extension detects HLS/DASH stream manifests (`.m3u8` / `.mpd`)
that load on the page you are viewing and hands them to the Siphon desktop app. It is
provided for **lawful, personal use only** — for media you own, have created, or have
permission to download, and for testing against **private media platforms you control
yourself**.

## No endorsement of unlawful use

The author **does not condone, encourage, or promote** any unlawful use of this extension.
Downloading or redistributing copyrighted material without permission may be illegal and
may violate the terms of service of the site the content is hosted on. **You are solely
responsible** for ensuring your use complies with all applicable laws and third-party terms
of service.

## What the extension does and does not do

- It **only observes request URLs** to spot manifest links, and stores the found list
  locally per tab (`chrome.storage.session`).
- It does **not** send any data to a server, does **not** collect analytics, and does
  **not** read page content or your browsing history beyond the URLs needed to detect
  streams.

## Demonstration material

Any logos, brand marks, or screenshots in this project's documentation are included **for
demonstration and illustrative purposes only** and do not imply endorsement of, or
affiliation with, any platform. Third-party names and logos belong to their respective
owners.

This software is provided "as is", without warranty of any kind. See [LICENSE](LICENSE) for
the full terms.
