import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
export declare class GrabBoxUseCase {
    private readonly state;
    constructor(state: GameState);
    executeGrab(player: IPlayer, boxId: number): void;
    executeDrag(player: IPlayer, x: number, y: number): void;
    executeRelease(player: IPlayer): void;
}
//# sourceMappingURL=GrabBoxUseCase.d.ts.map