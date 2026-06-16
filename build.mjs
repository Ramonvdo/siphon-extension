// Builds per-browser packages of the Siphon Stream Finder extension.
//
//   node build.mjs
//
// Produces:
//   dist/chrome/   — load unpacked in Chrome / Edge / Brave / Arc / Vivaldi
//   dist/firefox/  — load as a temporary add-on in Firefox (about:debugging)
//   dist/siphon-extension-<target>.zip  (if a zip tool is available)
//
// The two targets share all runtime files and differ only in the manifest
// (Chromium uses a service worker; Firefox uses background.scripts + a gecko id).
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

const SHARED = [
  'background.js',
  'popup.js',
  'popup.html',
  'popup.css',
  'icon-128.png',
  'browser-polyfill.min.js',
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
  console.log(`✓ built dist/${target}`);

  // Best-effort zip for store submission; the folder is usable without it.
  const zip = join(dist, `siphon-extension-${target}.zip`);
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -Force"`,
        { stdio: 'ignore' }
      );
    } else {
      execSync(`cd "${out}" && zip -r -q "${zip}" .`, { stdio: 'ignore' });
    }
    console.log(`✓ zipped dist/siphon-extension-${target}.zip`);
  } catch {
    console.log(`  (no zip tool found — load dist/${target} directly)`);
  }
}
