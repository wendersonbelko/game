import type WebSocket from 'ws';

/** Upgrades acumulados do torneio. Chave = upgrade id, valor = nível (stacks). */
export type UpgradesMap = Record<string, number>;

/** Input de direção recebido do cliente. */
export interface IPlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
}

/** Coordenada 2D (posição do mouse no mundo). */
export interface IWorldPos {
  x: number;
  y: number;
}

/** Estado completo de um jogador (humano ou bot) no servidor. */
export interface IPlayer {
  id: string;
  name: string;
  /** WebSocket de conexão — null para bots. */
  ws: WebSocket | null;
  isBot: boolean;

  // Posição e dimensões
  x: number;
  y: number;
  w: number;
  h: number;

  // Papel na partida
  isHot: boolean;
  speed: number;
  alive: boolean;

  // Input (preenchido a cada mensagem 'input' ou pela IA)
  input: IPlayerInput;
  mouseWorld: IWorldPos | null;

  // Visual
  color: string;

  // ── Mecânicas v5 ──
  ammo: number;
  reloadTimer: number;
  health: number;
  isStunned: boolean;
  stunTimer: number;
  speedDebuffTimer: number;
  holdEnergy: number;
  reviveImmunityTimer: number;
  stillTicks: number;
  grabbedBox: number | null;

  // ── Buffs v6 ──
  speedBoostTimer: number;
  machinegunTimer: number;
  shieldTimer: number;
  supernovaTimer: number;
  gravityTimer: number;
  invisibilityTimer: number;
  empTimer: number;
  stamina: number;
  isSprinting: boolean;
  overdriveTimer: number;
  trackerTimer: number;

  // ── Slots de Poderes v7 ──
  slotQ: string | null;
  slotE: string | null;
  phaseshiftTimer: number;
  magnetTimer: number;
  repelTimer: number;

  // ── Economia v8 ──
  coins: number;

  // ── Torneio v14 ──
  score: number;
  roundScore: number;
  upgrades: UpgradesMap;
  offeredUpgrades: string[];
  hasChosenUpgrade: boolean;

  // ── Inatividade (AFK) ──
  idleTicks: number;
  afkWarningTimer: number;

  // ── IA interna (apenas bots) ──
  ai?: BotAIState;
}

/** Estado persistente da IA de um bot. */
export interface BotAIState {
  posHistory: Array<{ x: number; y: number }>;
  stuckTicks: number;
  unstuckTimer: number;
  unstuckAngle: number;
  shootCooldown: number;
  buyCooldown: number;
  personality: 'aggressive' | 'defensive' | 'collector' | 'saboteur';
  strafeDir: 1 | -1;
  strafeSwitchTimer: number;
  fleeAngleBias: number;
  fleeAngleTimer: number;
  lastMoveAngle: number;
  boxCooldown: number;
  wanderTarget: IWorldPos | null;
  wanderTimer: number;
}
