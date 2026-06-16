/* ═══════════════════════════════════════════════════════════════
   Siphon Stream Finder — popup logic
   ═══════════════════════════════════════════════════════════════ */

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const copyAllBtn = document.getElementById('copyAll');
const clearBtn = document.getElementById('clear');

let streams = [];

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function load() {
  const tab = await activeTab();
  if (!tab) return;
  const res = await browser.runtime.sendMessage({ type: 'getStreams', tabId: tab.id });
  streams = (res && res.streams) || [];
  render();
}

function flash(btn, label) {
  const prev = btn.textContent;
  btn.textContent = label;
  btn.classList.add('ok');
  setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove('ok');
  }, 1300);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older clipboard policies.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

async function copy(text, btn, label) {
  await copyToClipboard(text);
  flash(btn, label || 'Copied');
}

// Launch the Siphon desktop app via its custom protocol. Must run inside a user
// gesture (the button click). Chrome prompts "Open Siphon?" the first time —
// tick "Always allow" and it's seamless after that.
function launchSiphon() {
  const a = document.createElement('a');
  a.href = 'siphon://quick';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 200);
}

// Send to Siphon: copy the link, then open Siphon's quick window (which
// auto-fills from the clipboard).
async function sendToSiphon(text, btn) {
  await copyToClipboard(text);
  launchSiphon();
  flash(btn, 'Opening Siphon…');
}

function render() {
  listEl.innerHTML = '';
  const has = streams.length > 0;
  emptyEl.style.display = has ? 'none' : 'flex';
  copyAllBtn.style.display = has ? '' : 'none';

  streams.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'row';

    const head = document.createElement('div');
    head.className = 'row-head';
    const kind = document.createElement('span');
    kind.className = `kind ${s.kind}`;
    kind.textContent = s.kind.toUpperCase();
    head.appendChild(kind);

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = s.url;
    url.title = s.url;

    const bar = document.createElement('div');
    bar.className = 'row-bar';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn primary';
    sendBtn.textContent = 'Send to Siphon';
    sendBtn.addEventListener('click', () => sendToSiphon(s.url, sendBtn));

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copy(s.url, copyBtn));

    bar.append(sendBtn, copyBtn);
    row.append(head, url, bar);
    listEl.appendChild(row);
  });
}

copyAllBtn.addEventListener('click', () =>
  copy(streams.map((s) => s.url).join('\n'), copyAllBtn, 'All copied')
);

clearBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab) return;
  await browser.runtime.sendMessage({ type: 'clearStreams', tabId: tab.id });
  streams = [];
  render();
});

load();
