import { state, ctx } from '../state.js';

export function drawSpeedZones() {
  const { gameMap } = state;
  if (!gameMap) return;
  for (const z of gameMap.speedZones) {
    const a = 0.07 + Math.sin(Date.now() / 800) * 0.03;
    ctx.fillStyle   = z.type === 'boost' ? `rgba(0,240,255,${a})` : `rgba(255,34,68,${a})`;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = z.type === 'boost' ? 'rgba(0,240,255,0.15)' : 'rgba(255,34,68,0.15)';
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.fillStyle   = z.type === 'boost' ? 'rgba(0,240,255,0.3)' : 'rgba(255,34,68,0.3)';
    ctx.font        = '10px Orbitron';
    ctx.textAlign   = 'center';
    ctx.fillText(z.label, z.x + z.w/2, z.y + z.h/2 + 4);
  }
}

export function drawWalls() {
  const { gameMap, camX, camY } = state;
  if (!gameMap) return;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  for (const w of gameMap.walls) {
    if (w.x + w.w < camX || w.x > camX + cw || w.y + w.h < camY || w.y > camY + ch) continue;
    ctx.fillStyle   = '#14102a';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(136, 68, 255, 0.3)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }
}

export function drawLasers() {
  for (const b of state.laserBeams) {
    ctx.save();
    ctx.strokeStyle = b.color;
    ctx.lineWidth   = 4 * (b.life / b.maxLife);
    ctx.shadowBlur  = 10;
    ctx.shadowColor = b.color;
    ctx.beginPath();
    ctx.moveTo(b.sx, b.sy);
    ctx.lineTo(b.ex, b.ey);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1 * (b.life / b.maxLife);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
