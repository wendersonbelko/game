import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import {
  TICK_RATE, PLAYER_SIZE, MAP_W, MAP_H, TILE,
  HOT_SPEED, RUNNER_SPEED, INFECTION_RADIUS,
  DRAG_SPEED,
} from '../../domain/constants';
import { collidesWithWalls, collidesWithBoxes, clamp } from '../../shared/MathUtils';
import type { PickupService } from './PickupService';

/**
 * PhysicsService — Single Responsibility: movimento, colisão e física.
 * Inclui: movimentação de jogadores, arrasto de caixas, zonas de velocidade,
 * forças magnéticas/repulsoras e resolução de sobreposição caixa-jogador.
 */
export class PhysicsService {
  constructor(
    private readonly state: GameState,
    private readonly broadcaster: IBroadcaster,
    private readonly pickupSvc: PickupService,
  ) {}

  // ─── Timers de Buff / Debuff ─────────────────────────────────────────────

  tickPlayerTimers(): void {
    const T = TICK_RATE;
    for (const [, p] of this.state.players) {
      if (p.reloadTimer     > 0) p.reloadTimer--;
      if (p.stunTimer       > 0) { p.stunTimer--; if (p.stunTimer <= 0) p.isStunned = false; }
      if (p.speedDebuffTimer> 0) p.speedDebuffTimer--;
      if (p.speedBoostTimer > 0) p.speedBoostTimer--;
      if (p.machinegunTimer > 0) p.machinegunTimer--;
      if (p.shieldTimer     > 0) p.shieldTimer--;
      if (p.supernovaTimer  > 0) p.supernovaTimer--;
      if (p.gravityTimer    > 0) p.gravityTimer--;
      if (p.invisibilityTimer> 0) p.invisibilityTimer--;
      if (p.empTimer        > 0) p.empTimer--;
      if (p.overdriveTimer  > 0) p.overdriveTimer--;
      if (p.trackerTimer    > 0) p.trackerTimer--;
      if (p.phaseshiftTimer > 0) p.phaseshiftTimer--;
      if (p.magnetTimer     > 0) p.magnetTimer--;
      if (p.repelTimer      > 0) p.repelTimer--;
      if (p.reviveImmunityTimer > 0) p.reviveImmunityTimer--;

      // Cura passsiva do Hot enquanto parado
      if (p.isHot && p.health < 100 && !p.isStunned) {
        const delay = 3 * T - (p.upgrades?.still_heal_delay ?? 0) * T;
        p.stillTicks = (p.stillTicks || 0) + 1;
        if (p.stillTicks >= delay) {
          const healRate = (p.upgrades?.hunter_still_heal ?? 0) * 2;
          p.health = Math.min(100 + (p.upgrades?.hunter_hp ?? 0) * 15, p.health + healRate / T);
        }
      } else if (!p.isHot) {
        p.stillTicks = 0;
      }

      // Regeneração de Tether
      if (!p.grabbedBox) {
        const isHot = p.isHot;
        const maxHoldEnergy = 300 * (1 + (p.upgrades?.tether_capacity ?? 0) * 0.15);
        const regenBase = 300 / (10 * T);
        const regenMult = isHot ? 2 : 1;
        p.holdEnergy = Math.min(maxHoldEnergy, p.holdEnergy + regenBase * regenMult);
      } else {
        p.holdEnergy -= 300 / (5 * T);
        if (p.holdEnergy <= 0) {
          p.holdEnergy = 0;
          const box = this.state.pushables.find(b => b.id === p.grabbedBox);
          if (box) box.grabbedBy = null;
          p.grabbedBox = null;
          p.mouseWorld = null;
        }
      }

      // Stamina
      if (p.input.shift && (p.input.up || p.input.down || p.input.left || p.input.right) && p.stamina > 0) {
        p.isSprinting = true;
        p.stamina = Math.max(0, p.stamina - 1);
        if (p.stamina <= 0) p.isSprinting = false;
      } else {
        const maxStamina = 600 * (1 + (p.upgrades?.runner_stamina ?? 0) * 0.15);
        const regenBase = 600 / (15 * T);
        const regenMult = 1 + (p.upgrades?.stamina_regen ?? 0) * 0.20;
        p.stamina = Math.min(maxStamina, p.stamina + regenBase * regenMult);
        p.isSprinting = false;
      }
    }
  }

  // ─── Movimentação de Jogadores ───────────────────────────────────────────

  movePlayers(): void {
    for (const [, p] of this.state.players) {
      if (p.isStunned) continue;

      let dx = 0, dy = 0;
      if (p.input.up)    dy -= 1;
      if (p.input.down)  dy += 1;
      if (p.input.left)  dx -= 1;
      if (p.input.right) dx += 1;
      if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

      let speed = p.isHot
        ? HOT_SPEED    * (1 + (p.upgrades?.hunter_speed  ?? 0) * 0.05)
        : RUNNER_SPEED * (1 + (p.upgrades?.runner_speed  ?? 0) * 0.05);

      // Zonas de velocidade
      const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
      for (const zone of this.state.speedZones) {
        if (pcx > zone.x && pcx < zone.x + zone.w && pcy > zone.y && pcy < zone.y + zone.h) {
          speed *= zone.type === 'boost' ? (p.isHot ? 0.75 : 1.35) : (p.isHot ? 1.35 : 0.75);
        }
      }

      if (p.speedDebuffTimer > 0) speed *= 0.5;
      if (p.speedBoostTimer  > 0) speed *= 1.4;
      if (p.isHot && p.supernovaTimer > 0) speed *= 1.3;
      if (p.isSprinting) speed *= 1.45;
      if (p.isHot && p.trackerTimer > 0) speed *= 1.1;

      // Gravidade dos Hots sobre Runners
      if (!p.isHot) {
        let gravityFactor = 1.0;
        for (const [, p2] of this.state.players) {
          if (!p2.isHot || p2.gravityTimer <= 0) continue;
          const gdx = (p2.x + p2.w / 2) - (p.x + p.w / 2);
          const gdy = (p2.y + p2.h / 2) - (p.y + p.h / 2);
          const gdist = Math.sqrt(gdx * gdx + gdy * gdy);
          if (gdist <= 160) {
            const slownessUpgrade = p2.upgrades?.gravity_slowness ?? 0;
            const factor = Math.max(0.1, 0.4 - slownessUpgrade * 0.10);
            if (factor < gravityFactor) gravityFactor = factor;
          }
        }
        if (gravityFactor < 1.0) speed *= gravityFactor;

        // EMP
        for (const [, p2] of this.state.players) {
          if (!p2.isHot || p2.empTimer <= 0) continue;
          const edx = (p2.x + p2.w / 2) - (p.x + p.w / 2);
          const edy = (p2.y + p2.h / 2) - (p.y + p.h / 2);
          if (Math.sqrt(edx * edx + edy * edy) <= 200) {
            p.reloadTimer = Math.max(p.reloadTimer, 2 * TICK_RATE);
            p.ammo = 0;
            p.holdEnergy = 0;
          }
        }
      }

      // Forças magnéticas / repulsoras
      const { fx, fy } = this._calcForces(p);

      // Mover X e Y com colisão
      const hasPhaseShift = p.phaseshiftTimer > 0;
      const nx = p.x + dx * speed + fx;
      if (hasPhaseShift || !collidesWithWalls(nx, p.y, p.w, p.h, this.state.walls)) {
        p.x = nx;
      }
      const ny = p.y + dy * speed + fy;
      if (hasPhaseShift || !collidesWithWalls(p.x, ny, p.w, p.h, this.state.walls)) {
        p.y = ny;
      }

      // Resolução de sobreposição caixa-jogador
      if (!p.isStunned && !hasPhaseShift) {
        this._resolveBoxOverlap(p);
      }

      // Clamp dentro do mapa
      p.x = clamp(p.x, TILE, MAP_W - TILE - p.w);
      p.y = clamp(p.y, TILE, MAP_H - TILE - p.h);
    }
  }

  private _calcForces(p: IPlayer): { fx: number; fy: number } {
    let fx = 0, fy = 0;

    if (!p.isHot) {
      // Atração magnética de Hots com Vórtex
      for (const [, p2] of this.state.players) {
        if (!p2.isHot || p2.magnetTimer <= 0) continue;
        const mdx = (p2.x + PLAYER_SIZE / 2) - (p.x + PLAYER_SIZE / 2);
        const mdy = (p2.y + PLAYER_SIZE / 2) - (p.y + PLAYER_SIZE / 2);
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist > 0 && mdist <= 240) {
          const magnetUpgrade = p2.upgrades?.vortex_strength ?? 0;
          const pullStrength = 2.8 * (1 + magnetUpgrade * 0.15) * (1 - mdist / 240);
          fx += (mdx / mdist) * pullStrength;
          fy += (mdy / mdist) * pullStrength;
        }
      }
    } else {
      // Repulsão de Runners com Pulso Repulsor
      for (const [, p2] of this.state.players) {
        if (p2.isHot || p2.repelTimer <= 0) continue;
        const rdx = (p.x + PLAYER_SIZE / 2) - (p2.x + PLAYER_SIZE / 2);
        const rdy = (p.y + PLAYER_SIZE / 2) - (p2.y + PLAYER_SIZE / 2);
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
        if (rdist > 0 && rdist <= 180) {
          const pushStrength = 5.2 * (1 - rdist / 180);
          fx += (rdx / rdist) * pushStrength;
          fy += (rdy / rdist) * pushStrength;
        }
      }
    }

    return { fx, fy };
  }

  private _resolveBoxOverlap(p: IPlayer): void {
    for (const box of this.state.pushables) {
      if (!(p.x + p.w > box.x && p.x < box.x + box.w && p.y + p.h > box.y && p.y < box.y + box.h)) continue;

      const overlapX = Math.min(p.x + p.w - box.x, box.x + box.w - p.x);
      const overlapY = Math.min(p.y + p.h - box.y, box.y + box.h - p.y);

      if (overlapX < overlapY) {
        const pushDir = box.x + box.w / 2 > p.x + p.w / 2 ? 1 : -1;
        const newBoxX = box.x + pushDir * overlapX;
        if (
          !collidesWithWalls(newBoxX + 1, box.y + 1, box.w - 2, box.h - 2, this.state.walls) &&
          !collidesWithBoxes(newBoxX + 1, box.y + 1, box.w - 2, box.h - 2, this.state.pushables, box.id)
        ) {
          box.x = newBoxX;
        } else {
          p.x -= pushDir * overlapX;
        }
      } else {
        const pushDir = box.y + box.h / 2 > p.y + p.h / 2 ? 1 : -1;
        const newBoxY = box.y + pushDir * overlapY;
        if (
          !collidesWithWalls(box.x + 1, newBoxY + 1, box.w - 2, box.h - 2, this.state.walls) &&
          !collidesWithBoxes(box.x + 1, newBoxY + 1, box.w - 2, box.h - 2, this.state.pushables, box.id)
        ) {
          box.y = newBoxY;
        } else {
          p.y -= pushDir * overlapY;
        }
      }
    }
  }

  // ─── Caixas Arrastadas ───────────────────────────────────────────────────

  moveDraggedBoxes(): void {
    for (const box of this.state.pushables) {
      if (!box.grabbedBy) continue;
      const p = this.state.players.get(box.grabbedBy);
      if (!p?.mouseWorld) continue;

      const tx = p.mouseWorld.x - box.w / 2;
      const ty = p.mouseWorld.y - box.h / 2;
      const ddx = tx - box.x, ddy = ty - box.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < 1) continue;

      const spd = Math.min(DRAG_SPEED, dist);
      const mx = (ddx / dist) * spd, my = (ddy / dist) * spd;

      const nxB = box.x + mx;
      if (
        !collidesWithWalls(nxB + 1, box.y + 1, box.w - 2, box.h - 2, this.state.walls) &&
        !collidesWithBoxes(nxB + 1, box.y + 1, box.w - 2, box.h - 2, this.state.pushables, box.id)
      ) box.x = nxB;

      const nyB = box.y + my;
      if (
        !collidesWithWalls(box.x + 1, nyB + 1, box.w - 2, box.h - 2, this.state.walls) &&
        !collidesWithBoxes(box.x + 1, nyB + 1, box.w - 2, box.h - 2, this.state.pushables, box.id)
      ) box.y = nyB;
    }
  }

  // ─── Vórtex Magnético sobre Caixas ──────────────────────────────────────

  applyMagneticForceOnBoxes(): void {
    for (const box of this.state.pushables) {
      let bfx = 0, bfy = 0;
      for (const [, p] of this.state.players) {
        if (!p.isHot || p.magnetTimer <= 0) continue;
        const bdx = (p.x + PLAYER_SIZE / 2) - (box.x + box.w / 2);
        const bdy = (p.y + PLAYER_SIZE / 2) - (box.y + box.h / 2);
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bdist > 35 && bdist <= 240) {
          const pullStrength = 2.5 * (1 - bdist / 240);
          bfx += (bdx / bdist) * pullStrength;
          bfy += (bdy / bdist) * pullStrength;
        }
      }
      if (bfx !== 0 || bfy !== 0) {
        const nxBoxX = box.x + bfx;
        if (
          !collidesWithWalls(nxBoxX + 1, box.y + 1, box.w - 2, box.h - 2, this.state.walls) &&
          !collidesWithBoxes(nxBoxX + 1, box.y + 1, box.w - 2, box.h - 2, this.state.pushables, box.id)
        ) box.x = nxBoxX;

        const nxBoxY = box.y + bfy;
        if (
          !collidesWithWalls(box.x + 1, nxBoxY + 1, box.w - 2, box.h - 2, this.state.walls) &&
          !collidesWithBoxes(box.x + 1, nxBoxY + 1, box.w - 2, box.h - 2, this.state.pushables, box.id)
        ) box.y = nxBoxY;
      }
    }
  }
}
