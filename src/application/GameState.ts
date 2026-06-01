import type { IPlayer } from '../domain/entities/Player';
import type { IBox } from '../domain/entities/Box';
import type { IPickup } from '../domain/entities/Pickup';
import type { ICoin } from '../domain/entities/Coin';
import type { IWall } from '../domain/entities/Wall';
import type { ISpeedZone } from '../domain/entities/SpeedZone';
import { GamePhase } from '../domain/enums/GamePhase';
import { PICKUP_SPAWN_INTERVAL, COIN_SPAWN_INTERVAL } from '../domain/constants';

/**
 * GameState centraliza todo o estado mutável do servidor.
 * É injetado nos serviços para evitar variáveis globais soltas.
 */
export class GameState {
  // Jogadores
  players: Map<string, IPlayer> = new Map();
  nextPlayerId = 1;

  // Mapa
  walls: IWall[] = [];
  pushables: IBox[] = [];
  speedZones: ISpeedZone[] = [];
  nextBoxId = 1;

  // Pickups
  pickups: IPickup[] = [];
  nextPickupId = 1;
  pickupSpawnTimer: number = PICKUP_SPAWN_INTERVAL;

  // Moedas
  coins: ICoin[] = [];
  nextCoinId = 1;
  coinSpawnTimer: number = COIN_SPAWN_INTERVAL;

  // Fase da partida
  gamePhase: GamePhase = GamePhase.LOBBY;
  phaseTimer = 0;
  tickCount = 0;
  winner: 'runners' | 'hots' | null = null;
  currentRound = 1;
  introFreezeTimer = 0;
}
