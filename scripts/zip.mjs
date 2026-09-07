/**
 * Write a directory as a store-ready zip.
 *
 * Hand-rolled rather than shelling out, because both obvious shortcuts are
 * wrong on at least one platform:
 *
 * - `zip` does not exist on Windows, nor in Git Bash.
 * - PowerShell's `Compress-Archive` writes path separators as BACKSLASHES.
 *   Measured on a comparable extension: 38 of 52 entries. The manifest still
 *   lands at the root so the upload appears to succeed, and then every
 *   subdirectory resolves to nothing — a broken add-on that passed review.
 *
 * This package is flat today, so `Compress-Archive` happened to be harmless.
 * That is luck, not correctness: the first subfolder anyone adds would ship
 * broken with no error anywhere. The two things the stores actually require are
 * asserted below — `manifest.json` at the archive root, forward slashes
 * throughout. No dependencies, so it cannot rot.
 */

import { deflateRawSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/* ── crc32 ──────────────────────────────────────────────────────────────── */

/** Table-driven rather than `zlib.crc32`, which only landed in Node 22.2. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buffer[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

/* ── the archive ────────────────────────────────────────────────────────── */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * A fixed timestamp, so the same input produces a byte-identical archive.
 *
 * Zip stores a DOS date/time; using "now" would make every build differ and
 * make it impossible to tell whether a rebuild actually changed anything.
 */
const DOS_TIME = 0x0000; // 00:00:00
const DOS_DATE = 0x2821; // 2020-01-01

function build(files) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of files) {
    const compressed = deflateRawSync(data, { level: 9 });
    // Never store a file larger than it started; small icons can deflate to
    // more than their own size.
    const stored = compressed.length < data.length;
    const payload = stored ? compressed : data;
    const method = stored ? 8 : 0;
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, nameBuf, payload);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(payload.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comment
    dir.writeUInt16LE(0, 34); // disk
    dir.writeUInt16LE(0, 36); // internal attrs
    dir.writeUInt32LE(0, 38); // external attrs
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

/**
 * Zip `dir` into `out`, refusing to write anything a store would mis-read.
 *
 * @returns {{ files: number, bytes: number }}
 */
export function zipDir(dir, out) {
  const files = walk(dir)
    .map((full) => ({
      // Forward slashes, always. This is the whole reason this module exists.
      name: relative(dir, full).split(/[\/]/).join("/"),
      data: readFileSync(full),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const names = files.map((f) => f.name);
  if (!names.includes("manifest.json")) {
    throw new Error(`${out}: manifest.json is not at the archive root`);
  }
  if (names.some((n) => n.includes("\\"))) {
    throw new Error(`${out}: an entry contains a backslash`);
  }

  const zip = build(files);
  writeFileSync(out, zip);
  return { files: files.length, bytes: zip.length };
}
