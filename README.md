# CARDIA-01 · Cadaveric Tissue Survey

A sci-fi "field survey" scanner rendered entirely in the browser: a beating, photoreal human heart floating in a studio, scanned region-by-region with animated HUD overlays, a live ECG trace, a macro-optics tracking panel, and a synthesized heartbeat. No engine, no build step — one HTML file, Three.js, and the Web Audio API.

![demo](media/cardia-survey.gif)

▶ **Full clip with sound:** [`media/cardia-survey.mp4`](media/cardia-survey.mp4)

## Run it locally

It's a static site, but it **must be served over HTTP** — opening `index.html` directly with `file://` won't work, because the browser blocks ES-module imports and the `.glb` model fetch under that scheme. Any static server does the job:

```bash
git clone https://github.com/carolinacherry/cardia-survey.git
cd cardia-survey

# pick one:
python3 -m http.server 4173      # Python 3
npx serve -l 4173                # Node (npx)
php -S localhost:4173            # PHP
```

Then open **http://localhost:4173** and click anywhere (or the audio button) to enable sound — browsers keep audio muted until a user gesture.

That's the whole setup. No install, no dependencies, no API keys — Three.js loads from a CDN at runtime.

## What's in it

- **Beating heart** — a real cardiac contraction cycle (~68 bpm) drives the mesh scale, a subtle exposure "flush," and a vertical thump.
- **Live ECG** — a scrolling PQRST waveform in the survey panel, locked to the same beat clock.
- **Surface scan sweep** — a world-space glow follows the reticle across the heart, with an expanding ring pulse on lock (shader-injected into the model material via `onBeforeCompile`).
- **On-surface reticle** — anchors are raycast onto the real mesh at load and stored in model space, so the target stays glued to the surface as the heart rotates.
- **Macro optics** — a second camera renders a live magnified view of whatever region is being scanned.
- **Synthesized audio** — ambient drone, scan ticks, lock chimes, and a "lub-dub" heartbeat, all generated at runtime (no samples), through a limiter for clean capture.
- **Record & replay** — `● REC` captures the page + synth audio straight to a `.webm` (via `getDisplayMedia` + `MediaRecorder`); `↻ REPLAY` rewinds to the entrance for a clean take.

## Stack

Vanilla HTML/CSS/JS · [Three.js](https://threejs.org) r160 (CDN) · Web Audio API · SVG overlays. Everything lives in a single self-contained `index.html`.

## Credits

- **Inspiration:** the viral floating-rock field-survey demo by Ray Velez ([@pascowebdesigns](https://x.com/pascowebdesigns)), built with [HyperFrames](https://hyperframes.heygen.com/). This is a from-scratch reinterpretation as a human heart.
- **3D heart model:** `assets/heart.glb` — third-party asset, included for the demo.
- **Type:** IBM Plex Mono.

## License

[MIT](LICENSE) © 2026 Daniel An. Applies to the code in this repository; bundled third-party assets (the heart model, fonts) retain their own terms.
