import { state, canvas } from '../state.js';
import { DEFAULT_COLORS } from '../constants.js';
import { updateHUD, updateWeaponHud } from './HUD.js';

// ── Elementos DOM ─────────────────────────────────────────────────────────────
const lobbyEl         = document.getElementById('lobby');
const hudEl           = document.getElementById('hud');
const weaponHud       = document.getElementById('weaponHud');
const playerListPanel = document.getElementById('playerListPanel');
const chatArea        = document.getElementById('chatArea');
const endScreen       = document.getElementById('endScreen');
const hotSelectScreen = document.getElementById('hotSelectScreen');

// ── Color Picker ──────────────────────────────────────────────────────────────
export function initColorPicker() {
  const colorPickerEl = document.getElementById('colorPicker');
  colorPickerEl.innerHTML = '';
  for (const c of DEFAULT_COLORS) {
    const div = document.createElement('div');
    div.className = 'color-swatch' + (c === state.selectedColor ? ' selected' : '');
    div.style.background = c;
    div.style.color = c;
    div.addEventListener('click', () => {
      state.selectedColor = c;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      div.classList.add('selected');
    });
    colorPickerEl.appendChild(div);
  }
}

// ── Botão Entrar ──────────────────────────────────────────────────────────────
export function setupJoinButton() {
  const joinBtn   = document.getElementById('joinBtn');
  const nameInput = document.getElementById('nameInput');

  joinBtn.disabled    = true;
  joinBtn.textContent = 'CONECTANDO AO SERVIDOR...';
  joinBtn.style.opacity = '0.5';
  joinBtn.style.cursor  = 'not-allowed';

  joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Anon';
    const { ws } = state;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'join', name, color: state.selectedColor }));
    }
  });
}

// ── Resize ────────────────────────────────────────────────────────────────────
export function setupResize() {
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();
}

// ── Telas ─────────────────────────────────────────────────────────────────────
export function showGame() {
  lobbyEl.style.display = 'none';
  canvas.style.display  = 'block';
  hudEl.classList.remove('hidden');
  weaponHud.classList.remove('hidden');
  playerListPanel.classList.remove('hidden');
  chatArea.classList.remove('hidden');
  endScreen.classList.add('hidden');
  hotSelectScreen.classList.add('hidden');
  state.joined = true;
  updateHUD();
  document.getElementById('chatMessages').innerHTML = '';
}

export function showLobbyScreen() {
  lobbyEl.style.display = 'flex';
  canvas.style.display  = 'none';
  hudEl.classList.add('hidden');
  weaponHud.classList.add('hidden');
  playerListPanel.classList.add('hidden');
  chatArea.classList.add('hidden');
  endScreen.classList.add('hidden');
  hotSelectScreen.classList.add('hidden');
  state.joined  = false;
  state.myId    = null;
  state.gameMap = null;
  state.players.clear();
}

export function showEndScreen(w) {
  endScreen.classList.remove('hidden');
  const endTitle   = document.getElementById('endTitle');
  const endMessage = document.getElementById('endMessage');
  endTitle.className   = w === 'runners' ? 'runners-win' : 'hots-win';
  endTitle.textContent = w === 'runners' ? '🏃 RUNNERS VENCEM!' : '⚡ OVERCHARGED VENCEM!';
  endMessage.textContent = w === 'runners'
    ? 'O tempo expirou! Pelo menos um runner evitou a sobrecarga!'
    : 'Todos os runners foram sobrecarregados!';
}

export function showHotSelect(hotIds) {
  if (!Array.isArray(hotIds)) hotIds = [hotIds];
  const names = hotIds.map(id => { const p = state.players.get(id); return p ? p.name : '???'; });
  const titleEl = document.querySelector('.hot-select-content h2');
  if (titleEl) titleEl.textContent = names.length > 1 ? 'SOBRECARGAS DETECTADAS' : 'SOBRECARGA DETECTADA';
  document.getElementById('hotSelectName').textContent = names.join(' & ');
  hotSelectScreen.classList.remove('hidden');
  const cTimer = document.getElementById('introCountdown');
  if (cTimer) cTimer.textContent = '3';
}
