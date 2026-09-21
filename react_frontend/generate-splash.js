// generate-splash.js (ES Module)
// Run from your react_frontend project root:
//   npm install sharp --save-dev
//   node generate-splash.js
//
// Note: this requires ES module support. Either:
//   1) add "type": "module" to your package.json, OR
//   2) rename this file to generate-splash.mjs and run `node generate-splash.mjs`

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = path.join(__dirname, 'public', 'logo.jpeg');
const OUTPUT_DIR = path.join(__dirname, 'resources');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'splash.png');

const CANVAS_SIZE = 2732;
const BG_COLOR = '#0a0a0f';       // Xircle dark background
const LOGO_SIZE = 900;             // logo width/height in px on the canvas
const TEXT = 'By Lovoh Create';
const TEXT_COLOR = '#5eead4';      // teal-300, soft accent
const FONT_SIZE = 42;

async function generateSplash() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Resize the logo, keep transparent/contained
  const logoBuffer = await sharp(LOGO_PATH)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain' })
    .toBuffer();

  // Build text as SVG (crisp at any resolution, easy to position)
  const textSvg = `
    <svg width="${CANVAS_SIZE}" height="200">
      <text
        x="50%"
        y="60"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="${FONT_SIZE}"
        font-weight="300"
        letter-spacing="4"
        fill="${TEXT_COLOR}"
      >${TEXT}</text>
    </svg>
  `;
  const textBuffer = Buffer.from(textSvg);

  // Compose: solid bg + logo centered + text near bottom
  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: logoBuffer,
        top: Math.round((CANVAS_SIZE - LOGO_SIZE) / 2) - 100,
        left: Math.round((CANVAS_SIZE - LOGO_SIZE) / 2),
      },
      {
        input: textBuffer,
        top: CANVAS_SIZE - 500,
        left: 0,
      },
    ])
    .png()
    .toFile(OUTPUT_PATH);

  console.log('✅ Splash generated at:', OUTPUT_PATH);
}

generateSplash().catch((err) => {
  console.error('❌ Failed to generate splash:', err);
  process.exit(1);
});