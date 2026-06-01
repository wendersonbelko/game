import type WebSocket from 'ws';
import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { GameSessionService } from '../services/GameSessionService';
import type { MapService } from '../services/MapService';
export declare class JoinPlayerUseCase {
    private readonly state;
    private readonly broadcaster;
    private readonly sessionSvc;
    private readonly mapSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, sessionSvc: GameSessionService, mapSvc: MapService);
    execute(ws: WebSocket, name: string, color: string): IPlayer | null;
    addBots(count: number, broadcaster: IBroadcaster): void;
}
//# sourceMappingURL=JoinPlayerUseCase.d.ts.map