import type { IPlayer } from '../../domain/entities/Player';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { PickupService } from '../services/PickupService';
export declare class BuyItemUseCase {
    private readonly broadcaster;
    private readonly pickupSvc;
    constructor(broadcaster: IBroadcaster, pickupSvc: PickupService);
    execute(player: IPlayer, itemId: string): void;
    private _applyHotItem;
}
//# sourceMappingURL=BuyItemUseCase.d.ts.map