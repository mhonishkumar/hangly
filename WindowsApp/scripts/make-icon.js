// Creates a 256×256 PNG tray icon for Hangly using Canvas API in Electron
// Run with: node scripts/make-icon.js
'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Background — transparent
ctx.clearRect(0, 0, SIZE, SIZE);

// ── Rope ──────────────────────────────────────────────────────────────────────
ctx.beginPath();
ctx.moveTo(SIZE / 2, 0);
ctx.lineTo(SIZE / 2, SIZE * 0.32);
ctx.strokeStyle = '#7a6a5a';
ctx.lineWidth = 6;
ctx.lineCap = 'round';
ctx.stroke();

// ── Beads ─────────────────────────────────────────────────────────────────────
const beadPositions = [SIZE * 0.1, SIZE * 0.18, SIZE * 0.26];
for (const y of beadPositions) {
  ctx.beginPath();
  ctx.arc(SIZE / 2, y, 7, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(SIZE / 2 - 2, y - 2, 1, SIZE / 2, y, 7);
  g.addColorStop(0, '#e8c88a');
  g.addColorStop(1, '#a07840');
  ctx.fillStyle = g;
  ctx.fill();
}

// ── Evil-eye charm (Nazar) ────────────────────────────────────────────────────
const cx = SIZE / 2;
const cy = SIZE * 0.62;
const R  = SIZE * 0.28;

// Shadow
ctx.shadowColor = 'rgba(0,0,0,0.35)';
ctx.shadowBlur  = 18;
ctx.shadowOffsetY = 8;

// Outer ring (deep blue)
ctx.beginPath();
ctx.arc(cx, cy, R, 0, Math.PI * 2);
ctx.fillStyle = '#1b3f7a';
ctx.fill();
ctx.shadowBlur = 0;

// Middle ring (white)
ctx.beginPath();
ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
ctx.fillStyle = '#f0f0f8';
ctx.fill();

// Inner ring (bright blue)
ctx.beginPath();
ctx.arc(cx, cy, R * 0.48, 0, Math.PI * 2);
ctx.fillStyle = '#3a8cdc';
ctx.fill();

// Pupil (dark)
ctx.beginPath();
ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
ctx.fillStyle = '#0d0d18';
ctx.fill();

// Highlight
ctx.beginPath();
ctx.arc(cx - R * 0.1, cy - R * 0.1, R * 0.08, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255,255,255,0.75)';
ctx.fill();

// ── Save ──────────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'assets', 'icon.png');
const buffer  = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);
console.log('Icon written to', outPath);
