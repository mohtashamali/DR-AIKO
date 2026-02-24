// ══════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════
const API_URL          = "http://127.0.0.1:8000/chat";
const API_IMAGE_URL    = "http://127.0.0.1:8000/chat-image";
const API_FOLLOWUP_URL = "http://127.0.0.1:8000/chat-followup";

// ══════════════════════════════════════════════════
//  IMAGE STATE
// ══════════════════════════════════════════════════
let currentImage = { base64: null, mimeType: null, fileName: null };
let imageHistory  = [];

// ══════════════════════════════════════════════════
//  CALL STATE
// ══════════════════════════════════════════════════
let callActive      = false;
let callMuted       = false;
let callTimerSec    = 0;
let callTimerHandle = null;

// Speech Recognition
let recognition     = null;
let recognizing     = false;
let ignoreOnEnd     = false;   // suppress restart while doctor is speaking

// WebAudio for real mic waveform
let audioCtx        = null;
let analyserNode    = null;
let micStream       = null;
let waveAnimHandle  = null;

// ══════════════════════════════════════════════════
//  CALL — START / END
// ══════════════════════════════════════════════════
async function startCall() {
  // Request mic permission first
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    alert("Microphone access is required for the live call feature.");
    return;
  }

  callActive   = false; // set true after overlay shown
  callMuted    = false;
  callTimerSec = 0;

  // Show overlay
  document.getElementById('callOverlay').classList.add('active');

  // Setup WebAudio analyser for real waveform
  setupMicWaveform(micStream);

  // Start timer
  updateCallTimer();
  callTimerHandle = setInterval(() => {
    callTimerSec++;
    updateCallTimer();
  }, 1000);

  // Greet user
  setCallStatus('speaking', 'Dr. AI is speaking…');
  await speakCall("Hello! I'm Dr. AI. I'm listening. Please describe your symptoms or ask me anything.");

  // Start listening after greeting
  callActive = true;
  startListening();
}

function endCall() {
  callActive = false;

  // Stop everything
  stopListening();
  window.speechSynthesis.cancel();
  stopLipsync();
  clearInterval(callTimerHandle);

  // Stop mic
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  cancelAnimationFrame(waveAnimHandle);

  // Reset UI
  document.getElementById('callOverlay').classList.remove('active', 'doctor-speaking');
  setCallStatus('idle', 'Ended');
  setCallMicActive(false);
  setCallTranscript('', false);
}

// ══════════════════════════════════════════════════
//  CALL TIMER
// ══════════════════════════════════════════════════
function updateCallTimer() {
  const m = String(Math.floor(callTimerSec / 60)).padStart(2, '0');
  const s = String(callTimerSec % 60).padStart(2, '0');
  document.getElementById('callTimer').textContent = `${m}:${s}`;
}

// ══════════════════════════════════════════════════
//  CALL STATUS PILL
// ══════════════════════════════════════════════════
function setCallStatus(state, label) {
  // state: 'idle' | 'listening' | 'thinking' | 'speaking'
  const dot  = document.getElementById('callStatusDot');
  const text = document.getElementById('callStatusText');
  dot.className  = `call-status-dot ${state}`;
  text.textContent = label;
}

// ══════════════════════════════════════════════════
//  CALL TRANSCRIPT
// ══════════════════════════════════════════════════
function setCallTranscript(text, isUser) {
  const box = document.getElementById('callTranscript');
  document.getElementById('callTranscriptText').textContent = text || 'Listening…';
  box.classList.toggle('user-speaking', isUser);
}

// ══════════════════════════════════════════════════
//  MIC WAVEFORM (real WebAudio)
// ══════════════════════════════════════════════════
function setupMicWaveform(stream) {
  audioCtx     = new (window.AudioContext || window.webkitAudioContext)();
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 256;

  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyserNode);

  drawMicWaveform();
}

function drawMicWaveform() {
  if (!analyserNode) return;

  const bars    = document.querySelectorAll('.call-mic-bars span');
  const bufLen  = analyserNode.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);

  function loop() {
    waveAnimHandle = requestAnimationFrame(loop);
    analyserNode.getByteFrequencyData(dataArr);

    const barsCount = bars.length;
    for (let i = 0; i < barsCount; i++) {
      // Map each bar to a frequency bucket
      const idx   = Math.floor((i / barsCount) * (bufLen / 3));
      const val   = dataArr[idx];                  // 0–255
      const pct   = val / 255;
      const h     = callMuted ? 3 : Math.max(3, pct * 32);
      bars[i].style.height = h + 'px';
    }
  }
  loop();
}

function setCallMicActive(active) {
  document.getElementById('callMicWrap').classList.toggle('active', active);
  document.getElementById('callMicLabel').textContent = active ? 'You are speaking' : 'Your mic';
}

// ══════════════════════════════════════════════════
//  MUTE / SKIP
// ══════════════════════════════════════════════════
function toggleMute() {
  callMuted = !callMuted;
  document.getElementById('muteBtn').classList.toggle('muted', callMuted);

  // Mute the mic track
  if (micStream) {
    micStream.getAudioTracks().forEach(t => { t.enabled = !callMuted; });
  }

  if (callMuted) {
    stopListening();
    setCallStatus('idle', 'Muted');
    setCallMicActive(false);
    setCallTranscript('Microphone muted', false);
  } else {
    setCallStatus('listening', 'Listening…');
    setCallTranscript('', false);
    startListening();
  }
}

function skipSpeech() {
  window.speechSynthesis.cancel();
  stopCallLipsync();
  document.getElementById('callOverlay').classList.remove('doctor-speaking');
  if (callActive && !callMuted) {
    setCallStatus('listening', 'Listening…');
    setCallTranscript('', false);
    startListening();
  }
}

// ══════════════════════════════════════════════════
//  SPEECH RECOGNITION (Web Speech API)
// ══════════════════════════════════════════════════
function startListening() {
  if (!callActive || callMuted) return;
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    setCallTranscript('⚠️ Speech recognition not supported in this browser. Try Chrome.', false);
    return;
  }

  if (recognizing) return;   // already running

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.lang            = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    setCallStatus('listening', 'Listening…');
    setCallMicActive(true);
    setCallTranscript('', false);
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final   = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }

    // Show interim live
    if (interim) setCallTranscript(interim, true);

    // Final → send to doctor
    if (final.trim()) {
      setCallTranscript(final.trim(), true);
      handleCallMessage(final.trim());
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    console.warn('SR error:', e.error);
  };

  recognition.onend = () => {
    recognizing = false;
    setCallMicActive(false);
    // Auto-restart if call still active and doctor isn't speaking
    if (callActive && !ignoreOnEnd && !callMuted) {
      setTimeout(startListening, 400);
    }
  };

  recognition.start();
}

function stopListening() {
  ignoreOnEnd = true;
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
  recognizing = false;
  setTimeout(() => { ignoreOnEnd = false; }, 600);
}

// ══════════════════════════════════════════════════
//  HANDLE VOICE MESSAGE
// ══════════════════════════════════════════════════
async function handleCallMessage(userText) {
  if (!userText.trim()) return;

  // Stop listening while we think + doctor speaks
  stopListening();
  setCallMicActive(false);
  setCallStatus('thinking', 'Dr. AI is thinking…');

  // Also add to main chat transcript
  appendUserMessage(userText);
  showTyping();

  try {
    let reply;

    if (currentImage.base64) {
      const res = await fetch(API_FOLLOWUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          image_base64: currentImage.base64,
          mime_type: currentImage.mimeType,
          history: imageHistory
        })
      });
      const data = await res.json();
      reply = data.response || "I couldn't get a response.";
      imageHistory.push({ role: "user",      content: userText });
      imageHistory.push({ role: "assistant", content: reply   });
    } else {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      reply = data.response || "I couldn't get a response.";
    }

    removeTyping();
    appendBotMessage(reply);

    // Doctor speaks in call overlay
    setCallTranscript(reply, false);
    await speakCall(reply);

  } catch (err) {
    console.error(err);
    removeTyping();
    const errMsg = "⚠️ I couldn't connect to the server. Please check the backend.";
    appendBotMessage(errMsg);
    await speakCall("Sorry, I'm having trouble connecting. Please check the server.");
  }
}

// ══════════════════════════════════════════════════
//  CALL-SPECIFIC TTS + LIPSYNC
// ══════════════════════════════════════════════════
const CALL_MOUTH_SHAPES = [
  'call-mouth-rest', 'call-mouth-mid',
  'call-mouth-open', 'call-mouth-press', 'call-mouth-smile'
];

function setCallMouth(id) {
  CALL_MOUTH_SHAPES.forEach(s => {
    document.getElementById(s).classList.toggle('active', s === id);
  });
}

let callLipInterval = null;

function startCallLipsync(text) {
  document.getElementById('callOverlay').classList.add('doctor-speaking');
  let i = 0;
  callLipInterval = setInterval(() => {
    if (i < text.length) {
      setCallMouth('call-mouth-' + phonemeShape(text[i]).replace('mouth-', ''));
      i++;
    } else {
      setCallMouth('call-mouth-rest');
    }
  }, 58);
}

function stopCallLipsync() {
  clearInterval(callLipInterval);
  setCallMouth('call-mouth-rest');
  document.getElementById('callOverlay').classList.remove('doctor-speaking');
}

// Returns a promise that resolves when TTS finishes
function speakCall(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();

    const utter   = new SpeechSynthesisUtterance(text);
    utter.rate    = 0.93;
    utter.pitch   = 1.05;
    utter.volume  = 1;

    const voices  = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Daniel') ||
      v.name.includes('Google UK English Male') ||
      v.name.toLowerCase().includes('male') ||
      v.lang.startsWith('en')
    );
    if (preferred) utter.voice = preferred;

    utter.onstart = () => {
      setCallStatus('speaking', 'Dr. AI is speaking…');
      startCallLipsync(text);
      // Also sync sidebar avatar
      startLipsync(text);
    };

    utter.onend = () => {
      stopCallLipsync();
      stopLipsync();
      // Resume listening
      if (callActive && !callMuted) {
        setCallStatus('listening', 'Listening…');
        setCallTranscript('', false);
        startListening();
      }
      resolve();
    };

    utter.onerror = () => {
      stopCallLipsync();
      stopLipsync();
      resolve();
    };

    speechSynthesis.speak(utter);
  });
}

// ══════════════════════════════════════════════════
//  IMAGE HANDLING
// ══════════════════════════════════════════════════
function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataURI  = e.target.result;
    const [meta, base64] = dataURI.split(',');
    const mimeType = meta.match(/:(.*?);/)[1];

    currentImage   = { base64, mimeType, fileName: file.name };
    imageHistory   = [];

    document.getElementById('imageThumb').src     = dataURI;
    document.getElementById('imageFileName').textContent = file.name;
    document.getElementById('imagePreviewBar').classList.add('visible');
    document.getElementById('uploadBtn').classList.add('has-image');

    analyzeImage();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function clearImage() {
  currentImage = { base64: null, mimeType: null, fileName: null };
  imageHistory = [];
  document.getElementById('imagePreviewBar').classList.remove('visible');
  document.getElementById('uploadBtn').classList.remove('has-image');
  document.getElementById('imageThumb').src = '';
}

async function analyzeImage() {
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  appendImageMessage(document.getElementById('imageThumb').src, currentImage.fileName);
  showTyping();

  try {
    const res  = await fetch(API_IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Please analyze this medical image and describe what you observe. Provide relevant medical insights and any concerns.",
        image_base64: currentImage.base64,
        mime_type: currentImage.mimeType
      })
    });
    const data  = await res.json();
    const reply = data.response || "I couldn't analyze this image. Please try again.";
    removeTyping();
    appendBotMessage(reply);
    speak(reply);
    imageHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error(err);
    removeTyping();
    appendBotMessage("⚠️ Could not analyze the image. Make sure the backend is running.");
  } finally {
    sendBtn.disabled = false;
  }
}

// ══════════════════════════════════════════════════
//  NORMAL TEXT CHAT
// ══════════════════════════════════════════════════
async function sendmsg() {
  const input   = document.getElementById('user-msg');
  const sendBtn = document.getElementById('sendBtn');
  const message = input.value.trim();
  if (!message) return;

  input.value       = '';
  sendBtn.disabled  = true;
  appendUserMessage(message);
  showTyping();

  try {
    let reply;
    if (currentImage.base64) {
      const res  = await fetch(API_FOLLOWUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, image_base64: currentImage.base64, mime_type: currentImage.mimeType, history: imageHistory })
      });
      const data = await res.json();
      reply      = data.response || "I'm sorry, I didn't get a response.";
      imageHistory.push({ role: "user", content: message });
      imageHistory.push({ role: "assistant", content: reply });
    } else {
      const res  = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      reply      = data.response || "I'm sorry, I didn't get a response.";
    }
    removeTyping();
    appendBotMessage(reply);
    speak(reply);
  } catch (err) {
    console.error(err);
    removeTyping();
    appendBotMessage("⚠️ Unable to connect to the medical server. Please make sure the backend is running on port 8000.");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

// ══════════════════════════════════════════════════
//  CHAT UI HELPERS
// ══════════════════════════════════════════════════
const chatArea = document.getElementById('chat-area');

function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.innerHTML = `<div class="avatar-mini">🧑</div><div class="user-message">${escapeHtml(text)}</div>`;
  chatArea.appendChild(row);
  scrollChat();
}

function appendImageMessage(src, fileName) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.innerHTML = `
    <div class="avatar-mini">🧑</div>
    <div class="user-message">
      <img class="chat-image" src="${src}" alt="${escapeHtml(fileName)}" />
      <div style="font-size:0.75rem;opacity:0.7;margin-top:4px">📎 ${escapeHtml(fileName)}</div>
    </div>`;
  chatArea.appendChild(row);
  scrollChat();
}

function appendBotMessage(text) {
  const row = document.createElement('div');
  row.className = 'bot-row';
  row.innerHTML = `<div class="avatar-mini">👨‍⚕️</div><div class="bot-message">${escapeHtml(text)}</div>`;
  chatArea.appendChild(row);
  scrollChat();
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'bot-row';
  row.id = 'typing-indicator';
  row.innerHTML = `<div class="avatar-mini">👨‍⚕️</div><div class="typing-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatArea.appendChild(row);
  scrollChat();
}

function removeTyping() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

function scrollChat() { chatArea.scrollTop = chatArea.scrollHeight; }

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════
//  SIDEBAR LIPSYNC + TTS (for text chat mode)
// ══════════════════════════════════════════════════
const SHAPES = ['mouth-rest','mouth-mid','mouth-open','mouth-press','mouth-smile'];

function setMouth(id) {
  SHAPES.forEach(s => document.getElementById(s).classList.toggle('active', s === id));
}

function phonemeShape(char) {
  const c = char.toLowerCase();
  if ('mbp'.includes(c))      return 'mouth-press';
  if ('aeiouàáâ'.includes(c)) return 'mouth-open';
  if ('fvszjx'.includes(c))   return 'mouth-smile';
  if ('tdnlr'.includes(c))    return 'mouth-mid';
  return 'mouth-rest';
}

let lipInterval = null;

function startLipsync(text) {
  const card      = document.getElementById('avatarCard');
  const avLabel   = document.getElementById('avLabel');
  const waveform  = document.getElementById('waveform');
  const statusDot = document.getElementById('statusDot');
  card.classList.add('speaking');
  avLabel.textContent = 'Speaking';
  waveform.classList.add('active');
  statusDot.classList.add('active');
  let i = 0;
  lipInterval = setInterval(() => {
    if (i < text.length) { setMouth(phonemeShape(text[i])); i++; }
    else { setMouth('mouth-rest'); }
  }, 58);
}

function stopLipsync() {
  clearInterval(lipInterval);
  setMouth('mouth-rest');
  const card      = document.getElementById('avatarCard');
  const avLabel   = document.getElementById('avLabel');
  const waveform  = document.getElementById('waveform');
  const statusDot = document.getElementById('statusDot');
  card.classList.remove('speaking');
  avLabel.textContent = 'Listening';
  waveform.classList.remove('active');
  statusDot.classList.remove('active');
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter   = new SpeechSynthesisUtterance(text);
  utter.rate    = 0.93;
  utter.pitch   = 1.05;
  utter.volume  = 1;
  const voices  = speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Daniel') ||
    v.name.includes('Google UK English Male') ||
    v.name.toLowerCase().includes('male') ||
    v.lang.startsWith('en')
  );
  if (preferred) utter.voice = preferred;
  utter.onstart = () => startLipsync(text);
  utter.onend   = () => stopLipsync();
  utter.onerror = () => stopLipsync();
  speechSynthesis.speak(utter);
}

// ══════════════════════════════════════════════════
//  KEYBOARD + VOICE PRELOAD
// ══════════════════════════════════════════════════
document.getElementById('user-msg').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendmsg();
});

window.speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();

// ══════════════════════════════════════════════════
//  TRAIN MODAL
// ══════════════════════════════════════════════════
const TRAIN_FILE_URL = "http://127.0.0.1:8000/train/file";
const TRAIN_TEXT_URL = "http://127.0.0.1:8000/train/text";

let trainFile = null;

function openTrainModal() {
  document.getElementById('trainModal').classList.add('active');
  setTrainStatus('', '');
}

function closeTrainModal() {
  document.getElementById('trainModal').classList.remove('active');
  clearTrainFile();
  document.getElementById('trainTextArea').value   = '';
  document.getElementById('trainTextSource').value = '';
  setTrainStatus('', '');
}

// Close modal on backdrop click
document.getElementById('trainModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('trainModal')) closeTrainModal();
});

function switchTab(tab) {
  const isFile = tab === 'file';
  document.getElementById('tabFile').classList.toggle('active', isFile);
  document.getElementById('tabText').classList.toggle('active', !isFile);
  document.getElementById('tabContentFile').style.display = isFile ? 'flex' : 'none';
  document.getElementById('tabContentText').style.display = isFile ? 'none' : 'flex';
  document.getElementById('tabContentFile').style.flexDirection = 'column';
  document.getElementById('tabContentFile').style.gap = '10px';
  document.getElementById('tabContentText').style.flexDirection = 'column';
  document.getElementById('tabContentText').style.gap = '0';
  setTrainStatus('', '');
}

function handleTrainFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  trainFile = file;
  document.getElementById('trainFileName').textContent = file.name;
  document.getElementById('trainFileSelected').style.display = 'flex';
  document.getElementById('fileDropZone').style.display = 'none';
  setTrainStatus('', '');
  event.target.value = '';
}

function clearTrainFile() {
  trainFile = null;
  document.getElementById('trainFileSelected').style.display = 'none';
  document.getElementById('fileDropZone').style.display = 'flex';
}

async function submitTrainFile() {
  if (!trainFile) {
    setTrainStatus('Please select a file first.', 'error');
    return;
  }

  const btn = document.getElementById('trainFileBtn');
  btn.disabled = true;
  setTrainStatus('Uploading and processing…', '');

  const formData = new FormData();
  formData.append('file', trainFile);

  try {
    const res  = await fetch(TRAIN_FILE_URL, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      setTrainStatus(data.message, 'success');
      // Also show in chat
      appendBotMessage(`📚 Knowledge base updated: "${data.filename}" added (${data.chunks_added} sections indexed).`);
      clearTrainFile();
    } else {
      setTrainStatus(data.error || 'Upload failed.', 'error');
    }
  } catch (err) {
    console.error(err);
    setTrainStatus('⚠️ Could not reach the server. Is the backend running?', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function submitTrainText() {
  const text   = document.getElementById('trainTextArea').value.trim();
  const source = document.getElementById('trainTextSource').value.trim() || 'user_text';

  if (!text) {
    setTrainStatus('Please enter some text first.', 'error');
    return;
  }

  const btn = document.getElementById('trainTextBtn');
  btn.disabled = true;
  setTrainStatus('Processing text…', '');

  try {
    const res  = await fetch(TRAIN_TEXT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, source })
    });
    const data = await res.json();

    if (data.success) {
      setTrainStatus(data.message, 'success');
      appendBotMessage(`📚 Knowledge base updated: custom text from "${source}" added (${data.chunks_added} sections indexed).`);
      document.getElementById('trainTextArea').value   = '';
      document.getElementById('trainTextSource').value = '';
    } else {
      setTrainStatus(data.error || 'Failed to add text.', 'error');
    }
  } catch (err) {
    console.error(err);
    setTrainStatus('⚠️ Could not reach the server. Is the backend running?', 'error');
  } finally {
    btn.disabled = false;
  }
}

function setTrainStatus(msg, type) {
  const el = document.getElementById('trainStatus');
  el.textContent  = msg;
  el.className    = `train-status ${type}`;
}

// Drag-and-drop support on the drop zone
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('fileDropZone');
  if (!zone) return;

  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
  zone.addEventListener('dragleave', ()  => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      // Simulate the file input change
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('trainFileInput');
      input.files = dt.files;
      handleTrainFile({ target: input });
    }
  });

  // Init tab flex layout
  switchTab('file');
});