/**
 * BraainHot — main.ts (Composition Root)
 *
 * Instancia todas as camadas na ordem correta e injeta as dependências:
 *   Domain → Shared → Application → Infrastructure
 *
 * Este arquivo é o único que conhece a estrutura completa.
 */

import { GameState }              from './application/GameState';
import { MapService }             from './application/services/MapService';
import { PickupService }          from './application/services/PickupService';
import { PhysicsService }         from './application/services/PhysicsService';
import { CombatService }          from './application/services/CombatService';
import { GameSessionService }     from './application/services/GameSessionService';
import { BotAIService }           from './application/services/BotAIService';
import { JoinPlayerUseCase }      from './application/usecases/JoinPlayerUseCase';
import { ShootUseCase }           from './application/usecases/ShootUseCase';
import { GrabBoxUseCase }         from './application/usecases/GrabBoxUseCase';
import { ActivatePowerUseCase }   from './application/usecases/ActivatePowerUseCase';
import { BuyItemUseCase }         from './application/usecases/BuyItemUseCase';
import { ChooseUpgradeUseCase }   from './application/usecases/ChooseUpgradeUseCase';
import { ChatUseCase }            from './application/usecases/ChatUseCase';

import { GameBroadcaster }        from './infrastructure/GameBroadcaster';
import { HttpServer }             from './infrastructure/http/HttpServer';
import { createWssServer }        from './infrastructure/websocket/WsServer';
import { MessageHandler }         from './infrastructure/websocket/MessageHandler';

import { GamePhase }              from './domain/enums/GamePhase';
import { TICK_MS, BROADCAST_EVERY, WARMUP_SECS, GAME_SECS } from './domain/constants';

// ─── 1. Estado Global ─────────────────────────────────────────────────────────
const state = new GameState();

// ─── 2. HTTP + WS Servers ─────────────────────────────────────────────────────
const httpSrv = new HttpServer();
const wss     = createWssServer(httpSrv.server);

// ─── 3. Broadcaster (depende de wss) ─────────────────────────────────────────
const broadcaster = new GameBroadcaster(wss);

// ─── 4. Serviços de Domínio (injeção via construtor) ─────────────────────────
const mapSvc     = new MapService(state);
const pickupSvc  = new PickupService(state, broadcaster);
const combatSvc  = new CombatService(state, broadcaster, pickupSvc);
const physicsSvc = new PhysicsService(state, broadcaster, pickupSvc);
const sessionSvc = new GameSessionService(state, broadcaster, mapSvc, pickupSvc);
const botAISvc   = new BotAIService(state, broadcaster, pickupSvc, combatSvc);

// ─── 5. Use Cases ────────────────────────────────────────────────────────────
const joinUC    = new JoinPlayerUseCase(state, broadcaster, sessionSvc, mapSvc);
const shootUC   = new ShootUseCase(combatSvc);
const grabUC    = new GrabBoxUseCase(state);
const powerUC   = new ActivatePowerUseCase(state, broadcaster, pickupSvc);
const buyUC     = new BuyItemUseCase(broadcaster, pickupSvc);
const upgradeUC = new ChooseUpgradeUseCase(state, broadcaster, sessionSvc);
const chatUC    = new ChatUseCase(broadcaster);

// ─── 6. Geração inicial do mapa ───────────────────────────────────────────────
mapSvc.generateMap();

// ─── 7. WebSocket — registrar handler por conexão ─────────────────────────────
const handlerDeps = { state, broadcaster, sessionSvc, mapSvc, joinUC, shootUC, grabUC, powerUC, buyUC, upgradeUC, chatUC };

wss.on('connection', (ws) => {
  const handler = new MessageHandler(ws, handlerDeps);
  handler.handleOpen();
  ws.on('message', (raw) => handler.handleMessage(raw));
  ws.on('close',   ()    => handler.handleClose());
});

// ─── 8. Game Loop ─────────────────────────────────────────────────────────────
function gameTick(): void {
  state.tickCount++;

  // Decrementa introFreezeTimer
  if (state.introFreezeTimer > 0) state.introFreezeTimer--;

  // Decrementa phaseTimer e avança fases
  if (state.gamePhase === GamePhase.WARMUP || state.gamePhase === GamePhase.INGAME ||
      state.gamePhase === GamePhase.UPGRADE || state.gamePhase === GamePhase.PODIUM) {

    if (state.phaseTimer > 0) {
      state.phaseTimer--;
    }

    if (state.phaseTimer <= 0) {
      switch (state.gamePhase) {
        case GamePhase.WARMUP:
          sessionSvc.startInGame(pickupSvc);
          break;

        case GamePhase.INGAME:
          sessionSvc.endGame('runners'); // Tempo esgotado → runners vencem
          break;

        case GamePhase.UPGRADE:
          sessionSvc.autoSelectUpgradesForDelinquents();
          sessionSvc.resetRound();
          break;

        case GamePhase.PODIUM:
          sessionSvc.resetGame();
          break;
      }
      return; // fase mudou, pula processamento deste tick
    }
  }

  const isFrozen =
    (state.gamePhase !== GamePhase.INGAME && state.gamePhase !== GamePhase.WARMUP) ||
    (state.gamePhase === GamePhase.INGAME && state.introFreezeTimer > 0);

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
    pickupSvc.tickSpawnTimers(state.gamePhase === GamePhase.INGAME);
  }

  // ── Infecção ──
  if (!isFrozen && state.gamePhase === GamePhase.INGAME) {
    combatSvc.checkInfection();
    sessionSvc.checkWinConditions();
  }

  // ── Broadcast periódico a 20 Hz ──
  if (state.tickCount % BROADCAST_EVERY === 0 && wss.clients.size > 0) {
    broadcaster.broadcast({
      type: 'gameState',
      players: [...state.players.values()].map(p => sessionSvc.serializePlayer(p)),
      pushables: state.pushables.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size, grabbedBy: b.grabbedBy })),
      phase: state.gamePhase,
      timer: Math.ceil(state.phaseTimer / 60),
      runnersCount: [...state.players.values()].filter(p => !p.isHot).length,
      hotsCount:    [...state.players.values()].filter(p =>  p.isHot).length,
      pickups: state.pickups.map(pk => ({ id: pk.id, x: pk.x, y: pk.y, type: pk.type })),
      coins:   state.coins.map(c  => ({ id: c.id,  x: c.x,  y: c.y })),
      currentRound: state.currentRound,
      introFreezeTimer: Math.ceil(state.introFreezeTimer / 60),
    });
  }
}

setInterval(gameTick, TICK_MS);

// ─── 9. Iniciar servidor ──────────────────────────────────────────────────────
httpSrv.listen();
