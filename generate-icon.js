/**
 * generate-icon.js
 *
 * Pure Node.js script to generate pixel-art "S" icons for the Synchron app.
 * No npm dependencies — writes raw PNG and ICO binary data using only
 * the built-in 'zlib' and 'fs' modules.
 *
 * Outputs:
 *   assets/icon.png      — 256x256 pixel-art icon
 *   assets/tray-icon.png — 16x16 tray icon
 *   assets/icon.ico      — multi-size ICO (16, 32, 48, 256)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
const COLORS = {
  bg:         [0x1a, 0x1a, 0x2e, 0xff],  // dark blue background
  bgDark:     [0x0f, 0x0e, 0x17, 0xff],  // darker shade for depth
  gold:       [0xf5, 0xc5, 0x42, 0xff],  // primary gold
  goldDark:   [0xc4, 0x9a, 0x2a, 0xff],  // shadow gold
  goldLight:  [0xff, 0xdd, 0x77, 0xff],  // highlight gold
  green:      [0x2e, 0xe6, 0x7a, 0xff],  // accent green
  greenDark:  [0x1a, 0xaa, 0x55, 0xff],  // dark green
  border:     [0xd4, 0xa8, 0x30, 0xff],  // border gold
  borderDark: [0x8a, 0x6e, 0x1e, 0xff],  // dark border edge
  stone:      [0x2a, 0x2a, 0x44, 0xff],  // stone background
  stoneDark:  [0x20, 0x20, 0x38, 0xff],  // darker stone
  stoneLight: [0x34, 0x34, 0x55, 0xff],  // lighter stone highlight
  transparent:[0x00, 0x00, 0x00, 0x00],
};

// ---------------------------------------------------------------------------
// 16x16 pixel art template
// Each cell is a key into COLORS. This is the master design; larger sizes
// are scaled up from this grid (with some extra detail added).
// ---------------------------------------------------------------------------
// Legend:
//   .  = transparent
//   B  = borderDark  (outer edge shadow)
//   b  = border      (outer edge highlight)
//   S  = stone       (inner background)
//   s  = stoneDark   (inner shadow)
//   L  = stoneLight  (inner highlight)
//   G  = gold        (the S letter)
//   g  = goldDark    (S letter shadow)
//   H  = goldLight   (S letter highlight)
//   E  = green       (small accent sparkle)
//   d  = bgDark      (corner)

const PIXEL_MAP_16 = [
  '..BbbbbbbbbbBB..',
  '.BbbbbbbbbbbbbB.',
  'BbLSSSSSSSSSSsbB',
  'bLSSSSSSSSSSSSsb',
  'bSSSHGGGGGg.SSb',
  'bSSHGGGGGGGg.Sb',
  'bSSHGGg.......Sb',
  'bSSSHGGGGGg..Sb',
  'bSSS.gGGGGGGgSb',
  'bSSS......gGGSb',
  'bSS.gGGGGGGGSsb',
  'bSSS.gGGGGGgSSb',
  'bsSSSSSSSSSSSSsb',
  'BbsSSSSSSSSSsLbB',
  '.BbbbbbbbbbbbbB.',
  '..BBbbbbbbbbBB..',
];

// Map characters to color keys
const CHAR_TO_COLOR = {
  '.': 'bg',
  'B': 'borderDark',
  'b': 'border',
  'S': 'stone',
  's': 'stoneDark',
  'L': 'stoneLight',
  'G': 'gold',
  'g': 'goldDark',
  'H': 'goldLight',
  'E': 'green',
  'd': 'bgDark',
};

// ---------------------------------------------------------------------------
// PNG writing utilities
// ---------------------------------------------------------------------------

/** Compute CRC32 for PNG chunks */
function crc32(buf) {
  // Build table on first call
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crc32.table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Create a PNG chunk: 4-byte length, 4-byte type, data, 4-byte CRC */
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([length, typeBytes, data, crcBuf]);
}

/** Build a complete PNG file from an RGBA pixel buffer */
function buildPNG(width, height, rgbaBuffer) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth 8, color type 6 (RGBA), compression 0, filter 0, interlace 0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter method
  ihdr[12] = 0;  // interlace

  // Build raw scanline data: each row gets a filter byte (0 = None) + pixel data
  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + rowBytes);
    raw[offset] = 0; // filter: None
    rgbaBuffer.copy(raw, offset + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  // Compress with zlib deflate
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // Build IDAT chunk
  const idatChunk = pngChunk('IDAT', compressed);

  // IHDR chunk
  const ihdrChunk = pngChunk('IHDR', ihdr);

  // IEND chunk
  const iendChunk = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ---------------------------------------------------------------------------
// Pixel art rendering
// ---------------------------------------------------------------------------

/**
 * Render the 16x16 design into an RGBA buffer at the given output size.
 * Uses nearest-neighbor scaling (preserves pixel-art crispness).
 */
function renderIcon(size) {
  const gridW = 16;
  const gridH = 16;
  const buf = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Map output pixel to grid cell
      const gx = Math.floor(x * gridW / size);
      const gy = Math.floor(y * gridH / size);

      const row = PIXEL_MAP_16[gy] || '';
      const ch = row[gx] || '.';
      const colorKey = CHAR_TO_COLOR[ch] || 'bg';
      const rgba = COLORS[colorKey];

      const idx = (y * size + x) * 4;
      buf[idx]     = rgba[0];
      buf[idx + 1] = rgba[1];
      buf[idx + 2] = rgba[2];
      buf[idx + 3] = rgba[3];
    }
  }

  // For sizes >= 32, add some extra detail: a subtle green sparkle in the
  // upper-right area and a small shadow gradient along the bottom/right edges.
  if (size >= 32) {
    addDetails(buf, size);
  }

  return buf;
}

/**
 * Add extra embellishments for larger icon sizes.
 */
function addDetails(buf, size) {
  const scale = size / 16;

  // Helper: set pixel if it's currently a "stone" family color
  function setPixelIfStone(px, py, rgba) {
    if (px < 0 || px >= size || py < 0 || py >= size) return;
    const idx = (py * size + px) * 4;
    const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
    // Check if it's a stone-ish color
    if (r >= 0x1a && r <= 0x3a && g >= 0x1a && g <= 0x3a && b >= 0x30 && b <= 0x60) {
      buf[idx]     = rgba[0];
      buf[idx + 1] = rgba[1];
      buf[idx + 2] = rgba[2];
      buf[idx + 3] = rgba[3];
    }
  }

  // Add a couple of green accent sparkle pixels (like Terraria item sparkles)
  const sparkles = [
    [12, 2],
    [13, 3],
    [3, 12],
  ];
  for (const [gx, gy] of sparkles) {
    const px = Math.floor(gx * scale + scale / 2);
    const py = Math.floor(gy * scale + scale / 2);
    // Small cross pattern for each sparkle
    setPixelIfStone(px, py, COLORS.green);
    if (scale >= 2) {
      setPixelIfStone(px - 1, py, COLORS.greenDark);
      setPixelIfStone(px + 1, py, COLORS.greenDark);
      setPixelIfStone(px, py - 1, COLORS.greenDark);
      setPixelIfStone(px, py + 1, COLORS.greenDark);
    }
  }

  // For 256px: add a very subtle diagonal "shine" streak across the stone
  if (size >= 128) {
    for (let i = 0; i < size * 0.4; i++) {
      const px = Math.floor(size * 0.15 + i);
      const py = Math.floor(size * 0.15 + i * 0.5);
      if (px >= size || py >= size) break;
      const idx = (py * size + px) * 4;
      const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
      // Lighten stone pixels slightly
      if (r >= 0x1a && r <= 0x3a && g >= 0x1a && g <= 0x3a && b >= 0x30 && b <= 0x60) {
        buf[idx]     = Math.min(255, r + 8);
        buf[idx + 1] = Math.min(255, g + 8);
        buf[idx + 2] = Math.min(255, b + 12);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ICO file builder
// ---------------------------------------------------------------------------

/**
 * Build an ICO file containing multiple PNG images.
 * ICO format:
 *   6-byte header: reserved(2) + type(2, =1 for ICO) + count(2)
 *   For each image: 16-byte directory entry
 *   Then the image data (embedded PNGs)
 */
function buildICO(pngBuffers) {
  // pngBuffers: array of { size, png } where png is a Buffer of PNG data
  const count = pngBuffers.length;

  // Header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = ICO
  header.writeUInt16LE(count, 4); // image count

  // Directory entries: 16 bytes each
  const dirSize = count * 16;
  const directory = Buffer.alloc(dirSize);

  // Data offset starts after header + directory
  let dataOffset = 6 + dirSize;
  const pngDatas = [];

  for (let i = 0; i < count; i++) {
    const { size, png } = pngBuffers[i];
    const offset = i * 16;

    // Width (0 = 256)
    directory.writeUInt8(size >= 256 ? 0 : size, offset + 0);
    // Height (0 = 256)
    directory.writeUInt8(size >= 256 ? 0 : size, offset + 1);
    // Color palette count (0 for no palette)
    directory.writeUInt8(0, offset + 2);
    // Reserved
    directory.writeUInt8(0, offset + 3);
    // Color planes
    directory.writeUInt16LE(1, offset + 4);
    // Bits per pixel
    directory.writeUInt16LE(32, offset + 6);
    // Image data size
    directory.writeUInt32LE(png.length, offset + 8);
    // Offset to image data
    directory.writeUInt32LE(dataOffset, offset + 12);

    dataOffset += png.length;
    pngDatas.push(png);
  }

  return Buffer.concat([header, directory, ...pngDatas]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const assetsDir = path.join(__dirname, 'assets');

  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('Generating Synchron pixel-art icons...');
  console.log('');

  // Generate each size
  const sizes = [16, 32, 48, 256];
  const pngs = {};

  for (const size of sizes) {
    console.log(`  Rendering ${size}x${size}...`);
    const rgba = renderIcon(size);
    const png = buildPNG(size, size, rgba);
    pngs[size] = png;
  }

  // Write 256x256 icon
  const iconPath = path.join(assetsDir, 'icon.png');
  fs.writeFileSync(iconPath, pngs[256]);
  console.log(`\n  Saved: ${iconPath} (${pngs[256].length} bytes)`);

  // Write 16x16 tray icon
  const trayPath = path.join(assetsDir, 'tray-icon.png');
  fs.writeFileSync(trayPath, pngs[16]);
  console.log(`  Saved: ${trayPath} (${pngs[16].length} bytes)`);

  // Build and write ICO (contains 16, 32, 48, 256)
  const icoData = buildICO([
    { size: 16,  png: pngs[16]  },
    { size: 32,  png: pngs[32]  },
    { size: 48,  png: pngs[48]  },
    { size: 256, png: pngs[256] },
  ]);
  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoData);
  console.log(`  Saved: ${icoPath} (${icoData.length} bytes)`);

  console.log('\nDone! All icons generated successfully.');
}

main();
