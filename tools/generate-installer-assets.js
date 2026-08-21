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

    const posterPath = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'images', 'forbidden_series_poster.jpg');
    const fallbackPath = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'images', 'forbidden_bg.png');
    const iconPath = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'icon.png');

    const sourceImgPath = fs.existsSync(posterPath) ? posterPath : fallbackPath;
    console.log('Loading source image for sidebar:', sourceImgPath);

    const srcImg = nativeImage.createFromPath(sourceImgPath);
    const { width: srcW, height: srcH } = srcImg.getSize();

    const targetW = 164;
    const targetH = 314;

    const cropWidth = Math.floor(srcH * (targetW / targetH));
    const cropX = 0;
    const cropped = srcImg.crop({ x: cropX, y: 0, width: Math.min(cropWidth, srcW), height: srcH });
    const resizedSidebar = cropped.resize({ width: targetW, height: targetH, quality: 'best' });

    const sidebarBitmap = resizedSidebar.toBitmap();
    const sidebarBmpBuf = createBmpBuffer(targetW, targetH, (x, y) => {
      const idx = (y * targetW + x) * 4;
      const r = sidebarBitmap[idx];
      const g = sidebarBitmap[idx + 1];
      const b = sidebarBitmap[idx + 2];
      return [b, g, r];
    });

    fs.writeFileSync(path.join(buildDir, 'installerSidebar.bmp'), sidebarBmpBuf);
    fs.writeFileSync(path.join(buildDir, 'uninstallerSidebar.bmp'), sidebarBmpBuf);
    console.log('Generated installerSidebar.bmp and uninstallerSidebar.bmp (164x314)');

    const iconImg = nativeImage.createFromPath(iconPath);
    const headW = 150;
    const headH = 57;
    const resizedHead = iconImg.resize({ width: 44, height: 44, quality: 'best' });
    const iconBitmap = resizedHead.toBitmap();

    const headerBmpBuf = createBmpBuffer(headW, headH, (x, y) => {
      let r = 18;
      let g = 14;
      let b = 22;

      const iconXStart = headW - 50;
      const iconYStart = 6;
      if (x >= iconXStart && x < iconXStart + 44 && y >= iconYStart && y < iconYStart + 44) {
        const ix = x - iconXStart;
        const iy = y - iconYStart;
        const iIdx = (iy * 44 + ix) * 4;
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
    console.log('Generated installerHeader.bmp (150x57)');

    fs.copyFileSync(iconPath, path.join(buildDir, 'icon.png'));
    console.log('All installer assets generated in /build!');
  } catch (e) {
    console.error('Error generating installer assets:', e);
  } finally {
    app.quit();
  }
});