// Erzeugt App-Icons (Homescreen, PWA, Favicon) aus einer SVG-Vorlage.
// Aufruf: node scripts/icons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const dumbbell = `
  <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>
  <path d="m2.5 21.5 1.4-1.4"/>
  <path d="m20.1 3.9 1.4-1.4"/>
  <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>
  <path d="m9.6 14.4 4.8-4.8"/>`;

/** @param {{ rounded: boolean; scale: number }} options */
function svg({ rounded, scale }) {
  const size = 512;
  const icon = 24 * scale;
  const offset = (size - icon) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a1a"/>
      <stop offset="1" stop-color="#0f0f0f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#fe8c35" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#fe8c35" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fg" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#ff743e"/>
      <stop offset="0.5" stop-color="#fe8c35"/>
      <stop offset="1" stop-color="#ffa30a"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${rounded ? 112 : 0}" fill="url(#glow)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="url(#fg)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${dumbbell}
  </g>
</svg>`;
}

const full = svg({ rounded: false, scale: 11 });
const maskable = svg({ rounded: false, scale: 8.5 });
const favicon = svg({ rounded: true, scale: 12 });

await writeFile('public/favicon.svg', favicon);
await sharp(Buffer.from(full)).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await sharp(Buffer.from(full)).resize(192, 192).png().toFile('public/pwa-192x192.png');
await sharp(Buffer.from(full)).resize(512, 512).png().toFile('public/pwa-512x512.png');
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile('public/maskable-icon-512x512.png');
console.log('Icons erzeugt.');
