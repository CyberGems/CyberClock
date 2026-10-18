import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
  const sourceImage = 'C:/Users/CARLOS/.gemini/antigravity-ide/brain/a2c918fe-3e36-45a4-b506-18b39d9f946e/cyberclock_installer_sidebar_1792283900787.jpg';
  const outDirs = [
    path.resolve('src-tauri/nsis'),
    'C:/Users/CARLOS/.gemini/antigravity-ide/brain/a2c918fe-3e36-45a4-b506-18b39d9f946e'
  ];

  for (const dir of outDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log('Generating installer sidebar (164x314)...');
  // Resize source image to 164x314 with cover / center fit
  const sidebarSharp = sharp(sourceImage)
    .resize(164, 314, { fit: 'cover', position: 'center' });

  const sidebarPngBuf = await sidebarSharp.clone().png().toBuffer();
  for (const dir of outDirs) {
    fs.writeFileSync(path.join(dir, 'installerSidebar.png'), sidebarPngBuf);
  }

  // Get raw RGB buffer for BMP
  const { data: rawSidebar, info: sidebarInfo } = await sidebarSharp
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const sidebarBmp = encodeBMP(sidebarInfo.width, sidebarInfo.height, rawSidebar);
  for (const dir of outDirs) {
    fs.writeFileSync(path.join(dir, 'installerSidebar.bmp'), sidebarBmp);
  }
  console.log(`Saved installerSidebar.bmp (${sidebarBmp.length} bytes) and installerSidebar.png`);

  console.log('Generating installer header (150x57)...');
  // For header, create a clean modern 150x57 banner:
  // soft tech gradient on white/pale cyan with logo on right
  const logoSharp = sharp(path.resolve('src-tauri/icons/icon.png'))
    .resize(44, 44, { fit: 'contain' });
  const logoBuf = await logoSharp.png().toBuffer();

  const svgHeader = `
    <svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="60%" stop-color="#F6F9FD" />
          <stop offset="100%" stop-color="#E8F1FC" />
        </linearGradient>
      </defs>
      <rect width="150" height="57" fill="url(#headerGrad)" />
      <circle cx="126" cy="28" r="24" fill="#06B6D4" opacity="0.08" />
      <circle cx="126" cy="28" r="16" fill="#3B82F6" opacity="0.06" />
    </svg>
  `;

  const headerSharp = sharp(Buffer.from(svgHeader))
    .composite([
      {
        input: logoBuf,
        top: 6,
        left: 98,
      },
    ]);

  const headerPngBuf = await headerSharp.clone().png().toBuffer();
  for (const dir of outDirs) {
    fs.writeFileSync(path.join(dir, 'installerHeader.png'), headerPngBuf);
  }

  const { data: rawHeader, info: headerInfo } = await headerSharp
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const headerBmp = encodeBMP(headerInfo.width, headerInfo.height, rawHeader);
  for (const dir of outDirs) {
    fs.writeFileSync(path.join(dir, 'installerHeader.bmp'), headerBmp);
  }
  console.log(`Saved installerHeader.bmp (${headerBmp.length} bytes) and installerHeader.png`);
}

main().catch(console.error);
