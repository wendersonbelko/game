"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
const GamePhase_1 = require("../../domain/enums/GamePhase");
const constants_1 = require("../../domain/constants");
/**
 * MessageHandler — roteador de mensagens WebSocket.
 * Cada conexão WS recebe uma instância que mantém referência ao jogador atual.
 */
class MessageHandler {
    constructor(ws, deps) {
        this.ws = ws;
        this.deps = deps;
        this.currentPlayer = null;
    }
    handleOpen() {
        const { state, sessionSvc } = this.deps;
        this.ws.send(JSON.stringify({
            type: 'gameState',
            players: [...state.players.values()].map(p => sessionSvc.serializePlayer(p)),
            pushables: [],
            phase: state.gamePhase,
            timer: Math.ceil(state.phaseTimer / constants_1.TICK_RATE),
            runnersCount: [...state.players.values()].filter(p => !p.isHot).length,
            hotsCount: [...state.players.values()].filter(p => p.isHot).length,
            pickups: [],
            coins: [],
            currentRound: state.currentRound,
            introFreezeTimer: Math.ceil(state.introFreezeTimer / constants_1.TICK_RATE),
        }));
    }
    handleMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        const { state, broadcaster, sessionSvc, mapSvc, joinUC, shootUC, grabUC, powerUC, buyUC, upgradeUC, chatUC } = this.deps;
        // ── Join ──
        if (msg.type === 'join') {
            const player = joinUC.execute(this.ws, msg.name, msg.color);
            this.currentPlayer = player;
            return;
        }
        if (!this.currentPlayer)
            return;
        const p = this.currentPlayer;
        // Rastrear atividade
        const activityTypes = ['shoot', 'grab', 'drag', 'release', 'reload', 'activatePower', 'buyItem', 'chooseUpgrade', 'chat'];
        if (activityTypes.includes(msg.type)) {
            sessionSvc.resetPlayerActivity(p);
        }
        // Freeze check
        const isFrozen = (state.gamePhase !== GamePhase_1.GamePhase.INGAME && state.gamePhase !== GamePhase_1.GamePhase.WARMUP) ||
            (state.gamePhase === GamePhase_1.GamePhase.INGAME && state.introFreezeTimer > 0);
        if (isFrozen) {
            p.input.up = false;
            p.input.down = false;
            p.input.left = false;
            p.input.right = false;
            p.input.shift = false;
            const blockedWhenFrozen = ['input', 'shoot', 'grab', 'drag', 'release', 'reload', 'activatePower', 'buyItem'];
            if (blockedWhenFrozen.includes(msg.type))
                return;
        }
        switch (msg.type) {
            case 'input': {
                const isMoving = !!(msg.up || msg.down || msg.left || msg.right || msg.shift);
                let mouseMoved = false;
                if (msg.mouseWorld && p.mouseWorld) {
                    const mw = msg.mouseWorld;
                    const dx = mw.x - p.mouseWorld.x, dy = mw.y - p.mouseWorld.y;
                    if (dx * dx + dy * dy > 1.5)
                        mouseMoved = true;
                }
                if (isMoving || mouseMoved)
                    sessionSvc.resetPlayerActivity(p);
                p.input.up = !!msg.up;
                p.input.down = !!msg.down;
                p.input.left = !!msg.left;
                p.input.right = !!msg.right;
                p.input.shift = !!msg.shift;
                if (msg.mouseWorld)
                    p.mouseWorld = msg.mouseWorld;
                break;
            }
            case 'shoot':
                shootUC.execute(p, msg.tx, msg.ty);
                break;
            case 'reload':
                shootUC.executeReload(p);
                break;
            case 'chat':
                chatUC.execute(p, msg.text);
                break;
            case 'grab':
                grabUC.executeGrab(p, msg.boxId);
                break;
            case 'drag':
                grabUC.executeDrag(p, msg.x, msg.y);
                break;
            case 'release':
                grabUC.executeRelease(p);
                break;
            case 'activatePower':
                powerUC.execute(p, msg.slot);
                break;
            case 'buyItem':
                buyUC.execute(p, msg.itemId);
                break;
            case 'chooseUpgrade':
                upgradeUC.execute(p, msg.upgradeId);
                break;
            case 'addBots':
                joinUC.addBots(parseInt(msg.count), broadcaster);
                break;
            case 'leaveToLobby':
                this._handleLeave(state, broadcaster, sessionSvc);
                return;
        }
    }
    handleClose() {
        if (!this.currentPlayer)
            return;
        const { state, broadcaster, sessionSvc } = this.deps;
        if (this.currentPlayer.grabbedBox) {
            const box = state.pushables.find(b => b.id === this.currentPlayer.grabbedBox);
            if (box)
                box.grabbedBy = null;
        }
        state.players.delete(this.currentPlayer.id);
        broadcaster.broadcast({ type: 'playerLeft', id: this.currentPlayer.id });
        // Oferecer bots se restar 1 humano
        const humansLeft = [...state.players.values()].filter(p => !p.isBot);
        if (humansLeft.length === 1) {
            const rh = humansLeft[0];
            if (rh.ws && rh.ws.readyState === 1) {
                rh.ws.send(JSON.stringify({ type: 'offerBots' }));
            }
        }
        if (state.players.size === 0) {
            sessionSvc.resetGame();
        }
        else {
            sessionSvc.checkWinConditions();
        }
    }
    _handleLeave(state, broadcaster, sessionSvc) {
        if (!this.currentPlayer)
            return;
        if (this.currentPlayer.grabbedBox) {
            const box = state.pushables.find(b => b.id === this.currentPlayer.grabbedBox);
            if (box)
                box.grabbedBy = null;
        }
        const id = this.currentPlayer.id;
        state.players.delete(id);
        broadcaster.broadcast({ type: 'playerLeft', id });
        this.currentPlayer = null;
        if (state.players.size === 0) {
            sessionSvc.resetGame();
        }
        else if (state.players.size < constants_1.MIN_PLAYERS_TO_START && state.gamePhase !== GamePhase_1.GamePhase.LOBBY) {
            sessionSvc.resetGame();
        }
        else {
            sessionSvc.checkWinConditions();
        }
    }
}
exports.MessageHandler = MessageHandler;
//# sourceMappingURL=MessageHandler.js.map