const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function generateHighResIcon() {
  const width = 256;
  const height = 256;

  // Create raw RGBA image data
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const center = 127.5;
  const outerRadius = 120;
  const innerRadius = 108;
  const borderThickness = 12;

  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x - center, y - center);
      const isBorder = (dist <= outerRadius && dist > innerRadius);
      const isInside = dist <= innerRadius;

      // Gothic "F" symbol in center (scaled for 256x256)
      const isFVertical = (x >= 80 && x <= 112 && y >= 50 && y <= 206);
      const isFTopBar = (x >= 80 && x <= 186 && y >= 50 && y <= 84);
      const isFMidBar = (x >= 80 && x <= 162 && y >= 118 && y <= 148);
      const isGothicCross = (y >= 118 && y <= 148 && x >= 56 && x <= 80);
      const isLetterF = isFVertical || isFTopBar || isFMidBar || isGothicCross;

      if (isLetterF) {
        // Glowing Fiery Crimson / Blood Magic Red
        const grad = (y - 50) / 156;
        raw[offset++] = 239; // R
        raw[offset++] = Math.round(50 + 30 * grad); // G
        raw[offset++] = Math.round(50 + 20 * grad); // B
        raw[offset++] = 255; // A
      } else if (isBorder) {
        // Imperial Gold / Cyber Amber Border
        const angle = Math.atan2(y - center, x - center);
        const shine = Math.sin(angle * 4) * 0.2 + 0.8;
        raw[offset++] = Math.min(255, Math.round(234 * shine));
        raw[offset++] = Math.min(255, Math.round(179 * shine));
        raw[offset++] = Math.min(255, Math.round(8 * shine));
        raw[offset++] = 255;
      } else if (isInside) {
        // Dark Velvet Obsidian & Cyber Nebula
        const radialDark = (dist / innerRadius);
        raw[offset++] = Math.round(15 + 10 * radialDark);
        raw[offset++] = Math.round(12 + 12 * radialDark);
        raw[offset++] = Math.round(20 + 20 * radialDark);
        raw[offset++] = 245;
      } else {
        // Transparent background
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const body = Buffer.concat([typeBuf, data]);
    const crc = crc32(body);
    crcBuf.writeInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ -1);
  }

  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // Bit depth
  ihdrData[9] = 6;  // Color type (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
  const outPath = path.join(__dirname, '../src/renderer/assets/icon.png');
  fs.writeFileSync(outPath, png);
  console.log(`✅ High-resolution 256x256 icon generated at: ${outPath}`);
}

generateHighResIcon();
