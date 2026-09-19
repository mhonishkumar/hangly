'use strict';

const { ipcRenderer } = require('electron');

// ─── Canvas & Rendering Setup ────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

let width, height;
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  width  = window.innerWidth;
  height = window.innerHeight;
  canvas.width  = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sim.anchor.x = width / 2;
  sim.anchor.y = 12;
}
window.addEventListener('resize', resizeCanvas);

// ─── Sleep / Wake System ─────────────────────────────────────────────────────
let sleepFrames    = 0;
const SLEEP_AFTER  = 90;   // frames of stillness before sleeping (~1.5 s at 60fps)
let sleeping       = false;
let rafHandle      = null;

function wake() {
  if (!sleeping) return;
  sleeping   = false;
  sleepFrames = 0;
  lastTime   = performance.now();
  rafHandle  = requestAnimationFrame(animate);
}

// ─── 240 Hz Verlet Physics ───────────────────────────────────────────────────
class Node {
  constructor(x, y) {
    this.x    = x; this.y    = y;
    this.oldX = x; this.oldY = y;
  }
}

class RopeSimulation {
  constructor(segmentCount = 20, segmentLength = 14) {
    this.segmentCount  = segmentCount;
    this.segmentLength = segmentLength;
    this.gravity       = 1800;
    this.damping       = 0.998;
    this.fixedStep     = 1 / 240;
    this.accumulator   = 0;
    this.nodes         = [];
    this.isDragging    = false;
    this.dragTarget    = { x: 0, y: 0 };
    this.anchor        = { x: 200, y: 12 };
    this.reset();
  }

  reset() {
    this.nodes = [];
    for (let i = 0; i <= this.segmentCount; i++) {
      const angle = 0.2;
      const x = this.anchor.x + Math.sin(angle) * i * this.segmentLength;
      const y = this.anchor.y + Math.cos(angle) * i * this.segmentLength;
      this.nodes.push(new Node(x, y));
    }
    this.accumulator = 0;
  }

  beginDrag(x, y)  { this.isDragging = true;  this.dragTarget = { x, y }; }
  updateDrag(x, y) { this.dragTarget = { x, y }; }
  endDrag()        { this.isDragging = false; }

  isSettled() {
    const THRESH = 0.05;
    for (const n of this.nodes) {
      const dvx = Math.abs(n.x - n.oldX);
      const dvy = Math.abs(n.y - n.oldY);
      if (dvx > THRESH || dvy > THRESH) return false;
    }
    return true;
  }

  step(dt) {
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= this.fixedStep) {
      this.advance(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
  }

  advance(dt) {
    // 1. Enforce anchor
    const a = this.nodes[0];
    a.x = a.oldX = this.anchor.x;
    a.y = a.oldY = this.anchor.y;

    // 2. Verlet integration
    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (this.isDragging && i === this.nodes.length - 1) {
        n.oldX = n.x; n.oldY = n.y;
        n.x = this.dragTarget.x; n.y = this.dragTarget.y;
        continue;
      }
      const vx = (n.x - n.oldX) * this.damping;
      const vy = (n.y - n.oldY) * this.damping;
      n.oldX = n.x; n.oldY = n.y;
      n.x += vx;
      n.y += vy + this.gravity * dt * dt;
    }

    // 3. Gauss-Seidel constraint relaxation
    for (let pass = 0; pass < 60; pass++) {
      this.nodes[0].x = this.anchor.x;
      this.nodes[0].y = this.anchor.y;
      for (let i = 0; i < this.nodes.length - 1; i++) {
        const n1 = this.nodes[i], n2 = this.nodes[i + 1];
        const dx   = n2.x - n1.x, dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const pct  = ((dist - this.segmentLength) / dist) * 0.5;
        const ox = dx * pct, oy = dy * pct;
        if (i === 0) {
          n2.x -= ox * 2; n2.y -= oy * 2;
        } else if (this.isDragging && i + 1 === this.nodes.length - 1) {
          n1.x += ox * 2; n1.y += oy * 2;
        } else {
          n1.x += ox; n1.y += oy;
          n2.x -= ox; n2.y -= oy;
        }
      }
    }
  }

  getEndNode() { return this.nodes[this.nodes.length - 1]; }
}

const sim = new RopeSimulation();

// ─── Window dragging via cord anchor ────────────────────────────────────────
// Users can drag the top anchor area (top 24px strip) to move the whole window
let windowDragging     = false;
let windowDragStartX   = 0;
let windowDragStartY   = 0;
let windowDragLastX    = 0;
let windowDragLastY    = 0;

// ─── SVG Charm Loading ───────────────────────────────────────────────────────
let currentCharmImage  = new Image();
let currentCharmLoaded = false;
let charmAspectRatio   = 1;

function loadCharm(pathOrUrl) {
  currentCharmLoaded = false;
  currentCharmImage  = new Image();
  currentCharmImage.crossOrigin = 'anonymous';
  currentCharmImage.onload = () => {
    currentCharmLoaded = true;
    charmAspectRatio   = (currentCharmImage.naturalWidth  || 100) /
                         (currentCharmImage.naturalHeight || 100);
    wake();
  };
  currentCharmImage.src = pathOrUrl;
}

loadCharm('assets/charms/Nazar Boncuğu.svg');

// Dropdown
const charmSelect = document.getElementById('charmSelect');
charmSelect.addEventListener('change', (e) => {
  loadCharm(`assets/charms/${e.target.value}`);
  wake();
});

// Custom file upload
const fileInput  = document.getElementById('fileInput');
const addSvgBtn  = document.getElementById('addSvgBtn');

addSvgBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const opt     = document.createElement('option');
    opt.value     = dataUrl;
    opt.textContent = `★ ${file.name}`;
    opt.selected  = true;
    charmSelect.appendChild(opt);
    loadCharm(dataUrl);
    wake();
  };
  reader.readAsDataURL(file);
});

ipcRenderer.on('trigger-file-upload', () => fileInput.click());

// ─── Window position sync from main ──────────────────────────────────────────
ipcRenderer.on('window-position-changed', (_, wx, wy) => {
  // anchor stays centered horizontally; main handles y offset
  sim.anchor.x = width / 2;
  sim.anchor.y = 12;
  // Kick rope so it reacts to the new position
  if (sleeping) wake();
  sleepFrames = 0;
});

// ─── Theme ───────────────────────────────────────────────────────────────────
let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

ipcRenderer.on('theme-changed', (_, isDark) => {
  darkMode = isDark;
});

// ─── Mouse Interaction & Glass Pass-Through ───────────────────────────────────
let mouseX = 0, mouseY = 0;
let isHoveringCharm = false;
let isHoveringUI    = false;

const pickerContainer = document.getElementById('pickerContainer');

pickerContainer.addEventListener('mouseenter', () => {
  isHoveringUI = true;
  ipcRenderer.send('set-ignore-mouse-events', false);
});
pickerContainer.addEventListener('mouseleave', () => {
  isHoveringUI = false;
  updateMouseIgnoreState();
});

// Anchor drag zone (top strip)
const ANCHOR_ZONE_H = 28;

function isInAnchorZone(x, y) {
  const ax = sim.anchor.x;
  return Math.abs(x - ax) < 80 && y < ANCHOR_ZONE_H;
}

function updateMouseIgnoreState() {
  if (windowDragging) {
    ipcRenderer.send('set-ignore-mouse-events', false);
    return;
  }
  const endNode = sim.getEndNode();
  const dx = mouseX - endNode.x;
  const dy = mouseY - (endNode.y + 40);
  isHoveringCharm = Math.sqrt(dx * dx + dy * dy) <= 52;

  const inAnchor = isInAnchorZone(mouseX, mouseY);

  if (sim.isDragging || isHoveringCharm || isHoveringUI || inAnchor) {
    ipcRenderer.send('set-ignore-mouse-events', false);
  } else {
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
}

window.addEventListener('mousemove', (e) => {
  const prevX = mouseX, prevY = mouseY;
  mouseX = e.clientX; mouseY = e.clientY;

  // Window drag
  if (windowDragging) {
    const dx = mouseX - windowDragLastX;
    const dy = mouseY - windowDragLastY;
    // Don't update last because we'll use screen coords; instead send delta
    ipcRenderer.send('window-move', dx, dy);
    // Note: after move the window physically moves so client coords reset
    // We reset to 0,0 from cursor perspective; keep lastX/Y stable at 0
    return;
  }

  if (sim.isDragging) {
    sim.updateDrag(mouseX, mouseY - 40);
    wake();
  }
  updateMouseIgnoreState();
});

window.addEventListener('mousedown', (e) => {
  if (isHoveringUI) return;

  // Check anchor zone for window drag
  if (isInAnchorZone(e.clientX, e.clientY)) {
    windowDragging   = true;
    windowDragStartX = e.clientX;
    windowDragStartY = e.clientY;
    windowDragLastX  = e.clientX;
    windowDragLastY  = e.clientY;
    ipcRenderer.send('set-ignore-mouse-events', false);
    return;
  }

  // Check charm drag
  const endNode = sim.getEndNode();
  const dx = e.clientX - endNode.x;
  const dy = e.clientY - (endNode.y + 40);
  if (Math.sqrt(dx * dx + dy * dy) <= 55) {
    sim.beginDrag(e.clientX, e.clientY - 40);
    wake();
  }
});

window.addEventListener('mouseup', () => {
  if (windowDragging) {
    windowDragging = false;
    updateMouseIgnoreState();
    return;
  }
  if (sim.isDragging) sim.endDrag();
  updateMouseIgnoreState();
});

// ─── Anchor indicator drawing ─────────────────────────────────────────────────
function drawAnchor(nodes) {
  const ax = nodes[0].x, ay = nodes[0].y;
  // Small mount bracket
  ctx.beginPath();
  ctx.moveTo(ax - 10, ay);
  ctx.lineTo(ax + 10, ay);
  ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Screw/pin dot
  ctx.beginPath();
  ctx.arc(ax, ay, 3, 0, Math.PI * 2);
  ctx.fillStyle = darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(80,60,40,0.55)';
  ctx.fill();
}

// ─── Main Render Loop ─────────────────────────────────────────────────────────
let lastTime = performance.now();

function animate(currentTime) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
  lastTime  = currentTime;

  sim.step(dt);

  // Check for sleep
  if (!sim.isDragging && !windowDragging && sim.isSettled()) {
    sleepFrames++;
    if (sleepFrames > SLEEP_AFTER) {
      sleeping  = true;
      sleepFrames = 0;
      // Draw one last settled frame then stop
      draw(sim.nodes);
      return; // do NOT call requestAnimationFrame
    }
  } else {
    sleepFrames = 0;
  }

  draw(sim.nodes);
  rafHandle = requestAnimationFrame(animate);
}

function draw(nodes) {
  ctx.clearRect(0, 0, width, height);

  // 1. Anchor indicator
  drawAnchor(nodes);

  // 2. Rope cord
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].x, nodes[i].y);
  }
  ctx.strokeStyle = darkMode ? '#8c7b6b' : '#594d43';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // 3. Decorative beads
  for (let i = 3; i < nodes.length - 2; i += 3) {
    const p = nodes[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(p.x - 1, p.y - 1, 0.5, p.x, p.y, 4);
    grad.addColorStop(0, '#e8c88a');
    grad.addColorStop(1, '#a07840');
    ctx.fillStyle   = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur  = 4;
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  // 4. Charm at end node
  const endNode  = nodes[nodes.length - 1];
  const prevNode = nodes[nodes.length - 2];
  const angle    = Math.atan2(endNode.y - prevNode.y, endNode.x - prevNode.x) - Math.PI / 2;

  ctx.save();
  ctx.translate(endNode.x, endNode.y);
  ctx.rotate(angle);

  if (currentCharmLoaded) {
    const charmH = 88;
    const charmW = charmH * charmAspectRatio;
    ctx.shadowColor   = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(currentCharmImage, -charmW / 2, 2, charmW, charmH);
  } else {
    ctx.beginPath();
    ctx.arc(0, 38, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#3080a8';
    ctx.fill();
  }
  ctx.restore();

  // 5. Drag hint — glow ring when hovering charm
  if (isHoveringCharm && !sim.isDragging) {
    ctx.save();
    ctx.translate(endNode.x, endNode.y);
    ctx.rotate(angle);
    const charmH = 88;
    const charmW = charmH * charmAspectRatio;
    ctx.beginPath();
    ctx.ellipse(0, charmH / 2 + 2, charmW / 2 + 4, charmH / 2 + 4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,160,255,0.35)';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
resizeCanvas();
lastTime  = performance.now();
rafHandle = requestAnimationFrame(animate);
