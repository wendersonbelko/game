import { state, ctx } from '../state.js';
import { spawnParticle, spawnHotTrail, spawnStunTrail } from '../particles/ParticleSystem.js';

// ── Utilitários ───────────────────────────────────────────────────────────────
function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
}

// ── drawPlayers ───────────────────────────────────────────────────────────────
export function drawPlayers() {
  const { players, myId, pushables, grabbedBoxId, camX, camY, shakeX, shakeY } = state;

  for (const [id, p] of players) {
    const isMe = id === myId;
    const sz   = 28;
    const cx   = p.x + sz/2, cy = p.y + sz/2;
    const myPlayer = players.get(myId);

    // ── Thermal Tracker (Hot enxerga mira nos runners) ────────────────────────
    if (myPlayer && myPlayer.isHot && myPlayer.trackerTimer > 0 && !p.isHot) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.8)';
      ctx.lineWidth   = 1.8;
      ctx.shadowColor = '#ff007f'; ctx.shadowBlur = 10;
      ctx.strokeRect(cx - sz/2 - 4, cy - sz/2 - 4, sz + 8, sz + 8);

      const corners = [
        [cx - sz/2 - 6, cy - sz/2 - 6, 6, 2], [cx - sz/2 - 6, cy - sz/2 - 6, 2, 6],
        [cx + sz/2,     cy - sz/2 - 6, 6, 2], [cx + sz/2 + 4, cy - sz/2 - 6, 2, 6],
        [cx - sz/2 - 6, cy + sz/2 + 4, 6, 2], [cx - sz/2 - 6, cy + sz/2,     2, 6],
        [cx + sz/2,     cy + sz/2 + 4, 6, 2], [cx + sz/2 + 4, cy + sz/2,     2, 6],
      ];
      ctx.fillStyle = '#ff007f';
      for (const [x, y, w, h] of corners) ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(myPlayer.x + 14, myPlayer.y + 14);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    }

    // ── Invisibilidade ────────────────────────────────────────────────────────
    const isInvisible = p.invisibilityTimer > 0;
    if (isInvisible && !isMe) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.beginPath(); ctx.arc(cx, cy, sz/2, 0, Math.PI * 2);
      ctx.fillStyle   = p.color || '#00f0ff'; ctx.fill();
      ctx.strokeStyle = p.color || '#44ccff'; ctx.stroke();
      ctx.restore();
      continue;
    }

    // ── Trails ────────────────────────────────────────────────────────────────
    if (p.isHot && !p.isStunned) spawnHotTrail(p.x, p.y);
    if (p.isStunned)              spawnStunTrail(p.x, p.y);
    if (p.speedBoostTimer > 0 && Math.random() > 0.5)
      spawnParticle(p.x + 14 + (Math.random()-0.5)*12, p.y + 14, '#00ff88', 12, 0.5, 1.5);
    if (p.phaseshiftTimer > 0 && Math.random() > 0.4)
      spawnParticle(p.x + 14 + (Math.random()-0.5)*12, p.y + 14, '#00ff88', 12, 0.5, 2);
    if (p.isHot && p.supernovaTimer > 0) {
      for (let k = 0; k < 2; k++)
        spawnParticle(p.x + 14 + (Math.random()-0.5)*15, p.y + 14, '#ff007f', 16, 1.2, 2.5);
    }

    // ── Gravity Aura ─────────────────────────────────────────────────────────
    if (p.isHot && p.gravityTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(170,102,255,0.25)'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 10]); ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, 160, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (Math.random() > 0.6) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * 100;
        state.particles.push({
          x: cx + Math.cos(angle)*radius, y: cy + Math.sin(angle)*radius,
          vx: -Math.cos(angle)*1.5, vy: -Math.sin(angle)*1.5,
          life: 30, maxLife: 30, color: '#aa66ff', size: 1.5,
        });
      }
    }

    // ── EMP Aura ──────────────────────────────────────────────────────────────
    if (p.isHot && p.empTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,0,255,0.3)';
      ctx.lineWidth   = 3 + Math.sin(Date.now() / 80) * 1.5;
      ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const angle = Math.random() * Math.PI * 2;
        ctx.strokeStyle = 'rgba(255,100,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath();
        let lx = cx + Math.cos(angle) * sz/2, ly = cy + Math.sin(angle) * sz/2;
        ctx.moveTo(lx, ly);
        for (let s = 1; s <= 4; s++) {
          const stepR  = sz/2 + (200 - sz/2) * (s / 4);
          const dev    = (Math.random() - 0.5) * 40;
          ctx.lineTo(
            cx + Math.cos(angle)*stepR + Math.sin(angle)*dev,
            cy + Math.sin(angle)*stepR - Math.cos(angle)*dev,
          );
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Corpo do Player ───────────────────────────────────────────────────────
    ctx.save();
    if (isInvisible && isMe) ctx.globalAlpha = 0.4;

    if (p.isStunned) {
      ctx.shadowColor = 'rgba(136,68,255,0.75)';
      ctx.shadowBlur  = 18 + Math.sin(Date.now() / 150) * 6;
    } else if (p.isHot) {
      ctx.shadowColor = p.supernovaTimer > 0 ? '#ff007f' : 'rgba(255,0,127,0.6)';
      ctx.shadowBlur  = p.supernovaTimer > 0 ? 25 : (18 + Math.sin(Date.now() / 200) * 5);
    } else {
      ctx.shadowColor = p.color || '#00f0ff'; ctx.shadowBlur = 10;
    }

    ctx.beginPath(); ctx.arc(cx, cy, sz/2, 0, Math.PI * 2);

    if (p.isStunned) {
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#aa66ff'); g.addColorStop(1, '#4400aa');
      ctx.fillStyle = g;
    } else if (p.isHot) {
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, p.supernovaTimer > 0 ? '#ff007f' : '#ff0055');
      g.addColorStop(1, '#990033');
      ctx.fillStyle = g;
    } else {
      const baseColor = p.color || '#00f0ff';
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, baseColor); g.addColorStop(1, darkenColor(baseColor, 0.4));
      ctx.fillStyle = g;
    }
    ctx.fill();

    const hasPhase = p.phaseshiftTimer > 0;
    ctx.lineWidth   = isMe ? 2.5 : 1.5;
    ctx.strokeStyle = hasPhase ? '#00ff88'
      : (isMe ? '#ffffff' : (p.isStunned ? '#aa66ff' : (p.isHot ? '#ff007f' : (p.color || '#44ccff'))));
    ctx.stroke();
    ctx.restore();

    // ── Shield ────────────────────────────────────────────────────────────────
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, sz/2 + 8 + Math.sin(Date.now()/100)*1.5, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // ── Repel ─────────────────────────────────────────────────────────────────
    if (p.repelTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00d2ff'; ctx.lineWidth = 3;
      ctx.shadowColor = '#00d2ff'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(cx, cy, sz/2 + 10 + Math.sin(Date.now()/80)*2, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.3)'; ctx.lineWidth = 1;
      const t = (Date.now() / 400) % 1;
      ctx.beginPath(); ctx.arc(cx, cy, sz/2 + 10 + t*40, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // ── Vortex Magnético ──────────────────────────────────────────────────────
    if (p.isHot && p.magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#aa00ff'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI*2); ctx.stroke();
      const t = (Date.now() / 600) % 1;
      for (const offset of [0, 0.5]) {
        const r = 240 * (1 - ((t + offset) % 1));
        if (r > 24) {
          ctx.strokeStyle = `rgba(170, 0, 255, ${0.4 * ((t + offset) % 1)})`;
          ctx.lineWidth   = 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── Nome ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = p.isStunned ? '#ccaaff' : (p.isHot ? '#ff007f' : (p.color || '#88ddff'));
    ctx.font      = 'bold 11px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, cx, p.y - 8);

    if (p.isStunned && p.stunTimer > 0) {
      ctx.fillStyle = '#ff007f'; ctx.font = '9px Orbitron';
      ctx.fillText(`⚡ REINICIANDO (${Math.ceil(p.stunTimer/60)}s)`, cx, p.y - 20);
    }

    // ── Buffs Flutuantes ──────────────────────────────────────────────────────
    let buffY = p.isStunned ? p.y - 32 : p.y - 20;
    const buffs = [];
    if (p.speedBoostTimer  > 0) buffs.push({ label:`⚡ SPEED (${Math.ceil(p.speedBoostTimer/60)}s)`,   color:'#00ff88' });
    if (p.phaseshiftTimer  > 0) buffs.push({ label:`🌀 PHASE (${Math.ceil(p.phaseshiftTimer/60)}s)`,   color:'#00ff88' });
    if (p.machinegunTimer  > 0) buffs.push({ label:`🔫 BURST (${Math.ceil(p.machinegunTimer/60)}s)`,   color:'#ffcc00' });
    if (p.shieldTimer      > 0) buffs.push({ label:`🛡️ SHIELD (${Math.ceil(p.shieldTimer/60)}s)`,     color:'#00f0ff' });
    if (p.supernovaTimer   > 0) buffs.push({ label:`🔥 SUPERNOVA (${Math.ceil(p.supernovaTimer/60)}s)`, color:'#ff2244' });
    if (p.gravityTimer     > 0) buffs.push({ label:`🕸️ GRAVITY (${Math.ceil(p.gravityTimer/60)}s)`,    color:'#aa66ff' });
    if (p.invisibilityTimer> 0 && isMe) buffs.push({ label:`👤 STEALTH (${Math.ceil(p.invisibilityTimer/60)}s)`, color:'#ffffff' });
    if (p.empTimer         > 0) buffs.push({ label:`⚡ EMP HACK (${Math.ceil(p.empTimer/60)}s)`,       color:'#ff00ff' });
    if (p.overdriveTimer   > 0) buffs.push({ label:`🔫 OVERDRV (${Math.ceil(p.overdriveTimer/60)}s)`,  color:'#ff3300' });
    if (p.trackerTimer     > 0) buffs.push({ label:`🎯 RADAR (${Math.ceil(p.trackerTimer/60)}s)`,      color:'#ff5555' });
    if (p.magnetTimer      > 0) buffs.push({ label:`🧲 VÓRTEX (${Math.ceil(p.magnetTimer/60)}s)`,      color:'#aa00ff' });
    if (p.repelTimer       > 0) buffs.push({ label:`🛡️ REPEL (${Math.ceil(p.repelTimer/60)}s)`,       color:'#00d2ff' });

    ctx.save();
    ctx.font = 'bold 8px Orbitron'; ctx.textAlign = 'center';
    for (const bf of buffs) {
      ctx.fillStyle = bf.color; ctx.shadowColor = bf.color; ctx.shadowBlur = 6;
      ctx.fillText(bf.label, cx, buffY); buffY -= 10;
    }
    ctx.restore();

    // ── Anel de seleção próprio ───────────────────────────────────────────────
    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, sz/2 + 6, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'; ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI*2); ctx.stroke();

      const holdingBox = grabbedBoxId !== null || (p.grabbedBox !== undefined && p.grabbedBox !== null);
      let nearBox = false;
      if (!holdingBox) {
        for (const b of pushables) {
          const bx = b.x + b.w/2, by = b.y + b.h/2;
          const dist = Math.sqrt((cx-bx)**2 + (cy-by)**2);
          if (dist <= 70 + b.w/2 + 10) { nearBox = true; break; }
        }
      }
      if (holdingBox || nearBox) {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.45)'; ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]); ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
  }
}
