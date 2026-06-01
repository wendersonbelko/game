import type { IPlayer } from '../domain/entities/Player';
import type { IBox } from '../domain/entities/Box';
import type { IPickup } from '../domain/entities/Pickup';
import type { ICoin } from '../domain/entities/Coin';
import type { IWall } from '../domain/entities/Wall';
import type { ISpeedZone } from '../domain/entities/SpeedZone';
import { GamePhase } from '../domain/enums/GamePhase';
/**
 * GameState centraliza todo o estado mutável do servidor.
 * É injetado nos serviços para evitar variáveis globais soltas.
 */
export declare class GameState {
    players: Map<string, IPlayer>;
    nextPlayerId: number;
    walls: IWall[];
    pushables: IBox[];
    speedZones: ISpeedZone[];
    nextBoxId: number;
    pickups: IPickup[];
    nextPickupId: number;
    pickupSpawnTimer: number;
    coins: ICoin[];
    nextCoinId: number;
    coinSpawnTimer: number;
    gamePhase: GamePhase;
    phaseTimer: number;
    tickCount: number;
    winner: 'runners' | 'hots' | null;
    currentRound: number;
    introFreezeTimer: number;
}
//# sourceMappingURL=GameState.d.ts.map