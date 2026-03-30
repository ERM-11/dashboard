#!/usr/bin/env node
/**
 * Generates PWA icons as valid PNG files using only Node built-ins (zlib).
 * Produces: icon-192.png, icon-512.png, icon-maskable-512.png
 */
const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ── PNG chunk builder ─────────────────────────────────────────────────────────
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const lenBuf = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(d.length)
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])))
  return Buffer.concat([lenBuf, t, d, crcBuf])
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function makePng(size, getPixel) {
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4)
    row[0] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = getPixel(x, y)
      const i = 1 + x * 4
      row[i] = r; row[i+1] = g; row[i+2] = b; row[i+3] = a
    }
    rows.push(row)
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 6 })
  const sig = Buffer.from([137,80,78,71,13,10,26,10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

// ── Icon renderer ─────────────────────────────────────────────────────────────
const lerp = (a, b, t) => Math.round(a + (b - a) * Math.max(0, Math.min(1, t)))

function drawIcon(size, maskable) {
  // Colours
  const BG         = [2,   6,   23,  255] // #020617 slate-950
  const BLUE       = [59,  130, 246, 255] // #3b82f6
  const BLUE_LIGHT = [147, 197, 253, 255] // #93c5fd

  const cx = size / 2, cy = size / 2
  // Squircle radius — maskable must keep content in centre 80%
  const sqR = maskable ? size * 0.36 : size * 0.44

  return makePng(size, (x, y) => {
    const dx = x - cx, dy = y - cy

    // Superellipse (squircle, n=4)
    const n = 4
    const sq = (Math.abs(dx / sqR) ** n + Math.abs(dy / sqR) ** n) ** (1/n)

    // Anti-alias edge ±0.5px in squircle-space
    const aa = Math.max(0, Math.min(1, (1.02 - sq) / 0.04))
    if (aa === 0) return BG

    // Radial gradient inside squircle: light blue centre → blue edge
    const r = Math.sqrt(dx*dx + dy*dy) / sqR
    const t = r * 0.85
    const ri = lerp(BLUE_LIGHT[0], BLUE[0], t)
    const gi = lerp(BLUE_LIGHT[1], BLUE[1], t)
    const bi = lerp(BLUE_LIGHT[2], BLUE[2], t)

    if (aa >= 1) return [ri, gi, bi, 255]

    // Blend with background for AA pixel
    return [
      lerp(BG[0], ri, aa),
      lerp(BG[1], gi, aa),
      lerp(BG[2], bi, aa),
      255,
    ]
  })
}

// ── Write files ────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const icons = [
  ['icon-192.png',          192, false],
  ['icon-512.png',          512, false],
  ['icon-maskable-512.png', 512, true ],
]

for (const [name, size, maskable] of icons) {
  const png = drawIcon(size, maskable)
  fs.writeFileSync(path.join(outDir, name), png)
  console.log(`✓ ${name} (${png.length} bytes)`)
}
console.log(`Icons written to public/icons/`)
