"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPGRADES_POOL = exports.PICKUP_TYPES = exports.PLAYER_COLORS = exports.MAX_COINS = exports.COIN_SPAWN_INTERVAL = exports.MAX_PICKUPS = exports.PICKUP_SPAWN_INTERVAL = exports.DRAG_SPEED = exports.GRAB_RANGE = exports.INFECTION_RADIUS = exports.MAX_PLAYERS = exports.MIN_PLAYERS_TO_START = exports.ENDGAME_SECS = exports.GAME_SECS = exports.WARMUP_SECS = exports.HOT_SPEED = exports.RUNNER_SPEED = exports.PLAYER_SIZE = exports.MAP_H = exports.MAP_W = exports.TILE = exports.BROADCAST_EVERY = exports.TICK_MS = exports.TICK_RATE = exports.PORT = void 0;
// ─── Constantes Globais do Jogo ─────────────────────────────────────────────
exports.PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
// Tick
exports.TICK_RATE = 60;
exports.TICK_MS = 1000 / exports.TICK_RATE;
exports.BROADCAST_EVERY = 3; // a cada 3 ticks = 20 hz
// Mapa
exports.TILE = 40;
exports.MAP_W = 2720;
exports.MAP_H = 2000;
// Jogador
exports.PLAYER_SIZE = 28;
exports.RUNNER_SPEED = 3.0;
exports.HOT_SPEED = 3.3;
// Fases
exports.WARMUP_SECS = 20;
exports.GAME_SECS = 120;
exports.ENDGAME_SECS = 8;
// Lobby
exports.MIN_PLAYERS_TO_START = 3;
exports.MAX_PLAYERS = 20;
// Mecânicas
exports.INFECTION_RADIUS = exports.PLAYER_SIZE + 2;
exports.GRAB_RANGE = 70;
exports.DRAG_SPEED = 4.5;
// Pickups
exports.PICKUP_SPAWN_INTERVAL = 7.5 * exports.TICK_RATE; // ticks
exports.MAX_PICKUPS = 10;
// Moedas
exports.COIN_SPAWN_INTERVAL = 5 * exports.TICK_RATE; // ticks
exports.MAX_COINS = 15;
// Cores de jogadores disponíveis
exports.PLAYER_COLORS = [
    '#00f0ff', '#00ff88', '#aa66ff', '#ff66cc',
    '#ffcc00', '#ff8844', '#66ffcc', '#88aaff',
];
// Tipos de pickup disponíveis
exports.PICKUP_TYPES = [
    'speed', 'machinegun', 'shield', 'supernova',
    'gravity', 'invisibility', 'emp', 'phaseshift',
    'blink', 'repel', 'magnetic',
];
// Pool de upgrades do torneio
exports.UPGRADES_POOL = [
    'runner_speed', 'hunter_speed', 'laser_cooldown', 'ammo_capacity',
    'runner_stamina', 'stamina_regen', 'tether_capacity', 'tether_regen',
    'hunter_hp', 'hunter_still_heal', 'still_heal_delay', 'shield_duration',
    'invisibility_duration', 'overdrive_duration', 'vortex_strength', 'emp_duration',
    'tracker_duration', 'gravity_slowness', 'blink_range', 'supernova_radius',
    'coin_magnet', 'revive_immunity',
];
//# sourceMappingURL=constants.js.map