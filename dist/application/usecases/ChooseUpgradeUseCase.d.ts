import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { GameSessionService } from '../services/GameSessionService';
export declare class ChooseUpgradeUseCase {
    private readonly state;
    private readonly broadcaster;
    private readonly sessionSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, sessionSvc: GameSessionService);
    execute(player: IPlayer, upgradeId: string): void;
}
//# sourceMappingURL=ChooseUpgradeUseCase.d.ts.map