import type { IPlayer } from '../../domain/entities/Player';
import type { CombatService } from '../services/CombatService';
export declare class ShootUseCase {
    private readonly combatSvc;
    constructor(combatSvc: CombatService);
    execute(player: IPlayer, tx: number, ty: number): void;
    executeReload(player: IPlayer): void;
}
//# sourceMappingURL=ShootUseCase.d.ts.map