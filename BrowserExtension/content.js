(() => {
  'use strict';

  // Only inject once per page
  if (document.getElementById('hangly-root')) return;

  // ─── Inject DOM ──────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'hangly-root';
  root.innerHTML = `
    <canvas id="hangly-canvas"></canvas>
    <div class="hangly-picker" id="hangly-picker">
      <select id="hangly-select" title="Choose a charm">
        <option value="Nazar Boncuğu.svg">Nazar Boncuğu</option>
        <option value="Daruma.svg">Daruma</option>
        <option value="Hamsa.svg">Hamsa</option>
        <option value="Maneki-neko.svg">Maneki-neko</option>
        <option value="Ghanta.svg">Ghanta</option>
        <option value="Horseshoe.svg">Horseshoe</option>
        <option value="Scarab.svg">Scarab</option>
        <option value="Himmeli.svg">Himmeli</option>
        <option value="Dhrishti bomma.svg">Dhrishti Bomma</option>
        <option value="Nimbu-mirchi.svg">Nimbu Mirchi</option>
        <option value="Pánchang Jié.svg">Pánchang Jié</option>
        <option value="Emoji.svg">Emoji</option>
      </select>
      <div class="hangly-divider"></div>
      <button class="hangly-btn" id="hangly-upload-btn" title="Upload custom charm">+</button>
    </div>
    <input type="file" id="hangly-file-input" accept=".svg,.png,.jpg,.jpeg,.webp">
  `;
  document.documentElement.appendChild(root);

  const canvas = document.getElementById('hangly-canvas');
  const ctx    = canvas.getContext('2d');

  // ─── Canvas resize ───────────────────────────────────────────────────────────
  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    sim.anchor.x = Math.min(sim.anchor.x, W - 10);
  }
  window.addEventListener('resize', () => { resize(); wake(); });

  // ─── Sleep / Wake ────────────────────────────────────────────────────────────
  let sleepFrames = 0, sleeping = false, rafHandle = null;
  let lastTime = performance.now();

  function wake() {
    if (!sleeping) return;
    sleeping = false; sleepFrames = 0;
    lastTime = performance.now();
    rafHandle = requestAnimationFrame(animate);
  }

  // ─── Verlet Physics ──────────────────────────────────────────────────────────
  class VNode {
    constructor(x, y) { this.x = x; this.y = y; this.oldX = x; this.oldY = y; }
  }

  class RopeSim {
    constructor(segs = 20, segLen = 14) {
      this.segs = segs; this.segLen = segLen;
      this.gravity = 1800; this.damping = 0.998;
      this.dt = 1 / 240; this.acc = 0;
      this.nodes = []; this.dragging = false; this.dragTarget = { x: 0, y: 0 };
      this.anchor = { x: 200, y: 8 };
      this.anchorDragging = false;
      this.reset();
    }

    reset() {
      this.nodes = [];
      for (let i = 0; i <= this.segs; i++) {
        const a = 0.15;
        this.nodes.push(new VNode(
          this.anchor.x + Math.sin(a) * i * this.segLen,
          this.anchor.y + Math.cos(a) * i * this.segLen
        ));
      }
      this.acc = 0;
    }

    isSettled() {
      const T = 0.05;
      return this.nodes.every(n => Math.abs(n.x - n.oldX) < T && Math.abs(n.y - n.oldY) < T);
    }

    step(dt) {
      this.acc = Math.min(this.acc + dt, 0.1);
      while (this.acc >= this.dt) { this.advance(this.dt); this.acc -= this.dt; }
    }

    advance(dt) {
      const a = this.nodes[0];
      a.x = a.oldX = this.anchor.x; a.y = a.oldY = this.anchor.y;

      for (let i = 1; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        if (this.dragging && i === this.nodes.length - 1) {
          n.oldX = n.x; n.oldY = n.y;
          n.x = this.dragTarget.x; n.y = this.dragTarget.y;
          continue;
        }
        const vx = (n.x - n.oldX) * this.damping;
        const vy = (n.y - n.oldY) * this.damping;
        n.oldX = n.x; n.oldY = n.y;
        n.x += vx; n.y += vy + this.gravity * dt * dt;
      }

      for (let pass = 0; pass < 60; pass++) {
        this.nodes[0].x = this.anchor.x; this.nodes[0].y = this.anchor.y;
        for (let i = 0; i < this.nodes.length - 1; i++) {
          const n1 = this.nodes[i], n2 = this.nodes[i + 1];
          const dx = n2.x - n1.x, dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const pct = ((dist - this.segLen) / dist) * 0.5;
          const ox = dx * pct, oy = dy * pct;
          if (i === 0) { n2.x -= ox * 2; n2.y -= oy * 2; }
          else if (this.dragging && i + 1 === this.nodes.length - 1) { n1.x += ox * 2; n1.y += oy * 2; }
          else { n1.x += ox; n1.y += oy; n2.x -= ox; n2.y -= oy; }
        }
      }
    }

    end() { return this.nodes[this.nodes.length - 1]; }
    prev() { return this.nodes[this.nodes.length - 2]; }
  }

  const sim = new RopeSim();

  // ─── Charm Loading ───────────────────────────────────────────────────────────
  let charmImg = new Image(), charmLoaded = false, charmAR = 1;

  function loadCharm(nameOrUrl) {
    charmLoaded = false;
    charmImg = new Image();
    charmImg.crossOrigin = 'anonymous';
    charmImg.onload = () => {
      charmLoaded = true;
      charmAR = (charmImg.naturalWidth || 100) / (charmImg.naturalHeight || 100);
      wake();
    };
    if (nameOrUrl.startsWith('data:') || nameOrUrl.startsWith('http')) {
      charmImg.src = nameOrUrl;
    } else {
      charmImg.src = chrome.runtime.getURL(`assets/charms/${encodeURIComponent(nameOrUrl)}`);
    }
  }

  // Restore saved charm or default
  chrome.storage.local.get(['hanglyCharm'], (res) => {
    loadCharm(res.hanglyCharm || 'Nazar Boncuğu.svg');
    const sel = document.getElementById('hangly-select');
    if (res.hanglyCharm) sel.value = res.hanglyCharm;
  });

  const sel = document.getElementById('hangly-select');
  sel.addEventListener('change', (e) => {
    loadCharm(e.target.value);
    chrome.storage.local.set({ hanglyCharm: e.target.value });
    wake();
  });

  // Custom upload
  const fileInput = document.getElementById('hangly-file-input');
  document.getElementById('hangly-upload-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const opt = document.createElement('option');
      opt.value = url; opt.textContent = `★ ${file.name}`; opt.selected = true;
      sel.appendChild(opt);
      loadCharm(url);
      wake();
    };
    reader.readAsDataURL(file);
  });

  // ─── Theme ───────────────────────────────────────────────────────────────────
  let dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { dark = e.matches; wake(); });

  // ─── Mouse Interaction ────────────────────────────────────────────────────────
  let mx = 0, my = 0, hoverCharm = false, hoverUI = false;
  const picker = document.getElementById('hangly-picker');

  picker.addEventListener('mouseenter', () => hoverUI = true);
  picker.addEventListener('mouseleave', () => hoverUI = false);

  function inAnchor(x, y) {
    return Math.abs(x - sim.anchor.x) < 80 && y < sim.anchor.y + 30;
  }

  function charmDist(x, y) {
    const e = sim.end();
    const dx = x - e.x, dy = y - (e.y + 40);
    return Math.sqrt(dx * dx + dy * dy);
  }

  window.addEventListener('mousemove', (e) => {
    const px = mx, py = my;
    mx = e.clientX; my = e.clientY;

    if (sim.anchorDragging) {
      sim.anchor.x = Math.max(10, Math.min(W - 10, sim.anchor.x + (mx - px)));
      sim.anchor.y = Math.max(4,  Math.min(H / 2,   sim.anchor.y + (my - py)));
      wake(); return;
    }

    if (sim.dragging) { sim.dragTarget = { x: mx, y: my - 40 }; wake(); }

    hoverCharm = charmDist(mx, my) <= 52;
  }, true);

  window.addEventListener('mousedown', (e) => {
    if (hoverUI) return;
    if (inAnchor(e.clientX, e.clientY)) {
      sim.anchorDragging = true; wake(); return;
    }
    if (charmDist(e.clientX, e.clientY) <= 55) {
      sim.dragging = true;
      sim.dragTarget = { x: e.clientX, y: e.clientY - 40 };
      wake();
    }
  }, true);

  window.addEventListener('mouseup', () => {
    sim.anchorDragging = false;
    sim.dragging = false;
    wake();
  }, true);

  // ─── Render ──────────────────────────────────────────────────────────────────
  function drawAnchor(nodes) {
    const ax = nodes[0].x, ay = nodes[0].y;
    ctx.beginPath();
    ctx.moveTo(ax - 10, ay); ctx.lineTo(ax + 10, ay);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(80,60,40,0.8)'; ctx.fill();
  }

  function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    sim.step(dt);

    if (!sim.dragging && !sim.anchorDragging && sim.isSettled()) {
      if (++sleepFrames > 90) { sleeping = true; sleepFrames = 0; draw(sim.nodes); return; }
    } else { sleepFrames = 0; }

    draw(sim.nodes);
    rafHandle = requestAnimationFrame(animate);
  }

  function draw(nodes) {
    ctx.clearRect(0, 0, W, H);
    drawAnchor(nodes);

    // Rope
    ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.strokeStyle = dark ? '#8c7b6b' : '#594d43';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

    // Beads
    for (let i = 3; i < nodes.length - 2; i += 3) {
      const p = nodes[i];
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(p.x - 1, p.y - 1, 0.5, p.x, p.y, 4);
      g.addColorStop(0, '#e8c88a'); g.addColorStop(1, '#a07840');
      ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 4; ctx.fill(); ctx.shadowBlur = 0;
    }

    // Charm
    const end = nodes[nodes.length - 1], prev2 = nodes[nodes.length - 2];
    const angle = Math.atan2(end.y - prev2.y, end.x - prev2.x) - Math.PI / 2;
    ctx.save(); ctx.translate(end.x, end.y); ctx.rotate(angle);
    if (charmLoaded) {
      const cH = 88, cW = cH * charmAR;
      ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
      ctx.drawImage(charmImg, -cW / 2, 2, cW, cH);
    } else {
      ctx.beginPath(); ctx.arc(0, 38, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#3080a8'; ctx.fill();
    }
    ctx.restore();

    // Hover glow
    if (hoverCharm && !sim.dragging) {
      const end2 = nodes[nodes.length - 1], prev3 = nodes[nodes.length - 2];
      const a2 = Math.atan2(end2.y - prev3.y, end2.x - prev3.x) - Math.PI / 2;
      const cH = 88, cW = cH * charmAR;
      ctx.save(); ctx.translate(end2.x, end2.y); ctx.rotate(a2);
      ctx.beginPath(); ctx.ellipse(0, cH / 2 + 2, cW / 2 + 4, cH / 2 + 4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,160,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  resize();
  sim.anchor.x = W / 2; sim.anchor.y = 8; sim.reset();
  lastTime = performance.now();
  rafHandle = requestAnimationFrame(animate);

})();
