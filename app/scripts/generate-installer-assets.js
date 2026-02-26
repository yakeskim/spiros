/**
 * generate-installer-assets.js
 *
 * Generates branded NSIS installer bitmaps for Spiros.
 * No npm dependencies — writes raw BMP binary data.
 *
 * Outputs:
 *   assets/installer-header.bmp   — 150x57  (top banner during install steps)
 *   assets/installer-sidebar.bmp  — 164x314 (welcome/finish page sidebar)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Color palette (BGRA for BMP)
// ---------------------------------------------------------------------------
const C = {
  bg:        [0x17, 0x0e, 0x0f, 0xff],  // #0f0e17
  bgDark:    [0x2e, 0x1a, 0x1a, 0xff],  // #1a1a2e
  panel:     [0x46, 0x29, 0x23, 0xff],  // #232946
  gold:      [0x42, 0xc5, 0xf5, 0xff],  // #f5c542
  goldDark:  [0x2a, 0x9a, 0xc4, 0xff],  // #c49a2a
  goldLight: [0x77, 0xdd, 0xff, 0xff],  // #ffdd77
  green:     [0x7a, 0xe6, 0x2e, 0xff],  // #2ee67a
  textDim:   [0xaa, 0x88, 0x88, 0xff],  // #8888aa
  textBright:[0xfe, 0xff, 0xff, 0xff],  // #fffffe
  border:    [0x30, 0xa8, 0xd4, 0xff],  // #d4a830
  borderDk:  [0x1e, 0x6e, 0x8a, 0xff],  // #8a6e1e
  stone:     [0x44, 0x2a, 0x2a, 0xff],  // #2a2a44
  stoneDk:   [0x38, 0x20, 0x20, 0xff],  // #202038
  stoneLt:   [0x55, 0x34, 0x34, 0xff],  // #343455
};

// The 16x16 pixel art "S" logo (same as generate-icon.js)
const PIXEL_MAP = [
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

const CHAR_COLOR = {
  '.': 'bg', 'B': 'borderDk', 'b': 'border', 'S': 'stone',
  's': 'stoneDk', 'L': 'stoneLt', 'G': 'gold', 'g': 'goldDark',
  'H': 'goldLight', 'E': 'green',
};

// ---------------------------------------------------------------------------
// BMP writer (24-bit, bottom-up, no compression)
// ---------------------------------------------------------------------------
function buildBMP(width, height, pixelFn) {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows padded to 4-byte boundary
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize);

  // BMP file header (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);        // reserved
  buf.writeUInt32LE(54, 10);      // pixel data offset

  // DIB header (40 bytes — BITMAPINFOHEADER)
  buf.writeUInt32LE(40, 14);      // header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);   // positive = bottom-up
  buf.writeUInt16LE(1, 26);       // color planes
  buf.writeUInt16LE(24, 28);      // bits per pixel
  buf.writeUInt32LE(0, 30);       // compression (none)
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38);     // h resolution (72 dpi)
  buf.writeInt32LE(2835, 42);     // v resolution
  buf.writeUInt32LE(0, 46);       // palette colors
  buf.writeUInt32LE(0, 50);       // important colors

  // Pixel data (bottom-up: row 0 in BMP = bottom of image)
  for (let y = 0; y < height; y++) {
    const bmpY = height - 1 - y; // flip for bottom-up
    const rowOffset = 54 + bmpY * rowSize;
    for (let x = 0; x < width; x++) {
      const [b, g, r] = pixelFn(x, y);
      const off = rowOffset + x * 3;
      buf[off]     = b;
      buf[off + 1] = g;
      buf[off + 2] = r;
    }
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Draw the icon at a given position/size into a pixel callback
// ---------------------------------------------------------------------------
function getIconPixel(x, y, iconX, iconY, iconSize) {
  const lx = x - iconX;
  const ly = y - iconY;
  if (lx < 0 || lx >= iconSize || ly < 0 || ly >= iconSize) return null;

  const gx = Math.floor(lx * 16 / iconSize);
  const gy = Math.floor(ly * 16 / iconSize);
  const row = PIXEL_MAP[gy] || '';
  const ch = row[gx] || '.';
  const colorKey = CHAR_COLOR[ch] || 'bg';
  if (ch === '.') return null; // transparent — let background show
  return C[colorKey];
}

// ---------------------------------------------------------------------------
// 5x5 pixel font for tiny text
// ---------------------------------------------------------------------------
const FONT = {
  'S': ['_##_', '#___', '_##_', '___#', '_##_'],
  'Y': ['#___#', '_#_#_', '__#__', '__#__', '__#__'],
  'N': ['#___#', '##__#', '#_#_#', '#__##', '#___#'],
  'C': ['_###', '#___', '#___', '#___', '_###'],
  'H': ['#___#', '#___#', '#####', '#___#', '#___#'],
  'R': ['####_', '#___#', '####_', '#_#__', '#__##'],
  'O': ['_###_', '#___#', '#___#', '#___#', '_###_'],
  ' ': ['____', '____', '____', '____', '____'],
  'D': ['####_', '#___#', '#___#', '#___#', '####_'],
  'E': ['####', '#___', '###_', '#___', '####'],
  'K': ['#__#', '#_#_', '##__', '#_#_', '#__#'],
  'T': ['#####', '__#__', '__#__', '__#__', '__#__'],
  'P': ['####_', '#___#', '####_', '#____', '#____'],
  'A': ['_###_', '#___#', '#####', '#___#', '#___#'],
  'I': ['###', '_#_', '_#_', '_#_', '###'],
  'V': ['#___#', '#___#', '_#_#_', '_#_#_', '__#__'],
  'L': ['#___', '#___', '#___', '#___', '####'],
  'G': ['_####', '#____', '#_###', '#___#', '_####'],
  'Q': ['_###_', '#___#', '#_#_#', '#__#_', '_##_#'],
  'U': ['#___#', '#___#', '#___#', '#___#', '_###_'],
  'W': ['#___#', '#___#', '#_#_#', '##_##', '#___#'],
  'X': ['#___#', '_#_#_', '__#__', '_#_#_', '#___#'],
  'F': ['####', '#___', '###_', '#___', '#___'],
  'B': ['####_', '#___#', '####_', '#___#', '####_'],
  'J': ['__###', '___#_', '___#_', '#__#_', '_##__'],
  'M': ['#___#', '##_##', '#_#_#', '#___#', '#___#'],
  'Z': ['#####', '___#_', '__#__', '_#___', '#####'],
  '0': ['_###_', '#__##', '#_#_#', '##__#', '_###_'],
  '1': ['_#_', '##_', '_#_', '_#_', '###'],
  '2': ['_##_', '#__#', '__#_', '_#__', '####'],
  '3': ['####', '___#', '_##_', '___#', '####'],
  '4': ['#__#', '#__#', '####', '___#', '___#'],
  '5': ['####', '#___', '###_', '___#', '###_'],
  '6': ['_##_', '#___', '###_', '#__#', '_##_'],
  '7': ['####', '___#', '__#_', '_#__', '_#__'],
  '8': ['_##_', '#__#', '_##_', '#__#', '_##_'],
  '9': ['_##_', '#__#', '_###', '___#', '_##_'],
  '.': ['_', '_', '_', '_', '#'],
  '-': ['____', '____', '####', '____', '____'],
};

function drawText(pixelFn, text, startX, startY, color, scale = 1) {
  let cursorX = startX;
  for (const ch of text) {
    const glyph = FONT[ch.toUpperCase()];
    if (!glyph) { cursorX += 4 * scale; continue; }
    const glyphWidth = glyph[0].length;
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < glyphWidth; gx++) {
        if (glyph[gy][gx] === '#') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              pixelFn(cursorX + gx * scale + sx, startY + gy * scale + sy, color);
            }
          }
        }
      }
    }
    cursorX += (glyphWidth + 1) * scale;
  }
}

// ---------------------------------------------------------------------------
// Generate installer header (150x57)
// ---------------------------------------------------------------------------
function generateHeader() {
  const W = 150, H = 57;
  const pixels = [];
  for (let i = 0; i < W * H; i++) pixels.push([...C.bg]);

  const set = (x, y, color) => {
    if (x >= 0 && x < W && y >= 0 && y < H) pixels[y * W + x] = color;
  };

  // Background: subtle gradient from bg to bgDark
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const b = Math.round(C.bg[0] + (C.bgDark[0] - C.bg[0]) * t);
      const g = Math.round(C.bg[1] + (C.bgDark[1] - C.bg[1]) * t);
      const r = Math.round(C.bg[2] + (C.bgDark[2] - C.bg[2]) * t);
      pixels[y * W + x] = [b, g, r];
    }
  }

  // Top and bottom gold accent lines
  for (let x = 0; x < W; x++) {
    set(x, 0, C.goldDark);
    set(x, 1, C.gold);
    set(x, H - 2, C.gold);
    set(x, H - 1, C.goldDark);
  }

  // Draw the icon (32x32) on the left
  const iconSize = 32;
  const iconX = 8;
  const iconY = Math.floor((H - iconSize) / 2);
  for (let y = iconY; y < iconY + iconSize; y++) {
    for (let x = iconX; x < iconX + iconSize; x++) {
      const c = getIconPixel(x, y, iconX, iconY, iconSize);
      if (c) set(x, y, c);
    }
  }

  // "SYNCHRON" text
  drawText(set, 'SYNCHRON', 48, 16, C.gold, 2);

  // "Desktop Tracker" subtitle
  drawText(set, 'DESKTOP TRACKER', 48, 36, C.textDim, 1);

  return buildBMP(W, H, (x, y) => pixels[y * W + x]);
}

// ---------------------------------------------------------------------------
// Generate installer sidebar (164x314)
// ---------------------------------------------------------------------------
function generateSidebar() {
  const W = 164, H = 314;
  const pixels = [];
  for (let i = 0; i < W * H; i++) pixels.push([...C.bg]);

  const set = (x, y, color) => {
    if (x >= 0 && x < W && y >= 0 && y < H) pixels[y * W + x] = color;
  };

  // Background: gradient from top (darker) to bottom (slightly lighter panel)
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const b = Math.round(C.bg[0] + (C.panel[0] - C.bg[0]) * t * 0.3);
      const g = Math.round(C.bg[1] + (C.panel[1] - C.bg[1]) * t * 0.3);
      const r = Math.round(C.bg[2] + (C.panel[2] - C.bg[2]) * t * 0.3);
      pixels[y * W + x] = [b, g, r];
    }
  }

  // Right edge gold accent line
  for (let y = 0; y < H; y++) {
    set(W - 1, y, C.goldDark);
    set(W - 2, y, C.gold);
  }

  // Draw the icon (64x64) centered near top
  const iconSize = 64;
  const iconX = Math.floor((W - iconSize) / 2);
  const iconY = 40;
  for (let y = iconY; y < iconY + iconSize; y++) {
    for (let x = iconX; x < iconX + iconSize; x++) {
      const c = getIconPixel(x, y, iconX, iconY, iconSize);
      if (c) set(x, y, c);
    }
  }

  // "SYNCHRON" text centered below icon
  const textY = iconY + iconSize + 20;
  drawText(set, 'SYNCHRON', Math.floor((W - 8 * 6 * 2) / 2) + 4, textY, C.gold, 2);

  // Decorative line separator
  const lineY = textY + 18;
  for (let x = 20; x < W - 20; x++) {
    set(x, lineY, C.goldDark);
  }

  // Tagline
  drawText(set, 'TRACK YOUR', Math.floor((W - 10 * 5) / 2), lineY + 12, C.textDim, 1);
  drawText(set, 'DIGITAL QUEST', Math.floor((W - 13 * 5) / 2), lineY + 22, C.textDim, 1);

  // Version at bottom
  drawText(set, 'V1.0.0', Math.floor((W - 6 * 5) / 2), H - 30, C.textDim, 1);

  // Decorative pixel dots scattered
  const dots = [
    [20, 200], [40, 220], [130, 190], [100, 250], [60, 270],
    [25, 240], [120, 230], [80, 260], [140, 260], [30, 280],
  ];
  for (const [dx, dy] of dots) {
    set(dx, dy, C.goldDark);
  }

  // Small green accent sparkles
  const sparkles = [[30, 180], [125, 210], [70, 285]];
  for (const [sx, sy] of sparkles) {
    set(sx, sy, C.green);
    set(sx - 1, sy, C.goldDark);
    set(sx + 1, sy, C.goldDark);
    set(sx, sy - 1, C.goldDark);
    set(sx, sy + 1, C.goldDark);
  }

  return buildBMP(W, H, (x, y) => pixels[y * W + x]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  console.log('Generating NSIS installer assets...\n');

  const header = generateHeader();
  const headerPath = path.join(assetsDir, 'installer-header.bmp');
  fs.writeFileSync(headerPath, header);
  console.log(`  Saved: installer-header.bmp (150x57, ${header.length} bytes)`);

  const sidebar = generateSidebar();
  const sidebarPath = path.join(assetsDir, 'installer-sidebar.bmp');
  fs.writeFileSync(sidebarPath, sidebar);
  console.log(`  Saved: installer-sidebar.bmp (164x314, ${sidebar.length} bytes)`);

  console.log('\nDone! Installer assets generated.');
}

main();
