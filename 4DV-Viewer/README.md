# 4DV Interactive Web Viewer

A lightweight, zero-dependency WebGL2 interactive viewer designed for loading and rendering 4D Gaussian Splatting (`.4dv`) scene files directly in your modern web browser.

## Features
- **Temporal Playback:** Play, pause, scrub timeline, and adjust simulation speeds.
- **Dynamic Camera Control:** 6-DoF orbit navigation, mouse panning, and multi-camera viewpoint toggles.
- **Splat Configuration:** Real-time point/splat size scaling and depth-sorted rendering.
- **Drag-and-Drop:** Directly drag any `.4dv` binary into the browser canvas to load immediately.
- **URL Parameter Loading:** Direct file loading via query parameter, e.g.: `index.html?file=path/to/scene.4dv`.

## Directory Structure
```text
4DV-Viewer/
├── index.html       # Main HTML application entry point
├── css/
│   └── viewer.css   # Dark theme and responsive UI styling
├── js/
│   └── viewer.js    # WebGL2 rendering pipeline and .4dv binary parser
├── assets/          # Icons, viewer UI assets, and reference models
└── README.md        # Viewer documentation
```

## How to Run
1. Open `index.html` directly in any WebGL2-compatible browser (Google Chrome, Firefox, Microsoft Edge, Safari).
2. Alternatively, serve via a local HTTP server:
   ```bash
   python -m http.server 8000
   ```
   and navigate to `http://localhost:8000/4DV-Viewer/`.
3. Click the 📂 button or drag-and-drop a `.4dv` file onto the window.
