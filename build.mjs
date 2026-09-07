// Builds per-browser packages of the Siphon Stream Finder extension.
//
//   node build.mjs
//
// Produces:
//   dist/chrome/   — load unpacked in Chrome / Edge / Brave / Arc / Vivaldi
//   dist/firefox/  — load as a temporary add-on in Firefox (about:debugging)
//   dist/siphon-extension-<target>.zip  (ready to upload to either store)
//
// The two targets share all runtime files and differ only in the manifest
// (Chromium uses a service worker; Firefox uses background.scripts + a gecko id).
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { zipDir } from './scripts/zip.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

// Everything both packages ship. `icon-source.png` is deliberately absent: it is
// the 1280px master kept for store artwork, not something users install.
const SHARED = [
  'background.js',
  'popup.js',
  'popup.html',
  'popup.css',
  'icon-16.png',
  'icon-48.png',
  'icon-128.png',
  'browser-polyfill.js',
];

// target -> source manifest (copied into the package as manifest.json)
const TARGETS = {
  chrome: 'manifest.json',
  firefox: 'manifest.firefox.json',
};

rmSync(dist, { recursive: true, force: true });

for (const [target, manifest] of Object.entries(TARGETS)) {
  const out = join(dist, target);
  mkdirSync(out, { recursive: true });
  for (const f of SHARED) copyFileSync(join(root, f), join(out, f));
  copyFileSync(join(root, manifest), join(out, 'manifest.json'));
  console.log(`built dist/${target}`);

  // Written by hand rather than shelled out to `zip` or PowerShell's
  // Compress-Archive; see the note at the top of scripts/zip.mjs for why both
  // are wrong. It also asserts the two things a store rejects for in silence.
  const zip = join(dist, `siphon-extension-${target}.zip`);
  const { files, bytes } = zipDir(out, zip);
  console.log(
    `zipped dist/siphon-extension-${target}.zip  ` +
      `${files} files, ${(bytes / 1024).toFixed(0)} KB`
  );
}
