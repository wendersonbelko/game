import { SHOT_POOL_SIZE } from '../constants.js';

// ── Web Audio Context ─────────────────────────────────────────────────────────
let audioCtx = null;
let globalVolume = 0.20;
let bgMusicStarted = false;

export function getVolume() { return globalVolume; }

function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function synth(type, freqStart, freqEnd, duration, volMult) {
  ensureCtx();
  if (!audioCtx || globalVolume <= 0.001) return;
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(globalVolume * volMult, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// ── SFX sintetizados ──────────────────────────────────────────────────────────
export const playCoinSfx   = () => synth('triangle', 880,  1320, 0.12, 0.15);
export const playBuySfx    = () => synth('sine',     523,  784,  0.18, 0.20);
export const playMagnetSfx = () => synth('sawtooth', 330,  110,  0.40, 0.12);
export const playRepelSfx  = () => synth('sine',     220,  660,  0.30, 0.15);

// ── Pool de tiros ─────────────────────────────────────────────────────────────
const shotPool = Array.from({ length: SHOT_POOL_SIZE }, () => {
  const a = new Audio('shot.mp3');
  a.volume = 0;
  return a;
});
let shotPoolIndex = 0;

export function playShotSound(volume) {
  const snd = shotPool[shotPoolIndex % SHOT_POOL_SIZE];
  shotPoolIndex++;
  snd.currentTime = 0;
  snd.volume = Math.max(0, Math.min(1, volume * globalVolume));
  snd.play().catch(() => {});
}

// ── Música de fundo ───────────────────────────────────────────────────────────
export const bgMusic = new Audio('background.mp3');
bgMusic.loop = true;
bgMusic.volume = globalVolume;

export const sfx10s = new Audio('10s.mp3');
sfx10s.volume = globalVolume;

export function startBgMusic() {
  if (bgMusicStarted) return;
  bgMusicStarted = true;
  bgMusic.play().catch(() => {});
}

// ── Controle de Volume ────────────────────────────────────────────────────────
export function initVolumeControl() {
  const slider = document.getElementById('volumeSlider');
  const label  = document.getElementById('volumeLabel');
  const icon   = document.getElementById('volumeIcon');

  function updateUI(val) {
    const pct = Math.round(val);
    label.textContent = pct + '%';
    icon.textContent  = pct === 0 ? '🔇' : pct < 40 ? '🔉' : '🔊';
    slider.style.background =
      `linear-gradient(90deg, #00f0ff ${pct}%, rgba(0,240,255,0.12) ${pct}%)`;
  }

  slider.addEventListener('input', () => {
    const val = Number(slider.value);
    globalVolume = val / 100;
    bgMusic.volume = globalVolume;
    sfx10s.volume  = globalVolume;
    for (const a of shotPool) a.volume = globalVolume;
    updateUI(val);
  });

  updateUI(20);

  // Iniciar áudio no primeiro gesto
  const startAll = () => { ensureCtx(); startBgMusic(); };
  document.addEventListener('click',   startAll, { once: true });
  document.addEventListener('keydown', startAll, { once: true });
}
