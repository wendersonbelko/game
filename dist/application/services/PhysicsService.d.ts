import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { PickupService } from './PickupService';
/**
 * PhysicsService — Single Responsibility: movimento, colisão e física.
 * Inclui: movimentação de jogadores, arrasto de caixas, zonas de velocidade,
 * forças magnéticas/repulsoras e resolução de sobreposição caixa-jogador.
 */
export declare class PhysicsService {
    private readonly state;
    private readonly broadcaster;
    private readonly pickupSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, pickupSvc: PickupService);
    tickPlayerTimers(): void;
    movePlayers(): void;
    private _calcForces;
    private _resolveBoxOverlap;
    moveDraggedBoxes(): void;
    applyMagneticForceOnBoxes(): void;
}
//# sourceMappingURL=PhysicsService.d.ts.map