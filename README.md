# 👁️ Blink Battle

An intense, adrenaline-pumping staring contest against an AI opponent right in your browser. 

## ✨ Features
- **Computer Vision via MediaPipe**: Utilizes Google's MediaPipe Face Mesh (loaded via CDN) to map your facial landmarks in real-time. By calculating the Eye Aspect Ratio (EAR) of your eyelids, the game detects the exact millisecond you blink.
- **Intense Boss-Fight Energy**: Fighting-game style UI with health bars, an aggressive dark-red color palette, and screen-shake effects when you lose.
- **Procedural AI Opponent**: The geometric SVG AI opponent stares back at you. It uses a procedural timer (between 8 and 25 seconds) to trigger its own blink. If you can outlast it, you win!
- **Dynamic Web Audio Heartbeat**: A procedural heartbeat synthesizer increases from 70 BPM to 110 BPM the longer you stare, accompanied by an escalating tension-building sawtooth wave.
- **Zero Build Step**: Pure HTML, CSS, and Vanilla JS. The ML models are fetched dynamically, keeping the repository incredibly lightweight.

## 🚀 Getting Started
Open `index.html` in your browser, or serve locally:
```bash
python -m http.server 8080
```
*Note: You must grant the browser permission to access your webcam to play. All facial tracking happens entirely locally on your device.*

## 🛠️ Tech Stack
- **HTML5 & CSS3**: SVG morphing animations, CSS screen shakes.
- **Vanilla JavaScript**: Real-time video processing, mathematical EAR calculation.
- **MediaPipe**: `@mediapipe/face_mesh` and `@mediapipe/camera_utils`.
- **Web Audio API**: Procedural sound synthesis for heartbeat, tension, and buzzers.

---
*Built as part of the VishwaNova Weboreel Hackathon.*
