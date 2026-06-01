import type WebSocket from 'ws';
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
export declare class MessageHandler {
    private readonly ws;
    private readonly deps;
    private currentPlayer;
    constructor(ws: WebSocket, deps: MessageHandlerDeps);
    handleOpen(): void;
    handleMessage(raw: WebSocket.RawData): void;
    handleClose(): void;
    private _handleLeave;
}
//# sourceMappingURL=MessageHandler.d.ts.map