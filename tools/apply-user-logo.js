const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  try {
    const buildDir = path.join(__dirname, '..', 'build');
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

    const logoPath = 'D:/Laucher/imagems/LOGO.png';
    console.log('Loading LOGO.png from:', logoPath);
    const logoImg = nativeImage.createFromPath(logoPath);
    console.log('Logo dimensions:', logoImg.getSize());

    // 1. Save 512x512 PNG
    const png512 = logoImg.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
    fs.writeFileSync('src/renderer/assets/icon.png', png512);
    fs.writeFileSync(path.join(buildDir, 'icon.png'), png512);
    console.log('✅ Saved src/renderer/assets/icon.png and build/icon.png');

    // 2. Build multi-resolution Windows ICO (256, 128, 64, 48, 32, 16)
    const sizes = [256, 128, 64, 48, 32, 16];
    const pngBuffers = sizes.map(s => logoImg.resize({ width: s, height: s, quality: 'best' }).toPNG());
    const count = sizes.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(count, 4);

    let offset = 6 + (count * 16);
    const entry = [];
    for (let i = 0; i < count; i++) {
      const s = sizes[i];
      const pBuf = pngBuffers[i];
      const ent = Buffer.alloc(16);
      ent.writeUInt8(s === 256 ? 0 : s, 0);
      ent.writeUInt8(s === 256 ? 0 : s, 1);
      ent.writeUInt8(0, 2);
      ent.writeUInt8(0, 3);
      ent.writeUInt16LE(1, 4);
      ent.writeUInt16LE(32, 6);
      ent.writeUInt32LE(pBuf.length, 8);
      ent.writeUInt32LE(offset, 12);
      offset += pBuf.length;
      entry.push(ent);
    }

    const icoBuffer = Buffer.concat([header, ...entry, ...pngBuffers]);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
    const placeholderHeaderIcon = path.join(buildDir, 'installerHeaderIcon.ico');
    fs.writeFileSync(placeholderHeaderIcon, icoBuffer);
    console.log('✅ Saved high-res build/icon.ico and build/installerHeaderIcon.ico!');

    console.log('  UPDATE LOGO SUCCESSFUL!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    app.quit();
  }
});
