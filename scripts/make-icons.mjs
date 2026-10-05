// Generates the PWA icons with no dependencies: raw RGBA -> zlib -> PNG chunks.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [15, 17, 21, 255];
const GREEN = [47, 191, 113, 255];
const BLUE = [76, 141, 255, 255];

function makeIcon(size, path) {
  const u = size / 10;
  const bars = [
    { x: 2.2, h: 3.0, color: GREEN },
    { x: 4.6, h: 4.6, color: GREEN },
    { x: 7.0, h: 6.4, color: BLUE },
  ];
  const bw = 1.5 * u;
  const radius = 0.35 * u;
  const corner = 0.22 * size;

  const inRounded = (px, py) => {
    // rounded-rect background mask
    const inset = 0;
    const w = size - inset * 2;
    const h = size - inset * 2;
    const cx = Math.min(Math.max(px, inset + corner), inset + w - corner);
    const cy = Math.min(Math.max(py, inset + corner), inset + h - corner);
    return (px - cx) ** 2 + (py - cy) ** 2 <= corner ** 2 || (px >= inset + corner && px <= inset + w - corner) || (py >= inset + corner && py <= inset + h - corner);
  };

  const inBar = (px, py, bar) => {
    const bx = bar.x * u;
    const by = 2.0 * u;
    const bh = bar.h * u;
    if (px < bx || px > bx + bw || py < by || py > by + bh) return false;
    const cx = Math.min(Math.max(px, bx + radius), bx + bw - radius);
    const cy = Math.min(Math.max(py, by + radius), by + bh - radius);
    return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2 || (px >= bx + radius && px <= bx + bw - radius) || (py >= by + radius && py <= by + bh - radius);
  };

  const data = png(size, (x, y) => {
    // PNG rows are top-down; draw bars growing upward from the bottom.
    const py = size - 1 - y;
    if (!inRounded(x + 0.5, py + 0.5)) return [0, 0, 0, 0];
    for (const bar of bars) {
      if (inBar(x + 0.5, py + 0.5, bar)) return bar.color;
    }
    return BG;
  });
  writeFileSync(path, data);
  console.log(`wrote ${path} (${size}x${size}, ${data.length} bytes)`);
}

const dir = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
makeIcon(192, dir + "icon-192.png");
makeIcon(512, dir + "icon-512.png");
makeIcon(180, dir + "apple-touch-icon-180.png");
