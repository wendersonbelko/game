"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSessionService = void 0;
const constants_1 = require("../../domain/constants");
const GamePhase_1 = require("../../domain/enums/GamePhase");
const MathUtils_1 = require("../../shared/MathUtils");
/**
 * GameSessionService — gerencia o ciclo de vida da partida:
 * fases, rodadas, upgrades e condições de vitória.
 */
class GameSessionService {
    constructor(state, broadcaster, mapSvc, pickupSvc) {
        this.state = state;
        this.broadcaster = broadcaster;
        this.mapSvc = mapSvc;
        this.pickupSvc = pickupSvc;
    }
    // ─── Serialização do Jogador ─────────────────────────────────────────────
    serializePlayer(p) {
        return {
            id: p.id, name: p.name, x: p.x, y: p.y,
            isHot: p.isHot, alive: p.alive, color: p.color,
            ammo: p.ammo, reloadTimer: p.reloadTimer,
            health: p.health, isStunned: p.isStunned, stunTimer: p.stunTimer,
            speedDebuffTimer: p.speedDebuffTimer, holdEnergy: p.holdEnergy,
            speedBoostTimer: p.speedBoostTimer, machinegunTimer: p.machinegunTimer,
            shieldTimer: p.shieldTimer, supernovaTimer: p.supernovaTimer,
            gravityTimer: p.gravityTimer, invisibilityTimer: p.invisibilityTimer,
            empTimer: p.empTimer, stamina: p.stamina, isSprinting: p.isSprinting,
            overdriveTimer: p.overdriveTimer, trackerTimer: p.trackerTimer,
            slotQ: p.slotQ, slotE: p.slotE,
            phaseshiftTimer: p.phaseshiftTimer, magnetTimer: p.magnetTimer, repelTimer: p.repelTimer,
            coins: p.coins || 0, isBot: !!p.isBot,
            reviveImmunityTimer: p.reviveImmunityTimer || 0,
            score: p.score || 0, roundScore: p.roundScore || 0,
            upgrades: p.upgrades || {},
        };
    }
    // ─── Condições de Vitória ────────────────────────────────────────────────
    checkWinConditions() {
        if (this.state.gamePhase !== GamePhase_1.GamePhase.INGAME)
            return;
        const runners = [...this.state.players.values()].filter(p => !p.isHot);
        const hots = [...this.state.players.values()].filter(p => p.isHot);
        if (hots.length === 0) {
            this.endGame('runners');
            return;
        }
        if (runners.length === 0) {
            this.endGame('hots');
        }
    }
    // ─── Warmup ──────────────────────────────────────────────────────────────
    startWarmup() {
        this.state.gamePhase = GamePhase_1.GamePhase.WARMUP;
        this.state.phaseTimer = constants_1.WARMUP_SECS * constants_1.TICK_RATE;
        this.state.pickups = [];
        this.state.coins = [];
        this.state.coinSpawnTimer = constants_1.COIN_SPAWN_INTERVAL;
        this.mapSvc.generateMap();
        for (const [, p] of this.state.players) {
            const spawn = this.mapSvc.findSpawnPos();
            this._resetPlayerForRound(p, spawn.x, spawn.y, false);
        }
        this.broadcaster.broadcast({
            type: 'phaseChange',
            phase: GamePhase_1.GamePhase.WARMUP,
            timer: constants_1.WARMUP_SECS,
            map: this.mapSvc.getMapData(),
        });
    }
    // ─── InGame ──────────────────────────────────────────────────────────────
    startInGame(pickupSvcRef) {
        // Libera todas as caixas arrastadas
        for (const [, p] of this.state.players) {
            p.grabbedBox = null;
            p.mouseWorld = null;
        }
        for (const box of this.state.pushables) {
            box.grabbedBy = null;
        }
        this.state.gamePhase = GamePhase_1.GamePhase.INGAME;
        this.state.phaseTimer = constants_1.GAME_SECS * constants_1.TICK_RATE;
        this.state.introFreezeTimer = Math.round(3.5 * constants_1.TICK_RATE);
        this.state.pickupSpawnTimer = constants_1.PICKUP_SPAWN_INTERVAL;
        this.state.pickups = [];
        // Definir Hots
        const ids = [...this.state.players.keys()];
        let hotCount = 1;
        if (ids.length >= 6 && ids.length <= 9)
            hotCount = 2;
        else if (ids.length >= 10)
            hotCount = 3;
        const shuffledIds = (0, MathUtils_1.shuffle)([...ids]);
        const selectedHotIds = shuffledIds.slice(0, hotCount);
        for (const hotId of selectedHotIds) {
            const hot = this.state.players.get(hotId);
            if (hot) {
                hot.isHot = true;
                hot.speed = constants_1.HOT_SPEED;
                hot.health = 100 + (hot.upgrades?.hunter_hp ?? 0) * 15;
                hot.machinegunTimer = 0;
                hot.shieldTimer = 0;
                hot.invisibilityTimer = 0;
                hot.empTimer = 0;
                hot.stamina = 600;
                hot.isSprinting = false;
                hot.overdriveTimer = 0;
                hot.trackerTimer = 0;
            }
        }
        this.broadcaster.broadcast({
            type: 'phaseChange',
            phase: GamePhase_1.GamePhase.INGAME,
            timer: constants_1.GAME_SECS,
            hotAlphaId: selectedHotIds[0],
            hotAlphaIds: selectedHotIds,
        });
        // Spawn inicial de pickups
        for (let i = 0; i < 4; i++)
            pickupSvcRef.spawnRandomPickup();
    }
    // ─── Fim de Partida ──────────────────────────────────────────────────────
    endGame(winner) {
        this.state.winner = winner;
        for (const [, p] of this.state.players) {
            p.grabbedBox = null;
            p.mouseWorld = null;
        }
        for (const box of this.state.pushables) {
            box.grabbedBy = null;
        }
        // Bônus de fim de rodada
        if (winner === 'runners') {
            for (const [, p] of this.state.players) {
                if (!p.isHot && p.alive) {
                    p.roundScore = (p.roundScore || 0) + 100;
                    p.score = (p.score || 0) + 100;
                }
            }
        }
        else {
            for (const [, p] of this.state.players) {
                if (p.isHot) {
                    p.roundScore = (p.roundScore || 0) + 150;
                    p.score = (p.score || 0) + 150;
                }
            }
        }
        if (this.state.currentRound < 7) {
            this.state.gamePhase = GamePhase_1.GamePhase.UPGRADE;
            this.state.phaseTimer = 15 * constants_1.TICK_RATE;
            const pool = [...constants_1.UPGRADES_POOL];
            for (const [id, p] of this.state.players) {
                p.hasChosenUpgrade = false;
                if (!p.isBot) {
                    const shuffled = (0, MathUtils_1.shuffle)(pool);
                    p.offeredUpgrades = shuffled.slice(0, 3);
                    if (p.ws && p.ws.readyState === 1) {
                        p.ws.send(JSON.stringify({
                            type: 'upgradeOffer',
                            options: p.offeredUpgrades,
                            roundScore: p.roundScore || 0,
                            totalScore: p.score || 0,
                            round: this.state.currentRound,
                            timer: 15,
                        }));
                    }
                }
                else {
                    setTimeout(() => {
                        if (this.state.players.has(id)) {
                            const ru = pool[Math.floor(Math.random() * pool.length)];
                            p.upgrades = p.upgrades || {};
                            p.upgrades[ru] = (p.upgrades[ru] || 0) + 1;
                            p.hasChosenUpgrade = true;
                        }
                    }, 1500);
                }
            }
            this.broadcaster.broadcast({
                type: 'gameOver',
                winner,
                currentRound: this.state.currentRound,
                nextPhase: 'upgrade',
                players: [...this.state.players.values()].map(p => this.serializePlayer(p)),
            });
        }
        else {
            this.state.gamePhase = GamePhase_1.GamePhase.PODIUM;
            this.state.phaseTimer = 20 * constants_1.TICK_RATE;
            const leaderboard = [...this.state.players.values()]
                .map(p => ({ id: p.id, name: p.name, score: p.score || 0, color: p.color, isBot: !!p.isBot }))
                .sort((a, b) => b.score - a.score);
            this.broadcaster.broadcast({ type: 'gameOverPodium', winner, leaderboard, timer: 20 });
        }
    }
    // ─── Auto-seleção de upgrades para quem não escolheu ────────────────────
    autoSelectUpgradesForDelinquents() {
        const pool = [...constants_1.UPGRADES_POOL];
        for (const [, p] of this.state.players) {
            if (!p.isBot && !p.hasChosenUpgrade) {
                const upgrade = p.offeredUpgrades?.length > 0
                    ? p.offeredUpgrades[Math.floor(Math.random() * p.offeredUpgrades.length)]
                    : pool[Math.floor(Math.random() * pool.length)];
                p.upgrades = p.upgrades || {};
                p.upgrades[upgrade] = (p.upgrades[upgrade] || 0) + 1;
                p.hasChosenUpgrade = true;
            }
        }
    }
    // ─── Reset de Rodada ─────────────────────────────────────────────────────
    resetRound() {
        this.state.currentRound++;
        this.state.gamePhase = GamePhase_1.GamePhase.WARMUP;
        this.state.phaseTimer = constants_1.WARMUP_SECS * constants_1.TICK_RATE;
        this.state.winner = null;
        this.state.pickups = [];
        this.state.pickupSpawnTimer = constants_1.PICKUP_SPAWN_INTERVAL;
        this.state.coins = [];
        this.state.coinSpawnTimer = constants_1.COIN_SPAWN_INTERVAL;
        this.mapSvc.generateMap();
        for (const [, p] of this.state.players) {
            const spawn = this.mapSvc.findSpawnPos();
            const ammo = 3 + (p.upgrades?.ammo_capacity ?? 0);
            const holdEnergy = 300 * (1 + (p.upgrades?.tether_capacity ?? 0) * 0.15);
            const stamina = 600 * (1 + (p.upgrades?.runner_stamina ?? 0) * 0.15);
            this._resetPlayerForRound(p, spawn.x, spawn.y, false, ammo, holdEnergy, stamina);
            p.roundScore = 0;
        }
        this.broadcaster.broadcast({
            type: 'phaseChange',
            phase: GamePhase_1.GamePhase.WARMUP,
            timer: constants_1.WARMUP_SECS,
            currentRound: this.state.currentRound,
            map: this.mapSvc.getMapData(),
            players: [...this.state.players.values()].map(p => this.serializePlayer(p)),
        });
    }
    // ─── Reset Completo ──────────────────────────────────────────────────────
    resetGame() {
        this.state.currentRound = 1;
        this.state.gamePhase = GamePhase_1.GamePhase.LOBBY;
        this.state.phaseTimer = 0;
        this.state.winner = null;
        this.state.pickups = [];
        this.state.pickupSpawnTimer = constants_1.PICKUP_SPAWN_INTERVAL;
        this.state.coins = [];
        this.state.coinSpawnTimer = constants_1.COIN_SPAWN_INTERVAL;
        this.mapSvc.generateMap();
        for (const [, p] of this.state.players) {
            const spawn = this.mapSvc.findSpawnPos();
            this._resetPlayerForRound(p, spawn.x, spawn.y, true);
        }
        this.broadcaster.broadcast({
            type: 'phaseChange',
            phase: GamePhase_1.GamePhase.LOBBY,
            timer: 0,
            map: this.mapSvc.getMapData(),
        });
        if (this.state.players.size >= constants_1.MIN_PLAYERS_TO_START) {
            setTimeout(() => {
                if (this.state.gamePhase === GamePhase_1.GamePhase.LOBBY && this.state.players.size >= constants_1.MIN_PLAYERS_TO_START) {
                    this.startWarmup();
                }
            }, 2000);
        }
    }
    killMatchAndReturnAllToLobby() {
        this.broadcaster.broadcast({ type: 'kickToLobby' });
        this.state.players.clear();
        this.state.currentRound = 1;
        this.state.gamePhase = GamePhase_1.GamePhase.LOBBY;
        this.state.phaseTimer = 0;
        this.state.winner = null;
        this.state.pickups = [];
        this.state.coins = [];
        this.mapSvc.generateMap();
        this.broadcaster.broadcast({ type: 'phaseChange', phase: GamePhase_1.GamePhase.LOBBY, timer: 0, map: this.mapSvc.getMapData() });
    }
    // ─── Helper interno ──────────────────────────────────────────────────────
    _resetPlayerForRound(p, x, y, fullReset, ammo = 3, holdEnergy = 300, stamina = 600) {
        p.x = x;
        p.y = y;
        p.isHot = false;
        p.speed = constants_1.RUNNER_SPEED;
        p.alive = true;
        p.grabbedBox = null;
        p.mouseWorld = null;
        p.ammo = ammo;
        p.reloadTimer = 0;
        p.health = 100;
        p.isStunned = false;
        p.stunTimer = 0;
        p.speedDebuffTimer = 0;
        p.holdEnergy = holdEnergy;
        p.reviveImmunityTimer = 0;
        p.speedBoostTimer = 0;
        p.machinegunTimer = 0;
        p.shieldTimer = 0;
        p.supernovaTimer = 0;
        p.gravityTimer = 0;
        p.invisibilityTimer = 0;
        p.empTimer = 0;
        p.stamina = stamina;
        p.isSprinting = false;
        p.overdriveTimer = 0;
        p.trackerTimer = 0;
        p.slotQ = null;
        p.slotE = null;
        p.phaseshiftTimer = 0;
        p.magnetTimer = 0;
        p.repelTimer = 0;
        if (fullReset) {
            p.coins = 0;
            p.score = 0;
            p.roundScore = 0;
            p.upgrades = {};
            p.offeredUpgrades = [];
            p.hasChosenUpgrade = false;
        }
    }
    // ─── AFK ────────────────────────────────────────────────────────────────
    resetPlayerActivity(p) {
        if (!p)
            return;
        p.idleTicks = 0;
        if (p.afkWarningTimer > 0) {
            p.afkWarningTimer = 0;
            if (p.ws && p.ws.readyState === 1) {
                p.ws.send(JSON.stringify({ type: 'afkWarningReset' }));
            }
        }
    }
}
exports.GameSessionService = GameSessionService;
//# sourceMappingURL=GameSessionService.js.map