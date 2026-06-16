# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in the Siphon Stream Finder extension, please
report it **privately** using GitHub's **["Report a vulnerability"](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
flow (Security tab → "Report a vulnerability") rather than opening a public issue.

Please include a description, impact, reproduction steps, and the affected version.

## Design notes

This is a Manifest V3 extension with a minimal footprint:

- **Permissions:** `webRequest` + `host_permissions: <all_urls>` are required to observe
  request URLs on any page and detect stream manifests; `storage` keeps the per-tab found
  list in `chrome.storage.session`; `tabs` is used to know the active tab and reset the
  list on navigation.
- **No data leaves the device.** There is no backend, no analytics, and no remote endpoint.
- **No content scripts and no `eval`.** The extension does not inject code into pages; it
  detects streams purely from network request URLs.
- **User-initiated handoff.** "Send to Siphon" only triggers the `siphon://` deep link in
  response to a user click; nothing is launched automatically.

The broad `<all_urls>` host permission is the most sensitive aspect and is inherent to the
extension's purpose (streams can appear on any site). It can be narrowed to specific
domains by editing `manifest.json` if you only use Siphon on a known set of sites.
