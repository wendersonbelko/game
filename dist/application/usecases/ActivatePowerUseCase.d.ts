import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { PickupService } from '../services/PickupService';
export declare class ActivatePowerUseCase {
    private readonly state;
    private readonly broadcaster;
    private readonly pickupSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, pickupSvc: PickupService);
    execute(player: IPlayer, slot: 'Q' | 'E'): void;
    private _activate;
}
//# sourceMappingURL=ActivatePowerUseCase.d.ts.map