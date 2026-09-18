// Generates the Hangly tray icon PNG using Electron's built-in nativeImage
// Run: node scripts/gen-icon.js
'use strict';

const fs   = require('fs');
const path = require('path');

// We'll use Electron's nativeImage to rasterise the SVG
const { nativeImage } = require('electron');

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');

const img = nativeImage.createFromPath(svgPath);
const buf = img.resize({ width: 256, height: 256 }).toPNG();
fs.writeFileSync(pngPath, buf);
console.log('Icon written:', pngPath);
