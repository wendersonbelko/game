import type WebSocket from 'ws';
import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../../application/GameState';
import type { IBroadcaster } from '../GameBroadcaster';
import type { GameSessionService } from '../../application/services/GameSessionService';
import type { MapService } from '../../application/services/MapService';
import type { JoinPlayerUseCase } from '../../application/usecases/JoinPlayerUseCase';
import type { ShootUseCase } from '../../application/usecases/ShootUseCase';
import type { GrabBoxUseCase } from '../../application/usecases/GrabBoxUseCase';
import type { ActivatePowerUseCase } from '../../application/usecases/ActivatePowerUseCase';
import type { BuyItemUseCase } from '../../application/usecases/BuyItemUseCase';
import type { ChooseUpgradeUseCase } from '../../application/usecases/ChooseUpgradeUseCase';
import type { ChatUseCase } from '../../application/usecases/ChatUseCase';
import { GamePhase } from '../../domain/enums/GamePhase';
import { MIN_PLAYERS_TO_START, TICK_RATE } from '../../domain/constants';

/** Dependências injetadas no handler de mensagens. */
export interface MessageHandlerDeps {
  state: GameState;
  broadcaster: IBroadcaster;
  sessionSvc: GameSessionService;
  mapSvc: MapService;
  joinUC: JoinPlayerUseCase;
  shootUC: ShootUseCase;
  grabUC: GrabBoxUseCase;
  powerUC: ActivatePowerUseCase;
  buyUC: BuyItemUseCase;
  upgradeUC: ChooseUpgradeUseCase;
  chatUC: ChatUseCase;
}

/**
 * MessageHandler — roteador de mensagens WebSocket.
 * Cada conexão WS recebe uma instância que mantém referência ao jogador atual.
 */
export class MessageHandler {
  private currentPlayer: IPlayer | null = null;

  constructor(
    private readonly ws: WebSocket,
    private readonly deps: MessageHandlerDeps,
  ) {}

  handleOpen(): void {
    const { state, sessionSvc } = this.deps;
    (this.ws as unknown as { send: (d: string) => void }).send(JSON.stringify({
      type: 'gameState',
      players: [...state.players.values()].map(p => sessionSvc.serializePlayer(p)),
      pushables: [],
      phase: state.gamePhase,
      timer: Math.ceil(state.phaseTimer / TICK_RATE),
      runnersCount: [...state.players.values()].filter(p => !p.isHot).length,
      hotsCount:    [...state.players.values()].filter(p =>  p.isHot).length,
      pickups: [],
      coins: [],
      currentRound: state.currentRound,
      introFreezeTimer: Math.ceil(state.introFreezeTimer / TICK_RATE),
    }));
  }

  handleMessage(raw: WebSocket.RawData): void {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }

    const { state, broadcaster, sessionSvc, mapSvc, joinUC, shootUC, grabUC, powerUC, buyUC, upgradeUC, chatUC } = this.deps;

    // ── Join ──
    if (msg.type === 'join') {
      const player = joinUC.execute(this.ws, msg.name as string, msg.color as string);
      this.currentPlayer = player;
      return;
    }

    if (!this.currentPlayer) return;
    const p = this.currentPlayer;

    // Rastrear atividade
    const activityTypes = ['shoot', 'grab', 'drag', 'release', 'reload', 'activatePower', 'buyItem', 'chooseUpgrade', 'chat'];
    if (activityTypes.includes(msg.type as string)) {
      sessionSvc.resetPlayerActivity(p);
    }

    // Freeze check
    const isFrozen =
      (state.gamePhase !== GamePhase.INGAME && state.gamePhase !== GamePhase.WARMUP) ||
      (state.gamePhase === GamePhase.INGAME && state.introFreezeTimer > 0);

    if (isFrozen) {
      p.input.up = false; p.input.down = false;
      p.input.left = false; p.input.right = false; p.input.shift = false;
      const blockedWhenFrozen = ['input', 'shoot', 'grab', 'drag', 'release', 'reload', 'activatePower', 'buyItem'];
      if (blockedWhenFrozen.includes(msg.type as string)) return;
    }

    switch (msg.type as string) {
      case 'input': {
        const isMoving = !!(msg.up || msg.down || msg.left || msg.right || msg.shift);
        let mouseMoved = false;
        if (msg.mouseWorld && p.mouseWorld) {
          const mw = msg.mouseWorld as { x: number; y: number };
          const dx = mw.x - p.mouseWorld.x, dy = mw.y - p.mouseWorld.y;
          if (dx * dx + dy * dy > 1.5) mouseMoved = true;
        }
        if (isMoving || mouseMoved) sessionSvc.resetPlayerActivity(p);
        p.input.up    = !!msg.up;
        p.input.down  = !!msg.down;
        p.input.left  = !!msg.left;
        p.input.right = !!msg.right;
        p.input.shift = !!msg.shift;
        if (msg.mouseWorld) p.mouseWorld = msg.mouseWorld as { x: number; y: number };
        break;
      }

      case 'shoot':
        shootUC.execute(p, msg.tx as number, msg.ty as number);
        break;

      case 'reload':
        shootUC.executeReload(p);
        break;

      case 'chat':
        chatUC.execute(p, msg.text as string);
        break;

      case 'grab':
        grabUC.executeGrab(p, msg.boxId as number);
        break;

      case 'drag':
        grabUC.executeDrag(p, msg.x as number, msg.y as number);
        break;

      case 'release':
        grabUC.executeRelease(p);
        break;

      case 'activatePower':
        powerUC.execute(p, msg.slot as 'Q' | 'E');
        break;

      case 'buyItem':
        buyUC.execute(p, msg.itemId as string);
        break;

      case 'chooseUpgrade':
        upgradeUC.execute(p, msg.upgradeId as string);
        break;

      case 'addBots':
        joinUC.addBots(parseInt(msg.count as string), broadcaster);
        break;

      case 'leaveToLobby':
        this._handleLeave(state, broadcaster, sessionSvc);
        return;
    }
  }

  handleClose(): void {
    if (!this.currentPlayer) return;
    const { state, broadcaster, sessionSvc } = this.deps;

    if (this.currentPlayer.grabbedBox) {
      const box = state.pushables.find(b => b.id === this.currentPlayer!.grabbedBox);
      if (box) box.grabbedBy = null;
    }

    state.players.delete(this.currentPlayer.id);
    broadcaster.broadcast({ type: 'playerLeft', id: this.currentPlayer.id });

    // Oferecer bots se restar 1 humano
    const humansLeft = [...state.players.values()].filter(p => !p.isBot);
    if (humansLeft.length === 1) {
      const rh = humansLeft[0];
      if (rh.ws && (rh.ws as unknown as { readyState: number }).readyState === 1) {
        (rh.ws as unknown as { send: (d: string) => void }).send(JSON.stringify({ type: 'offerBots' }));
      }
    }

    if (state.players.size === 0) {
      sessionSvc.resetGame();
    } else {
      sessionSvc.checkWinConditions();
    }
  }

  private _handleLeave(
    state: GameState,
    broadcaster: IBroadcaster,
    sessionSvc: GameSessionService,
  ): void {
    if (!this.currentPlayer) return;

    if (this.currentPlayer.grabbedBox) {
      const box = state.pushables.find(b => b.id === this.currentPlayer!.grabbedBox);
      if (box) box.grabbedBy = null;
    }

    const id = this.currentPlayer.id;
    state.players.delete(id);
    broadcaster.broadcast({ type: 'playerLeft', id });
    this.currentPlayer = null;

    if (state.players.size === 0) {
      sessionSvc.resetGame();
    } else if (state.players.size < MIN_PLAYERS_TO_START && state.gamePhase !== GamePhase.LOBBY) {
      sessionSvc.resetGame();
    } else {
      sessionSvc.checkWinConditions();
    }
  }
}
