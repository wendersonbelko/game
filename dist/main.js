"use strict";
/**
 * BraainHot — main.ts (Composition Root)
 *
 * Instancia todas as camadas na ordem correta e injeta as dependências:
 *   Domain → Shared → Application → Infrastructure
 *
 * Este arquivo é o único que conhece a estrutura completa.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const GameState_1 = require("./application/GameState");
const MapService_1 = require("./application/services/MapService");
const PickupService_1 = require("./application/services/PickupService");
const PhysicsService_1 = require("./application/services/PhysicsService");
const CombatService_1 = require("./application/services/CombatService");
const GameSessionService_1 = require("./application/services/GameSessionService");
const BotAIService_1 = require("./application/services/BotAIService");
const JoinPlayerUseCase_1 = require("./application/usecases/JoinPlayerUseCase");
const ShootUseCase_1 = require("./application/usecases/ShootUseCase");
const GrabBoxUseCase_1 = require("./application/usecases/GrabBoxUseCase");
const ActivatePowerUseCase_1 = require("./application/usecases/ActivatePowerUseCase");
const BuyItemUseCase_1 = require("./application/usecases/BuyItemUseCase");
const ChooseUpgradeUseCase_1 = require("./application/usecases/ChooseUpgradeUseCase");
const ChatUseCase_1 = require("./application/usecases/ChatUseCase");
const GameBroadcaster_1 = require("./infrastructure/GameBroadcaster");
const HttpServer_1 = require("./infrastructure/http/HttpServer");
const WsServer_1 = require("./infrastructure/websocket/WsServer");
const MessageHandler_1 = require("./infrastructure/websocket/MessageHandler");
const GamePhase_1 = require("./domain/enums/GamePhase");
const constants_1 = require("./domain/constants");
// ─── 1. Estado Global ─────────────────────────────────────────────────────────
const state = new GameState_1.GameState();
// ─── 2. HTTP + WS Servers ─────────────────────────────────────────────────────
const httpSrv = new HttpServer_1.HttpServer();
const wss = (0, WsServer_1.createWssServer)(httpSrv.server);
// ─── 3. Broadcaster (depende de wss) ─────────────────────────────────────────
const broadcaster = new GameBroadcaster_1.GameBroadcaster(wss);
// ─── 4. Serviços de Domínio (injeção via construtor) ─────────────────────────
const mapSvc = new MapService_1.MapService(state);
const pickupSvc = new PickupService_1.PickupService(state, broadcaster);
const combatSvc = new CombatService_1.CombatService(state, broadcaster, pickupSvc);
const physicsSvc = new PhysicsService_1.PhysicsService(state, broadcaster, pickupSvc);
const sessionSvc = new GameSessionService_1.GameSessionService(state, broadcaster, mapSvc, pickupSvc);
const botAISvc = new BotAIService_1.BotAIService(state, broadcaster, pickupSvc, combatSvc);
// ─── 5. Use Cases ────────────────────────────────────────────────────────────
const joinUC = new JoinPlayerUseCase_1.JoinPlayerUseCase(state, broadcaster, sessionSvc, mapSvc);
const shootUC = new ShootUseCase_1.ShootUseCase(combatSvc);
const grabUC = new GrabBoxUseCase_1.GrabBoxUseCase(state);
const powerUC = new ActivatePowerUseCase_1.ActivatePowerUseCase(state, broadcaster, pickupSvc);
const buyUC = new BuyItemUseCase_1.BuyItemUseCase(broadcaster, pickupSvc);
const upgradeUC = new ChooseUpgradeUseCase_1.ChooseUpgradeUseCase(state, broadcaster, sessionSvc);
const chatUC = new ChatUseCase_1.ChatUseCase(broadcaster);
// ─── 6. Geração inicial do mapa ───────────────────────────────────────────────
mapSvc.generateMap();
// ─── 7. WebSocket — registrar handler por conexão ─────────────────────────────
const handlerDeps = { state, broadcaster, sessionSvc, mapSvc, joinUC, shootUC, grabUC, powerUC, buyUC, upgradeUC, chatUC };
wss.on('connection', (ws) => {
    const handler = new MessageHandler_1.MessageHandler(ws, handlerDeps);
    handler.handleOpen();
    ws.on('message', (raw) => handler.handleMessage(raw));
    ws.on('close', () => handler.handleClose());
});
// ─── 8. Game Loop ─────────────────────────────────────────────────────────────
function gameTick() {
    // ── Verificação de Sessão com apenas Bots ──
    const humans = [...state.players.values()].filter(p => !p.isBot);
    if (humans.length === 0 && state.gamePhase !== GamePhase_1.GamePhase.LOBBY) {
        sessionSvc.killMatchAndReturnAllToLobby();
        return;
    }
    state.tickCount++;
    // Decrementa introFreezeTimer
    if (state.introFreezeTimer > 0)
        state.introFreezeTimer--;
    // Decrementa phaseTimer e avança fases
    if (state.gamePhase === GamePhase_1.GamePhase.WARMUP || state.gamePhase === GamePhase_1.GamePhase.INGAME ||
        state.gamePhase === GamePhase_1.GamePhase.UPGRADE || state.gamePhase === GamePhase_1.GamePhase.PODIUM) {
        if (state.phaseTimer > 0) {
            state.phaseTimer--;
        }
        if (state.phaseTimer <= 0) {
            switch (state.gamePhase) {
                case GamePhase_1.GamePhase.WARMUP:
                    sessionSvc.startInGame(pickupSvc);
                    break;
                case GamePhase_1.GamePhase.INGAME:
                    sessionSvc.endGame('runners'); // Tempo esgotado → runners vencem
                    break;
                case GamePhase_1.GamePhase.UPGRADE:
                    sessionSvc.autoSelectUpgradesForDelinquents();
                    sessionSvc.resetRound();
                    break;
                case GamePhase_1.GamePhase.PODIUM:
                    sessionSvc.resetGame();
                    break;
            }
            return; // fase mudou, pula processamento deste tick
        }
    }
    const isFrozen = (state.gamePhase !== GamePhase_1.GamePhase.INGAME && state.gamePhase !== GamePhase_1.GamePhase.WARMUP) ||
        (state.gamePhase === GamePhase_1.GamePhase.INGAME && state.introFreezeTimer > 0);
    // ── IA dos Bots ──
    botAISvc.updateAll();
    // ── Física ──
    physicsSvc.tickPlayerTimers();
    if (!isFrozen) {
        physicsSvc.movePlayers();
        physicsSvc.moveDraggedBoxes();
        physicsSvc.applyMagneticForceOnBoxes();
    }
    // ── Pickups e Moedas ──
    if (!isFrozen) {
        pickupSvc.processPickupCollection();
        pickupSvc.processCoinCollection();
        pickupSvc.tickSpawnTimers(state.gamePhase === GamePhase_1.GamePhase.INGAME);
    }
    // ── Infecção ──
    if (!isFrozen && state.gamePhase === GamePhase_1.GamePhase.INGAME) {
        combatSvc.checkInfection();
        sessionSvc.checkWinConditions();
    }
    // ── Broadcast periódico a 20 Hz ──
    if (state.tickCount % constants_1.BROADCAST_EVERY === 0 && wss.clients.size > 0) {
        broadcaster.broadcast({
            type: 'gameState',
            players: [...state.players.values()].map(p => sessionSvc.serializePlayer(p)),
            pushables: state.pushables.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size, grabbedBy: b.grabbedBy })),
            phase: state.gamePhase,
            timer: Math.ceil(state.phaseTimer / 60),
            runnersCount: [...state.players.values()].filter(p => !p.isHot).length,
            hotsCount: [...state.players.values()].filter(p => p.isHot).length,
            pickups: state.pickups.map(pk => ({ id: pk.id, x: pk.x, y: pk.y, type: pk.type })),
            coins: state.coins.map(c => ({ id: c.id, x: c.x, y: c.y })),
            currentRound: state.currentRound,
            introFreezeTimer: Math.ceil(state.introFreezeTimer / 60),
        });
    }
}
setInterval(gameTick, constants_1.TICK_MS);
// ─── 9. Iniciar servidor ──────────────────────────────────────────────────────
httpSrv.listen();
//# sourceMappingURL=main.js.map