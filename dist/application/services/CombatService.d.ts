import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { PickupService } from './PickupService';
/**
 * CombatService — Single Responsibility: raycast de tiro, infecção e stun.
 */
export declare class CombatService {
    private readonly state;
    private readonly broadcaster;
    private readonly pickupSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, pickupSvc: PickupService);
    performRaycast(shooter: IPlayer, tx: number, ty: number, angleOffset?: number, isMachinegun?: boolean): void;
    checkInfection(): void;
}
//# sourceMappingURL=CombatService.d.ts.map