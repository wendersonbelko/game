"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivatePowerUseCase = void 0;
const constants_1 = require("../../domain/constants");
const MathUtils_1 = require("../../shared/MathUtils");
class ActivatePowerUseCase {
    constructor(state, broadcaster, pickupSvc) {
        this.state = state;
        this.broadcaster = broadcaster;
        this.pickupSvc = pickupSvc;
    }
    execute(player, slot) {
        if (player.isHot)
            return;
        if (player.isStunned)
            return;
        const powerKey = slot === 'Q' ? player.slotQ : player.slotE;
        if (!powerKey)
            return;
        if (slot === 'Q')
            player.slotQ = null;
        else
            player.slotE = null;
        this._activate(player, powerKey);
    }
    _activate(player, key) {
        const T = constants_1.TICK_RATE;
        switch (key) {
            case 'phaseshift':
                player.phaseshiftTimer = 4 * T;
                this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'phaseshift' });
                break;
            case 'blink': {
                let bdx = 0, bdy = 0;
                if (player.input.up)
                    bdy -= 1;
                if (player.input.down)
                    bdy += 1;
                if (player.input.left)
                    bdx -= 1;
                if (player.input.right)
                    bdx += 1;
                if (bdx === 0 && bdy === 0)
                    bdx = 1;
                const len = Math.sqrt(bdx * bdx + bdy * bdy);
                const dist = 160 + (player.upgrades?.blink_range ?? 0) * 20;
                const ux = bdx / len, uy = bdy / len;
                for (let d = dist; d >= 0; d -= 8) {
                    const tx = Math.max(constants_1.TILE, Math.min(constants_1.MAP_W - constants_1.TILE - player.w, player.x + ux * d));
                    const ty = Math.max(constants_1.TILE, Math.min(constants_1.MAP_H - constants_1.TILE - player.h, player.y + uy * d));
                    if (!(0, MathUtils_1.collidesWithWalls)(tx, ty, player.w, player.h, this.state.walls) &&
                        !(0, MathUtils_1.collidesWithBoxes)(tx, ty, player.w, player.h, this.state.pushables, -1)) {
                        player.x = tx;
                        player.y = ty;
                        this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'blink', x: tx, y: ty });
                        break;
                    }
                }
                break;
            }
            case 'speed':
                player.speedBoostTimer = 15 * T;
                this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'speed' });
                break;
            case 'machinegun':
                player.machinegunTimer = 15 * T;
                this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'machinegun' });
                break;
            case 'shield':
                player.shieldTimer = this.pickupSvc._getUpgradedTimer(player, 'shield', 15 * T);
                this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'shield' });
                break;
            case 'invisibility':
                player.invisibilityTimer = this.pickupSvc._getUpgradedTimer(player, 'invisibility', 10 * T);
                this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'invisibility' });
                break;
            case 'repel':
                player.repelTimer = 6 * T;
                this.broadcaster.broadcast({ type: 'powerActivated', playerId: player.id, powerType: 'repel' });
                break;
        }
    }
}
exports.ActivatePowerUseCase = ActivatePowerUseCase;
//# sourceMappingURL=ActivatePowerUseCase.js.map