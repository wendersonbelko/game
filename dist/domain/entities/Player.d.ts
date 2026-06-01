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
    x: number;
    y: number;
    w: number;
    h: number;
    isHot: boolean;
    speed: number;
    alive: boolean;
    input: IPlayerInput;
    mouseWorld: IWorldPos | null;
    color: string;
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
    slotQ: string | null;
    slotE: string | null;
    phaseshiftTimer: number;
    magnetTimer: number;
    repelTimer: number;
    coins: number;
    score: number;
    roundScore: number;
    upgrades: UpgradesMap;
    offeredUpgrades: string[];
    hasChosenUpgrade: boolean;
    idleTicks: number;
    afkWarningTimer: number;
    ai?: BotAIState;
}
/** Estado persistente da IA de um bot. */
export interface BotAIState {
    posHistory: Array<{
        x: number;
        y: number;
    }>;
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
//# sourceMappingURL=Player.d.ts.map