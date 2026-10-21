import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Regenerates the NSIS installer artwork in src-tauri/nsis.
//
// The sidebar is the 164x314 image shown on the installer's Welcome and
// Finish pages. NSIS only reads BMP, so the PNG is kept alongside it as a
// preview. The source artwork lives in the repository (sidebar-source.jpg)
// so the script runs on any machine without external dependencies.

const NSIS_DIR = path.resolve('src-tauri/nsis');
const SOURCE_IMAGE = path.join(NSIS_DIR, 'sidebar-source.jpg');

function encodeBMP(width, height, rawRGBBuffer) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  // BITMAPFILEHEADER (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt32LE(54, 10);

  // BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive = bottom-up
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30); // BI_RGB
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38); // ~72 DPI
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 3;
      buf[rowOffset + x * 3] = rawRGBBuffer[srcIdx + 2]; // B
      buf[rowOffset + x * 3 + 1] = rawRGBBuffer[srcIdx + 1]; // G
      buf[rowOffset + x * 3 + 2] = rawRGBBuffer[srcIdx]; // R
    }
  }
  return buf;
}

async function main() {
  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`Missing source artwork: ${SOURCE_IMAGE}`);
  }

  fs.mkdirSync(NSIS_DIR, { recursive: true });

  console.log('Generating installer sidebar (164x314)...');
  const sidebarSharp = sharp(SOURCE_IMAGE)
    .resize(164, 314, { fit: 'cover', position: 'center' });

  const sidebarPngBuf = await sidebarSharp.clone().png().toBuffer();
  fs.writeFileSync(path.join(NSIS_DIR, 'installerSidebar.png'), sidebarPngBuf);

  const { data: rawSidebar, info: sidebarInfo } = await sidebarSharp
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const sidebarBmp = encodeBMP(sidebarInfo.width, sidebarInfo.height, rawSidebar);
  fs.writeFileSync(path.join(NSIS_DIR, 'installerSidebar.bmp'), sidebarBmp);

  console.log(`Saved installerSidebar.bmp (${sidebarBmp.length} bytes) and installerSidebar.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
