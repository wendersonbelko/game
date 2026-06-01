import { state } from '../state.js';

// ── Spawn de partículas ───────────────────────────────────────────────────────

export function spawnParticle(x, y, color, life, speed, size = 3) {
  const a = Math.random() * Math.PI * 2;
  state.particles.push({
    x, y,
    vx: Math.cos(a) * Math.random() * speed,
    vy: Math.sin(a) * Math.random() * speed - 1.5,
    life, maxLife: life,
    color, size,
  });
}

export function spawnInfectionBurst(x, y) {
  for (let i = 0; i < 25; i++) {
    spawnParticle(
      x + 14, y + 14,
      `hsl(${320 + Math.random() * 25},100%,${50 + Math.random() * 30}%)`,
      35 + Math.random() * 25, 4, 3 + Math.random() * 3,
    );
  }
}

export function spawnStunBurst(x, y) {
  for (let i = 0; i < 35; i++) {
    spawnParticle(
      x + 14, y + 14,
      `hsl(280,100%,${60 + Math.random() * 20}%)`,
      45 + Math.random() * 35, 6, 2.5 + Math.random() * 3,
    );
  }
}

export function spawnImpactSpark(x, y, color) {
  for (let i = 0; i < 8; i++) {
    spawnParticle(x, y, color, 15 + Math.random() * 15, 3, 1.5 + Math.random() * 1.5);
  }
}

export function spawnHotTrail(x, y) {
  if (Math.random() > 0.4) return;
  spawnParticle(
    x + 14 + (Math.random() - 0.5) * 10, y + 14,
    `hsl(${320 + Math.random() * 25},100%,${50 + Math.random() * 30}%)`,
    12 + Math.random() * 12, 0.8, 2 + Math.random() * 2,
  );
}

export function spawnStunTrail(x, y) {
  if (Math.random() > 0.3) return;
  spawnParticle(
    x + 14 + (Math.random() - 0.5) * 10, y + 14,
    'hsl(280,100%,70%)',
    15 + Math.random() * 15, 0.5, 2 + Math.random() * 2,
  );
}

// ── Tick de partículas e lasers ───────────────────────────────────────────────

export function updateParticles() {
  const p = state.particles;
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.05; pt.life--;
    if (pt.life <= 0) p.splice(i, 1);
  }

  const lb = state.laserBeams;
  for (let i = lb.length - 1; i >= 0; i--) {
    lb[i].life--;
    if (lb[i].life <= 0) lb.splice(i, 1);
  }
}
