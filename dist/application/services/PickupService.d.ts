import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
/**
 * PickupService — Single Responsibility: spawn e coleta de itens e moedas.
 */
export declare class PickupService {
    private readonly state;
    private readonly broadcaster;
    constructor(state: GameState, broadcaster: IBroadcaster);
    spawnRandomPickup(): void;
    spawnRandomCoin(): void;
    spawnCoinAt(x: number, y: number): void;
    /** Detecta e processa coleta de pickups pelos jogadores. */
    processPickupCollection(): void;
    private _applyHotPickup;
    _getUpgradedTimer(p: IPlayer, type: string, baseTicks: number): number;
    processCoinCollection(): void;
    tickSpawnTimers(isIngame: boolean): void;
}
//# sourceMappingURL=PickupService.d.ts.map