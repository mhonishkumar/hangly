# 🧿 Hangly — Windows Edition

> A tiny hanging charm that lives on your desktop, browser, and the web.

Hangly is a **240Hz Verlet rope physics** charm that hangs from your screen. Pick from 12 traditional lucky charms, drag them, swing them, and upload your own. Built for Windows.

---

## 📦 What's Inside

| Folder | Description |
|---|---|
| `WindowsApp/` | Electron desktop app — hangs on your Windows desktop |
| `WebApp/` | Static web version — host on Vercel or any web server |
| `BrowserExtension/` | Chrome/Edge extension — hangs on every browser tab |
| `Windows/` | WinUI 3 / C# version (experimental) |

---

## 🖥️ Windows Desktop App

Run a floating charm on your Windows desktop with full physics, system tray integration, and click-through transparency.

### Requirements
- [Node.js](https://nodejs.org/) (v18 or later)

### Run locally

```powershell
cd WindowsApp
npm install
npm start
```

### Build installer (.exe)

```powershell
cd WindowsApp
npm run dist:win
```

The installer will be in `WindowsApp/dist/`.

---

## 🌐 Web Version

A fully self-contained static website version of Hangly. Drag the anchor, swing the charm, pick from 12 charms, or upload your own.

**Live demo:** [hangly-ten.vercel.app](https://hangly-ten.vercel.app)

### Run locally

```powershell
cd WebApp
npx serve .
```

Then open `http://localhost:3000`.

---

## 🔌 Browser Extension (Chrome / Edge)

Hang a charm on **every browser tab** you visit.

### Install

1. Open `chrome://extensions` or `edge://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `BrowserExtension/` folder

---

## ✨ Features

- 240Hz Verlet rope physics
- 12 traditional lucky charms (Nazar, Daruma, Hamsa, Maneki-neko, and more)
- Upload custom SVG / PNG / JPG charms
- Dark mode support
- Glassmorphism UI pill

---

## 📄 License

MIT © mhonishkumar
