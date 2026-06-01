"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupService = void 0;
const constants_1 = require("../../domain/constants");
const MathUtils_1 = require("../../shared/MathUtils");
/**
 * PickupService — Single Responsibility: spawn e coleta de itens e moedas.
 */
class PickupService {
    constructor(state, broadcaster) {
        this.state = state;
        this.broadcaster = broadcaster;
    }
    // ─── Spawn de Pickups ────────────────────────────────────────────────────
    spawnRandomPickup() {
        if (this.state.pickups.length >= constants_1.MAX_PICKUPS)
            return;
        const hx = 3 * constants_1.TILE, hy = 3 * constants_1.TILE;
        const hw = 62 * constants_1.TILE, hh = 44 * constants_1.TILE;
        for (let attempts = 0; attempts < 100; attempts++) {
            const rx = hx + constants_1.TILE + Math.random() * (hw - 3 * constants_1.TILE);
            const ry = hy + constants_1.TILE + Math.random() * (hh - 3 * constants_1.TILE);
            if (!(0, MathUtils_1.collidesWithWalls)(rx - 10, ry - 10, 20, 20, this.state.walls) &&
                !(0, MathUtils_1.collidesWithBoxes)(rx - 10, ry - 10, 20, 20, this.state.pushables, -1)) {
                const type = constants_1.PICKUP_TYPES[Math.floor(Math.random() * constants_1.PICKUP_TYPES.length)];
                const item = {
                    id: 'item_' + this.state.nextPickupId++,
                    x: rx - 10, y: ry - 10, w: 20, h: 20,
                    type,
                };
                this.state.pickups.push(item);
                this.broadcaster.broadcast({ type: 'itemSpawned', item });
                return;
            }
        }
    }
    // ─── Spawn de Moedas ─────────────────────────────────────────────────────
    spawnRandomCoin() {
        if (this.state.coins.length >= constants_1.MAX_COINS)
            return;
        const hx = 3 * constants_1.TILE, hy = 3 * constants_1.TILE;
        const hw = 62 * constants_1.TILE, hh = 44 * constants_1.TILE;
        for (let attempts = 0; attempts < 100; attempts++) {
            const rx = hx + constants_1.TILE + Math.random() * (hw - 3 * constants_1.TILE);
            const ry = hy + constants_1.TILE + Math.random() * (hh - 3 * constants_1.TILE);
            if (!(0, MathUtils_1.collidesWithWalls)(rx - 8, ry - 8, 16, 16, this.state.walls) &&
                !(0, MathUtils_1.collidesWithBoxes)(rx - 8, ry - 8, 16, 16, this.state.pushables, -1)) {
                const coin = {
                    id: 'coin_' + this.state.nextCoinId++,
                    x: rx - 8, y: ry - 8, w: 16, h: 16,
                };
                this.state.coins.push(coin);
                this.broadcaster.broadcast({ type: 'coinSpawned', coin });
                return;
            }
        }
    }
    spawnCoinAt(x, y) {
        if (this.state.coins.length >= constants_1.MAX_COINS)
            return;
        const coin = {
            id: 'coin_' + this.state.nextCoinId++,
            x: x - 8, y: y - 8, w: 16, h: 16,
        };
        this.state.coins.push(coin);
        this.broadcaster.broadcast({ type: 'coinSpawned', coin });
    }
    // ─── Coleta de Pickups ───────────────────────────────────────────────────
    /** Detecta e processa coleta de pickups pelos jogadores. */
    processPickupCollection() {
        const hotTypes = ['speed', 'supernova', 'gravity', 'emp', 'tracker', 'magnetic'];
        const runTypes = ['speed', 'machinegun', 'shield', 'invisibility', 'phaseshift', 'blink', 'repel'];
        for (let i = this.state.pickups.length - 1; i >= 0; i--) {
            const pickup = this.state.pickups[i];
            for (const [, p] of this.state.players) {
                if (p.isStunned)
                    continue;
                const px = p.x + 14, py = p.y + 14;
                const ix = pickup.x + 10, iy = pickup.y + 10;
                const dist = Math.sqrt((px - ix) ** 2 + (py - iy) ** 2);
                if (dist >= 22)
                    continue;
                let collected = false;
                if (p.isHot) {
                    if (hotTypes.includes(pickup.type)) {
                        this._applyHotPickup(p, pickup.type);
                        collected = true;
                    }
                }
                else {
                    if (runTypes.includes(pickup.type) && (!p.slotQ || !p.slotE)) {
                        if (!p.slotQ)
                            p.slotQ = pickup.type;
                        else
                            p.slotE = pickup.type;
                        collected = true;
                    }
                }
                if (collected) {
                    this.broadcaster.broadcast({
                        type: 'collected',
                        playerId: p.id,
                        playerName: p.name,
                        itemType: pickup.type,
                        color: p.color,
                    });
                    this.state.pickups.splice(i, 1);
                    break;
                }
            }
        }
    }
    _applyHotPickup(p, type) {
        const T = constants_1.TICK_RATE;
        if (type === 'speed')
            p.speedBoostTimer = 15 * T;
        else if (type === 'supernova')
            p.supernovaTimer = 10 * T;
        else if (type === 'gravity')
            p.gravityTimer = 12 * T;
        else if (type === 'emp')
            p.empTimer = this._getUpgradedTimer(p, 'emp', 10 * T);
        else if (type === 'tracker')
            p.trackerTimer = this._getUpgradedTimer(p, 'tracker', 10 * T);
        else if (type === 'magnetic')
            p.magnetTimer = 8 * T;
    }
    _getUpgradedTimer(p, type, baseTicks) {
        const u = p.upgrades;
        if (!u)
            return baseTicks;
        if (type === 'shield')
            return baseTicks + (u.shield_duration || 0) * 2 * constants_1.TICK_RATE;
        if (type === 'invisibility')
            return baseTicks + (u.invisibility_duration || 0) * 2 * constants_1.TICK_RATE;
        if (type === 'emp')
            return baseTicks + (u.emp_duration || 0) * constants_1.TICK_RATE;
        if (type === 'tracker')
            return baseTicks + (u.tracker_duration || 0) * 2 * constants_1.TICK_RATE;
        if (type === 'overdrive')
            return baseTicks + (u.overdrive_duration || 0) * 1.5 * constants_1.TICK_RATE;
        return baseTicks;
    }
    // ─── Coleta de Moedas ────────────────────────────────────────────────────
    processCoinCollection() {
        for (let i = this.state.coins.length - 1; i >= 0; i--) {
            const coin = this.state.coins[i];
            // Magnetismo passivo
            for (const [, p] of this.state.players) {
                if (p.isStunned)
                    continue;
                const px = p.x + 14, py = p.y + 14;
                const cx = coin.x + 8, cy = coin.y + 8;
                const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
                const magnetLevel = p.upgrades?.coin_magnet ?? 0;
                if (magnetLevel > 0 && dist <= magnetLevel * 40 && dist > 18) {
                    coin.x += ((px - cx) / dist) * 4;
                    coin.y += ((py - cy) / dist) * 4;
                }
            }
            // Colisão de coleta
            for (const [, p] of this.state.players) {
                if (p.isStunned)
                    continue;
                const px = p.x + 14, py = p.y + 14;
                const cx = coin.x + 8, cy = coin.y + 8;
                const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
                if (dist < 22) {
                    p.coins = (p.coins || 0) + 1;
                    p.roundScore = (p.roundScore || 0) + 10;
                    p.score = (p.score || 0) + 10;
                    this.broadcaster.broadcast({
                        type: 'coinCollected',
                        playerId: p.id,
                        playerName: p.name,
                        coins: p.coins,
                        coinId: coin.id,
                        color: p.color,
                    });
                    this.state.coins.splice(i, 1);
                    break;
                }
            }
        }
    }
    // ─── Tick dos Timers de Spawn ────────────────────────────────────────────
    tickSpawnTimers(isIngame) {
        if (!isIngame)
            return;
        this.state.pickupSpawnTimer--;
        if (this.state.pickupSpawnTimer <= 0) {
            this.spawnRandomPickup();
            this.state.pickupSpawnTimer = constants_1.PICKUP_SPAWN_INTERVAL;
        }
        this.state.coinSpawnTimer--;
        if (this.state.coinSpawnTimer <= 0) {
            this.spawnRandomCoin();
            this.state.coinSpawnTimer = constants_1.COIN_SPAWN_INTERVAL;
        }
    }
}
exports.PickupService = PickupService;
//# sourceMappingURL=PickupService.js.map