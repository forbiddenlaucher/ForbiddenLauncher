const fs = require('fs');
const path = require('path');

// Simple script to generate a 32x32 RGBA PNG icon with a gothic 'F' symbol for the Tray
function generateTrayPng() {
  const zlib = require('zlib');
  const width = 32;
  const height = 32;

  // Create uncompressed raw image data (RGBA)
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x - 15.5, y - 15.5);
      // Outer gothic dark diamond / circle
      const isBorder = (dist > 13.5 && dist <= 15.5);
      const isInside = dist <= 13.5;
      
      // Gothic "F" cross symbol inside
      const isFVertical = (x >= 10 && x <= 14 && y >= 6 && y <= 25);
      const isFTopBar = (x >= 10 && x <= 23 && y >= 6 && y <= 10);
      const isFMidBar = (x >= 10 && x <= 20 && y >= 14 && y <= 17);
      const isLetterF = isFVertical || isFTopBar || isFMidBar;

      if (isLetterF) {
        // Glowing crimson / fiery red
        raw[offset++] = 239; // R
        raw[offset++] = 68;  // G
        raw[offset++] = 68;  // B
        raw[offset++] = 255; // A
      } else if (isBorder) {
        // Gold border
        raw[offset++] = 217;
        raw[offset++] = 119;
        raw[offset++] = 6;
        raw[offset++] = 255;
      } else if (isInside) {
        // Dark velvet obsidian background
        raw[offset++] = 18;
        raw[offset++] = 18;
        raw[offset++] = 24;
        raw[offset++] = 230;
      } else {
        // Transparent
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
        raw[offset++] = 0;
      }
    }
  }

  // PNG Creation
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
  console.log('Icon PNG generated at:', outPath);
}

generateTrayPng();
