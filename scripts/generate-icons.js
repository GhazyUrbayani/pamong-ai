#!/usr/bin/env node
/**
 * Generate PWA icons programmatically using canvas.
 * Requires: npm install canvas (already available via node)
 * Fallback: uses pure SVG -> PNG conversion via sharp if available,
 * otherwise writes SVG files that browsers can use.
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

// SVG icon definition - owl on book motif for PAMONG AI
function generateSVG(size) {
  const scale = size / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="${size * 0.18}" fill="#09090e"/>
  
  <!-- Glow effect -->
  <circle cx="256" cy="256" r="180" fill="#4f46e5" opacity="0.15"/>
  
  <!-- Book base -->
  <rect x="120" y="290" width="272" height="160" rx="12" fill="#312e81"/>
  <rect x="120" y="290" width="134" height="160" rx="12" fill="#3730a3"/>
  <line x1="256" y1="290" x2="256" y2="450" stroke="#6366f1" stroke-width="3"/>
  
  <!-- Book pages detail -->
  <rect x="134" y="305" width="108" height="6" rx="3" fill="#6366f1" opacity="0.5"/>
  <rect x="134" y="320" width="88" height="6" rx="3" fill="#6366f1" opacity="0.5"/>
  <rect x="134" y="335" width="98" height="6" rx="3" fill="#6366f1" opacity="0.5"/>
  <rect x="270" y="305" width="108" height="6" rx="3" fill="#818cf8" opacity="0.5"/>
  <rect x="270" y="320" width="88" height="6" rx="3" fill="#818cf8" opacity="0.5"/>
  <rect x="270" y="335" width="98" height="6" rx="3" fill="#818cf8" opacity="0.5"/>
  
  <!-- Owl body -->
  <ellipse cx="256" cy="230" rx="85" ry="100" fill="#4f46e5"/>
  
  <!-- Owl wings -->
  <ellipse cx="175" cy="255" rx="45" ry="75" fill="#3730a3" transform="rotate(-15 175 255)"/>
  <ellipse cx="337" cy="255" rx="45" ry="75" fill="#3730a3" transform="rotate(15 337 255)"/>
  
  <!-- Owl head -->
  <circle cx="256" cy="155" r="72" fill="#4f46e5"/>
  
  <!-- Ear tufts -->
  <polygon points="208,95 196,62 224,82" fill="#6366f1"/>
  <polygon points="304,95 316,62 288,82" fill="#6366f1"/>
  
  <!-- Eyes - glowing -->
  <circle cx="228" cy="155" r="26" fill="#09090e"/>
  <circle cx="284" cy="155" r="26" fill="#09090e"/>
  <circle cx="228" cy="155" r="18" fill="#fbbf24"/>
  <circle cx="284" cy="155" r="18" fill="#fbbf24"/>
  <circle cx="228" cy="155" r="10" fill="#09090e"/>
  <circle cx="284" cy="155" r="10" fill="#09090e"/>
  <!-- Eye shine -->
  <circle cx="233" cy="150" r="4" fill="white" opacity="0.9"/>
  <circle cx="289" cy="150" r="4" fill="white" opacity="0.9"/>
  
  <!-- Beak -->
  <polygon points="256,168 244,185 268,185" fill="#fbbf24"/>
  
  <!-- Chest feathers -->
  <ellipse cx="256" cy="260" rx="55" ry="65" fill="#6366f1" opacity="0.4"/>
  
  <!-- Glow sparkles -->
  <circle cx="340" cy="120" r="6" fill="#fbbf24" opacity="0.8"/>
  <circle cx="355" cy="100" r="4" fill="#fbbf24" opacity="0.6"/>
  <circle cx="330" cy="95" r="3" fill="#fbbf24" opacity="0.5"/>
  <circle cx="172" cy="110" r="5" fill="#818cf8" opacity="0.7"/>
  <circle cx="158" cy="90" r="3" fill="#818cf8" opacity="0.5"/>
</svg>`;
}

// Write SVG versions (512 and 192)
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.svg'), generateSVG(512));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.svg'), generateSVG(192));

// Also write PNG placeholders using base64 embedded SVG
// Real PNG generation requires canvas or sharp - use SVG as source
// For production: run: npx sharp-cli -i icon-512.svg -o icon-512.png resize 512 512

console.log('✅ SVG icons generated at public/icons/');
console.log('   To convert to PNG: npm install -g sharp-cli && sharp -i public/icons/icon-512.svg -o public/icons/icon-512.png');

// Try to use sharp if available
try {
  const sharp = require('sharp');
  const svg512 = Buffer.from(generateSVG(512));
  const svg192 = Buffer.from(generateSVG(192));
  
  Promise.all([
    sharp(svg512).png().toFile(path.join(ICONS_DIR, 'icon-512.png')),
    sharp(svg192).png().toFile(path.join(ICONS_DIR, 'icon-192.png')),
    sharp(svg192).png().toFile(path.join(ICONS_DIR, 'apple-touch-icon.png')),
  ]).then(() => {
    console.log('✅ PNG icons generated successfully via sharp!');
  }).catch(console.error);
} catch {
  // sharp not available - SVG icons will work for dev, PWA manifest can reference SVGs
  console.log('ℹ️  sharp not installed, using SVG icons (works in Chrome/Firefox)');
  
  // Copy SVG as PNG names for manifest compatibility during dev
  fs.copyFileSync(path.join(ICONS_DIR, 'icon-512.svg'), path.join(ICONS_DIR, 'icon-512.png.svg'));
  
  // Write the manifest-compatible SVG icons
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), fs.readFileSync(path.join(ICONS_DIR, 'icon-512.svg')));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), fs.readFileSync(path.join(ICONS_DIR, 'icon-192.svg')));
  fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), fs.readFileSync(path.join(ICONS_DIR, 'icon-192.svg')));
  console.log('ℹ️  Written SVG content as .png files (works for PWA in dev)');
}
