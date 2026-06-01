// ─── Constantes Globais do Jogo ─────────────────────────────────────────────
export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Tick
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const BROADCAST_EVERY = 3; // a cada 3 ticks = 20 hz

// Mapa
export const TILE = 40;
export const MAP_W = 2720;
export const MAP_H = 2000;

// Jogador
export const PLAYER_SIZE = 28;
export const RUNNER_SPEED = 3.0;
export const HOT_SPEED = 3.3;

// Fases
export const WARMUP_SECS = 20;
export const GAME_SECS = 120;
export const ENDGAME_SECS = 8;

// Lobby
export const MIN_PLAYERS_TO_START = 3;
export const MAX_PLAYERS = 20;

// Mecânicas
export const INFECTION_RADIUS = PLAYER_SIZE + 2;
export const GRAB_RANGE = 70;
export const DRAG_SPEED = 4.5;

// Pickups
export const PICKUP_SPAWN_INTERVAL = 7.5 * TICK_RATE; // ticks
export const MAX_PICKUPS = 10;

// Moedas
export const COIN_SPAWN_INTERVAL = 5 * TICK_RATE; // ticks
export const MAX_COINS = 15;

// Cores de jogadores disponíveis
export const PLAYER_COLORS: readonly string[] = [
  '#00f0ff', '#00ff88', '#aa66ff', '#ff66cc',
  '#ffcc00', '#ff8844', '#66ffcc', '#88aaff',
];

// Tipos de pickup disponíveis
export const PICKUP_TYPES: readonly string[] = [
  'speed', 'machinegun', 'shield', 'supernova',
  'gravity', 'invisibility', 'emp', 'phaseshift',
  'blink', 'repel', 'magnetic',
];

// Pool de upgrades do torneio
export const UPGRADES_POOL: readonly string[] = [
  'runner_speed', 'hunter_speed', 'laser_cooldown', 'ammo_capacity',
  'runner_stamina', 'stamina_regen', 'tether_capacity', 'tether_regen',
  'hunter_hp', 'hunter_still_heal', 'still_heal_delay', 'shield_duration',
  'invisibility_duration', 'overdrive_duration', 'vortex_strength', 'emp_duration',
  'tracker_duration', 'gravity_slowness', 'blink_range', 'supernova_radius',
  'coin_magnet', 'revive_immunity',
];
