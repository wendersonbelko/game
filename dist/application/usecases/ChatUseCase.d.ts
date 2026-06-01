import type { IPlayer } from '../../domain/entities/Player';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
export declare class ChatUseCase {
    private readonly broadcaster;
    constructor(broadcaster: IBroadcaster);
    execute(player: IPlayer, text: string): void;
}
//# sourceMappingURL=ChatUseCase.d.ts.map