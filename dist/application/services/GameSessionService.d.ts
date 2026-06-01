import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { MapService } from './MapService';
import type { PickupService } from './PickupService';
/**
 * GameSessionService — gerencia o ciclo de vida da partida:
 * fases, rodadas, upgrades e condições de vitória.
 */
export declare class GameSessionService {
    private readonly state;
    private readonly broadcaster;
    private readonly mapSvc;
    private readonly pickupSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, mapSvc: MapService, pickupSvc: PickupService);
    serializePlayer(p: IPlayer): object;
    checkWinConditions(): void;
    startWarmup(): void;
    startInGame(pickupSvcRef: PickupService): void;
    endGame(winner: 'runners' | 'hots'): void;
    autoSelectUpgradesForDelinquents(): void;
    resetRound(): void;
    resetGame(): void;
    killMatchAndReturnAllToLobby(): void;
    private _resetPlayerForRound;
    resetPlayerActivity(p: IPlayer): void;
}
//# sourceMappingURL=GameSessionService.d.ts.map