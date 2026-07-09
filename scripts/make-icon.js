// Génère l'icône source de l'exe (512×512) : carré vert arrondi,
// grille de tableur et grand X blanc — même identité que le logo du site.
// PNG écrit sans dépendance (zlib intégré à Node).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 512;

// ---------- Dessin ----------
const px = Buffer.alloc(W * W * 4);
const R = 92;               // rayon des coins arrondis
const BASE = [0x21, 0x73, 0x46]; // vert XLDiff #217346

function insideRounded(x, y) {
  const cx = x < R ? R : x > W - 1 - R ? W - 1 - R : x;
  const cy = y < R ? R : y > W - 1 - R ? W - 1 - R : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}

for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (!insideRounded(x, y)) { px[o + 3] = 0; continue; }

    let [r, g, b] = BASE;

    // Grille de tableur (2 lignes verticales + 2 horizontales, blanc 45 %)
    const grid =
      Math.abs(x - W / 3) < 7 || Math.abs(x - (2 * W) / 3) < 7 ||
      Math.abs(y - W / 3) < 7 || Math.abs(y - (2 * W) / 3) < 7;
    if (grid) {
      r = Math.round(r * 0.55 + 255 * 0.45);
      g = Math.round(g * 0.55 + 255 * 0.45);
      b = Math.round(b * 0.55 + 255 * 0.45);
    }

    // Grand X blanc au centre
    const inBox = x >= 118 && x <= 394 && y >= 118 && y <= 394;
    const d1 = Math.abs(y - x) / Math.SQRT2;           // diagonale ↘
    const d2 = Math.abs(x + y - W) / Math.SQRT2;       // diagonale ↗
    if (inBox && (d1 < 30 || d2 < 30)) { r = g = b = 255; }

    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
}

// ---------- Encodage PNG minimal ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(W, 4);
ihdr[8] = 8;  // 8 bits/canal
ihdr[9] = 6;  // RGBA

// Scanlines : filtre 0 en tête de chaque ligne
const raw = Buffer.alloc(W * (W * 4 + 1));
for (let y = 0; y < W; y++) {
  raw[y * (W * 4 + 1)] = 0;
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, 'icon-source.png');
fs.writeFileSync(out, png);
console.log('Icône écrite :', out, `(${png.length} octets)`);
