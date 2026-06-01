import { state, ctx } from '../state.js';
import { PICKUP_TYPES_CFG } from '../constants.js';

export function drawPickups() {
  for (const pk of state.activePickups) {
    const cx = pk.x + 10, cy = pk.y + 10;
    const floatOffset  = Math.sin(Date.now() / 250 + pk.x) * 4;
    const rotateAngle  = (Date.now() / 600) % (Math.PI * 2);
    const cfg = PICKUP_TYPES_CFG[pk.type] || PICKUP_TYPES_CFG.speed;

    ctx.save();
    ctx.translate(cx, cy + floatOffset);
    ctx.rotate(rotateAngle);

    ctx.shadowBlur  = 15;
    ctx.shadowColor = cfg.color;
    ctx.fillStyle   = cfg.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeRect(-8, -8, 16, 16);

    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-4, -4, 8, 8);

    ctx.restore();

    ctx.save();
    ctx.fillStyle = cfg.color;
    ctx.font      = 'bold 9px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.label, cx, pk.y - 12 + floatOffset);
    ctx.restore();
  }
}

export function drawCoins() {
  for (const c of state.activeCoins) {
    const cx = c.x + 8, cy = c.y + 8;
    const floatOffset  = Math.sin(Date.now() / 200 + c.x) * 3;
    const rotateScale  = Math.sin(Date.now() / 300);

    ctx.save();
    ctx.translate(cx, cy + floatOffset);
    ctx.scale(Math.abs(rotateScale) < 0.15 ? 0.15 : rotateScale, 1);

    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle   = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#00c0f0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 7px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', 0, 2.5);

    ctx.restore();
  }
}
