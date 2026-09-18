'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeTheme, nativeImage, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

// ─── Single-instance lock ────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

// ─── State ───────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;
let isQuitting = false;

// Persisted window position (top of primary display by default)
const WINDOW_W = 420;
const WINDOW_H = 620;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDefaultPosition() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width } = primaryDisplay.workArea;
  return {
    x: x + Math.floor((width - WINDOW_W) / 2),
    y: y   // sit flush at top of work area (below taskbar if top-taskbar)
  };
}

// ─── Window creation ─────────────────────────────────────────────────────────
function createWindow() {
  const pos = getDefaultPosition();

  mainWindow = new BrowserWindow({
    width:       WINDOW_W,
    height:      WINDOW_H,
    x:           pos.x,
    y:           pos.y,
    transparent: true,
    frame:       false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    hasShadow:   false,
    // Keep the window visible on all virtual desktops
    type:        'toolbar',
    webPreferences: {
      nodeIntegration:    true,
      contextIsolation:   false,
      backgroundThrottling: false   // keep physics alive when window loses focus
    }
  });

  mainWindow.loadFile('index.html');

  // ── IPC: mouse click-through pass-through ──
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setIgnoreMouseEvents(ignore, options || {});
  });

  // ── IPC: drag the entire window ──
  ipcMain.on('window-drag-start', () => {
    // handled via mousemove in renderer; nothing needed here
  });

  ipcMain.on('window-move', (event, deltaX, deltaY) => {
    if (!mainWindow) return;
    const [cx, cy] = mainWindow.getPosition();
    mainWindow.setPosition(cx + Math.round(deltaX), cy + Math.round(deltaY));
    // Tell renderer new anchor position after move
    const [nx, ny] = mainWindow.getPosition();
    mainWindow.webContents.send('window-position-changed', nx, ny);
  });

  // ── IPC: reset position ──
  ipcMain.on('reset-position', () => {
    if (!mainWindow) return;
    const p = getDefaultPosition();
    mainWindow.setPosition(p.x, p.y);
    mainWindow.webContents.send('window-position-changed', p.x, p.y);
  });

  // ── IPC: quit ──
  ipcMain.on('quit-app', () => {
    isQuitting = true;
    app.quit();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // When the display configuration changes, snap back into view
  screen.on('display-metrics-changed', () => {
    if (!mainWindow) return;
    const p = getDefaultPosition();
    mainWindow.setPosition(p.x, p.y);
    mainWindow.webContents.send('window-position-changed', p.x, p.y);
  });

  // Pass native theme changes to renderer
  nativeTheme.on('updated', () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  // Prefer the SVG icon; fall back to PNG for older Electron builds
  const svgPath = path.join(__dirname, 'assets', 'icon.svg');
  const pngPath = path.join(__dirname, 'assets', 'icon.png');

  // Build the tray icon. On Windows, Tray requires a PNG/ICO — not SVG.
  // We rasterise the SVG via nativeImage once on first launch and cache as PNG.
  let trayIcon;

  try {
    if (fs.existsSync(svgPath)) {
      // Load SVG and rasterise to 256×256 PNG, then cache it
      const raw = nativeImage.createFromPath(svgPath);
      const buf = raw.isEmpty()
        ? null
        : raw.resize({ width: 256, height: 256 }).toPNG();

      if (buf && buf.length > 0) {
        // Cache the generated PNG so we don't rasterise every launch
        try { fs.writeFileSync(pngPath, buf); } catch (_) { /* read-only env */ }
        trayIcon = nativeImage.createFromBuffer(buf);
      }
    }
  } catch (_) { /* fall through */ }

  // Fallback: load existing PNG
  if (!trayIcon || trayIcon.isEmpty()) {
    try {
      trayIcon = nativeImage.createFromPath(pngPath);
    } catch (_) { /* fall through */ }
  }

  // Last resort: empty 1×1 transparent icon (app still works, just no tray icon image)
  if (!trayIcon || trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Hangly');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: 'Hangly for Windows', enabled: false },
    { type: 'separator' },
    {
      label: 'Add Custom Charm…',
      click: () => mainWindow && mainWindow.webContents.send('trigger-file-upload')
    },
    {
      label: 'Reset Position',
      click: () => {
        if (!mainWindow) return;
        const p = getDefaultPosition();
        mainWindow.setPosition(p.x, p.y);
        mainWindow.webContents.send('window-position-changed', p.x, p.y);
      }
    },
    { type: 'separator' },
    {
      label: 'Run at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        // Rebuild menu so the checkmark reflects reality
        tray.setContextMenu(buildMenu());
      }
    },
    { type: 'separator' },
    {
      label: 'Exit Hangly',
      click: () => { isQuitting = true; app.quit(); }
    }
  ]);

  tray.setContextMenu(buildMenu());

  // Left-click on tray shows/hides the window
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true);
    }
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Disable the default electron menu bar
  Menu.setApplicationMenu(null);

  createWindow();
  createTray();
});

app.on('second-instance', () => {
  // Someone tried to run a second instance — bring our window to front
  if (mainWindow) {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
  }
});

// On Windows, closing the last window should NOT quit — we live in the tray
app.on('window-all-closed', () => {
  // intentionally do nothing; tray keeps the app alive
});

app.on('before-quit', () => { isQuitting = true; });
