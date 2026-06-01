"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyItemUseCase = void 0;
const constants_1 = require("../../domain/constants");
const RUNNER_PRICES = {
    speed: 3, blink: 3, shield: 4, machinegun: 4, phaseshift: 5, invisibility: 5, repel: 4,
};
const HOT_PRICES = {
    speed: 3, tracker: 3, gravity: 4, supernova: 4, emp: 5, magnetic: 4,
};
class BuyItemUseCase {
    constructor(broadcaster, pickupSvc) {
        this.broadcaster = broadcaster;
        this.pickupSvc = pickupSvc;
    }
    execute(player, itemId) {
        if (player.isStunned)
            return;
        const prices = player.isHot ? HOT_PRICES : RUNNER_PRICES;
        const price = prices[itemId];
        if (price === undefined)
            return;
        if ((player.coins || 0) < price)
            return;
        if (!player.isHot && player.slotQ && player.slotE)
            return; // slots cheios
        player.coins -= price;
        if (!player.isHot) {
            if (!player.slotQ)
                player.slotQ = itemId;
            else
                player.slotE = itemId;
        }
        else {
            this._applyHotItem(player, itemId);
        }
        this.broadcaster.broadcast({ type: 'itemBought', playerId: player.id, itemId, coins: player.coins });
    }
    _applyHotItem(player, itemId) {
        const T = constants_1.TICK_RATE;
        switch (itemId) {
            case 'speed':
                player.speedBoostTimer = 15 * T;
                break;
            case 'tracker':
                player.trackerTimer = this.pickupSvc._getUpgradedTimer(player, 'tracker', 10 * T);
                break;
            case 'gravity':
                player.gravityTimer = 12 * T;
                break;
            case 'supernova':
                player.supernovaTimer = 10 * T;
                break;
            case 'emp':
                player.empTimer = this.pickupSvc._getUpgradedTimer(player, 'emp', 10 * T);
                break;
            case 'magnetic':
                player.magnetTimer = 8 * T;
                break;
        }
    }
}
exports.BuyItemUseCase = BuyItemUseCase;
//# sourceMappingURL=BuyItemUseCase.js.map