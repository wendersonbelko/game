"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = void 0;
const GamePhase_1 = require("../domain/enums/GamePhase");
const constants_1 = require("../domain/constants");
/**
 * GameState centraliza todo o estado mutável do servidor.
 * É injetado nos serviços para evitar variáveis globais soltas.
 */
class GameState {
    constructor() {
        // Jogadores
        this.players = new Map();
        this.nextPlayerId = 1;
        // Mapa
        this.walls = [];
        this.pushables = [];
        this.speedZones = [];
        this.nextBoxId = 1;
        // Pickups
        this.pickups = [];
        this.nextPickupId = 1;
        this.pickupSpawnTimer = constants_1.PICKUP_SPAWN_INTERVAL;
        // Moedas
        this.coins = [];
        this.nextCoinId = 1;
        this.coinSpawnTimer = constants_1.COIN_SPAWN_INTERVAL;
        // Fase da partida
        this.gamePhase = GamePhase_1.GamePhase.LOBBY;
        this.phaseTimer = 0;
        this.tickCount = 0;
        this.winner = null;
        this.currentRound = 1;
        this.introFreezeTimer = 0;
    }
}
exports.GameState = GameState;
//# sourceMappingURL=GameState.js.map