"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinPlayerUseCase = void 0;
const constants_1 = require("../../domain/constants");
const GamePhase_1 = require("../../domain/enums/GamePhase");
class JoinPlayerUseCase {
    constructor(state, broadcaster, sessionSvc, mapSvc) {
        this.state = state;
        this.broadcaster = broadcaster;
        this.sessionSvc = sessionSvc;
        this.mapSvc = mapSvc;
    }
    execute(ws, name, color) {
        if (this.state.players.size >= constants_1.MAX_PLAYERS) {
            ws.send(JSON.stringify({ type: 'error', message: 'O servidor está cheio (máximo 20 jogadores).' }));
            return null;
        }
        const pId = 'p' + this.state.nextPlayerId++;
        const safeName = (name || 'Anon').slice(0, 16);
        const safeColor = constants_1.PLAYER_COLORS.includes(color) ? color : constants_1.PLAYER_COLORS[0];
        const spawn = this.mapSvc.findSpawnPos();
        const player = {
            id: pId, name: safeName, ws, color: safeColor, isBot: false,
            x: spawn.x, y: spawn.y, w: constants_1.PLAYER_SIZE, h: constants_1.PLAYER_SIZE,
            isHot: false, speed: constants_1.RUNNER_SPEED, alive: true,
            input: { up: false, down: false, left: false, right: false, shift: false },
            grabbedBox: null, mouseWorld: null,
            ammo: 3, reloadTimer: 0, health: 100,
            isStunned: false, stunTimer: 0, speedDebuffTimer: 0,
            holdEnergy: 300, reviveImmunityTimer: 0, stillTicks: 0,
            speedBoostTimer: 0, machinegunTimer: 0, shieldTimer: 0,
            supernovaTimer: 0, gravityTimer: 0, invisibilityTimer: 0,
            empTimer: 0, stamina: 600, isSprinting: false,
            overdriveTimer: 0, trackerTimer: 0,
            slotQ: null, slotE: null, phaseshiftTimer: 0, magnetTimer: 0, repelTimer: 0,
            coins: 0, score: 0, roundScore: 0,
            upgrades: {}, offeredUpgrades: [], hasChosenUpgrade: false,
            idleTicks: 0, afkWarningTimer: 0,
        };
        this.state.players.set(pId, player);
        ws.send(JSON.stringify({
            type: 'welcome',
            id: pId,
            map: this.mapSvc.getMapData(),
            players: [...this.state.players.values()].map(p => this.sessionSvc.serializePlayer(p)),
            phase: this.state.gamePhase,
            timer: Math.ceil(this.state.phaseTimer / 60),
            colors: constants_1.PLAYER_COLORS,
            pickups: this.state.pickups.map(pk => ({ id: pk.id, x: pk.x, y: pk.y, type: pk.type })),
            coins: this.state.coins.map(c => ({ id: c.id, x: c.x, y: c.y })),
            currentRound: this.state.currentRound,
        }));
        this.broadcaster.broadcast({ type: 'playerJoined', player: this.sessionSvc.serializePlayer(player) });
        // Oferecer bots se for o único humano
        setTimeout(() => {
            if (this.state.players.has(pId)) {
                const humanCount = [...this.state.players.values()].filter(p => !p.isBot).length;
                if (humanCount === 1) {
                    ws.send(JSON.stringify({ type: 'offerBots' }));
                }
            }
        }, 500);
        // Iniciar warmup se atingiu mínimo
        if (this.state.gamePhase === GamePhase_1.GamePhase.LOBBY && this.state.players.size >= constants_1.MIN_PLAYERS_TO_START) {
            this.sessionSvc.startWarmup();
        }
        return player;
    }
    addBots(count, broadcaster) {
        if (isNaN(count) || count < 0 || count > 8)
            return;
        // Remove bots existentes
        for (const [id, p] of this.state.players) {
            if (p.isBot) {
                this.state.players.delete(id);
                broadcaster.broadcast({ type: 'playerLeft', id });
            }
        }
        const botNames = ['CyberBot_X', 'NeoDroid', 'ByteHunter', 'QuantumG', 'GlitchRun', 'ZeroCool', 'Vector_B', 'PixelFlee'];
        for (let i = 0; i < count; i++) {
            const bId = 'bot_' + this.state.nextPlayerId++;
            const spawn = this.mapSvc.findSpawnPos();
            const bot = {
                id: bId, name: botNames[i % botNames.length],
                ws: null, isBot: true,
                color: constants_1.PLAYER_COLORS[i % constants_1.PLAYER_COLORS.length],
                x: spawn.x, y: spawn.y, w: constants_1.PLAYER_SIZE, h: constants_1.PLAYER_SIZE,
                isHot: false, speed: constants_1.RUNNER_SPEED, alive: true,
                input: { up: false, down: false, left: false, right: false, shift: false },
                grabbedBox: null, mouseWorld: null,
                ammo: 3, reloadTimer: 0, health: 100,
                isStunned: false, stunTimer: 0, speedDebuffTimer: 0,
                holdEnergy: 300, reviveImmunityTimer: 0, stillTicks: 0,
                speedBoostTimer: 0, machinegunTimer: 0, shieldTimer: 0,
                supernovaTimer: 0, gravityTimer: 0, invisibilityTimer: 0,
                empTimer: 0, stamina: 600, isSprinting: false,
                overdriveTimer: 0, trackerTimer: 0,
                slotQ: null, slotE: null, phaseshiftTimer: 0, magnetTimer: 0, repelTimer: 0,
                coins: 0, score: 0, roundScore: 0,
                upgrades: {}, offeredUpgrades: [], hasChosenUpgrade: false,
                idleTicks: 0, afkWarningTimer: 0,
            };
            this.state.players.set(bId, bot);
            broadcaster.broadcast({ type: 'playerJoined', player: this.sessionSvc.serializePlayer(bot) });
        }
        if (this.state.players.size < constants_1.MIN_PLAYERS_TO_START && this.state.gamePhase !== GamePhase_1.GamePhase.LOBBY) {
            this.sessionSvc.resetGame();
        }
        else if (this.state.gamePhase === GamePhase_1.GamePhase.LOBBY && this.state.players.size >= constants_1.MIN_PLAYERS_TO_START) {
            this.sessionSvc.startWarmup();
        }
    }
}
exports.JoinPlayerUseCase = JoinPlayerUseCase;
//# sourceMappingURL=JoinPlayerUseCase.js.map