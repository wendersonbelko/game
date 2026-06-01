import type { IPlayer, BotAIState } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import {
  TICK_RATE, PLAYER_SIZE, RUNNER_SPEED, HOT_SPEED,
  MAP_W, MAP_H, TILE,
} from '../../domain/constants';
import { GamePhase } from '../../domain/enums/GamePhase';
import { collidesWithWalls, collidesWithBoxes } from '../../shared/MathUtils';
import type { PickupService } from './PickupService';
import type { CombatService } from './CombatService';

/**
 * BotAIService — Single Responsibility: lógica completa da IA dos bots.
 * Personalidades, pathfinding multinível, detecção de travamento,
 * tiro tático, sabotagem e barricada de caixas.
 */
export class BotAIService {
  constructor(
    private readonly state: GameState,
    private readonly broadcaster: IBroadcaster,
    private readonly pickupSvc: PickupService,
    private readonly combatSvc: CombatService,
  ) {}

  updateAll(): void {
    for (const [, p] of this.state.players) {
      if (!p.isBot) continue;
      this.updateBotAI(p);
    }
  }

  // ─── IA Principal ─────────────────────────────────────────────────────────

  private updateBotAI(p: IPlayer): void {
    p.input.up = false; p.input.down = false;
    p.input.left = false; p.input.right = false; p.input.shift = false;

    const isFrozen =
      (this.state.gamePhase !== GamePhase.INGAME && this.state.gamePhase !== GamePhase.WARMUP) ||
      (this.state.gamePhase === GamePhase.INGAME && this.state.introFreezeTimer > 0);

    if (isFrozen) {
      p.mouseWorld = null;
      if (p.grabbedBox) {
        const box = this.state.pushables.find(b => b.id === p.grabbedBox);
        if (box) box.grabbedBy = null;
        p.grabbedBox = null;
      }
      return;
    }

    if (p.isStunned) return;

    this._ensureBotAI(p);
    const ai = p.ai!;

    ai.shootCooldown = Math.max(0, ai.shootCooldown - 1);
    ai.unstuckTimer  = Math.max(0, ai.unstuckTimer - 1);
    if (--ai.strafeSwitchTimer <= 0) {
      ai.strafeDir = (ai.strafeDir * -1) as (1 | -1);
      ai.strafeSwitchTimer = Math.floor(Math.random() * 150) + 80;
    }
    if (--ai.fleeAngleTimer <= 0) {
      ai.fleeAngleBias = (Math.random() - 0.5) * Math.PI / 2.5;
      ai.fleeAngleTimer = Math.floor(Math.random() * 200) + 100;
    }

    const stuck = this._checkBotStuck(p);
    if (stuck && ai.stuckTicks > 2) {
      if (ai.unstuckTimer <= 0) {
        ai.unstuckTimer = Math.floor(0.75 * TICK_RATE);
        ai.unstuckAngle = Math.random() * Math.PI * 2;
      }
      ai.wanderTarget = null; ai.wanderTimer = 0;
      if (ai.stuckTicks > 4 && p.grabbedBox) {
        const box = this.state.pushables.find(b => b.id === p.grabbedBox);
        if (box) box.grabbedBy = null;
        p.grabbedBox = null; p.mouseWorld = null;
      }
    }

    const env = this._calcEnvForces(p);
    this._tryBotBuy(p);

    if (p.isHot) this._hotBotAI(p, env);
    else         this._runnerBotAI(p, env);

    // Sincroniza mouseWorld para arrasto de caixas
    if (p.grabbedBox) {
      let mx = 0, my = 0;
      if (p.input.up)    my = -1;
      if (p.input.down)  my =  1;
      if (p.input.left)  mx = -1;
      if (p.input.right) mx =  1;
      if (mx === 0 && my === 0) { mx = Math.cos(ai.lastMoveAngle); my = Math.sin(ai.lastMoveAngle); }
      const len = Math.sqrt(mx * mx + my * my) || 1;
      p.mouseWorld = {
        x: p.x + PLAYER_SIZE / 2 - (mx / len) * 50,
        y: p.y + PLAYER_SIZE / 2 - (my / len) * 50,
      };
    } else {
      p.mouseWorld = null;
    }
  }

  // ─── IA do Hot ────────────────────────────────────────────────────────────

  private _hotBotAI(p: IPlayer, env: EnvForces): void {
    const ai = p.ai!;
    if (ai.unstuckTimer > 0) { this._applyDir(p, ai.unstuckAngle, env); p.input.shift = true; return; }

    const runners = [];
    for (const [, p2] of this.state.players) {
      if (p2.isHot || p2.invisibilityTimer > 0) continue;
      const dx = p2.x - p.x, dy = p2.y - p.y;
      runners.push({ p: p2, dx, dy, dist: Math.sqrt(dx * dx + dy * dy) });
    }
    runners.sort((a, b) => a.dist - b.dist);

    if (!runners.length) { this._smartWander(p, env, 600); return; }

    // Seleção de alvo inteligente
    let target = runners[0];
    if (runners.length > 1) {
      let bestScore = -Infinity;
      for (const r of runners) {
        const allies = runners.filter(r2 => r2 !== r && Math.sqrt((r2.p.x - r.p.x) ** 2 + (r2.p.y - r.p.y) ** 2) < 200).length;
        let score = 1000 - r.dist - allies * 180;
        if (r.p.stamina < 100)          score += 120;
        if (r.p.speedDebuffTimer > 0)    score += 180;
        if (r.p.shieldTimer > 0)         score -= 200;
        if (r.p.repelTimer > 0)          score -= 300;
        if (r.p.phaseshiftTimer > 0)     score -= 150;
        if (score > bestScore) { bestScore = score; target = r; }
      }
    }

    // Predição de movimento
    let tx = target.p.x, ty = target.p.y;
    if (target.p.input) {
      let px2 = 0, py2 = 0;
      if (target.p.input.up)    py2 -= 1;
      if (target.p.input.down)  py2 += 1;
      if (target.p.input.left)  px2 -= 1;
      if (target.p.input.right) px2 += 1;
      const pLen = Math.sqrt(px2 * px2 + py2 * py2) || 1;
      const predFrames = Math.min(20, target.dist / (HOT_SPEED * 2));
      tx += (px2 / pLen) * RUNNER_SPEED * predFrames * 0.7;
      ty += (py2 / pLen) * RUNNER_SPEED * predFrames * 0.7;
    }

    let chaseAngle = Math.atan2(ty - p.y, tx - p.x);
    if (target.dist > 350) chaseAngle += ai.strafeDir * 0.2;

    this._applyDir(p, chaseAngle, env);

    if (target.dist < 400 && p.stamina > 60) p.input.shift = true;
    else if (target.dist < 200)              p.input.shift = true;

    // Hots não arrastam caixas
    if (p.grabbedBox) {
      const box = this.state.pushables.find(b => b.id === p.grabbedBox);
      if (box) box.grabbedBy = null;
      p.grabbedBox = null;
    }
  }

  // ─── IA do Runner ─────────────────────────────────────────────────────────

  private _runnerBotAI(p: IPlayer, env: EnvForces): void {
    const ai = p.ai!;
    if (ai.unstuckTimer > 0) { this._applyDir(p, ai.unstuckAngle, env); p.input.shift = true; return; }

    let nearHot: IPlayer | null = null, hotDist = Infinity;
    for (const [, p2] of this.state.players) {
      if (!p2.isHot || p2.isStunned) continue;
      const d = Math.sqrt((p2.x - p.x) ** 2 + (p2.y - p.y) ** 2);
      if (d < hotDist) { hotDist = d; nearHot = p2; }
    }

    const critical = !!nearHot && hotDist < 180;
    const danger   = !!nearHot && hotDist < 350;
    const safe     = !nearHot || hotDist > 500;

    // Poderes
    if (nearHot) this._tryActivatePowers(p, nearHot, hotDist);

    // Tiro tático
    if (ai.shootCooldown <= 0 && p.ammo > 0 && p.reloadTimer <= 0) {
      if (nearHot && hotDist < 550) {
        const chance = hotDist < 200 ? 0.16 : hotDist < 350 ? 0.10 : 0.05;
        if (Math.random() < chance) {
          const noise = (Math.random() - 0.5) * 16;
          this._triggerBotShoot(p, nearHot.x + PLAYER_SIZE / 2 + noise, nearHot.y + PLAYER_SIZE / 2 + noise);
          ai.shootCooldown = 12 + Math.floor(Math.random() * 18);
        }
      }
      // Sabotagem
      if (danger && p.ammo > 1 && Math.random() < 0.03) {
        for (const [, p2] of this.state.players) {
          if (p2.id === p.id || p2.isHot || !nearHot) continue;
          const d = Math.sqrt((p2.x - p.x) ** 2 + (p2.y - p.y) ** 2);
          if (d < 250 && Math.sqrt((p2.x - nearHot.x) ** 2 + (p2.y - nearHot.y) ** 2) > hotDist) {
            this._triggerBotShoot(p, p2.x + PLAYER_SIZE / 2, p2.y + PLAYER_SIZE / 2);
            ai.shootCooldown = 40;
            break;
          }
        }
      }
    }

    // Recarga inteligente
    if (safe && p.ammo < 3 && p.reloadTimer <= 0) {
      p.reloadTimer = Math.floor(2.5 * TICK_RATE);
      p.ammo = 0;
    }

    // Barricada de caixas
    if (ai.boxCooldown > 0) ai.boxCooldown--;
    if (!p.grabbedBox && p.holdEnergy > 150 && ai.boxCooldown <= 0) {
      const wantToGrab = danger || (safe && Math.random() < 0.005);
      if (wantToGrab) {
        let closestBox = null, closestDist = Infinity;
        for (const box of this.state.pushables) {
          if (box.grabbedBy) continue;
          const d = Math.sqrt((p.x + p.w / 2 - box.x - box.w / 2) ** 2 + (p.y + p.h / 2 - box.y - box.h / 2) ** 2);
          if (d <= 90 && d < closestDist) { closestDist = d; closestBox = box; }
        }
        if (closestBox) {
          p.grabbedBox = closestBox.id;
          closestBox.grabbedBy = p.id;
          ai.boxCooldown = 4 * TICK_RATE;
        }
      }
    }

    // Soltar caixa taticamente
    if (p.grabbedBox) {
      const box = this.state.pushables.find(b => b.id === p.grabbedBox);
      let shouldRelease = p.holdEnergy < 50 || critical;

      if (!shouldRelease && box && this._isInNarrowPassage(p.x, p.y, p.w, p.h)) shouldRelease = true;

      if (shouldRelease) {
        if (box) box.grabbedBy = null;
        p.grabbedBox = null; p.mouseWorld = null;
        ai.boxCooldown = 2 * TICK_RATE;
      }
    }

    // Movimento de fuga ou coleta
    const collectTarget = this._findBestCollectable(p, 500);
    if (nearHot && hotDist < 400) {
      const dx = p.x - nearHot.x, dy = p.y - nearHot.y;
      let fleeAngle = Math.atan2(dy, dx) + ai.fleeAngleBias;
      if (danger) fleeAngle += ai.strafeDir * 0.3;
      this._applyDir(p, fleeAngle, env);
      if (critical || p.stamina > 100) p.input.shift = true;
    } else if (collectTarget) {
      this._applyDir(p, Math.atan2(collectTarget.y - p.y, collectTarget.x - p.x), env);
    } else {
      this._smartWander(p, env, 500);
    }
  }

  // ─── Helpers de IA ────────────────────────────────────────────────────────

  private _triggerBotShoot(bot: IPlayer, tx: number, ty: number): void {
    if (bot.isHot || bot.isStunned || bot.reloadTimer > 0 || bot.ammo <= 0) return;
    const dx = tx - (bot.x + PLAYER_SIZE / 2), dy = ty - (bot.y + PLAYER_SIZE / 2);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const noise = 22 + dist * 0.16;
    tx += (Math.random() - 0.5) * noise;
    ty += (Math.random() - 0.5) * noise;
    bot.ammo--;
    if (bot.ammo <= 0) {
      const cdMult = 1 - (bot.upgrades?.laser_cooldown ?? 0) * 0.10;
      bot.reloadTimer = Math.round(5 * TICK_RATE * cdMult);
    }
    if (bot.machinegunTimer > 0) {
      this.combatSvc.performRaycast(bot, tx, ty, -0.06, true);
      this.combatSvc.performRaycast(bot, tx, ty, 0, true);
      this.combatSvc.performRaycast(bot, tx, ty,  0.06, true);
    } else {
      this.combatSvc.performRaycast(bot, tx, ty, 0, false);
    }
  }

  private _tryActivatePowers(p: IPlayer, hot: IPlayer, dist: number): void {
    const trySlot = (slot: 'Q' | 'E', key: string | null): boolean => {
      if (!key) return false;
      let should = false;
      if (key === 'blink'       && dist < 150) should = true;
      if (key === 'phaseshift'  && dist < 180) should = true;
      if (key === 'shield'      && dist < 200) should = true;
      if (key === 'repel'       && dist < 130) should = true;
      if (key === 'speed'       && dist < 300 && p.stamina < 200) should = true;
      if (key === 'invisibility'&& dist < 300) should = true;
      if (key === 'machinegun'  && dist < 450) should = true;
      if (!should) return false;

      if (slot === 'Q') p.slotQ = null; else p.slotE = null;

      if (key === 'phaseshift') {
        p.phaseshiftTimer = 4 * TICK_RATE;
        this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'phaseshift' });
      } else if (key === 'blink') {
        const bx = p.x - hot.x, by = p.y - hot.y, bl = Math.sqrt(bx * bx + by * by);
        if (bl > 0) {
          const ux = bx / bl, uy = by / bl;
          const maxDist = 160 + (p.upgrades?.blink_range ?? 0) * 20;
          for (let d = maxDist; d >= 0; d -= 8) {
            const tx = Math.max(TILE, Math.min(MAP_W - TILE - p.w, p.x + ux * d));
            const ty = Math.max(TILE, Math.min(MAP_H - TILE - p.h, p.y + uy * d));
            if (!collidesWithWalls(tx, ty, p.w, p.h, this.state.walls) &&
                !collidesWithBoxes(tx, ty, p.w, p.h, this.state.pushables, -1)) {
              p.x = tx; p.y = ty;
              this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'blink', x: p.x, y: p.y });
              break;
            }
          }
        }
      } else if (key === 'speed')       { p.speedBoostTimer    = 15 * TICK_RATE; this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'speed' }); }
        else if (key === 'machinegun')  { p.machinegunTimer     = 15 * TICK_RATE; this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'machinegun' }); }
        else if (key === 'shield')      { p.shieldTimer         = 15 * TICK_RATE; this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'shield' }); }
        else if (key === 'invisibility'){ p.invisibilityTimer   = 10 * TICK_RATE; this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'invisibility' }); }
        else if (key === 'repel')       { p.repelTimer          =  6 * TICK_RATE; this.broadcaster.broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'repel' }); }

      return true;
    };

    if (p.slotQ && !trySlot('Q', p.slotQ) && p.slotE) trySlot('E', p.slotE);
    else if (!p.slotQ && p.slotE) trySlot('E', p.slotE);
  }

  private _tryBotBuy(p: IPlayer): void {
    const ai = p.ai!;
    if (ai.buyCooldown > 0) { ai.buyCooldown--; return; }
    const mc = p.coins || 0;
    if (mc < 3) return;

    if (p.isHot) {
      const items = [
        { id: 'magnetic', price: 4 }, { id: 'gravity', price: 4 },
        { id: 'speed', price: 3 }, { id: 'tracker', price: 3 },
        { id: 'emp', price: 5 }, { id: 'supernova', price: 4 },
      ];
      const affordable = items.filter(i => mc >= i.price);
      if (affordable.length > 0) {
        const item = affordable[Math.floor(Math.random() * Math.min(2, affordable.length))];
        p.coins -= item.price;
        const T = TICK_RATE;
        if      (item.id === 'speed')    p.speedBoostTimer = 15 * T;
        else if (item.id === 'tracker')  p.trackerTimer    = this.pickupSvc._getUpgradedTimer(p, 'tracker', 10 * T);
        else if (item.id === 'gravity')  p.gravityTimer    = 12 * T;
        else if (item.id === 'magnetic') p.magnetTimer     =  8 * T;
        else if (item.id === 'supernova')p.supernovaTimer  = 10 * T;
        else if (item.id === 'emp')      p.empTimer        = this.pickupSvc._getUpgradedTimer(p, 'emp', 10 * T);
        this.broadcaster.broadcast({ type: 'itemBought', playerId: p.id, itemId: item.id, coins: p.coins });
        ai.buyCooldown = 2 * TICK_RATE;
      }
    } else {
      if (p.slotQ && p.slotE) return;
      const items = [
        { id: 'shield', price: 4 }, { id: 'blink', price: 3 },
        { id: 'repel', price: 4 }, { id: 'speed', price: 3 },
        { id: 'phaseshift', price: 5 }, { id: 'invisibility', price: 5 },
        { id: 'machinegun', price: 4 },
      ];
      if (ai.personality === 'aggressive') items.unshift({ id: 'machinegun', price: 4 });
      else if (ai.personality === 'defensive') items.unshift({ id: 'shield', price: 4 });
      const affordable = items.filter(i => mc >= i.price);
      if (affordable.length > 0) {
        const item = affordable[0];
        p.coins -= item.price;
        if (!p.slotQ) p.slotQ = item.id; else p.slotE = item.id;
        this.broadcaster.broadcast({ type: 'itemBought', playerId: p.id, itemId: item.id, coins: p.coins });
        ai.buyCooldown = 2 * TICK_RATE;
      }
    }
  }

  private _findBestCollectable(p: IPlayer, maxRange: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    const pcx = p.x + PLAYER_SIZE / 2, pcy = p.y + PLAYER_SIZE / 2;
    const hotTypes  = ['speed', 'supernova', 'gravity', 'emp', 'tracker', 'magnetic'];
    const runTypes  = ['speed', 'machinegun', 'shield', 'invisibility', 'phaseshift', 'blink', 'repel'];

    for (const c of this.state.coins) {
      const d = Math.sqrt((c.x + 8 - pcx) ** 2 + (c.y + 8 - pcy) ** 2);
      if (d < maxRange) {
        const s = 100 - d * 0.2;
        if (s > bestScore) { bestScore = s; best = { x: c.x + 8, y: c.y + 8 }; }
      }
    }

    for (const pk of this.state.pickups) {
      if (p.isHot  && !hotTypes.includes(pk.type)) continue;
      if (!p.isHot && !runTypes.includes(pk.type)) continue;
      if (!p.isHot && p.slotQ && p.slotE) continue;
      const d = Math.sqrt((pk.x + 10 - pcx) ** 2 + (pk.y + 10 - pcy) ** 2);
      if (d < maxRange) {
        let v = 150;
        if (!p.isHot && (!p.slotQ || !p.slotE)) v += 80;
        if (!p.isHot && ['shield', 'blink', 'phaseshift'].includes(pk.type)) v += 50;
        if (p.isHot  && ['speed', 'magnetic', 'gravity'].includes(pk.type))  v += 50;
        const s = v - d * 0.15;
        if (s > bestScore) { bestScore = s; best = { x: pk.x + 10, y: pk.y + 10 }; }
      }
    }
    return best;
  }

  private _smartWander(p: IPlayer, env: EnvForces, range: number): void {
    const ai = p.ai!;
    ai.wanderTimer = Math.max(0, (ai.wanderTimer || 0) - 1);
    if (!ai.wanderTarget || ai.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      ai.wanderTarget = {
        x: p.x + Math.cos(angle) * range * Math.random(),
        y: p.y + Math.sin(angle) * range * Math.random(),
      };
      ai.wanderTimer = Math.floor(Math.random() * 120) + 60;
    }
    const dx = ai.wanderTarget.x - p.x, dy = ai.wanderTarget.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < 30) ai.wanderTarget = null;
    else this._applyDir(p, Math.atan2(dy, dx), env);
  }

  private _checkBotStuck(p: IPlayer): boolean {
    const ai = p.ai!;
    ai.posHistory.push({ x: p.x, y: p.y });
    if (ai.posHistory.length > 45) ai.posHistory.shift();
    if (ai.posHistory.length >= 45) {
      const o = ai.posHistory[0];
      if (Math.sqrt((p.x - o.x) ** 2 + (p.y - o.y) ** 2) < 8) { ai.stuckTicks++; return true; }
      ai.stuckTicks = 0;
    }
    return false;
  }

  private _findSmartDir(p: IPlayer, idealAngle: number): { vx: number; vy: number } {
    const sweeps = [0, Math.PI/8, -Math.PI/8, Math.PI/4, -Math.PI/4, 3*Math.PI/8, -3*Math.PI/8,
                    Math.PI/2, -Math.PI/2, 5*Math.PI/8, -5*Math.PI/8, 3*Math.PI/4, -3*Math.PI/4,
                    7*Math.PI/8, -7*Math.PI/8, Math.PI];
    const hasPhase = p.phaseshiftTimer > 0;
    for (const testDist of [24, 14, 7]) {
      for (const offset of sweeps) {
        const a = idealAngle + offset;
        const vx = Math.cos(a), vy = Math.sin(a);
        const tx = p.x + vx * testDist, ty = p.y + vy * testDist;
        const wallOk = !collidesWithWalls(tx, ty, p.w, p.h, this.state.walls);
        const boxOk  = testDist <= 7 || !collidesWithBoxes(tx, ty, p.w, p.h, this.state.pushables, -1);
        if (hasPhase || (wallOk && boxOk)) return { vx, vy };
      }
    }
    return { vx: Math.cos(idealAngle), vy: Math.sin(idealAngle) };
  }

  private _calcEnvForces(p: IPlayer): EnvForces {
    let sepX = 0, sepY = 0, avoidX = 0, avoidY = 0;
    for (const [, p2] of this.state.players) {
      if (p2.id === p.id || p.isHot !== p2.isHot) continue;
      const dx = p.x - p2.x, dy = p.y - p2.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0 && d < 100) { const f = (100 - d) / 100; sepX += (dx / d) * f * 3.0; sepY += (dy / d) * f * 3.0; }
    }
    const wallRange = 45;
    for (const w of this.state.walls) {
      const cx = Math.max(w.x, Math.min(p.x + p.w / 2, w.x + w.w));
      const cy = Math.max(w.y, Math.min(p.y + p.h / 2, w.y + w.h));
      const dx = (p.x + p.w / 2) - cx, dy = (p.y + p.h / 2) - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0 && d < wallRange) { const f = (wallRange - d) / wallRange; avoidX += (dx / d) * f * 3.5; avoidY += (dy / d) * f * 3.5; }
    }
    for (const b of this.state.pushables) {
      if (b.id === p.grabbedBox) continue;
      const cx = Math.max(b.x, Math.min(p.x + p.w / 2, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y + p.h / 2, b.y + b.h));
      const dx = (p.x + p.w / 2) - cx, dy = (p.y + p.h / 2) - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0 && d < 30) { const f = (30 - d) / 30; avoidX += (dx / d) * f * 1.5; avoidY += (dy / d) * f * 1.5; }
    }
    return { sepX, sepY, avoidX, avoidY };
  }

  private _applyDir(p: IPlayer, angle: number, env: EnvForces): void {
    const mx = Math.cos(angle) + env.sepX + env.avoidX;
    const my = Math.sin(angle) + env.sepY + env.avoidY;
    const finalAngle = Math.atan2(my, mx);
    const dir = this._findSmartDir(p, finalAngle);
    if (Math.abs(dir.vx) > 0.15) { p.input.left = dir.vx < 0; p.input.right = dir.vx > 0; }
    if (Math.abs(dir.vy) > 0.15) { p.input.up   = dir.vy < 0; p.input.down  = dir.vy > 0; }
    p.ai!.lastMoveAngle = finalAngle;
  }

  private _isInNarrowPassage(x: number, y: number, w: number, h: number): boolean {
    const walls = this.state.walls;
    if (collidesWithWalls(x - 50, y, w, h, walls) && collidesWithWalls(x + 50, y, w, h, walls)) return true;
    if (collidesWithWalls(x, y - 50, w, h, walls) && collidesWithWalls(x, y + 50, w, h, walls)) return true;
    return false;
  }

  private _ensureBotAI(p: IPlayer): void {
    if (p.ai) return;
    const types: BotAIState['personality'][] = ['aggressive', 'defensive', 'collector', 'saboteur'];
    p.ai = {
      posHistory: [], stuckTicks: 0, unstuckTimer: 0, unstuckAngle: 0,
      shootCooldown: 0, buyCooldown: 0,
      personality: types[Math.floor(Math.random() * types.length)],
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeSwitchTimer: Math.floor(Math.random() * 120) + 60,
      fleeAngleBias: (Math.random() - 0.5) * Math.PI / 2.5,
      fleeAngleTimer: Math.floor(Math.random() * 200) + 100,
      lastMoveAngle: Math.random() * Math.PI * 2,
      boxCooldown: 0, wanderTarget: null, wanderTimer: 0,
    };
  }
}

interface EnvForces { sepX: number; sepY: number; avoidX: number; avoidY: number; }
