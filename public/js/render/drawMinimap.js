import { state, ctx } from '../state.js';

export function drawMinimap() {
  const { gameMap, camX, camY, players, pushables, myId } = state;
  if (!gameMap) return;

  const mmW = 160, mmH = 120;
  const cw  = ctx.canvas.width, ch = ctx.canvas.height;
  const mx  = cw - mmW - 12, my = ch - mmH - 12;
  const sx  = mmW / gameMap.w, sy = mmH / gameMap.h;

  ctx.fillStyle   = 'rgba(5,5,20,0.8)';
  ctx.fillRect(mx, my, mmW, mmH);
  ctx.strokeStyle = 'rgba(0,240,255,0.2)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(mx, my, mmW, mmH);

  ctx.fillStyle = 'rgba(136,68,255,0.4)';
  for (const w of gameMap.walls) {
    ctx.fillRect(mx + w.x*sx, my + w.y*sy, Math.max(1, w.w*sx), Math.max(1, w.h*sy));
  }

  ctx.fillStyle = 'rgba(0,255,136,0.3)';
  for (const b of pushables) {
    ctx.fillRect(mx + b.x*sx, my + b.y*sy, Math.max(1, b.w*sx), Math.max(1, b.h*sy));
  }

  for (const [id, p] of players) {
    ctx.fillStyle = id === myId
      ? '#ffffff'
      : (p.isStunned ? '#aa66ff' : (p.isHot ? '#ff007f' : (p.color || '#00f0ff')));
    ctx.fillRect(mx + p.x*sx - 1, my + p.y*sy - 1, 3, 3);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.strokeRect(mx + camX*sx, my + camY*sy, cw*sx, ch*sy);
}
