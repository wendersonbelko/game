import { state, canvas, ctx } from '../state.js';
import { drawFloor }           from './drawFloor.js';
import { drawSpeedZones, drawWalls, drawLasers, drawParticles } from './drawEffects.js';
import { drawTethers, drawBoxes3D }  from './drawBoxes.js';
import { drawPickups, drawCoins }    from './drawPickups.js';
import { drawPlayers }               from './drawPlayers.js';
import { drawMinimap }               from './drawMinimap.js';
import { updateParticles }           from '../particles/ParticleSystem.js';
import { sendInput }                 from '../input/keyboard.js';

// ── Câmera ────────────────────────────────────────────────────────────────────

export function updateCamera() {
  const me = state.players.get(state.myId);
  if (!me || !state.gameMap) return;

  const tx = me.x + 14 - canvas.width  / 2;
  const ty = me.y + 14 - canvas.height / 2;
  const cx = Math.max(0, Math.min(state.gameMap.w - canvas.width,  tx));
  const cy = Math.max(0, Math.min(state.gameMap.h - canvas.height, ty));
  state.camX += (cx - state.camX) * 0.1;
  state.camY += (cy - state.camY) * 0.1;

  if (state.shakeMag > 0) {
    state.shakeX  = (Math.random() - 0.5) * state.shakeMag;
    state.shakeY  = (Math.random() - 0.5) * state.shakeMag;
    state.shakeMag *= 0.88;
    if (state.shakeMag < 0.5) state.shakeMag = 0;
  } else {
    state.shakeX = state.shakeY = 0;
  }
}

// ── Interpolação de posição ───────────────────────────────────────────────────

export function interpolatePlayers() {
  for (const [id, p] of state.players) {
    const t = state.targetPos.get(id);
    if (!t) continue;
    p.x += (t.x - p.x) * 0.25;
    p.y += (t.y - p.y) * 0.25;
  }
}

// ── Transparência dos HUDs sob jogadores ──────────────────────────────────────

function updateHudOpacity() {
  if (!state.joined) return;

  const hudIds = ['volumeControl', 'shopPanel', 'weaponHud', 'playerListPanel', 'chatArea', 'hudTop'];
  for (const hid of hudIds) {
    const hud = document.getElementById(hid);
    if (!hud) continue;
    if (hud.classList.contains('hidden') || hud.style.display === 'none') {
      hud.classList.remove('behind-hud'); continue;
    }
    const rect = hud.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) { hud.classList.remove('behind-hud'); continue; }

    let overlap = false;
    for (const [, p] of state.players) {
      const sz = 28;
      const screenX = p.x - state.camX + state.shakeX;
      const screenY = p.y - state.camY + state.shakeY;
      if (!(screenX + sz < rect.left || screenX > rect.right ||
            screenY + sz < rect.top  || screenY > rect.bottom)) {
        overlap = true; break;
      }
    }
    if (overlap) hud.classList.add('behind-hud');
    else         hud.classList.remove('behind-hud');
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  if (!state.joined || !state.gameMap) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-state.camX + state.shakeX, -state.camY + state.shakeY);
  drawFloor();
  drawSpeedZones();
  drawWalls();
  drawTethers();
  drawBoxes3D();
  drawPickups();
  drawCoins();
  drawPlayers();
  drawLasers();
  drawParticles();
  ctx.restore();
  drawMinimap();
}

// ── Game Loop ─────────────────────────────────────────────────────────────────

export function gameLoop() {
  sendInput();
  interpolatePlayers();
  updateCamera();
  updateParticles();
  updateHudOpacity();
  render();
  requestAnimationFrame(gameLoop);
}
