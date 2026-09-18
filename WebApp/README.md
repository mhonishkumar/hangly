# Hangly (Web Version)

A beautiful, interactive 240Hz physics-based web application. This is a standalone web adaptation of the Hangly desktop app, designed specifically to be hosted on platforms like Vercel.

## Features
- **240Hz Verlet Rope Physics**: Incredibly smooth physics simulation running natively in the browser.
- **Custom Charms**: Upload any SVG, PNG, or JPG to hang on your screen.
- **Interactive Dragging**: Click and drag the charm to watch it swing, or drag the anchor point at the top to move it around the page.
- **Glassmorphism UI**: Beautiful, premium, Windows 11 Mica-inspired UI controls.

## Development

To run the application locally, you can use any static web server. For example:

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

## Deployment

Since this is a static website (HTML/CSS/JS), it can be hosted anywhere. 

**To deploy to Vercel:**
1. Push this code to a GitHub repository.
2. Import the repository in your Vercel dashboard.
3. Vercel will automatically detect the static files and deploy them!
