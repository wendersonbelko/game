import { state, ctx } from '../state.js';

export function drawFloor() {
  const { gameMap, camX, camY } = state;
  if (!gameMap) return;
  const { canvas } = ctx.canvas ? { canvas: ctx.canvas } : {};
  const T  = gameMap.tile;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const sc = Math.floor(camX / T), sr = Math.floor(camY / T);
  const ec = Math.ceil((camX + cw) / T), er = Math.ceil((camY + ch) / T);

  const hx = 3*T, hy = 3*T, hw = 62*T, hh = 44*T;
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(hx, hy, hw, hh);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
  ctx.lineWidth   = 0.5;
  for (let c = sc; c <= ec; c++) {
    ctx.beginPath(); ctx.moveTo(c*T, sr*T); ctx.lineTo(c*T, er*T); ctx.stroke();
  }
  for (let r = sr; r <= er; r++) {
    ctx.beginPath(); ctx.moveTo(sc*T, r*T); ctx.lineTo(ec*T, r*T); ctx.stroke();
  }
}
