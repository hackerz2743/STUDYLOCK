const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function generateIconPNG(size = 256) {
  // RGBA buffer
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const radius = size * 0.44;

  let offset = 0;
  for (let y = 0; y < size; y++) {
    rawData[offset++] = 0; // Filter byte 0 (None)
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;

      // Rounded squircle distance: (x/r)^4 + (y/r)^4 <= 1
      const nx = Math.abs(dx) / radius;
      const ny = Math.abs(dy) / radius;
      const squircleDist = Math.pow(nx, 4) + Math.pow(ny, 4);

      if (squircleDist <= 1.0) {
        // Inside squircle
        const borderDist = squircleDist;
        
        // Gradient from top-left (cyan/indigo) to bottom-right (deep obsidian)
        const t = (x + y) / (size * 2);
        let r = Math.round(9 + t * 5);
        let g = Math.round(14 + t * 8);
        let b = Math.round(26 + t * 20);

        // Ambient border ring
        if (borderDist > 0.88 && borderDist <= 1.0) {
          const borderAlpha = (borderDist - 0.88) / 0.12;
          r = Math.round(r * (1 - borderAlpha) + 56 * borderAlpha);
          g = Math.round(g * (1 - borderAlpha) + 189 * borderAlpha);
          b = Math.round(b * (1 - borderAlpha) + 248 * borderAlpha);
        }

        // Draw Lock Motif in center
        // 1. Shackle: arc from center-40 to center+40, y from center-60 to center-15
        const shackleR = 36;
        const shackleDist = Math.hypot(dx, dy + 22);
        const inShackleArc = dy < -18 && Math.abs(shackleDist - shackleR) < 10;
        const inShackleLegs = dy >= -22 && dy <= -5 && (Math.abs(dx - 36) < 10 || Math.abs(dx + 36) < 10);

        // 2. Lock body: rectangle from x: -50..50, y: -8..62
        const inLockBody = Math.abs(dx) <= 52 && dy >= -8 && dy <= 62;

        // 3. Lightning bolt / keyhole in lock body
        const inBolt = (Math.abs(dx - (dy - 25) * 0.3) < 8 && dy >= 8 && dy <= 48);

        if (inShackleArc || inShackleLegs) {
          // Shackle: gleaming silver-cyan
          r = 148; g = 163; b = 184;
        } else if (inLockBody) {
          if (inBolt) {
            // Neon cyan lightning bolt
            r = 56; g = 189; b = 248;
          } else {
            // Lock body: rich indigo gradient
            const bodyT = (dy + 8) / 70;
            r = Math.round(30 + bodyT * 10);
            g = Math.round(41 + bodyT * 20);
            b = Math.round(75 + bodyT * 60);

            // Lock body border highlight
            if (Math.abs(dx) > 48 || dy < -5 || dy > 58) {
              r = 99; g = 102; b = 241;
            }
          }
        }

        rawData[offset++] = r;
        rawData[offset++] = g;
        rawData[offset++] = b;
        rawData[offset++] = 255;
      } else if (squircleDist <= 1.08) {
        // Anti-aliased outer edge
        const edgeAlpha = Math.round(255 * (1 - (squircleDist - 1.0) / 0.08));
        rawData[offset++] = 56;
        rawData[offset++] = 189;
        rawData[offset++] = 248;
        rawData[offset++] = Math.max(0, Math.min(255, edgeAlpha));
      } else {
        // Transparent outside
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  // PNG Header
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createICOFromPNG(pngBuffer) {
  // Modern ICO file containing 256x256 PNG
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const directoryEntry = Buffer.alloc(16);
  directoryEntry.writeUInt8(0, 0); // Width 256 -> 0
  directoryEntry.writeUInt8(0, 1); // Height 256 -> 0
  directoryEntry.writeUInt8(0, 2); // Color count
  directoryEntry.writeUInt8(0, 3); // Reserved
  directoryEntry.writeUInt16LE(1, 4); // Color planes
  directoryEntry.writeUInt16LE(32, 6); // Bits per pixel
  directoryEntry.writeUInt32LE(pngBuffer.length, 8); // PNG size
  directoryEntry.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

  return Buffer.concat([header, directoryEntry, pngBuffer]);
}

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const png = generateIconPNG(256);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
console.log('✓ Created src/assets/icon.png (256x256)');

const ico = createICOFromPNG(png);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);
console.log('✓ Created src/assets/icon.ico (Windows Icon)');
