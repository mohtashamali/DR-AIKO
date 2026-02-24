# ⚕ DR AIKO — Ghibli Medical AI Assistant

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![Stack](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20SVG-teal?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=for-the-badge)

**A browser-based AI medical assistant with a fully animated Studio Ghibli-style doctor character — no image overlays, pure SVG animation with real-time lipsync, bilateral eye blinking, and live voice consultation.**

[Features](#-features) · [Setup](#-setup) · [API Reference](#-api-endpoints) · [Animation System](#-animation-system) · [Customisation](#-customisation)

</div>

---

## ✨ Overview

DR AIKO is a richly animated AI medical assistant UI. The doctor character is hand-crafted entirely in SVG — she fills the full height of the right panel, floating gently above a watercolour Ghibli landscape of rolling hills, a warm sun, drifting clouds, and a flower field. She blinks, speaks, and lip-syncs in real time as she responds to your questions.

```
┌──────────────────────────┬─────────────────────────────┐
│                          │                             │
│    Consultation Room     │   🌸  Ghibli Landscape  🌸  │
│                          │                             │
│  [Chat messages here]    │      Dr. Aiko (SVG)         │
│                          │      Full-height avatar     │
│                          │      Blinks · Talks         │
│  > Type your symptoms…   │      Floats above hills     │
│                          │                             │
└──────────────────────────┴─────────────────────────────┘
```

---

## 🎯 Features

### 🎨 Animated Ghibli Doctor Avatar

The avatar is 100% SVG — no raster images, no CSS overlays on photos. Every detail is drawn with SVG paths and gradients.

| Feature | Detail |
|---|---|
| **Bilateral eye blink** | Both eyes blink together every 3–6 s with random double-blinks |
| **5-shape lipsync** | `REST` · `MID` · `OPEN` · `PRESS` · `SMILE` — 65 ms/char cadence |
| **Floating animation** | Gentle 4 s bob (`translateY 0 → -12px`) like a visual novel character |
| **Speaking glow** | SVG `drop-shadow` filter intensifies when talking |
| **Full-height fill** | Doctor fills the entire right panel — no card, no border box |

**SVG character includes:**
- Layered dark-brown hair with flyaway strands and highlight shimmer
- Large expressive blue-teal eyes with dual sparkle highlights
- Signature Ghibli rosy cheeks (radial gradient blush) and freckles
- White lab coat with lapels, breast pocket (3 colour-coded pens), ID badge
- Stethoscope draped around neck and held in right hand
- Clipboard with paper lines and pencil in left hand
- Animated SVG sparkles pulsing around the character

---

### 📞 Live Voice Call Mode

Press **Live Call** to enter a fullscreen call interface.

```
┌─────────────────────────────────────────┐
│  ⚕ DR AIKO          00:42   ● Speaking  │
│─────────────────────────────────────────│
│                                         │
│          🌸  Dr. Aiko (large)  🌸        │
│       (pulse rings expanding)           │
│                                         │
│         "I recommend drinking…"         │
│                                         │
│    ▁▃▅▇▅▃▁  Your mic waveform  ▁▃▅▇▅▃▁  │
│                                         │
│       [🔇 Mute]  [📵 End]  [⏭ Skip]    │
└─────────────────────────────────────────┘
```

- 🎤 Real-time speech recognition (Web Speech API)
- 🤖 AI response via Groq LLaMA 3
- 🔊 TTS playback with female voice preference
- 📊 Live microphone waveform (Web Audio API analyser node)
- 💫 Expanding pulse rings during doctor speech
- 🌈 Atmospheric Ghibli sky background with animated clouds

---

### 🩻 Medical Image Analysis

Upload X-rays, skin photos, lab reports, or any medical image using the 📷 button. Powered by **LLaVA vision model** via Groq. Follow-up questions maintain full image context across the conversation.

---

### 📚 Knowledge Base Training

Expand Dr. Aiko's specialised medical knowledge via the **Train AI** modal:

- 📄 Upload **PDF, TXT, or MD** documents (drag-and-drop supported)
- 📝 Paste raw text with an optional source label
- Documents are chunked and indexed server-side for RAG retrieval

---

### 🌿 Atmospheric Visual Design

| Layer | Implementation |
|---|---|
| Sky gradient | CSS `linear-gradient` — powder blue → sage green → forest |
| Rolling hills | Layered CSS `radial-gradient` ellipses at different depths |
| Warm sun | CSS radial gradient + glowing `box-shadow` |
| Drifting clouds | CSS `::before` pseudo-element with `box-shadow` offset clouds |
| Flower field | Emoji sprites with CSS `@keyframes` sway alternating ±4° |
| Floating petals | 8 particles with staggered `petalFall` keyframe animations |

---

## 🗂 File Structure

```
dr-aiko/
└──Frontend
    ├── index.html      # Main UI — nav, chat, full avatar section, call overlay, train modal
    ├── style.css       # All styling — layout, Ghibli scenery, animations, call overlay
    ├── script.js       # Logic — blink engine, lipsync, TTS, speech recognition, chat API
└──Backend
    ├── llm.py      prompt + feature engineering
    ├── main.py       handle the backend
    ├── rag.py      deal with information gien by the user 
└── README.md       # This file
```

> Zero build tools. No bundler. No framework. Runs directly in the browser.

---

## ⚙ Setup

### Prerequisites

- Python 3.9+
- **Chrome** (required for full Web Speech API support)
- [Groq API key](https://console.groq.com) (free tier available)

### 1. Install & Start the Backend

```bash
pip install fastapi uvicorn groq python-multipart
export GROQ_API_KEY=your_key_here
uvicorn main:app --reload --port 8000
```

Add CORS middleware to `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Open the Frontend

Either open `index.html` directly in Chrome, or serve it:

```bash
python -m http.server 3000
# then open http://localhost:3000
```

### 3. Start Talking

1. Type in the chat box and press Enter or click ➤
2. Press **Live Call** for voice mode
3. Click 📷 to upload a medical image for visual analysis
4. Click **Train AI** to expand the knowledge base

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Text message → LLaMA 3 response |
| `POST` | `/chat-image` | Base64 image + message → LLaVA analysis |
| `POST` | `/chat-followup` | Continues conversation with image context |
| `POST` | `/train/file` | Upload PDF/TXT/MD to knowledge base |
| `POST` | `/train/text` | POST `{ text, source }` to index raw text |

### Request Examples

```json
// POST /chat
{ "message": "I have a headache and fever for 3 days" }

// POST /chat-image
{
  "message": "What do you see in this X-ray?",
  "image_base64": "...",
  "mime_type": "image/jpeg"
}

// POST /chat-followup
{
  "message": "Is this serious?",
  "image_base64": "...",
  "mime_type": "image/jpeg",
  "history": [
    { "role": "assistant", "content": "I can see..." }
  ]
}
```

---

## 🎬 Animation System

### Blink Engine

Both eyes blink **together** via JavaScript — no CSS animation (which caused the single-eye bug).

```js
function performBlink() {
  // Close both eyes simultaneously
  ['sLeftBlink', 'sRightBlink', 'cLeftBlink', 'cRightBlink'].forEach(id => {
    document.getElementById(id).style.transform = 'scaleY(1)';
  });
  // Open after 120ms
  setTimeout(() => {
    ['sLeftBlink', ...].forEach(id => {
      document.getElementById(id).style.transform = 'scaleY(0)';
    });
  }, 120);
}

// Randomised schedule: blink every 3–6 seconds
// 25% chance of a double-blink
function scheduleNextBlink() {
  setTimeout(() => {
    performBlink();
    if (Math.random() < 0.25) setTimeout(performBlink, 300);
    scheduleNextBlink();
  }, 3000 + Math.random() * 3000);
}
```

Each blink cover is an SVG `<ellipse>` with `transition: transform 0.07s ease-in` — the CSS transition creates the natural asymmetric speed of eyelid opening vs closing.

---

### Lipsync Engine

```js
// Phoneme → shape mapping
function charToShape(ch) {
  const c = ch.toLowerCase();
  if ('aeiou'.includes(c))          return 'open';   // vowels → wide mouth
  if ('mbp'.includes(c))            return 'press';  // bilabials → pressed lips
  if ('fvwszxq'.includes(c))        return 'mid';    // fricatives → half open
  if ('tdnlrkygh'.includes(c))      return 'mid';    // plosives/nasals → mid
  if (' ,.!?'.includes(c))          return 'rest';   // punctuation → close
  return 'mid';
}

// On TTS start → step through text at 65ms/char
function startLipsync(text) {
  let i = 0;
  lipInterval = setInterval(() => {
    setMouth(i < text.length ? charToShape(text[i++]) : 'rest');
  }, 65);
}
```

| Shape | SVG element IDs | Triggered by |
|---|---|---|
| `rest` | `#mouth-rest` / `#call-mouth-rest` | Spaces, punctuation, silence |
| `mid` | `#mouth-mid` / `#call-mouth-mid` | Most consonants |
| `open` | `#mouth-open` / `#call-mouth-open` | Vowels (a e i o u) |
| `press` | `#mouth-press` / `#call-mouth-press` | Bilabials (m b p) |
| `smile` | `#mouth-smile` / `#call-mouth-smile` | Wide fricatives |

Mouth shapes are `<g>` elements with `display:none` toggled to `display:block` via `.active` class — no repainting the SVG, just show/hide groups.

---

## 🎨 Customisation

### Change the Voice

In `script.js`, edit `getPreferredVoice()`:

```js
function getPreferredVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v =>
    v.name.includes('Samantha') ||       // macOS
    v.name.includes('Karen') ||           // macOS AU
    v.name.includes('Google UK English Female')  // Chrome
  ) || voices.find(v => v.lang.startsWith('en'));
}
```

### Change Lipsync Speed

In `script.js`, change the interval in `startLipsync()`:

```js
lipInterval = setInterval(() => { ... }, 65); // lower = faster
```

### Change the Scenery Colours

In `style.css`, edit the `.av-sky` rule:

```css
.av-sky {
  background: linear-gradient(180deg,
    #c8e8f8 0%,   /* sky blue top */
    #a8d4f0 25%,  /* mid blue */
    #e8f4e0 60%,  /* pale green */
    #c8e8a8 78%,  /* sage */
    #98d070 88%,  /* grass */
    #78b850 100%  /* deep green floor */
  );
}
```

### Add a New Mouth Shape

1. Add a `<g id="mouth-newshape" class="mouth-shape">` SVG group with your path inside the SVG in `index.html`
2. Add the same for the call overlay SVG
3. Update `SIDE_MOUTHS` and `CALL_MOUTHS` objects in `script.js`
4. Map characters to `'newshape'` in `charToShape()`

---

## 🌐 Browser Support

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| SVG animation | ✅ | ✅ | ✅ |
| Web Speech API (recognition) | ✅ | ⚠ Partial | ⚠ Partial |
| Speech Synthesis (TTS) | ✅ | ✅ | ✅ |
| Web Audio API (waveform) | ✅ | ✅ | ✅ |
| **Overall** | ✅ **Recommended** | ⚠ Limited call mode | ⚠ Limited call mode |

> For the full Live Call experience, **Chrome is required**.

---

## ⚠ Known Limitations

- Lipsync is phoneme-approximated, not phoneme-accurate — accuracy varies by text content
- Speech recognition requires Chrome and HTTPS (or `localhost`)
- Image analysis quality depends on the LLaVA model — not intended for clinical diagnosis
- Knowledge base is in-memory by default; use [ChromaDB](https://www.trychroma.com/) or similar for persistence across restarts
- The project is a demonstration UI — **not a substitute for professional medical advice**

---

## 🏥 Medical Disclaimer

> **⚠ IMPORTANT:** DR AIKO is an educational demonstration application. It is **NOT** a certified medical device and does **NOT** provide professional medical advice, diagnosis, or treatment. Always seek guidance from a qualified healthcare provider for any medical concerns. Do not use this application as a substitute for professional medical judgement.

---

## 📄 License

MIT © 2026 DR AIKO Project

---

<div align="center">

Built with ❤ using **SVG · CSS · Web Speech API · Groq · FastAPI**

*"Healing with the heart of Ghibli"* 🌸

</div>