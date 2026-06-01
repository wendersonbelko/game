import { state, ctx } from '../state.js';

const BOX_COLORS = {
  S: { top:'#2a6b4a', front:'#1a4a32', side:'#144028', glow:'rgba(0,255,136,0.3)'   },
  M: { top:'#4a6b2a', front:'#324a1a', side:'#284014', glow:'rgba(180,255,0,0.3)'   },
  L: { top:'#6b4a2a', front:'#4a321a', side:'#402814', glow:'rgba(255,160,0,0.3)'   },
};

export function drawTethers() {
  for (const b of state.pushables) {
    if (!b.grabbedBy) continue;
    const p = state.players.get(b.grabbedBy);
    if (!p) continue;
    const px = p.x + 14, py = p.y + 14;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;

    ctx.save();
    ctx.strokeStyle = p.color || '#00f0ff';
    ctx.shadowColor = p.color || '#00f0ff';
    ctx.shadowBlur  = 12;
    ctx.lineWidth   = 3.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
    ctx.restore();
  }
}

export function drawBoxes3D() {
  const { pushables, camX, camY, hoveringBoxId } = state;
  const depth = 10;
  const cw    = ctx.canvas.width, ch = ctx.canvas.height;

  for (const b of pushables) {
    if (b.x + b.w < camX - 20 || b.x > camX + cw + 20 ||
        b.y + b.h < camY - 20 || b.y > camY + ch + 20) continue;

    const isGrabbed = b.grabbedBy !== null;
    const isHover   = b.id === hoveringBoxId;
    const colors    = BOX_COLORS[b.size] || BOX_COLORS.M;

    ctx.save();

    if (isGrabbed) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(b.x + 6, b.y + 6 + depth, b.w, b.h);
    }
    if (isHover || isGrabbed) {
      ctx.shadowColor = isGrabbed ? 'rgba(255,255,0,0.5)' : colors.glow;
      ctx.shadowBlur  = isGrabbed ? 20 : 12;
    }

    // Face lateral
    ctx.fillStyle = colors.side;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w,          b.y);
    ctx.lineTo(b.x + b.w + depth,  b.y - depth);
    ctx.lineTo(b.x + b.w + depth,  b.y + b.h - depth);
    ctx.lineTo(b.x + b.w,          b.y + b.h);
    ctx.closePath(); ctx.fill();

    // Face superior
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(b.x,             b.y);
    ctx.lineTo(b.x + depth,     b.y - depth);
    ctx.lineTo(b.x + b.w + depth, b.y - depth);
    ctx.lineTo(b.x + b.w,      b.y);
    ctx.closePath(); ctx.fill();

    ctx.shadowBlur = 0;

    // Face frontal
    ctx.fillStyle = colors.front;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = isGrabbed
      ? 'rgba(255,255,0,0.6)' : (isHover ? 'rgba(0,255,136,0.5)' : 'rgba(0,255,136,0.25)');
    ctx.lineWidth = isGrabbed ? 2 : 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // Linhas de detalhe
    ctx.strokeStyle = 'rgba(0,255,136,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w * 0.3, b.y + 4);      ctx.lineTo(b.x + b.w * 0.3, b.y + b.h - 4);
    ctx.moveTo(b.x + b.w * 0.7, b.y + 4);      ctx.lineTo(b.x + b.w * 0.7, b.y + b.h - 4);
    ctx.moveTo(b.x + 4,         b.y + b.h * 0.4); ctx.lineTo(b.x + b.w - 4, b.y + b.h * 0.4);
    ctx.stroke();

    if (b.w >= 35) {
      ctx.fillStyle = 'rgba(0,255,136,0.2)';
      ctx.font      = `bold ${b.w > 45 ? 14 : 10}px Rajdhani`;
      ctx.textAlign = 'center';
      ctx.fillText(b.size === 'S' ? 'P' : b.size === 'M' ? 'M' : 'G', b.x + b.w/2, b.y + b.h/2 + 4);
    }

    ctx.restore();
  }
}
