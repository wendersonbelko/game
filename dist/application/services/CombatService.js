"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CombatService = void 0;
const constants_1 = require("../../domain/constants");
const MathUtils_1 = require("../../shared/MathUtils");
/**
 * CombatService — Single Responsibility: raycast de tiro, infecção e stun.
 */
class CombatService {
    constructor(state, broadcaster, pickupSvc) {
        this.state = state;
        this.broadcaster = broadcaster;
        this.pickupSvc = pickupSvc;
    }
    // ─── Raycast ─────────────────────────────────────────────────────────────
    performRaycast(shooter, tx, ty, angleOffset = 0, isMachinegun = false) {
        const px = shooter.x + constants_1.PLAYER_SIZE / 2;
        const py = shooter.y + constants_1.PLAYER_SIZE / 2;
        let dx = tx - px, dy = ty - py;
        let len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1)
            return;
        const maxRange = 600;
        if (len > maxRange) {
            dx = (dx / len) * maxRange;
            dy = (dy / len) * maxRange;
            len = maxRange;
        }
        let ux = dx / len, uy = dy / len;
        if (angleOffset !== 0) {
            const angle = Math.atan2(uy, ux) + angleOffset;
            ux = Math.cos(angle);
            uy = Math.sin(angle);
            dx = ux * len;
            dy = uy * len;
        }
        let finalEx = px + dx, finalEy = py + dy;
        let hitType = null;
        const step = 5;
        outer: for (let d = 0; d < len; d += step) {
            const rx = px + ux * d, ry = py + uy * d;
            // 1. Parede
            if ((0, MathUtils_1.collidesWithWalls)(rx - 1, ry - 1, 2, 2, this.state.walls)) {
                finalEx = rx;
                finalEy = ry;
                hitType = 'wall';
                break;
            }
            // 2. Caixa
            for (const b of this.state.pushables) {
                if (rx >= b.x && rx <= b.x + b.w && ry >= b.y && ry <= b.y + b.h) {
                    finalEx = rx;
                    finalEy = ry;
                    hitType = 'box';
                    const pushDist = isMachinegun ? 40 : 35;
                    const tBX = b.x + ux * pushDist, tBY = b.y + uy * pushDist;
                    if (!(0, MathUtils_1.collidesWithWalls)(tBX + 1, b.y + 1, b.w - 2, b.h - 2, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(tBX + 1, b.y + 1, b.w - 2, b.h - 2, this.state.pushables, b.id))
                        b.x = tBX;
                    if (!(0, MathUtils_1.collidesWithWalls)(b.x + 1, tBY + 1, b.w - 2, b.h - 2, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(b.x + 1, tBY + 1, b.w - 2, b.h - 2, this.state.pushables, b.id))
                        b.y = tBY;
                    break outer;
                }
            }
            // 3. Jogador
            for (const [id, p2] of this.state.players) {
                if (id === shooter.id)
                    continue;
                const cx2 = p2.x + constants_1.PLAYER_SIZE / 2, cy2 = p2.y + constants_1.PLAYER_SIZE / 2;
                if (Math.sqrt((rx - cx2) ** 2 + (ry - cy2) ** 2) < constants_1.PLAYER_SIZE / 2 + 2) {
                    finalEx = rx;
                    finalEy = ry;
                    hitType = 'player';
                    // Empurrão
                    const pushDist = isMachinegun ? 35 : 30;
                    const tPX = p2.x + ux * pushDist, tPY = p2.y + uy * pushDist;
                    if (!(0, MathUtils_1.collidesWithWalls)(tPX, p2.y, p2.w, p2.h, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(tPX, p2.y, p2.w, p2.h, this.state.pushables, -1))
                        p2.x = tPX;
                    if (!(0, MathUtils_1.collidesWithWalls)(p2.x, tPY, p2.w, p2.h, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(p2.x, tPY, p2.w, p2.h, this.state.pushables, -1))
                        p2.y = tPY;
                    p2.speedDebuffTimer = 30;
                    // Dano ao Hot
                    if (p2.isHot && !p2.isStunned && p2.reviveImmunityTimer <= 0) {
                        p2.health -= isMachinegun ? 10 : 22.6;
                        p2.stillTicks = 0;
                        shooter.roundScore = (shooter.roundScore || 0) + 20;
                        shooter.score = (shooter.score || 0) + 20;
                        this.pickupSvc.spawnCoinAt(p2.x + constants_1.PLAYER_SIZE / 2, p2.y + constants_1.PLAYER_SIZE / 2);
                        if (p2.health <= 0) {
                            p2.health = 0;
                            p2.isStunned = true;
                            p2.stunTimer = 10 * constants_1.TICK_RATE;
                            this.broadcaster.broadcast({ type: 'stunned', playerId: p2.id, name: p2.name });
                        }
                    }
                    break outer;
                }
            }
        }
        this.broadcaster.broadcast({
            type: 'bulletTraced',
            shooterId: shooter.id,
            sx: px, sy: py,
            ex: finalEx, ey: finalEy,
            hitType,
            color: isMachinegun ? '#ffcc00' : shooter.color,
        });
    }
    // ─── Infecção ─────────────────────────────────────────────────────────────
    checkInfection() {
        const hots = [...this.state.players.values()].filter(p => p.isHot && !p.isStunned);
        const runners = [...this.state.players.values()].filter(p => !p.isHot);
        for (const hot of hots) {
            for (const runner of runners) {
                const dx = (hot.x + hot.w / 2) - (runner.x + runner.w / 2);
                const dy = (hot.y + hot.h / 2) - (runner.y + runner.h / 2);
                let infRad = constants_1.INFECTION_RADIUS;
                if (hot.supernovaTimer > 0) {
                    infRad += 25 + (hot.upgrades?.supernova_radius ?? 0) * 20;
                }
                if (Math.sqrt(dx * dx + dy * dy) >= infRad)
                    continue;
                // Escudo absorve
                if (runner.shieldTimer > 0) {
                    runner.shieldTimer = 0;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const hux = dx / len, huy = dy / len;
                    const tHX = hot.x + hux * 120, tHY = hot.y + huy * 120;
                    if (!(0, MathUtils_1.collidesWithWalls)(tHX, hot.y, hot.w, hot.h, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(tHX, hot.y, hot.w, hot.h, this.state.pushables, -1))
                        hot.x = tHX;
                    if (!(0, MathUtils_1.collidesWithWalls)(hot.x, tHY, hot.w, hot.h, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(hot.x, tHY, hot.w, hot.h, this.state.pushables, -1))
                        hot.y = tHY;
                    hot.roundScore = (hot.roundScore || 0) + 15;
                    hot.score = (hot.score || 0) + 15;
                    this.broadcaster.broadcast({
                        type: 'shieldPopped',
                        runnerId: runner.id, runnerName: runner.name,
                        hotId: hot.id, hotName: hot.name,
                    });
                }
                else {
                    // Infecção
                    runner.isHot = true;
                    runner.speed = constants_1.HOT_SPEED;
                    runner.health = 100 + (runner.upgrades?.hunter_hp ?? 0) * 15;
                    runner.machinegunTimer = 0;
                    runner.shieldTimer = 0;
                    runner.invisibilityTimer = 0;
                    hot.roundScore = (hot.roundScore || 0) + 50;
                    hot.score = (hot.score || 0) + 50;
                    this.broadcaster.broadcast({
                        type: 'infected',
                        playerId: runner.id, byPlayerId: hot.id,
                        name: runner.name, byName: hot.name,
                    });
                }
            }
        }
    }
}
exports.CombatService = CombatService;
//# sourceMappingURL=CombatService.js.map