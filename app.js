/* ── STATE ── */
const UI = {
  screenHero: document.getElementById('screen-hero'),
  screenLoading: document.getElementById('screen-loading'),
  screenBattle: document.getElementById('screen-battle'),
  screenResult: document.getElementById('screen-result'),
  videoElement: document.getElementById('webcamVideo'),
  timer: document.getElementById('gameTimer'),
  bestStreak: document.getElementById('bestStreak'),
  healthAi: document.getElementById('healthAi'),
  healthYou: document.getElementById('healthYou'),
  aiFace: document.getElementById('aiFace'),
  aiMouth: document.getElementById('aiMouth'),
  resultTitle: document.getElementById('resultTitle'),
  finalTime: document.getElementById('finalTime'),
  globalRank: document.getElementById('globalRank'),
  leaderboardList: document.getElementById('leaderboardList')
};

let faceMesh = null;
let camera = null;
let gameActive = false;
let startTime = 0;
let aiBlinkTimeout = null;
let lastBlinkTime = 0;
let consecutiveClosedFrames = 0;
const BLINK_THRESHOLD = 0.22; // EAR threshold
const CLOSED_FRAMES_REQUIRED = 2; // >100ms roughly at 30fps

let audioCtx = null;
let heartbeatInterval = null;
let currentBpm = 70;
let tensionOsc = null;
let tensionGain = null;

let bestTime = parseFloat(localStorage.getItem('blink_best_time')) || 0;

/* ── INIT & MEDIAPIPE ── */
document.addEventListener('DOMContentLoaded', () => {
  UI.bestStreak.textContent = `PB: ${bestTime.toFixed(1)}s`;
  loadLeaderboard();
});

async function initGame() {
  UI.screenHero.classList.remove('active');
  UI.screenLoading.classList.add('active');
  
  initAudio();
  
  if (!faceMesh) {
    try {
      faceMesh = new FaceMesh({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }});
      
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      faceMesh.onResults(onResults);
      
      camera = new Camera(UI.videoElement, {
        onFrame: async () => {
          await faceMesh.send({image: UI.videoElement});
        },
        width: 320,
        height: 240,
        facingMode: "user"
      });
      
      await camera.start();
    } catch (e) {
      console.error(e);
      alert("Failed to access camera or load ML model. Please ensure you have granted camera permissions.");
      UI.screenLoading.classList.remove('active');
      UI.screenHero.classList.add('active');
      return;
    }
  } else {
    await camera.start();
  }
  
  // Give camera a second to adjust exposure
  setTimeout(startBattle, 1500);
}

/* ── BATTLE LOGIC ── */
function startBattle() {
  UI.screenLoading.classList.remove('active');
  UI.screenResult.classList.remove('active');
  UI.screenBattle.classList.add('active');
  
  document.body.classList.remove('tense-state');
  document.body.classList.remove('shake');
  UI.aiFace.parentElement.classList.remove('ai-blinking');
  UI.aiMouth.setAttribute('d', 'M 60 140 Q 100 150 140 140'); // neutral mouth
  
  gameActive = true;
  startTime = performance.now();
  lastBlinkTime = performance.now();
  consecutiveClosedFrames = 0;
  
  // Reset HUD
  UI.healthYou.style.width = '100%';
  UI.healthAi.style.width = '100%';
  UI.timer.className = 'timer';
  
  // Schedule AI Blink (8 to 25 seconds)
  const aiTimeMs = Math.random() * 17000 + 8000;
  clearTimeout(aiBlinkTimeout);
  aiBlinkTimeout = setTimeout(triggerAiBlink, aiTimeMs);
  
  startHeartbeat();
  requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
  if (!gameActive) return;
  
  const elapsed = (time - startTime) / 1000;
  UI.timer.textContent = formatTime(elapsed);
  
  // AI Health bar visual drain (fake tension)
  const healthPercent = Math.max(0, 100 - (elapsed / 30) * 100);
  UI.healthAi.style.width = `${healthPercent}%`;
  
  // Escalating Tension
  if (elapsed > 15 && currentBpm === 70) {
    currentBpm = 90;
    startHeartbeat(); // restart with new BPM
    document.body.classList.add('tense-state');
    startTensionSweep();
  } else if (elapsed > 30 && currentBpm === 90) {
    currentBpm = 110;
    startHeartbeat();
    UI.timer.classList.add('danger');
  }
  
  requestAnimationFrame(gameLoop);
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  if (m > 0) return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${s.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;
}

/* ── ML DETECTION (EAR) ── */
function onResults(results) {
  if (!gameActive || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
  
  // 1 second invulnerability at start to prevent immediate game over
  if (performance.now() - startTime < 1000) return;
  
  const landmarks = results.multiFaceLandmarks[0];
  
  // Eye landmarks (MediaPipe Face Mesh indices)
  // Left eye: 33 (left corner), 160, 158 (top), 133 (right corner), 153, 144 (bottom)
  const leftEAR = calculateEAR(landmarks, [33, 160, 158, 133, 153, 144]);
  // Right eye: 362 (right corner), 385, 387 (top), 263 (left corner), 373, 380 (bottom)
  const rightEAR = calculateEAR(landmarks, [362, 385, 387, 263, 373, 380]);
  
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  if (avgEAR < BLINK_THRESHOLD) {
    consecutiveClosedFrames++;
    if (consecutiveClosedFrames >= CLOSED_FRAMES_REQUIRED) {
      triggerUserBlink();
    }
  } else {
    consecutiveClosedFrames = 0;
  }
}

function calculateEAR(landmarks, idx) {
  const p1 = landmarks[idx[0]];
  const p2 = landmarks[idx[1]];
  const p3 = landmarks[idx[2]];
  const p4 = landmarks[idx[3]];
  const p5 = landmarks[idx[4]];
  const p6 = landmarks[idx[5]];
  
  // vertical distances
  const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  // horizontal distance
  const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  
  return (v1 + v2) / (2.0 * h);
}

/* ── WIN/LOSS EVENTS ── */
function triggerUserBlink() {
  if (!gameActive) return;
  endGame(false);
  
  // Visuals
  document.body.classList.add('shake');
  const flash = document.createElement('div');
  flash.className = 'flash-red';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
  
  // AI Smirk
  UI.aiMouth.setAttribute('d', 'M 60 140 Q 100 160 140 130'); 
  UI.healthYou.style.width = '0%';
  
  playBuzzer();
}

function triggerAiBlink() {
  if (!gameActive) return;
  
  // Visual AI Blink
  UI.aiFace.parentElement.classList.add('ai-blinking');
  setTimeout(() => UI.aiFace.parentElement.classList.remove('ai-blinking'), 150);
  
  endGame(true);
  
  // AI Shocked Mouth
  UI.aiMouth.setAttribute('d', 'M 80 140 Q 100 170 120 140 Q 100 110 80 140'); 
  UI.healthAi.style.width = '0%';
  
  createConfetti();
  playFanfare();
}

function endGame(userWon) {
  gameActive = false;
  const elapsed = (performance.now() - startTime) / 1000;
  clearTimeout(aiBlinkTimeout);
  clearInterval(heartbeatInterval);
  if (tensionGain) tensionGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
  camera.stop(); // Stop camera to save battery
  
  saveScore(elapsed);
  
  setTimeout(() => {
    UI.screenBattle.classList.remove('active');
    UI.screenResult.classList.add('active');
    
    UI.finalTime.textContent = elapsed.toFixed(2) + 's';
    
    if (userWon) {
      UI.resultTitle.textContent = "AI BLINKED! 🎉";
      UI.resultTitle.className = "result-title title-win";
    } else {
      UI.resultTitle.textContent = "YOU BLINKED! 😈";
      UI.resultTitle.className = "result-title title-lose";
    }
    
    // Fake global rank calculation
    let rank = Math.min(99, Math.floor((elapsed / 25) * 100));
    if (rank < 5) rank = 5;
    UI.globalRank.textContent = `You lasted longer than ${rank}% of players.`;
    
  }, 1500); // Wait 1.5s to show the immediate reaction
}

/* ── SCOREBOARD ── */
function saveScore(time) {
  if (time > bestTime) {
    bestTime = time;
    localStorage.setItem('blink_best_time', bestTime);
    UI.bestStreak.textContent = `PB: ${bestTime.toFixed(1)}s`;
  }
  
  let scores = JSON.parse(localStorage.getItem('blink_leaderboard')) || [];
  scores.push({ time: parseFloat(time.toFixed(2)), date: new Date().toLocaleDateString() });
  scores.sort((a,b) => b.time - a.time);
  scores = scores.slice(0, 5); // top 5
  localStorage.setItem('blink_leaderboard', JSON.stringify(scores));
  loadLeaderboard();
}

function loadLeaderboard() {
  let scores = JSON.parse(localStorage.getItem('blink_leaderboard')) || [];
  UI.leaderboardList.innerHTML = '';
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="lb-rank">#${i+1}</span><span class="lb-time">${s.time}s</span><span class="lb-date">${s.date}</span>`;
    UI.leaderboardList.appendChild(li);
  });
}

function rematch() {
  initGame();
}

function shareResult() {
  const time = UI.finalTime.textContent;
  const text = `I stared into the void for ${time} without blinking in Blink Battle! 👁️ Can you beat me?`;
  if (navigator.share) {
    navigator.share({ title: 'Blink Battle', text: text });
  } else {
    navigator.clipboard.writeText(text);
    alert("Score copied to clipboard!");
  }
}

/* ── AUDIO ENGINE ── */
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioEnabled = true;
}

function startHeartbeat() {
  clearInterval(heartbeatInterval);
  const intervalMs = 60000 / currentBpm;
  
  heartbeatInterval = setInterval(() => {
    if (!audioEnabled || !gameActive) return;
    const t = audioCtx.currentTime;
    
    // Heartbeat: Lub - Dub
    playThump(t);
    playThump(t + 0.15);
  }, intervalMs);
}

function playThump(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, time);
  osc.frequency.exponentialRampToValueAtTime(20, time + 0.2);
  
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time); osc.stop(time + 0.2);
}

function startTensionSweep() {
  if (!audioEnabled) return;
  tensionOsc = audioCtx.createOscillator();
  tensionGain = audioCtx.createGain();
  
  tensionOsc.type = 'sawtooth';
  const t = audioCtx.currentTime;
  tensionOsc.frequency.setValueAtTime(200, t);
  tensionOsc.frequency.exponentialRampToValueAtTime(2000, t + 30); // rises over 30s
  
  tensionGain.gain.setValueAtTime(0, t);
  tensionGain.gain.linearRampToValueAtTime(0.05, t + 2);
  
  tensionOsc.connect(tensionGain).connect(audioCtx.destination);
  tensionOsc.start(t);
}

function playBuzzer() {
  if (!audioEnabled) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, t);
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.5);
}

function playFanfare() {
  if (!audioEnabled) return;
  const t = audioCtx.currentTime;
  [440, 554, 659, 880].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + i*0.1);
    gain.gain.linearRampToValueAtTime(0.3, t + i*0.1 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + i*0.1 + 1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t + i*0.1); osc.stop(t + i*0.1 + 1);
  });
}

function createConfetti() {
  for (let i = 0; i < 50; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.top = '-10px';
    c.style.backgroundColor = ['#10b981', '#f59e0b', '#3b82f6', '#ffffff'][Math.floor(Math.random() * 4)];
    document.body.appendChild(c);
    
    const duration = Math.random() * 2 + 1;
    c.animate([
      { transform: `translate3d(0,0,0) rotate(0deg)`, opacity: 1 },
      { transform: `translate3d(${Math.random()*100 - 50}px, 100vh, 0) rotate(${Math.random()*360}deg)`, opacity: 0 }
    ], { duration: duration * 1000, easing: 'ease-in' });
    
    setTimeout(() => c.remove(), duration * 1000);
  }
}
