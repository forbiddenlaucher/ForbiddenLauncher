const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const srcPath = 'C:/Users/takamura/.gemini/antigravity/brain/5d5b4ebc-a280-4ba6-befa-1eafaca536c6/.user_uploaded/media_1787325580181.jpg';
    const img = nativeImage.createFromPath(srcPath);
    console.log('Emblem dimensions:', img.getSize());

    const png512 = img.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
    fs.writeFileSync('src/renderer/assets/icon.png', png512);
    fs.writeFileSync('build/icon.png', png512);
    console.log('Saved src/renderer/assets/icon.png and build/icon.png');

    const sizes = [256, 128, 64, 48, 32, 16];
    const pngBuffers = sizes.map(s => img.resize({ width: s, height: s, quality: 'best' }).toPNG());

    const count = sizes.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(count, 4);

    let offset = 6 + (count * 16);
    const entries = [];
    for (let i = 0; i < count; i++) {
      const s = sizes[i];
      const pBuf = pngBuffers[i];
      const entry = Buffer.alloc(16);
      entry.writeUInt8(s === 256 ? 0 : s, 0);
      entry.writeUInt8(s === 256 ? 0 : s, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(pBuf.length, 8);
      entry.writeUInt32LE(offset, 12);
      offset += pBuf.length;
      entries.push(entry);
    }


    const icoBuffer = Buffer.concat([header, ...entries, ...pngBuffers]);
    fs.writeFileSync('build/icon.ico', icoBuffer);
    console.log('Saved high-res multi-layer build/icon.ico (Size:', icoBuffer.length, 'bytes)');
  } catch (e) {
    console.error('Error updating icon:', e);
  } finally {
    app.quit();
  }
});
