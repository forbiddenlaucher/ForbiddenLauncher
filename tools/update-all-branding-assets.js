const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

function createBmpBuffer(width, height, getPixelBgr) {
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt32LE(54, 10);

  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    let rowStart = offset;
    for (let x = 0; x < width; x++) {
      const [b, g, r] = getPixelBgr(x, y);
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    while (offset < rowStart + rowSize) {
      buf[offset++] = 0;
    }
  }

  return buf;
}

app.whenReady().then(async () => {
  try {
    const buildDir = path.join(__dirname, '..', 'build');
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

    const sidebarSrcPath = 'C:/Users/takamura/.gemini/antigravity/brain/5d5b4ebc-a280-4ba6-befa-1eafaca536c6/.user_uploaded/media_1787326640777.png';
    const emblemSrcPath = 'C:/Users/takamura/.gemini/antigravity/brain/5d5b4ebc-a280-4ba6-befa-1eafaca536c6/.user_uploaded/media_1787327732064.jpg';

    // 1. Generate Sidebar BMP (164 x 314) from castle portrait
    const sideBgImg = nativeImage.createFromPath(sidebarSrcPath);
    const resizedSidebar = sideBgImg.resize({ width: 164, height: 314, quality: 'best' });
    const sidebarBitmap = resizedSidebar.toBitmap();
    const sidebarBapBuf = createBmpBuffer(164, 314, (x, y) => {
      const idx = (y * 164 + x) * 4;
      return [sidebarBitmap[idx + 2], sidebarBitmap[idx + 1], sidebarBitmap[idx]];
    });

    fs.writeFileSync(path.join(buildDir, 'installerSidebar.bmp'), sidebarBapBuf);
    fs.writeFileSync(path.join(buildDir, 'uninstallerSidebar.bmp'), sidebarBapBuf);
    console.log('✅ Generated installerSidebar.bmp and uninstallerSidebar.bmp from new portrait!');

    // 2. Generate Emblem Icon (PNG & ICO)
    const emblemImg = nativeImage.createFromPath(emblemSrcPath);
    const png512 = emblemImg.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
    fs.writeFileSync('src/renderer/assets/icon.png', png512);
    fs.writeFileSync(path.join(buildDir, 'icon.png'), png512);

    // ICO Multiple Sizes
    const sizes = [256, 128, 64, 48, 32, 16];
    const pngBuffers = sizes.map(s => emblemImg.resize({ width: s, height: s, quality: 'best' }).toPNG());
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
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
    console.log('✅ Generated high-res build/icon.ico!');

    // 3. Generate Header BMP (150 x 57) with the new 3D emblem
    const headW = 150;
    const headH = 57;
    const resizedHead = emblemImg.resize({ width: 48, height: 48, quality: 'best' });
    const iconBitmap = resizedHead.toBitmap();

    const headerBmpBuf = createBmpBuffer(headW, headH, (x, y) => {
      // Smart dark gradient
      let r = 22;
      let g = 17;
      let b = 25;

      const iconXStart = headW - 53;
      const iconYStart = 4;
      if (x >= iconXStart && x < iconXStart + 48 && y >= iconYStart && y < iconYStart + 48) {
        const ix = x - iconXStart;
        const iy = y - iconYStart;
        const iIdx = (iy * 48 + ix) * 4;
        const alpha = iconBitmap[iIdx + 3] / 255;
        if (alpha > 0) {
          r = Math.round(iconBitmap[iIdx] * alpha + r * (1 - alpha));
          g = Math.round(iconBitmap[iIdx + 1] * alpha + g * (1 - alpha));
          b = Math.round(iconBitmap[iIdx + 2] * alpha + b * (1 - alpha));
        }
      }
      return [b, g, r];
    });

    fs.writeFileSync(path.join(buildDir, 'installerHeader.bmp'), headerBmpBuf);
    console.log('✅ Generated installerHeader.bmp (150x57)!');

    console.log('🎉 All new branding assets successfully applied!');
  } catch (e) {
    console.error('Error updating assets:', e);
  } finally {
    app.quit();
  }
});
