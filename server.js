/**
 * BraainHot — Server v6
 * Servidor Único Autorizativo (Máximo 20 jogadores)
 * Aguarda 3 jogadores para iniciar Aquecimento de 60 segundos.
 * Após o Aquecimento, inicia Partida de 2 minutos.
 * Com Arma para Corredores (3 tiros seguidos, 5s recarga, reduz velocidade e empurra).
 * Sangue do Hot (100 HP, 3 hits paralisam por 10s).
 * Limite de Arrasto de Caixas (5s de tether max, recarrega solto, Hots recarregam 2x mais rápido).
 * Bate-papo por sessão e painel de jogadores.
 * 
 * NOVO NA V6:
 * Sistema de Drop de Itens Cyberpunk Aleatórios (Metralhadora Burst, Escudo de Plasma, Supernova, Aura Gravitacional, Super Velocidade, Camuflagem Holográfica, Pulso Cyber EMP).
 */
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;
const BROADCAST_EVERY = 3; // a cada 3 ticks = 20hz

const TILE = 40;
const MAP_W = 2720;
const MAP_H = 2000;
const PLAYER_SIZE = 28;
const RUNNER_SPEED = 3.0;
const HOT_SPEED = 3.4;
const WARMUP_SECS = 20; // 20 segundos de aquecimento antes da caçada
const GAME_SECS = 120; // 2 minutos de caçada
const ENDGAME_SECS = 8;
const MIN_PLAYERS_TO_START = 3;
const MAX_PLAYERS = 20;
const INFECTION_RADIUS = PLAYER_SIZE + 2;
const GRAB_RANGE = 70;
const DRAG_SPEED = 4.5;

const Phase = { LOBBY: 'lobby', WARMUP: 'warmup', INGAME: 'ingame', ENDGAME: 'endgame' };
const PLAYER_COLORS = ['#00f0ff','#00ff88','#aa66ff','#ff66cc','#ffcc00','#ff8844','#66ffcc','#88aaff'];

// ─── Estado do Servidor Único ───
const players = new Map(); // pId -> Player
let walls = [];
let pushables = [];
let speedZones = [];
let gamePhase = Phase.LOBBY;
let phaseTimer = 0;
let tickCount = 0;
let winner = null;
let nextPlayerId = 1;

// Itens Drops v6
let pickups = [];
let nextPickupId = 1;
const PICKUP_SPAWN_INTERVAL = 7.5 * TICK_RATE; // a cada 7.5 segundos (o dobro da taxa atual)
let pickupSpawnTimer = PICKUP_SPAWN_INTERVAL;

// Economia de Moedas v7
let coins = [];
let nextCoinId = 1;
const COIN_SPAWN_INTERVAL = 5 * TICK_RATE; // a cada 5 segundos
let coinSpawnTimer = COIN_SPAWN_INTERVAL;

// ─── Geração do Mapa ───
function addWall(x, y, w, h) {
  walls.push({ x, y, w, h });
}

function generateMap() {
  walls = [];
  pushables = [];
  speedZones = [];
  let nextBoxId = 1;
  const T = TILE;

  // ── Borda externa ──
  addWall(0, 0, MAP_W, T);
  addWall(0, MAP_H - T, MAP_W, T);
  addWall(0, 0, T, MAP_H);
  addWall(MAP_W - T, 0, T, MAP_H);

  // ── Paredes externas da casa (Expandidas de 44x32 para 62x44) ──
  const hx = 3 * T, hy = 3 * T;
  const hw = 62 * T, hh = 44 * T;
  const hx2 = hx + hw, hy2 = hy + hh;

  addWall(hx, hy, hw, T);
  addWall(hx, hy, T, hh);
  addWall(hx2 - T, hy, T, hh);
  
  // Porta de entrada = gap de 4 tiles no meio da parede inferior
  addWall(hx, hy2 - T, 28 * T, T);
  addWall(hx + 32 * T, hy2 - T, 30 * T, T);

  // ── Paredes internas procedimentais (Minecraft cyberpunk style) ──
  const hDividers = [
    Math.floor(Math.random() * 5) + 12, // Ex: linha entre row 12 e 16
    Math.floor(Math.random() * 5) + 26  // Ex: linha entre row 26 e 30
  ];
  const vDividers = [
    Math.floor(Math.random() * 5) + 13, // Ex: coluna entre 13 e 17
    Math.floor(Math.random() * 5) + 29, // Ex: coluna entre 29 e 33
    Math.floor(Math.random() * 5) + 45  // Ex: coluna entre 45 e 49
  ];

  // Gerar divisórias horizontais procedimentais com vãos de mínimo 6 tiles
  for (const row of hDividers) {
    let col = 1;
    while (col < 61) {
      const isWall = Math.random() < 0.6; // 60% chance de ser parede sólida
      if (isWall) {
        const wLen = Math.floor(Math.random() * 9) + 6; // tamanho 6 a 14 tiles
        const endCol = Math.min(61, col + wLen);
        const actualLen = endCol - col;
        if (actualLen >= 3) {
          addWall(hx + col * T, hy + row * T, actualLen * T, T);
        }
        col = endCol;
      }
      // Garante corredor livre de no mínimo 6 tiles (6 a 9 tiles sorteados)
      const gapLen = Math.floor(Math.random() * 4) + 6;
      col += gapLen;
    }
  }

  // Gerar divisórias verticais procedimentais com vãos de mínimo 6 tiles
  for (const col of vDividers) {
    let row = 1;
    while (row < 43) {
      const isWall = Math.random() < 0.6; // 60% chance de ser parede sólida
      if (isWall) {
        const hLen = Math.floor(Math.random() * 9) + 6; // tamanho 6 a 14 tiles
        const endRow = Math.min(43, row + hLen);
        const actualLen = endRow - row;
        if (actualLen >= 3) {
          addWall(hx + col * T, hy + row * T, T, actualLen * T);
        }
        row = endRow;
      }
      // Garante corredor livre de no mínimo 6 tiles (6 a 9 tiles sorteados)
      const gapLen = Math.floor(Math.random() * 4) + 6;
      row += gapLen;
    }
  }

  // Sorteia de 6 a 10 pilares táticos cibernéticos (1x1 ou 2x2 tiles)
  const numPillars = Math.floor(Math.random() * 5) + 6; // 6 a 10
  let pillarsAdded = 0;
  let pillarAttempts = 0;
  while (pillarsAdded < numPillars && pillarAttempts < 100) {
    pillarAttempts++;
    const col = Math.floor(Math.random() * 58) + 2; // de 2 a 59
    const row = Math.floor(Math.random() * 40) + 2; // de 2 a 41
    const size = Math.random() < 0.5 ? 1 : 2; // 1x1 ou 2x2
    const px = hx + col * T;
    const py = hy + row * T;
    const pw = size * T;
    const ph = size * T;

    // Margem de 1 tile livre em volta do pilar para não trancar corredores
    if (!collidesWithWalls(px - T, py - T, pw + 2 * T, ph + 2 * T)) {
      addWall(px, py, pw, ph);
      pillarsAdded++;
    }
  }

  // Adicionar 4 Boosts e 2 Slows em áreas totalmente desobstruídas
  const zonesToPlace = [
    { type: 'boost', label: '⚡ BOOST' },
    { type: 'boost', label: '⚡ BOOST' },
    { type: 'boost', label: '⚡ BOOST' },
    { type: 'boost', label: '⚡ BOOST' },
    { type: 'slow', label: '❄ SLOW' },
    { type: 'slow', label: '❄ SLOW' }
  ];

  for (const zoneDef of zonesToPlace) {
    let placed = false;
    let attempts = 0;
    const zw = zoneDef.type === 'boost' 
      ? (Math.floor(Math.random() * 2) + 4) * T 
      : (Math.floor(Math.random() * 2) + 5) * T;
    const zh = zoneDef.type === 'boost' 
      ? (Math.floor(Math.random() * 2) + 2) * T 
      : 3 * T;

    while (!placed && attempts < 100) {
      attempts++;
      const col = Math.floor(Math.random() * (60 - zw / T)) + 1;
      const row = Math.floor(Math.random() * (42 - zh / T)) + 1;
      const zx = hx + col * T;
      const zy = hy + row * T;

      let collides = false;
      for (const wall of walls) {
        if (rectOverlap(zx, zy, zw, zh, wall.x, wall.y, wall.w, wall.h)) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        for (const existing of speedZones) {
          if (rectOverlap(zx, zy, zw, zh, existing.x, existing.y, existing.w, existing.h)) {
            collides = true;
            break;
          }
        }
      }

      if (!collides) {
        speedZones.push({ x: zx, y: zy, w: zw, h: zh, type: zoneDef.type, label: zoneDef.label });
        placed = true;
      }
    }
  }

  // Adicionar as 37 caixas barricadas procedimentais (sizes S: 28px, M: 40px, L: 56px)
  const boxSizesList = [];
  for (let i = 0; i < 15; i++) boxSizesList.push('S');
  for (let i = 0; i < 12; i++) boxSizesList.push('M');
  for (let i = 0; i < 10; i++) boxSizesList.push('L');

  const sizes = { S: 28, M: 40, L: 56 };

  for (const size of boxSizesList) {
    const s = sizes[size];
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 150) {
      attempts++;
      const rx = hx + T + Math.random() * (hw - 2 * T - s);
      const ry = hy + T + Math.random() * (hh - 2 * T - s);

      // Margem de 2px livre em volta para que as caixas não nasçam coladas em paredes
      if (!collidesWithWalls(rx - 2, ry - 2, s + 4, s + 4) &&
          !collidesWithBoxes(rx - 2, ry - 2, s + 4, s + 4, -1)) {
        pushables.push({
          id: nextBoxId++,
          x: rx, y: ry, w: s, h: s,
          size: size,
          grabbedBy: null,
          targetX: null, targetY: null
        });
        placed = true;
      }
    }
  }
}

generateMap();

// ─── Física & Colisão ───
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function collidesWithWalls(x, y, w, h) {
  for (const wall of walls) {
    if (rectOverlap(x, y, w, h, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

function collidesWithBoxes(x, y, w, h, excludeId) {
  for (const b of pushables) {
    if (b.id === excludeId) continue;
    if (rectOverlap(x, y, w, h, b.x, b.y, b.w, b.h)) return true;
  }
  return false;
}

function findSpawnPos() {
  const hx = 3 * TILE + TILE, hy = 3 * TILE + TILE;
  const hw = 60 * TILE, hh = 42 * TILE;
  
  // Camada 1: 300 tentativas livre de paredes e caixas
  for (let tries = 0; tries < 300; tries++) {
    const x = hx + Math.random() * (hw - PLAYER_SIZE);
    const y = hy + Math.random() * (hh - PLAYER_SIZE);
    if (!collidesWithWalls(x, y, PLAYER_SIZE, PLAYER_SIZE) &&
        !collidesWithBoxes(x, y, PLAYER_SIZE, PLAYER_SIZE, -1)) {
      return { x, y };
    }
  }
  
  // Camada 2: 200 tentativas livre apenas de paredes (fallback)
  for (let tries = 0; tries < 200; tries++) {
    const x = hx + Math.random() * (hw - PLAYER_SIZE);
    const y = hy + Math.random() * (hh - PLAYER_SIZE);
    if (!collidesWithWalls(x, y, PLAYER_SIZE, PLAYER_SIZE)) {
      return { x, y };
    }
  }

  // Fallback absoluto
  return { x: hx + 100, y: hy + 100 };
}

// ─── Lógica do Servidor ───
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const [, p] of players) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(data);
  }
}

function serializePlayer(p) {
  return {
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    isHot: p.isHot,
    alive: p.alive,
    color: p.color,
    ammo: p.ammo,
    reloadTimer: p.reloadTimer,
    health: p.health,
    isStunned: p.isStunned,
    stunTimer: p.stunTimer,
    speedDebuffTimer: p.speedDebuffTimer,
    holdEnergy: p.holdEnergy,

    // Buffs v6
    speedBoostTimer: p.speedBoostTimer,
    machinegunTimer: p.machinegunTimer,
    shieldTimer: p.shieldTimer,
    supernovaTimer: p.supernovaTimer,
    gravityTimer: p.gravityTimer,
    invisibilityTimer: p.invisibilityTimer,
    empTimer: p.empTimer,
    stamina: p.stamina,
    isSprinting: p.isSprinting,
    overdriveTimer: p.overdriveTimer,
    trackerTimer: p.trackerTimer,

    // Slots e Poderes v7
    slotQ: p.slotQ,
    slotE: p.slotE,
    phaseshiftTimer: p.phaseshiftTimer,
    magnetTimer: p.magnetTimer || 0,
    repelTimer: p.repelTimer || 0,

    // Economia v8
    coins: p.coins || 0,

    // Bot status v9
    isBot: !!p.isBot,
    
    // Imunidade ao Reviver v10.2
    reviveImmunityTimer: p.reviveImmunityTimer || 0,
  };
}

function getMapData() {
  return {
    w: MAP_W, h: MAP_H, tile: TILE, walls,
    pushables: pushables.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size, grabbedBy: b.grabbedBy })),
    speedZones,
  };
}

function startWarmup() {
  gamePhase = Phase.WARMUP;
  phaseTimer = WARMUP_SECS * TICK_RATE;
  pickups = [];
  coins = [];
  coinSpawnTimer = COIN_SPAWN_INTERVAL;
  
  // Regenera o mapa de forma procedimental
  generateMap();

  // Teleporta e reseta o estado de todos os jogadores ativos
  for (const [, p] of players) {
    const spawn = findSpawnPos();
    p.x = spawn.x;
    p.y = spawn.y;
    p.isHot = false;
    p.speed = RUNNER_SPEED;
    p.alive = true;
    p.grabbedBox = null;
    p.mouseWorld = null;

    // Reset de armas e mecânicas
    p.ammo = 3;
    p.reloadTimer = 0;
    p.health = 100;
    p.isStunned = false;
    p.stunTimer = 0;
    p.speedDebuffTimer = 0;
    p.holdEnergy = 300;
    p.reviveImmunityTimer = 0;

    // Reset Buffs v6
    p.speedBoostTimer = 0;
    p.machinegunTimer = 0;
    p.shieldTimer = 0;
    p.supernovaTimer = 0;
    p.gravityTimer = 0;
    p.invisibilityTimer = 0;
    p.empTimer = 0;
    p.stamina = 600;
    p.isSprinting = false;
    p.overdriveTimer = 0;
    p.trackerTimer = 0;

    // Reset Slots e Poderes v7
    p.slotQ = null;
    p.slotE = null;
    p.phaseshiftTimer = 0;
    p.magnetTimer = 0;
    p.repelTimer = 0;

    // Reset Economia v8
    p.coins = 0;
  }

  broadcast({ type: 'phaseChange', phase: Phase.WARMUP, timer: WARMUP_SECS, map: getMapData() });
}

function startInGame() {
  gamePhase = Phase.INGAME;
  phaseTimer = GAME_SECS * TICK_RATE;
  // Reseta timer e spawna o primeiro item logo ao iniciar
  pickupSpawnTimer = PICKUP_SPAWN_INTERVAL;
  pickups = [];
  const ids = [...players.keys()];
  const hotId = ids[Math.floor(Math.random() * ids.length)];
  const hotPlayer = players.get(hotId);
  if (hotPlayer) {
    hotPlayer.isHot = true;
    hotPlayer.speed = HOT_SPEED;
    hotPlayer.health = 100;
    hotPlayer.machinegunTimer = 0;
    hotPlayer.shieldTimer = 0;
    hotPlayer.invisibilityTimer = 0;
    hotPlayer.empTimer = 0;
    hotPlayer.stamina = 600;
    hotPlayer.isSprinting = false;
    hotPlayer.overdriveTimer = 0;
    hotPlayer.trackerTimer = 0;
  }
  broadcast({ type: 'phaseChange', phase: Phase.INGAME, timer: GAME_SECS, hotAlphaId: hotId });
  // Spawna o primeiro pickup imediatamente ao começar a partida (dobro do inicial)
  spawnRandomPickup();
  spawnRandomPickup();
  spawnRandomPickup();
  spawnRandomPickup();
}

function endGame(win) {
  gamePhase = Phase.ENDGAME;
  phaseTimer = ENDGAME_SECS * TICK_RATE;
  winner = win;
  broadcast({ type: 'gameOver', winner: win });
}

function resetGame() {
  gamePhase = Phase.LOBBY;
  phaseTimer = 0; winner = null;
  pickups = [];
  pickupSpawnTimer = PICKUP_SPAWN_INTERVAL;
  coins = [];
  coinSpawnTimer = COIN_SPAWN_INTERVAL;
  generateMap();
  for (const [, p] of players) {
    const spawn = findSpawnPos();
    p.x = spawn.x; p.y = spawn.y;
    p.isHot = false; p.speed = RUNNER_SPEED; p.alive = true;
    p.grabbedBox = null; p.mouseWorld = null;

    // Reset de armas e mecânicas
    p.ammo = 3;
    p.reloadTimer = 0;
    p.health = 100;
    p.isStunned = false;
    p.stunTimer = 0;
    p.speedDebuffTimer = 0;
    p.holdEnergy = 300;
    p.reviveImmunityTimer = 0;

    // Reset Buffs v6
    p.speedBoostTimer = 0;
    p.machinegunTimer = 0;
    p.shieldTimer = 0;
    p.supernovaTimer = 0;
    p.gravityTimer = 0;
    p.invisibilityTimer = 0;
    p.empTimer = 0;
    p.stamina = 600;
    p.isSprinting = false;
    p.overdriveTimer = 0;
    p.trackerTimer = 0;

    // Reset Slots e Poderes v7
    p.slotQ = null;
    p.slotE = null;
    p.phaseshiftTimer = 0;
    p.magnetTimer = 0;
    p.repelTimer = 0;

    // Reset Economia v8
    p.coins = 0;
  }
  broadcast({ type: 'phaseChange', phase: Phase.LOBBY, timer: 0, map: getMapData() });

  // Se mantiver 3 ou mais, aguarda 2s e inicia aquecimento novamente
  if (players.size >= MIN_PLAYERS_TO_START) {
    setTimeout(() => {
      if (gamePhase === Phase.LOBBY && players.size >= MIN_PLAYERS_TO_START) {
        startWarmup();
      }
    }, 2000);
  }
}

function checkWinConditions() {
  if (gamePhase !== Phase.INGAME) return;
  const runners = [...players.values()].filter(p => !p.isHot);
  const hots = [...players.values()].filter(p => p.isHot);
  if (hots.length === 0) return;
  if (runners.length === 0) endGame('hots');
}

// ─── Geração de Itens Cyberpunk v6 ───
function spawnRandomPickup() {
  if (pickups.length >= 10) return; // Limite de 10 itens no mapa simultaneamente (o dobro do limite anterior de 5)

  const hx = 3 * TILE, hy = 3 * TILE;
  const hw = 62 * TILE, hh = 44 * TILE;

  let spawned = false;
  let attempts = 0;
  while (!spawned && attempts < 100) {
    attempts++;
    const rx = hx + TILE + Math.random() * (hw - 3 * TILE);
    const ry = hy + TILE + Math.random() * (hh - 3 * TILE);

    if (!collidesWithWalls(rx - 10, ry - 10, 20, 20) && 
        !collidesWithBoxes(rx - 10, ry - 10, 20, 20, -1)) {
      
      const types = ['speed', 'machinegun', 'shield', 'supernova', 'gravity', 'invisibility', 'emp', 'phaseshift', 'blink', 'repel', 'magnetic'];
      const type = types[Math.floor(Math.random() * types.length)];

      const item = {
        id: 'item_' + nextPickupId++,
        x: rx - 10,
        y: ry - 10,
        w: 20,
        h: 20,
        type: type
      };
      pickups.push(item);
      spawned = true;
      
      broadcast({ type: 'itemSpawned', item });
    }
  }
}

// ─── Geração de Moedas v7 ───
function spawnRandomCoin() {
  if (coins.length >= 15) return; // Limite de 15 moedas simultâneas

  const hx = 3 * TILE, hy = 3 * TILE;
  const hw = 62 * TILE, hh = 44 * TILE;

  let spawned = false;
  let attempts = 0;
  while (!spawned && attempts < 100) {
    attempts++;
    const rx = hx + TILE + Math.random() * (hw - 3 * TILE);
    const ry = hy + TILE + Math.random() * (hh - 3 * TILE);

    if (!collidesWithWalls(rx - 8, ry - 8, 16, 16) && 
        !collidesWithBoxes(rx - 8, ry - 8, 16, 16, -1)) {
      
      const coin = {
        id: 'coin_' + nextCoinId++,
        x: rx - 8,
        y: ry - 8,
        w: 16,
        h: 16
      };
      coins.push(coin);
      spawned = true;
      
      broadcast({ type: 'coinSpawned', coin });
    }
  }
}

function spawnCoinAt(x, y) {
  if (coins.length >= 15) return;
  const coin = {
    id: 'coin_' + nextCoinId++,
    x: x - 8,
    y: y - 8,
    w: 16,
    h: 16
  };
  coins.push(coin);
  broadcast({ type: 'coinSpawned', coin });
}

// ─── Disparo com Raycast Reutilizável v6 ───
function performRaycast(currentPlayer, tx, ty, angleOffset = 0, isMachinegun = false) {
  const px = currentPlayer.x + PLAYER_SIZE / 2;
  const py = currentPlayer.y + PLAYER_SIZE / 2;

  let dx = tx - px;
  let dy = ty - py;
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const maxRange = 600;
  if (len > maxRange) {
    dx = (dx / len) * maxRange;
    dy = (dy / len) * maxRange;
    len = maxRange;
  }

  let ux = dx / len;
  let uy = dy / len;

  if (angleOffset !== 0) {
    const angle = Math.atan2(uy, ux) + angleOffset;
    ux = Math.cos(angle);
    uy = Math.sin(angle);
    dx = ux * len;
    dy = uy * len;
  }

  let finalEx = px + dx;
  let finalEy = py + dy;
  let hitType = null;
  let hitTargetId = null;

  const step = 5;
  for (let d = 0; d < len; d += step) {
    const rx = px + ux * d;
    const ry = py + uy * d;

    // 1. Colisão com paredes
    if (collidesWithWalls(rx - 1, ry - 1, 2, 2)) {
      finalEx = rx;
      finalEy = ry;
      hitType = 'wall';
      break;
    }

    // 2. Colisão com caixas (arrasta um pouco)
    let boxHit = null;
    for (const b of pushables) {
      if (rx >= b.x && rx <= b.x + b.w && ry >= b.y && ry <= b.y + b.h) {
        boxHit = b;
        break;
      }
    }
    if (boxHit) {
      finalEx = rx;
      finalEy = ry;
      hitType = 'box';
      hitTargetId = boxHit.id;

      // Metralhadora causa empurrão maior na caixa! (Com inset de 1px para evitar travamentos)
      const pushDist = isMachinegun ? 40 : 35;
      const targetBoxX = boxHit.x + ux * pushDist;
      const targetBoxY = boxHit.y + uy * pushDist;
      if (!collidesWithWalls(targetBoxX + 1, boxHit.y + 1, boxHit.w - 2, boxHit.h - 2) &&
          !collidesWithBoxes(targetBoxX + 1, boxHit.y + 1, boxHit.w - 2, boxHit.h - 2, boxHit.id)) {
        boxHit.x = targetBoxX;
      }
      if (!collidesWithWalls(boxHit.x + 1, targetBoxY + 1, boxHit.w - 2, boxHit.h - 2) &&
          !collidesWithBoxes(boxHit.x + 1, targetBoxY + 1, boxHit.w - 2, boxHit.h - 2, boxHit.id)) {
        boxHit.y = targetBoxY;
      }
      break;
    }

    // 3. Colisão com outros jogadores
    let playerHit = null;
    for (const [id, p2] of players) {
      if (id === currentPlayer.id) continue;
      const cx2 = p2.x + PLAYER_SIZE / 2;
      const cy2 = p2.y + PLAYER_SIZE / 2;
      const distToPlayer = Math.sqrt((rx - cx2) * (rx - cx2) + (ry - cy2) * (ry - cy2));
      if (distToPlayer < PLAYER_SIZE / 2 + 2) {
        playerHit = p2;
        break;
      }
    }
    if (playerHit) {
      finalEx = rx;
      finalEy = ry;
      hitType = 'player';
      hitTargetId = playerHit.id;

      const pushDist = isMachinegun ? 35 : 30;
      const targetPX = playerHit.x + ux * pushDist;
      const targetPY = playerHit.y + uy * pushDist;
      if (!collidesWithWalls(targetPX, playerHit.y, playerHit.w, playerHit.h) &&
          !collidesWithBoxes(targetPX, playerHit.y, playerHit.w, playerHit.h, -1)) {
        playerHit.x = targetPX;
      }
      if (!collidesWithWalls(playerHit.x, targetPY, playerHit.w, playerHit.h) &&
          !collidesWithBoxes(playerHit.x, targetPY, playerHit.w, playerHit.h, -1)) {
        playerHit.y = targetPY;
      }

      // Reduz velocidade por 0.5s (30 ticks)
      playerHit.speedDebuffTimer = 30;

      // Se for Pegador, perde sangue (a menos que esteja imune ao reviver).
      if (playerHit.isHot && !playerHit.isStunned) {
        if (playerHit.reviveImmunityTimer > 0) {
          // Imune! Não perde HP nem moedas
        } else {
          // Metralhadora causa 15 por tiro (45 total se acertar o spray triplo!), tiro normal tira 34
          playerHit.health -= isMachinegun ? 15 : 34;
          
          // NOVO: Dropar moeda ao tomar tiro!
          spawnCoinAt(playerHit.x + PLAYER_SIZE / 2, playerHit.y + PLAYER_SIZE / 2);

          if (playerHit.health <= 0) {
            playerHit.health = 0;
            playerHit.isStunned = true;
            playerHit.stunTimer = 10 * TICK_RATE; // Paralisado por 10s
            broadcast({ type: 'stunned', playerId: playerHit.id, name: playerHit.name });
          }
        }
      }
      break;
    }
  }

  // Envia feixe de laser para o cliente
  broadcast({
    type: 'bulletTraced',
    shooterId: currentPlayer.id,
    sx: px, sy: py,
    ex: finalEx, ey: finalEy,
    hitType,
    color: isMachinegun ? '#ffcc00' : currentPlayer.color // Metralhadora atira amarelo ouro!
  });
}

// ─── Servidor WebSockets ───
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let currentPlayer = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      if (players.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ type: 'error', message: 'O servidor está cheio (máximo 20 jogadores).' }));
        return;
      }

      const pId = 'p' + nextPlayerId++;
      const name = (msg.name || 'Anon').slice(0, 16);
      const color = PLAYER_COLORS.includes(msg.color) ? msg.color : PLAYER_COLORS[0];
      const spawn = findSpawnPos();

      currentPlayer = {
        id: pId, name, ws, color,
        x: spawn.x, y: spawn.y,
        w: PLAYER_SIZE, h: PLAYER_SIZE,
        isHot: false, speed: RUNNER_SPEED, alive: true,
        input: { up: false, down: false, left: false, right: false, shift: false },
        grabbedBox: null,
        mouseWorld: null,

        // --- Mecânicas v5 ---
        ammo: 3,
        reloadTimer: 0,
        health: 100,
        isStunned: false,
        stunTimer: 0,
        speedDebuffTimer: 0,
        holdEnergy: 300,
        reviveImmunityTimer: 0,

        // --- Buffs v6 ---
        speedBoostTimer: 0,
        machinegunTimer: 0,
        shieldTimer: 0,
        supernovaTimer: 0,
        gravityTimer: 0,
        invisibilityTimer: 0,
        empTimer: 0,
        stamina: 600,
        isSprinting: false,
        overdriveTimer: 0,
        trackerTimer: 0,

        // --- Slots e Poderes v7 ---
        slotQ: null,
        slotE: null,
        phaseshiftTimer: 0,
        magnetTimer: 0,
        repelTimer: 0,

        // --- Economia v8 ---
        coins: 0,
      };

      players.set(pId, currentPlayer);

      ws.send(JSON.stringify({
        type: 'welcome',
        id: pId,
        map: getMapData(),
        players: [...players.values()].map(serializePlayer),
        phase: gamePhase,
        timer: Math.ceil(phaseTimer / TICK_RATE),
        colors: PLAYER_COLORS,
        pickups: pickups.map(pk => ({ id: pk.id, x: pk.x, y: pk.y, type: pk.type })),
        coins: coins.map(c => ({ id: c.id, x: c.x, y: c.y })),
      }));

      broadcast({ type: 'playerJoined', player: serializePlayer(currentPlayer) });

      setTimeout(() => {
        if (players.has(pId)) {
          const humanCount = [...players.values()].filter(p => !p.isBot).length;
          if (humanCount === 1) {
            ws.send(JSON.stringify({ type: 'offerBots' }));
          }
        }
      }, 500);

      if (gamePhase === Phase.LOBBY && players.size >= MIN_PLAYERS_TO_START) {
        startWarmup();
      }
    }

    if (!currentPlayer) return;

    if (msg.type === 'input') {
      currentPlayer.input.up = !!msg.up;
      currentPlayer.input.down = !!msg.down;
      currentPlayer.input.left = !!msg.left;
      currentPlayer.input.right = !!msg.right;
      currentPlayer.input.shift = !!msg.shift;
    }

    // ── ATIRAR COM ARMA (Mecânica v5 + Metralhadora v6) ──
    if (msg.type === 'shoot') {
      if (currentPlayer.isHot) return; // Apenas corredores atiram
      if (currentPlayer.isStunned) return;
      if (currentPlayer.reloadTimer > 0) return;
      if (currentPlayer.ammo <= 0) return;

      currentPlayer.ammo--;
      if (currentPlayer.ammo <= 0) {
        currentPlayer.reloadTimer = 5 * TICK_RATE; // 5 segundos de recarga
      }

      const tx = msg.tx;
      const ty = msg.ty;

      if (currentPlayer.machinegunTimer > 0) {
        // Metralhadora neon: atira 3 tiros em spray espalhado em formato de rajada instantânea!
        performRaycast(currentPlayer, tx, ty, -0.06, true);
        performRaycast(currentPlayer, tx, ty, 0, true);
        performRaycast(currentPlayer, tx, ty, 0.06, true);
      } else {
        // Tiro normal de precisão
        performRaycast(currentPlayer, tx, ty, 0, false);
      }
    }

    // ── BATE-PAPO (Mecânica v5) ──
    if (msg.type === 'chat') {
      const text = (msg.text || '').slice(0, 80).trim();
      if (text) {
        broadcast({
          type: 'chat',
          playerId: currentPlayer.id,
          name: currentPlayer.name,
          color: currentPlayer.color,
          text,
        });
      }
    }

    // ── GRAB CAIXAS ──
    if (msg.type === 'grab') {
      if (currentPlayer.grabbedBox) return;
      if (currentPlayer.holdEnergy <= 30) return; 

      const box = pushables.find(b => b.id === msg.boxId);
      if (!box || box.grabbedBy) return;
      const dx = (currentPlayer.x + currentPlayer.w / 2) - (box.x + box.w / 2);
      const dy = (currentPlayer.y + currentPlayer.h / 2) - (box.y + box.h / 2);
      if (Math.sqrt(dx * dx + dy * dy) > GRAB_RANGE + box.w / 2) return;
      box.grabbedBy = currentPlayer.id;
      currentPlayer.grabbedBox = box.id;
    }

    if (msg.type === 'drag') {
      currentPlayer.mouseWorld = { x: msg.x, y: msg.y };
    }

    if (msg.type === 'release') {
      if (currentPlayer.grabbedBox) {
        const box = pushables.find(b => b.id === currentPlayer.grabbedBox);
        if (box) box.grabbedBy = null;
        currentPlayer.grabbedBox = null;
        currentPlayer.mouseWorld = null;
      }
    }

    if (msg.type === 'reload') {
      if (currentPlayer.isHot) return;
      if (currentPlayer.isStunned) return;
      if (currentPlayer.reloadTimer > 0) return;
      if (currentPlayer.ammo >= 3) return; // Só recarrega se gastou bala
      currentPlayer.reloadTimer = 2.5 * TICK_RATE; // 2.5 segundos (metade)
      currentPlayer.ammo = 0; // Desativa tiro durante a recarga
    }

    if (msg.type === 'activatePower') {
      if (currentPlayer.isHot) return;
      if (currentPlayer.isStunned) return;

      const slot = msg.slot; // 'Q' ou 'E'
      const powerKey = slot === 'Q' ? currentPlayer.slotQ : currentPlayer.slotE;
      if (!powerKey) return;

      // Consome o slot
      if (slot === 'Q') currentPlayer.slotQ = null;
      else currentPlayer.slotE = null;

      // Ativa o poder correspondente!
      if (powerKey === 'phaseshift') {
        currentPlayer.phaseshiftTimer = 4 * TICK_RATE; // 4 segundos
        broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'phaseshift' });
      } else if (powerKey === 'blink') {
        // Dispara o Blink!
        let bdx = 0, bdy = 0;
        if (currentPlayer.input.up) bdy -= 1;
        if (currentPlayer.input.down) bdy += 1;
        if (currentPlayer.input.left) bdx -= 1;
        if (currentPlayer.input.right) bdx += 1;
        
        // Direção padrão se parado
        if (bdx === 0 && bdy === 0) {
          bdx = 1; // move para a direita por padrão se parado
        }
        
        let len = Math.sqrt(bdx * bdx + bdy * bdy);
        const dist = 160; // 160px blink
        const ux = bdx / len;
        const uy = bdy / len;
        
        let landed = false;
        // Tenta teleportar de 160px a 0px recuando de 8 em 8px para achar local livre
        for (let d = dist; d >= 0; d -= 8) {
          const testX = currentPlayer.x + ux * d;
          const testY = currentPlayer.y + uy * d;
          const tx = Math.max(TILE, Math.min(MAP_W - TILE - currentPlayer.w, testX));
          const ty = Math.max(TILE, Math.min(MAP_H - TILE - currentPlayer.h, testY));
          if (!collidesWithWalls(tx, ty, currentPlayer.w, currentPlayer.h) &&
              !collidesWithBoxes(tx, ty, currentPlayer.w, currentPlayer.h, -1)) {
            currentPlayer.x = tx;
            currentPlayer.y = ty;
            landed = true;
            break;
          }
        }
        if (landed) {
          broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'blink', x: currentPlayer.x, y: currentPlayer.y });
        }
      } else if (powerKey === 'speed') {
        currentPlayer.speedBoostTimer = 15 * TICK_RATE;
        broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'speed' });
      } else if (powerKey === 'machinegun') {
        currentPlayer.machinegunTimer = 15 * TICK_RATE;
        broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'machinegun' });
      } else if (powerKey === 'shield') {
        currentPlayer.shieldTimer = 20 * TICK_RATE;
        broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'shield' });
      } else if (powerKey === 'invisibility') {
        currentPlayer.invisibilityTimer = 12 * TICK_RATE;
        broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'invisibility' });
      } else if (powerKey === 'repel') {
        currentPlayer.repelTimer = 6 * TICK_RATE; // 6 segundos
        broadcast({ type: 'powerActivated', playerId: currentPlayer.id, powerType: 'repel' });
      }
    }

    if (msg.type === 'buyItem') {
      if (currentPlayer.isStunned) return;
      
      const itemId = msg.itemId;
      const runnerPrices = { speed: 3, blink: 3, shield: 4, machinegun: 4, phaseshift: 5, invisibility: 5, repel: 4 };
      const hotPrices = { speed: 3, tracker: 3, gravity: 4, supernova: 4, emp: 5, magnetic: 4 };
      
      const prices = currentPlayer.isHot ? hotPrices : runnerPrices;
      const price = prices[itemId];
      if (price === undefined) return;
      
      if ((currentPlayer.coins || 0) < price) return;
      
      if (!currentPlayer.isHot) {
        if (currentPlayer.slotQ && currentPlayer.slotE) return; // Sem espaço nos slots Q e E
      }
      
      currentPlayer.coins -= price;
      
      if (!currentPlayer.isHot) {
        if (!currentPlayer.slotQ) {
          currentPlayer.slotQ = itemId;
        } else {
          currentPlayer.slotE = itemId;
        }
        broadcast({ type: 'itemBought', playerId: currentPlayer.id, itemId, coins: currentPlayer.coins });
      } else {
        if (itemId === 'speed') {
          currentPlayer.speedBoostTimer = 15 * TICK_RATE;
        } else if (itemId === 'tracker') {
          currentPlayer.trackerTimer = 10 * TICK_RATE;
        } else if (itemId === 'gravity') {
          currentPlayer.gravityTimer = 12 * TICK_RATE;
        } else if (itemId === 'supernova') {
          currentPlayer.supernovaTimer = 10 * TICK_RATE;
        } else if (itemId === 'emp') {
          currentPlayer.empTimer = 10 * TICK_RATE;
        } else if (itemId === 'magnetic') {
          currentPlayer.magnetTimer = 8 * TICK_RATE;
        }
        broadcast({ type: 'itemBought', playerId: currentPlayer.id, itemId, coins: currentPlayer.coins });
      }
    }

    if (msg.type === 'addBots') {
      const count = parseInt(msg.count);
      if (!isNaN(count) && count >= 0 && count <= 8) {
        // Remove bots existentes primeiro para evitar acumular
        for (const [id, p] of players) {
          if (p.isBot) {
            players.delete(id);
            broadcast({ type: 'playerLeft', id });
          }
        }

        const botNames = ['CyberBot_X', 'NeoDroid', 'ByteHunter', 'QuantumG', 'GlitchRun', 'ZeroCool', 'Vector_B', 'PixelFlee'];
        const colors = PLAYER_COLORS;

        for (let i = 0; i < count; i++) {
          const bId = 'bot_' + nextPlayerId++;
          const spawn = findSpawnPos();
          const bot = {
            id: bId,
            name: botNames[i % botNames.length],
            ws: null, // indica que é um bot local
            isBot: true,
            color: colors[i % colors.length],
            x: spawn.x,
            y: spawn.y,
            w: PLAYER_SIZE,
            h: PLAYER_SIZE,
            isHot: false,
            speed: RUNNER_SPEED,
            alive: true,
            input: { up: false, down: false, left: false, right: false, shift: false },
            grabbedBox: null,
            mouseWorld: null,

            ammo: 3,
            reloadTimer: 0,
            health: 100,
            isStunned: false,
            stunTimer: 0,
            speedDebuffTimer: 0,
            holdEnergy: 300,

            speedBoostTimer: 0,
            machinegunTimer: 0,
            shieldTimer: 0,
            supernovaTimer: 0,
            gravityTimer: 0,
            invisibilityTimer: 0,
            empTimer: 0,
            stamina: 600,
            isSprinting: false,
            overdriveTimer: 0,
            trackerTimer: 0,

            slotQ: null,
            slotE: null,
            phaseshiftTimer: 0,
            magnetTimer: 0,
            repelTimer: 0,
            coins: 0
          };
          players.set(bId, bot);
          broadcast({ type: 'playerJoined', player: serializePlayer(bot) });
        }

        // Se o número total de jogadores (humano + bots) for menor que o mínimo de partida
        // e o jogo estiver ativo, recuamos de forma elegante para o LOBBY
        if (players.size < MIN_PLAYERS_TO_START && gamePhase !== Phase.LOBBY) {
          resetGame();
        } else if (gamePhase === Phase.LOBBY && players.size >= MIN_PLAYERS_TO_START) {
          startWarmup();
        }
      }
    }
  });

  ws.on('close', () => {
    if (currentPlayer) {
      if (currentPlayer.grabbedBox) {
        const box = pushables.find(b => b.id === currentPlayer.grabbedBox);
        if (box) box.grabbedBy = null;
      }
      players.delete(currentPlayer.id);
      broadcast({ type: 'playerLeft', id: currentPlayer.id });

      const humansLeft = [...players.values()].filter(p => !p.isBot);
      if (humansLeft.length === 1) {
        const remainingHuman = humansLeft[0];
        if (remainingHuman.ws && remainingHuman.ws.readyState === 1) {
          remainingHuman.ws.send(JSON.stringify({ type: 'offerBots' }));
        }
      }

      // Se não restar ninguém, destroi o servidor (retorna ao lobby)
      if (players.size === 0) {
        resetGame();
      } else {
        checkWinConditions();
      }
    }
  });
});

// ─── Lógica do Bot AI Avançada v10 ───
// Sistema completo: Personalidades, Detecção de Travamento, Pathfinding Multinível,
// Tiro Tático, Sabotagem, Barricada de Caixas, Sprint Inteligente, Coleta Pró-ativa.

function triggerBotShoot(bot, tx, ty) {
  if (bot.isHot) return;
  if (bot.isStunned) return;
  if (bot.reloadTimer > 0) return;
  if (bot.ammo <= 0) return;

  bot.ammo--;
  if (bot.ammo <= 0) {
    bot.reloadTimer = 5 * TICK_RATE;
  }

  if (bot.machinegunTimer > 0) {
    performRaycast(bot, tx, ty, -0.06, true);
    performRaycast(bot, tx, ty, 0, true);
    performRaycast(bot, tx, ty, 0.06, true);
  } else {
    performRaycast(bot, tx, ty, 0, false);
  }
}

// Inicialização lazy do estado de IA persistente por bot
function ensureBotAI(p) {
  if (!p.ai) {
    const types = ['aggressive', 'defensive', 'collector', 'saboteur'];
    p.ai = {
      posHistory: [],
      stuckTicks: 0,
      unstuckTimer: 0,
      unstuckAngle: 0,
      shootCooldown: 0,
      buyCooldown: 0,
      personality: types[Math.floor(Math.random() * types.length)],
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeSwitchTimer: Math.floor(Math.random() * 120) + 60,
      fleeAngleBias: (Math.random() - 0.5) * Math.PI / 2.5,
      fleeAngleTimer: Math.floor(Math.random() * 200) + 100,
      lastMoveAngle: Math.random() * Math.PI * 2,
      boxCooldown: 0,
      wanderTarget: null,
      wanderTimer: 0,
    };
  }
}

// Verifica se o bot está em um corredor ou porta estreita
function isInNarrowPassage(x, y, w, h) {
  // Testa passagem horizontal (paredes próximas na esquerda e direita)
  const leftWall = collidesWithWalls(x - 50, y, w, h);
  const rightWall = collidesWithWalls(x + 50, y, w, h);
  if (leftWall && rightWall) return true;

  // Testa passagem vertical (paredes próximas acima e abaixo)
  const topWall = collidesWithWalls(x, y - 50, w, h);
  const bottomWall = collidesWithWalls(x, y + 50, w, h);
  if (topWall && bottomWall) return true;

  return false;
}

// Normaliza ângulo para [-PI, PI]
function normalizeAngle(a) {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Detecção de travamento: verifica se o bot se moveu menos de 8px em 0.75s
function checkBotStuck(p) {
  const ai = p.ai;
  ai.posHistory.push({ x: p.x, y: p.y });
  if (ai.posHistory.length > 45) ai.posHistory.shift();

  if (ai.posHistory.length >= 45) {
    const o = ai.posHistory[0];
    if (Math.sqrt((p.x - o.x) ** 2 + (p.y - o.y) ** 2) < 8) {
      ai.stuckTicks++;
      return true;
    }
    ai.stuckTicks = 0;
  }
  return false;
}

// Pathfinding aprimorado: testa múltiplas distâncias de look-ahead (24→14→7)
function findSmartDir(p, idealAngle) {
  const sweeps = [
    0,
    Math.PI / 8, -Math.PI / 8,
    Math.PI / 4, -Math.PI / 4,
    3 * Math.PI / 8, -3 * Math.PI / 8,
    Math.PI / 2, -Math.PI / 2,
    5 * Math.PI / 8, -5 * Math.PI / 8,
    3 * Math.PI / 4, -3 * Math.PI / 4,
    7 * Math.PI / 8, -7 * Math.PI / 8,
    Math.PI
  ];
  const hasPhase = p.phaseshiftTimer && p.phaseshiftTimer > 0;

  // Testa 3 distâncias: 24px (longe), 14px (médio), 7px (curto — ignora caixas para poder empurrá-las)
  for (const testDist of [24, 14, 7]) {
    for (const offset of sweeps) {
      const a = idealAngle + offset;
      const vx = Math.cos(a);
      const vy = Math.sin(a);
      const tx = p.x + vx * testDist;
      const ty = p.y + vy * testDist;
      // Na distância curta (7px), ignora caixas — a física de empurrão resolve o contato
      const wallOk = !collidesWithWalls(tx, ty, p.w, p.h);
      const boxOk = testDist <= 7 || !collidesWithBoxes(tx, ty, p.w, p.h, -1);
      if (hasPhase || (wallOk && boxOk)) {
        return { vx, vy };
      }
    }
  }
  return { vx: Math.cos(idealAngle), vy: Math.sin(idealAngle) };
}

// Calcula forças ambientais: Anti-Clumping expandido (120px) + Repulsão de Paredes/Caixas (50px)
function calcEnvForces(p) {
  let sepX = 0, sepY = 0, avoidX = 0, avoidY = 0;

  // Separação anti-aglomeração: APENAS entre bots do mesmo time!
  // Hot NÃO tem separação de Runners (precisa chegar perto para infectar)
  // Runners têm separação entre si para não aglomerar
  for (const [, p2] of players) {
    if (p2.id === p.id) continue;
    // Pula separação entre times opostos (Hot↔Runner) — a perseguição/fuga cuida disso
    if (p.isHot !== p2.isHot) continue;
    const dx = p.x - p2.x, dy = p.y - p2.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0 && d < 100) {
      const f = (100 - d) / 100;
      sepX += (dx / d) * f * 3.0;
      sepY += (dy / d) * f * 3.0;
    }
  }

  // Repulsão contínua de paredes (raio 45px, força 3.5)
  const wallRange = 45;
  for (const w of walls) {
    const cx = Math.max(w.x, Math.min(p.x + p.w / 2, w.x + w.w));
    const cy = Math.max(w.y, Math.min(p.y + p.h / 2, w.y + w.h));
    const dx = (p.x + p.w / 2) - cx;
    const dy = (p.y + p.h / 2) - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0 && d < wallRange) {
      const f = (wallRange - d) / wallRange;
      avoidX += (dx / d) * f * 3.5;
      avoidY += (dy / d) * f * 3.5;
    }
  }

  // Repulsão suave de caixas (raio menor 30px, força 1.5 — permite interação)
  for (const b of pushables) {
    if (b.id === p.grabbedBox) continue;
    const cx = Math.max(b.x, Math.min(p.x + p.w / 2, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y + p.h / 2, b.y + b.h));
    const dx = (p.x + p.w / 2) - cx;
    const dy = (p.y + p.h / 2) - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0 && d < 30) {
      const f = (30 - d) / 30;
      avoidX += (dx / d) * f * 1.5;
      avoidY += (dy / d) * f * 1.5;
    }
  }

  return { sepX, sepY, avoidX, avoidY };
}

// Encontra o melhor item/moeda para coletar, filtrando por tipo compatível
function findBestCollectable(p, maxRange) {
  let best = null, bestScore = -Infinity;
  const pcx = p.x + PLAYER_SIZE / 2;
  const pcy = p.y + PLAYER_SIZE / 2;
  const hotTypes = ['speed', 'supernova', 'gravity', 'emp', 'tracker', 'magnetic'];
  const runTypes = ['speed', 'machinegun', 'shield', 'invisibility', 'phaseshift', 'blink', 'repel'];

  // Avaliar moedas (sempre coletáveis)
  for (const c of coins) {
    const d = Math.sqrt((c.x + 8 - pcx) ** 2 + (c.y + 8 - pcy) ** 2);
    if (d < maxRange) {
      const s = 100 - d * 0.2;
      if (s > bestScore) { bestScore = s; best = { x: c.x + 8, y: c.y + 8 }; }
    }
  }

  // Avaliar pickups (filtrado por tipo compatível e slots disponíveis)
  for (const pk of pickups) {
    if (p.isHot && !hotTypes.includes(pk.type)) continue;
    if (!p.isHot && !runTypes.includes(pk.type)) continue;
    if (!p.isHot && p.slotQ && p.slotE) continue; // Slots cheios

    const d = Math.sqrt((pk.x + 10 - pcx) ** 2 + (pk.y + 10 - pcy) ** 2);
    if (d < maxRange) {
      let v = 150;
      if (!p.isHot && (!p.slotQ || !p.slotE)) v += 80;
      if (!p.isHot && ['shield', 'blink', 'phaseshift'].includes(pk.type)) v += 50;
      if (p.isHot && ['speed', 'magnetic', 'gravity'].includes(pk.type)) v += 50;
      const s = v - d * 0.15;
      if (s > bestScore) { bestScore = s; best = { x: pk.x + 10, y: pk.y + 10 }; }
    }
  }

  return best;
}

// Aplica direção ao input do bot com fusão de forças ambientais
function applyDir(p, angle, env) {
  const mx = Math.cos(angle) + (env ? env.sepX + env.avoidX : 0);
  const my = Math.sin(angle) + (env ? env.sepY + env.avoidY : 0);
  const finalAngle = Math.atan2(my, mx);
  const dir = findSmartDir(p, finalAngle);

  if (Math.abs(dir.vx) > 0.15) {
    p.input.left = dir.vx < 0;
    p.input.right = dir.vx > 0;
  }
  if (Math.abs(dir.vy) > 0.15) {
    p.input.up = dir.vy < 0;
    p.input.down = dir.vy > 0;
  }
  p.ai.lastMoveAngle = finalAngle;
}

// Compras inteligentes na Cyber-Loja com cooldown e prioridade por personalidade
function tryBotBuy(p) {
  const ai = p.ai;
  if (ai.buyCooldown > 0) { ai.buyCooldown--; return; }
  const mc = p.coins || 0;
  if (mc < 3) return;

  if (p.isHot) {
    // Hot prioriza: magnetic > gravity > speed > tracker > supernova > emp
    const items = [
      { id: 'magnetic', price: 4 }, { id: 'gravity', price: 4 },
      { id: 'speed', price: 3 }, { id: 'tracker', price: 3 },
      { id: 'emp', price: 5 }, { id: 'supernova', price: 4 }
    ];
    const affordable = items.filter(i => mc >= i.price);
    if (affordable.length > 0) {
      const item = affordable[Math.floor(Math.random() * Math.min(2, affordable.length))];
      p.coins -= item.price;
      if (item.id === 'speed') p.speedBoostTimer = 15 * TICK_RATE;
      else if (item.id === 'tracker') p.trackerTimer = 10 * TICK_RATE;
      else if (item.id === 'gravity') p.gravityTimer = 12 * TICK_RATE;
      else if (item.id === 'magnetic') p.magnetTimer = 8 * TICK_RATE;
      else if (item.id === 'supernova') p.supernovaTimer = 10 * TICK_RATE;
      else if (item.id === 'emp') p.empTimer = 10 * TICK_RATE;
      broadcast({ type: 'itemBought', playerId: p.id, itemId: item.id, coins: p.coins });
      ai.buyCooldown = 2 * TICK_RATE;
    }
  } else {
    if (p.slotQ && p.slotE) return; // Slots cheios
    // Runner prioriza baseado na personalidade
    let items = [
      { id: 'shield', price: 4 }, { id: 'blink', price: 3 },
      { id: 'repel', price: 4 }, { id: 'speed', price: 3 },
      { id: 'phaseshift', price: 5 }, { id: 'invisibility', price: 5 },
      { id: 'machinegun', price: 4 }
    ];
    if (ai.personality === 'aggressive') items.unshift({ id: 'machinegun', price: 4 });
    else if (ai.personality === 'defensive') items.unshift({ id: 'shield', price: 4 });

    const affordable = items.filter(i => mc >= i.price);
    if (affordable.length > 0) {
      const item = affordable[0];
      p.coins -= item.price;
      if (!p.slotQ) p.slotQ = item.id;
      else p.slotE = item.id;
      broadcast({ type: 'itemBought', playerId: p.id, itemId: item.id, coins: p.coins });
      ai.buyCooldown = 2 * TICK_RATE;
    }
  }
}

// Ativação tática de poderes especiais (Q/E) baseada em proximidade do perigo
function tryActivatePowers(p, hot, dist) {
  const activate = (slot, key) => {
    if (!key) return false;
    let should = false;

    if (key === 'blink' && dist < 150) should = true;
    else if (key === 'phaseshift' && dist < 180) should = true;
    else if (key === 'shield' && dist < 200) should = true;
    else if (key === 'repel' && dist < 130) should = true;
    else if (key === 'speed' && dist < 300 && p.stamina < 200) should = true;
    else if (key === 'invisibility' && dist < 300) should = true;
    else if (key === 'machinegun' && dist < 450) should = true;

    if (!should) return false;
    if (slot === 'Q') p.slotQ = null;
    else p.slotE = null;

    if (key === 'phaseshift') {
      p.phaseshiftTimer = 4 * TICK_RATE;
      broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'phaseshift' });
    } else if (key === 'blink') {
      const bx = p.x - hot.x, by = p.y - hot.y;
      const bl = Math.sqrt(bx * bx + by * by);
      if (bl > 0) {
        const ux = bx / bl, uy = by / bl;
        for (let d = 160; d >= 0; d -= 8) {
          const tx = Math.max(TILE, Math.min(MAP_W - TILE - p.w, p.x + ux * d));
          const ty = Math.max(TILE, Math.min(MAP_H - TILE - p.h, p.y + uy * d));
          if (!collidesWithWalls(tx, ty, p.w, p.h) && !collidesWithBoxes(tx, ty, p.w, p.h, -1)) {
            p.x = tx; p.y = ty;
            broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'blink', x: p.x, y: p.y });
            break;
          }
        }
      }
    } else if (key === 'speed') {
      p.speedBoostTimer = 15 * TICK_RATE;
      broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'speed' });
    } else if (key === 'machinegun') {
      p.machinegunTimer = 15 * TICK_RATE;
      broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'machinegun' });
    } else if (key === 'shield') {
      p.shieldTimer = 20 * TICK_RATE;
      broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'shield' });
    } else if (key === 'invisibility') {
      p.invisibilityTimer = 12 * TICK_RATE;
      broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'invisibility' });
    } else if (key === 'repel') {
      p.repelTimer = 6 * TICK_RATE;
      broadcast({ type: 'powerActivated', playerId: p.id, powerType: 'repel' });
    }
    return true;
  };

  // Tenta Q primeiro, depois E
  if (p.slotQ && !activate('Q', p.slotQ) && p.slotE) activate('E', p.slotE);
  else if (!p.slotQ && p.slotE) activate('E', p.slotE);
}

// ══════════════════════════════════════════════════════════════
// ══ ENTRADA PRINCIPAL DA IA ══
// ══════════════════════════════════════════════════════════════
function updateBotAI(p) {
  p.input.up = false;
  p.input.down = false;
  p.input.left = false;
  p.input.right = false;
  p.input.shift = false;
  if (p.isStunned) return;

  ensureBotAI(p);
  const ai = p.ai;

  // Atualiza timers do bot
  ai.shootCooldown = Math.max(0, ai.shootCooldown - 1);
  ai.unstuckTimer = Math.max(0, ai.unstuckTimer - 1);
  if (--ai.strafeSwitchTimer <= 0) {
    ai.strafeDir *= -1;
    ai.strafeSwitchTimer = Math.floor(Math.random() * 150) + 80;
  }
  if (--ai.fleeAngleTimer <= 0) {
    ai.fleeAngleBias = (Math.random() - 0.5) * Math.PI / 2.5;
    ai.fleeAngleTimer = Math.floor(Math.random() * 200) + 100;
  }

  // Detecção de travamento: ativa comportamento de desvencilhar
  const stuck = checkBotStuck(p);
  if (stuck && ai.stuckTicks > 2) {
    if (ai.unstuckTimer <= 0) {
      ai.unstuckTimer = Math.floor(0.75 * TICK_RATE); // 45 ticks = 0.75s
      ai.unstuckAngle = Math.random() * Math.PI * 2;
    }
    ai.wanderTarget = null;
    ai.wanderTimer = 0;
    if (ai.stuckTicks > 4 && p.grabbedBox) {
      const box = pushables.find(b => b.id === p.grabbedBox);
      if (box) box.grabbedBy = null;
      p.grabbedBox = null;
      p.mouseWorld = null;
    }
  }

  // Calcula forças ambientais
  const env = calcEnvForces(p);

  // Tenta comprar na loja
  tryBotBuy(p);

  // Despacha para a IA específica do papel
  if (p.isHot) hotBotAI(p, env);
  else runnerBotAI(p, env);

  // Sincroniza mouseWorld APÓS decidir a direção (corrige bug de arrasto)
  if (p.grabbedBox) {
    let mx = 0, my = 0;
    if (p.input.up) my = -1;
    if (p.input.down) my = 1;
    if (p.input.left) mx = -1;
    if (p.input.right) mx = 1;
    if (mx === 0 && my === 0) {
      mx = Math.cos(ai.lastMoveAngle);
      my = Math.sin(ai.lastMoveAngle);
    }
    const len = Math.sqrt(mx * mx + my * my) || 1;
    p.mouseWorld = {
      x: p.x + PLAYER_SIZE / 2 - (mx / len) * 50,
      y: p.y + PLAYER_SIZE / 2 - (my / len) * 50
    };
  } else {
    p.mouseWorld = null;
  }
}

// ══════════════════════════════════════════════════════════════
// ══ IA DO CAÇADOR (HOT) — Predição, Flanqueio, Seleção de Alvo ══
// ══════════════════════════════════════════════════════════════
function hotBotAI(p, env) {
  const ai = p.ai;

  // Se estiver se desvencilhando de travamento, ignora IA normal e corre na direção livre
  if (ai.unstuckTimer > 0) {
    applyDir(p, ai.unstuckAngle, env);
    p.input.shift = true;
    return;
  }

  // Encontra todos os corredores visíveis (ignora invisíveis)
  const runners = [];
  for (const [, p2] of players) {
    if (p2.isHot || p2.invisibilityTimer > 0) continue;
    const dx = p2.x - p.x;
    const dy = p2.y - p.y;
    runners.push({ p: p2, dx, dy, dist: Math.sqrt(dx * dx + dy * dy) });
  }
  runners.sort((a, b) => a.dist - b.dist);

  // Se não há corredores visíveis, explora o mapa buscando itens
  if (!runners.length) {
    smartWander(p, env, 600);
    return;
  }

  // ── Seleção de Alvo Inteligente ──
  // Pontua cada corredor: mais perto + isolado + debuffado = melhor alvo
  let target = runners[0];
  if (runners.length > 1) {
    let bestScore = -Infinity;
    for (const r of runners) {
      let allies = 0;
      for (const r2 of runners) {
        if (r2 === r) continue;
        if (Math.sqrt((r2.p.x - r.p.x) ** 2 + (r2.p.y - r.p.y) ** 2) < 200) allies++;
      }
      let score = 1000 - r.dist - allies * 180;
      if (r.p.stamina < 100) score += 120;      // Sem stamina = fácil de pegar
      if (r.p.speedDebuffTimer > 0) score += 180; // Lento por tiro
      if (r.p.shieldTimer > 0) score -= 200;     // Escudo ativo = evitar
      if (r.p.repelTimer > 0) score -= 300;      // Repulsão ativa = nem tentar
      if (r.p.phaseshiftTimer > 0) score -= 150; // Atravessa paredes = difícil
      if (score > bestScore) { bestScore = score; target = r; }
    }
  }

  // ── Predição de Movimento do Alvo ──
  let tx = target.p.x, ty = target.p.y;
  if (target.p.input) {
    let px = 0, py = 0;
    if (target.p.input.up) py -= 1;
    if (target.p.input.down) py += 1;
    if (target.p.input.left) px -= 1;
    if (target.p.input.right) px += 1;
    const pLen = Math.sqrt(px * px + py * py) || 1;
    const predFrames = Math.min(20, target.dist / (HOT_SPEED * 2));
    tx += (px / pLen) * RUNNER_SPEED * predFrames * 0.7;
    ty += (py / pLen) * RUNNER_SPEED * predFrames * 0.7;
  }

  // ── Flanqueio: adiciona ângulo de desvio quando longe ──
  let chaseAngle = Math.atan2(ty - p.y, tx - p.x);
  if (target.dist > 350) chaseAngle += ai.strafeDir * 0.2;

  applyDir(p, chaseAngle, env);

  // Sprint: quando perto e com stamina disponível
  if (target.dist < 400 && p.stamina > 60) p.input.shift = true;
  else if (target.dist < 200) p.input.shift = true;

  // Hot não segura caixas (libera se pegou por acidente)
  if (p.grabbedBox) {
    const box = pushables.find(b => b.id === p.grabbedBox);
    if (box) box.grabbedBy = null;
    p.grabbedBox = null;
  }
}

// ══════════════════════════════════════════════════════════════
// ══ IA DO CORREDOR (RUNNER) — Fuga, Sabotagem, Barricada, Coleta ══
// ══════════════════════════════════════════════════════════════
function runnerBotAI(p, env) {
  const ai = p.ai;

  // Se estiver se desvencilhando de travamento, ignora IA normal e corre na direção livre
  if (ai.unstuckTimer > 0) {
    applyDir(p, ai.unstuckAngle, env);
    p.input.shift = true;
    return;
  }

  // Encontra o Hot mais próximo (não stunado)
  let nearHot = null, hotDist = Infinity;
  for (const [, p2] of players) {
    if (!p2.isHot || p2.isStunned) continue;
    const d = Math.sqrt((p2.x - p.x) ** 2 + (p2.y - p.y) ** 2);
    if (d < hotDist) { hotDist = d; nearHot = p2; }
  }

  // Níveis de ameaça
  const critical = nearHot && hotDist < 180;
  const danger = nearHot && hotDist < 350;
  const safe = !nearHot || hotDist > 500;

  // ── Ativação de Poderes ──
  if (nearHot) tryActivatePowers(p, nearHot, hotDist);

  // ── Tiro Tático ──
  if (ai.shootCooldown <= 0 && p.ammo > 0 && p.reloadTimer <= 0) {
    // Atira no Hot quando ao alcance (chance maior quando mais perto)
    if (nearHot && hotDist < 550) {
      const shootChance = hotDist < 200 ? 0.16 : (hotDist < 350 ? 0.10 : 0.05);
      if (Math.random() < shootChance) {
        const aimNoise = (Math.random() - 0.5) * 16;
        triggerBotShoot(p, nearHot.x + PLAYER_SIZE / 2 + aimNoise, nearHot.y + PLAYER_SIZE / 2 + aimNoise);
        ai.shootCooldown = 12 + Math.floor(Math.random() * 18);
      }
    }
    // Sabotagem: atira em outros corredores para deixá-los lentos (isca para o Hot)
    if (danger && p.ammo > 1 && Math.random() < 0.03) {
      for (const [, p2] of players) {
        if (p2.id === p.id || p2.isHot) continue;
        const d = Math.sqrt((p2.x - p.x) ** 2 + (p2.y - p.y) ** 2);
        if (d < 250 && nearHot) {
          const p2ToHot = Math.sqrt((p2.x - nearHot.x) ** 2 + (p2.y - nearHot.y) ** 2);
          if (p2ToHot > hotDist) { // Só sabota quem está MAIS LONGE do Hot que nós
            triggerBotShoot(p, p2.x + PLAYER_SIZE / 2, p2.y + PLAYER_SIZE / 2);
            ai.shootCooldown = 40;
            break;
          }
        }
      }
    }
  }

  // ── Recarga Inteligente: recarrega manualmente quando seguro (2.5s vs 5s) ──
  if (safe && p.ammo < 3 && p.reloadTimer <= 0) {
    p.reloadTimer = Math.floor(2.5 * TICK_RATE);
    p.ammo = 0;
  }

  // ── Barricada de Caixas, Bloqueio de Portas e Sabotagem de Aliados v10.3 ──
  if (ai.boxCooldown > 0) ai.boxCooldown--;

  if (!p.grabbedBox && p.holdEnergy > 150 && ai.boxCooldown <= 0) {
    // Decide agarrar se estiver em perigo imediato OU chance aleatória se seguro para barricar preventivamente
    const wantToGrab = danger || (safe && Math.random() < 0.005);
    if (wantToGrab) {
      // Encontra a caixa livre mais próxima em um raio estendido de 90px
      let closestBox = null;
      let closestDist = Infinity;
      for (const box of pushables) {
        if (box.grabbedBy) continue;
        const d = Math.sqrt(
          (p.x + p.w / 2 - box.x - box.w / 2) ** 2 +
          (p.y + p.h / 2 - box.y - box.h / 2) ** 2
        );
        if (d <= 90 && d < closestDist) {
          closestDist = d;
          closestBox = box;
        }
      }
      if (closestBox) {
        p.grabbedBox = closestBox.id;
        closestBox.grabbedBy = p.id;
        ai.boxCooldown = 4 * TICK_RATE; // Cooldown para evitar agarrar freneticamente
      }
    }
  }

  // Solta a caixa taticamente: quando energia baixa, perigo crítico, seguro, ou para bloquear passagens/sabotar
  if (p.grabbedBox) {
    const box = pushables.find(b => b.id === p.grabbedBox);
    let shouldRelease = false;
    let releaseReason = "";

    if (p.holdEnergy < 50) {
      shouldRelease = true;
      releaseReason = "energy";
    } else if (critical) {
      shouldRelease = true;
      releaseReason = "critical";
    }

    // 1. Bloquear passagens estreitas (portas e corredores)
    if (!shouldRelease && isInNarrowPassage(p.x, p.y, p.w, p.h)) {
      shouldRelease = true;
      releaseReason = "block";
    }

    // 2. Sabotagem: solta a caixa para atrapalhar um aliado próximo
    if (!shouldRelease && danger) {
      for (const [, p2] of players) {
        if (p2.id === p.id || p2.isHot) continue;
        const distToAlly = Math.sqrt((p2.x - p.x) ** 2 + (p2.y - p.y) ** 2);
        if (distToAlly < 110) {
          // Verifica se o aliado está atrás de nós (próximo à caixa)
          if (box) {
            const distAllyToBox = Math.sqrt(
              (p2.x + p2.w / 2 - box.x - box.w / 2) ** 2 +
              (p2.y + p2.h / 2 - box.y - box.h / 2) ** 2
            );
            if (distAllyToBox < 80) {
              shouldRelease = true;
              releaseReason = "sabotage";
              break;
            }
          }
        }
      }
    }

    // 3. Queda aleatória se seguro
    if (!shouldRelease && !danger && Math.random() < 0.008) {
      shouldRelease = true;
      releaseReason = "safe_drop";
    }

    if (shouldRelease) {
      if (box) box.grabbedBy = null;
      p.grabbedBox = null;
      ai.boxCooldown = 3 * TICK_RATE;

      // Mensagens de chat divertidas e neon-imersivas
      if (releaseReason === "block") {
        if (Math.random() < 0.20) {
          const msgs = ["Passagem fechada!", "Barricando a porta!", "Fica aí, caçador!", "Caminho bloqueado!"];
          broadcast({ type: 'chat', playerId: p.id, name: p.name, color: p.color, text: msgs[Math.floor(Math.random() * msgs.length)] });
        }
      } else if (releaseReason === "sabotage") {
        if (Math.random() < 0.35) {
          const msgs = ["Desculpa, amigo! Cada um por si!", "Opa, deixei cair!", "O caçador prefere você!", "Foi mal, bloqueado!"];
          broadcast({ type: 'chat', playerId: p.id, name: p.name, color: p.color, text: msgs[Math.floor(Math.random() * msgs.length)] });
        }
      }
    }
  }

  // ══ DECISÃO DE MOVIMENTO ══
  if (critical) {
    // ── CRÍTICO: fuga com zigzag e possível tática de isca ──
    const fleeAngle = Math.atan2(-(nearHot.y - p.y), -(nearHot.x - p.x));
    let useDecoy = false;

    // Tática de isca: corre em direção a outro corredor para dividir atenção do Hot
    const decoyChance = ai.personality === 'saboteur' ? 0.06 : 0.015;
    if (Math.random() < decoyChance) {
      for (const [, p2] of players) {
        if (p2.id === p.id || p2.isHot) continue;
        const d = Math.sqrt((p2.x - p.x) ** 2 + (p2.y - p.y) ** 2);
        if (d < 300 && d > 60) {
          const p2ToHot = Math.sqrt((p2.x - nearHot.x) ** 2 + (p2.y - nearHot.y) ** 2);
          if (p2ToHot > hotDist + 80) {
            const decoyAngle = Math.atan2(p2.y - p.y, p2.x - p.x);
            if (Math.abs(normalizeAngle(decoyAngle - fleeAngle)) < Math.PI / 2) {
              applyDir(p, decoyAngle, env);
              useDecoy = true;
              break;
            }
          }
        }
      }
    }

    if (!useDecoy) {
      applyDir(p, fleeAngle + ai.fleeAngleBias + ai.strafeDir * 0.3, env);
    }
    p.input.shift = p.stamina > 20; // Sprint mesmo com pouca stamina em emergência

  } else if (danger) {
    // ── PERIGO: foge mas coleta itens se estiverem no caminho da fuga ──
    const fleeAngle = Math.atan2(-(nearHot.y - p.y), -(nearHot.x - p.x));
    const collectable = findBestCollectable(p, 150);

    if (collectable) {
      const collectAngle = Math.atan2(
        collectable.y - p.y - PLAYER_SIZE / 2,
        collectable.x - p.x - PLAYER_SIZE / 2
      );
      // Só coleta se o item está na direção da fuga (ângulo < 90°)
      if (Math.abs(normalizeAngle(collectAngle - fleeAngle)) < Math.PI / 2) {
        applyDir(p, collectAngle, env);
      } else {
        applyDir(p, fleeAngle + ai.fleeAngleBias, env);
      }
    } else {
      applyDir(p, fleeAngle + ai.fleeAngleBias, env);
    }
    if (p.stamina > 100) p.input.shift = true;

  } else if (safe) {
    // ── SEGURO: coleta proativa de itens e moedas (raio expandido 600px) ──
    const collectable = findBestCollectable(p, 600);
    if (collectable) {
      applyDir(p, Math.atan2(
        collectable.y - p.y - PLAYER_SIZE / 2,
        collectable.x - p.x - PLAYER_SIZE / 2
      ), env);
    } else {
      smartWander(p, env, 500);
    }

  } else {
    // ── MODERADO: balanço entre fuga e coleta ──
    const collectable = findBestCollectable(p, 350);
    if (collectable && nearHot) {
      const collectAngle = Math.atan2(
        collectable.y - p.y - PLAYER_SIZE / 2,
        collectable.x - p.x - PLAYER_SIZE / 2
      );
      const fleeAngle = Math.atan2(-(nearHot.y - p.y), -(nearHot.x - p.x));
      // Mistura 60% fuga + 40% coleta
      const blendAngle = Math.atan2(
        Math.sin(fleeAngle) * 0.6 + Math.sin(collectAngle) * 0.4,
        Math.cos(fleeAngle) * 0.6 + Math.cos(collectAngle) * 0.4
      );
      applyDir(p, blendAngle, env);
    } else if (nearHot) {
      applyDir(p, Math.atan2(-(nearHot.y - p.y), -(nearHot.x - p.x)) + ai.fleeAngleBias, env);
    } else {
      smartWander(p, env, 500);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// ══ EXPLORAÇÃO INTELIGENTE — Busca itens, moedas, waypoints livres ══
// ══════════════════════════════════════════════════════════════
function smartWander(p, env, radius) {
  const ai = p.ai;

  // Primeiro tenta achar algo para coletar no raio
  const collectable = findBestCollectable(p, radius);
  if (collectable) {
    applyDir(p, Math.atan2(
      collectable.y - p.y - PLAYER_SIZE / 2,
      collectable.x - p.x - PLAYER_SIZE / 2
    ), env);
    return;
  }

  // Se não há coletáveis, navega até um ponto aleatório na arena
  if (!ai.wanderTarget || ai.wanderTimer <= 0) {
    const hx = 3 * TILE + TILE;
    const hy = 3 * TILE + TILE;
    const hw = 60 * TILE;
    const hh = 42 * TILE;

    // Tenta encontrar um ponto livre (sem paredes)
    for (let i = 0; i < 15; i++) {
      const rx = hx + Math.random() * hw;
      const ry = hy + Math.random() * hh;
      if (!collidesWithWalls(rx, ry, PLAYER_SIZE, PLAYER_SIZE)) {
        ai.wanderTarget = { x: rx, y: ry };
        break;
      }
    }
    if (!ai.wanderTarget) {
      ai.wanderTarget = {
        x: TILE + Math.random() * (MAP_W - 2 * TILE),
        y: TILE + Math.random() * (MAP_H - 2 * TILE)
      };
    }
    ai.wanderTimer = Math.floor((3 + Math.random() * 5) * TICK_RATE);
  } else {
    ai.wanderTimer--;
  }

  if (ai.wanderTarget) {
    const dx = ai.wanderTarget.x - (p.x + PLAYER_SIZE / 2);
    const dy = ai.wanderTarget.y - (p.y + PLAYER_SIZE / 2);
    if (Math.sqrt(dx * dx + dy * dy) < 30) {
      // Chegou no alvo, escolhe novo
      ai.wanderTarget = null;
      ai.wanderTimer = 0;
    } else {
      applyDir(p, Math.atan2(dy, dx), env);
    }
  }
}
// ─── Loop Principal da Física (60 FPS) ───
function gameTick() {
  tickCount++;

  // 1. Cronômetro das fases
  if (gamePhase === Phase.WARMUP || gamePhase === Phase.INGAME || gamePhase === Phase.ENDGAME) {
    if (phaseTimer > 0) {
      phaseTimer--;
      if (phaseTimer <= 0) {
        if (gamePhase === Phase.WARMUP) {
          startInGame();
        } else if (gamePhase === Phase.INGAME) {
          endGame('runners'); // Fim do tempo = corredores vencem!
        } else if (gamePhase === Phase.ENDGAME) {
          resetGame();
        }
      }
    }
  }

  // 2. Spawning dinâmico de itens e moedas — apenas durante a partida!
  if (gamePhase === Phase.INGAME) {
    pickupSpawnTimer--;
    if (pickupSpawnTimer <= 0) {
      pickupSpawnTimer = PICKUP_SPAWN_INTERVAL;
      spawnRandomPickup();
    }

    coinSpawnTimer--;
    if (coinSpawnTimer <= 0) {
      coinSpawnTimer = COIN_SPAWN_INTERVAL;
      spawnRandomCoin();
    }
  }

  // 3. Atualização individual de cada jogador
  for (const [, p] of players) {
    if (p.isBot) {
      updateBotAI(p);
    }

    // 1. Recarga da arma (5 segundos)
    if (p.reloadTimer > 0) {
      p.reloadTimer--;
      if (p.reloadTimer === 0) {
        p.ammo = 3;
      }
    }

    // 2. Paralisado/Stunned (Hot com 0 de HP)
    if (p.isStunned) {
      p.stunTimer--;
      if (p.stunTimer <= 0) {
        p.isStunned = false;
        p.health = 100; // Recupera totalmente o sangue
        p.reviveImmunityTimer = 3 * TICK_RATE; // 3 segundos de imunidade infinita ao reviver!
      }
    }

    // 3. Debuff de velocidade por tiro (0.5s)
    if (p.speedDebuffTimer > 0) {
      p.speedDebuffTimer--;
    }

    // 4. Limite de segurar objeto (5 segundos)
    if (p.grabbedBox !== null) {
      p.holdEnergy--;
      if (p.holdEnergy <= 0) {
        p.holdEnergy = 0;
        const box = pushables.find(b => b.id === p.grabbedBox);
        if (box) box.grabbedBy = null;
        p.grabbedBox = null;
        p.mouseWorld = null;
      }
    } else {
      if (p.holdEnergy < 300) {
        // Hots recarregam a barra 2x mais rápido que corredores
        p.holdEnergy += p.isHot ? 2 : 1;
        if (p.holdEnergy > 300) p.holdEnergy = 300;
      }
    }

    // 5. Decremento dos Timers de Buffs/Itens v6
    if (p.speedBoostTimer > 0) p.speedBoostTimer--;
    if (p.machinegunTimer > 0) p.machinegunTimer--;
    if (p.shieldTimer > 0) p.shieldTimer--;
    if (p.supernovaTimer > 0) p.supernovaTimer--;
    if (p.gravityTimer > 0) p.gravityTimer--;
    if (p.invisibilityTimer > 0) p.invisibilityTimer--;
    if (p.empTimer > 0) p.empTimer--;
    if (p.overdriveTimer > 0) p.overdriveTimer--;
    if (p.trackerTimer > 0) p.trackerTimer--;
    if (p.phaseshiftTimer > 0) p.phaseshiftTimer--;
    if (p.magnetTimer > 0) p.magnetTimer--;
    if (p.repelTimer > 0) p.repelTimer--;
    if (p.reviveImmunityTimer > 0) p.reviveImmunityTimer--;

    // Canhão Overdrive: munição infinita e sem recarga
    if (p.overdriveTimer > 0) {
      p.reloadTimer = 0;
      p.ammo = 3;
    }

    // Mecânica de Corrida / Estamina (Shift)
    // Jogador está correndo se segurar Shift e estiver se movendo
    const isMoving = p.input.up || p.input.down || p.input.left || p.input.right;
    if (p.input.shift && isMoving && !p.isStunned) {
      if (p.stamina > 0) {
        p.stamina = Math.max(0, p.stamina - 1);
        p.isSprinting = true;
      } else {
        p.isSprinting = false;
      }
    } else {
      // Recarga proporcional de estamina (15 segundos para carregar do 0 ao máximo de 600)
      p.stamina = Math.min(600, p.stamina + 600 / (15 * TICK_RATE));
      p.isSprinting = false;
    }
  }

  // 4. Detecção de Coleta de Itens v6
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    for (const [, p] of players) {
      if (p.isStunned) continue;
      const px = p.x + PLAYER_SIZE / 2;
      const py = p.y + PLAYER_SIZE / 2;
      const ix = pickup.x + 10;
      const iy = pickup.y + 10;
      const dist = Math.sqrt((px - ix) * (px - ix) + (py - iy) * (py - iy));

      if (dist < 22) { // Colisão!
        let collected = false;

        if (p.isHot) {
          // Pegador coleta Speed, Supernova, Aura Gravitacional ou EMP
          if (pickup.type === 'speed') {
            p.speedBoostTimer = 15 * TICK_RATE;
            collected = true;
          } else if (pickup.type === 'supernova') {
            p.supernovaTimer = 10 * TICK_RATE;
            collected = true;
          } else if (pickup.type === 'gravity') {
            p.gravityTimer = 12 * TICK_RATE;
            collected = true;
          } else if (pickup.type === 'emp') {
            p.empTimer = 10 * TICK_RATE;
            collected = true;
          } else if (pickup.type === 'tracker') {
            p.trackerTimer = 10 * TICK_RATE;
            collected = true;
          } else if (pickup.type === 'magnetic') {
            p.magnetTimer = 8 * TICK_RATE;
            collected = true;
          }
        } else {
          // Corredores: guardam itens no Slot Q ou E se tiverem espaço
          if (['speed', 'machinegun', 'shield', 'invisibility', 'phaseshift', 'blink', 'repel'].includes(pickup.type)) {
            if (!p.slotQ) {
              p.slotQ = pickup.type;
              collected = true;
            } else if (!p.slotE) {
              p.slotE = pickup.type;
              collected = true;
            }
          }
        }

        if (collected) {
          broadcast({
            type: 'collected',
            playerId: p.id,
            playerName: p.name,
            itemType: pickup.type,
            color: p.color
          });
          pickups.splice(i, 1);
          break; // sai do loop de jogadores para este pickup
        }
      }
    }
  }

  // 4b. Detecção de Coleta de Moedas v7
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    for (const [, p] of players) {
      if (p.isStunned) continue;
      const px = p.x + PLAYER_SIZE / 2;
      const py = p.y + PLAYER_SIZE / 2;
      const cx = coin.x + 8;
      const cy = coin.y + 8;
      const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));

      if (dist < 22) { // Colisão!
        p.coins = (p.coins || 0) + 1;
        
        broadcast({
          type: 'coinCollected',
          playerId: p.id,
          playerName: p.name,
          coins: p.coins,
          coinId: coin.id,
          color: p.color
        });
        
        coins.splice(i, 1);
        break; // sai do loop de jogadores para esta moeda
      }
    }
  }

  // 5. ── Mover Jogadores ──
  for (const [, p] of players) {
    if (p.isStunned) continue;

    let dx = 0, dy = 0;
    if (p.input.up) dy -= 1;
    if (p.input.down) dy += 1;
    if (p.input.left) dx -= 1;
    if (p.input.right) dx += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    let speed = p.isHot ? HOT_SPEED : RUNNER_SPEED;

    // Zonas de velocidade
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const zone of speedZones) {
      if (pcx > zone.x && pcx < zone.x + zone.w && pcy > zone.y && pcy < zone.y + zone.h) {
        speed *= zone.type === 'boost' ? (p.isHot ? 0.75 : 1.35) : (p.isHot ? 1.35 : 0.75);
      }
    }

    // Debuff de velocidade por tiro (redução de 50%)
    if (p.speedDebuffTimer > 0) {
      speed *= 0.5;
    }

    // --- Buffs v6 ---
    // Super Velocidade (+40%)
    if (p.speedBoostTimer > 0) {
      speed *= 1.4;
    }
    // Supernova do Hot (+30%)
    if (p.isHot && p.supernovaTimer > 0) {
      speed *= 1.3;
    }
    // Sprint com Shift (+45% velocidade)
    if (p.isSprinting) {
      speed *= 1.45;
    }
    // Rastreador Térmico (+10% velocidade de perseguição)
    if (p.isHot && p.trackerTimer > 0) {
      speed *= 1.1;
    }
    // Aura de Gravidade (Corredor lento por 60% perto de Hot com Teia)
    if (!p.isHot) {
      let underGravity = false;
      for (const [, p2] of players) {
        if (p2.isHot && p2.gravityTimer > 0) {
          const gdx = (p2.x + p2.w / 2) - (p.x + p.w / 2);
          const gdy = (p2.y + p2.h / 2) - (p.y + p.h / 2);
          const gdist = Math.sqrt(gdx * gdx + gdy * gdy);
          if (gdist <= 160) {
            underGravity = true;
            break;
          }
        }
      }
      if (underGravity) {
        speed *= 0.4;
      }

      // Pulso Cyber EMP (Corredor perto de Hot com EMP ativo perde arma e tether)
      let underEmp = false;
      for (const [, p2] of players) {
        if (p2.isHot && p2.empTimer > 0) {
          const edx = (p2.x + p2.w / 2) - (p.x + p.w / 2);
          const edy = (p2.y + p2.h / 2) - (p.y + p.h / 2);
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist <= 200) {
            underEmp = true;
            break;
          }
        }
      }
      if (underEmp) {
        p.reloadTimer = Math.max(p.reloadTimer, 2 * TICK_RATE); // Bloqueia tiro/arma
        p.ammo = 0; // Zerado!
        p.holdEnergy = 0; // Zera tether!
      }
    }

    // --- Novos Efeitos de Força v9 (Magnetismo e Repulsão) ---
    let fx = 0, fy = 0;

    if (!p.isHot) {
      // 1. Corredor sob atração magnética de qualquer Hot com Vórtex Ativo
      for (const [, p2] of players) {
        if (p2.isHot && p2.magnetTimer > 0) {
          const mdx = (p2.x + PLAYER_SIZE / 2) - (p.x + PLAYER_SIZE / 2);
          const mdy = (p2.y + PLAYER_SIZE / 2) - (p.y + PLAYER_SIZE / 2);
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist > 0 && mdist <= 240) {
            const pullStrength = 3.6 * (1 - mdist / 240); // Força diminui com a distância
            fx += (mdx / mdist) * pullStrength;
            fy += (mdy / mdist) * pullStrength;
          }
        }
      }
    } else {
      // 2. Hot sob repulsão de qualquer Corredor com Pulso Repulsor Ativo
      for (const [, p2] of players) {
        if (!p2.isHot && p2.repelTimer > 0) {
          const rdx = (p.x + PLAYER_SIZE / 2) - (p2.x + PLAYER_SIZE / 2);
          const rdy = (p.y + PLAYER_SIZE / 2) - (p2.y + PLAYER_SIZE / 2);
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
          if (rdist > 0 && rdist <= 180) {
            const pushStrength = 5.2 * (1 - rdist / 180); // Empurrão diminui com a distância
            fx += (rdx / rdist) * pushStrength;
            fy += (rdy / rdist) * pushStrength;
          }
        }
      }
    }

    // Mover X
    const hasPhaseShift = p.phaseshiftTimer > 0;
    let nx = p.x + dx * speed + fx;
    if (hasPhaseShift || !collidesWithWalls(nx, p.y, p.w, p.h)) {
      p.x = nx;
    }
    // Mover Y
    let ny = p.y + dy * speed + fy;
    if (hasPhaseShift || !collidesWithWalls(p.x, ny, p.w, p.h)) {
      p.y = ny;
    }

    // --- Resolução de Sobreposição Física com Caixas (Permite empurrão por corpo e evita travamento) ---
    if (!p.isStunned && !hasPhaseShift) {
      for (const box of pushables) {
        if (p.x + p.w > box.x && p.x < box.x + box.w && p.y + p.h > box.y && p.y < box.y + box.h) {
          const overlapX = Math.min(p.x + p.w - box.x, box.x + box.w - p.x);
          const overlapY = Math.min(p.y + p.h - box.y, box.y + box.h - p.y);

          if (overlapX < overlapY) {
            const pushDir = (box.x + box.w / 2 > p.x + p.w / 2) ? 1 : -1;
            const newBoxX = box.x + pushDir * overlapX;
            if (!collidesWithWalls(newBoxX + 1, box.y + 1, box.w - 2, box.h - 2) &&
                !collidesWithBoxes(newBoxX + 1, box.y + 1, box.w - 2, box.h - 2, box.id)) {
              box.x = newBoxX;
            } else {
              p.x -= pushDir * overlapX;
            }
          } else {
            const pushDir = (box.y + box.h / 2 > p.y + p.h / 2) ? 1 : -1;
            const newBoxY = box.y + pushDir * overlapY;
            if (!collidesWithWalls(box.x + 1, newBoxY + 1, box.w - 2, box.h - 2) &&
                !collidesWithBoxes(box.x + 1, newBoxY + 1, box.w - 2, box.h - 2, box.id)) {
              box.y = newBoxY;
            } else {
              p.y -= pushDir * overlapY;
            }
          }
        }
      }
    }
    
    // Clamps
    p.x = Math.max(TILE, Math.min(MAP_W - TILE - p.w, p.x));
    p.y = Math.max(TILE, Math.min(MAP_H - TILE - p.h, p.y));
  }

  // 6. ── Mover Caixas Arrastadas ──
  for (const box of pushables) {
    if (!box.grabbedBy) continue;
    const p = players.get(box.grabbedBy);
    if (!p || !p.mouseWorld) continue;

    const tx = p.mouseWorld.x - box.w / 2;
    const ty = p.mouseWorld.y - box.h / 2;
    const ddx = tx - box.x;
    const ddy = ty - box.y;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist < 1) continue;

    const spd = Math.min(DRAG_SPEED, dist);
    const mx = (ddx / dist) * spd;
    const my = (ddy / dist) * spd;

    const nxB = box.x + mx;
    if (!collidesWithWalls(nxB + 1, box.y + 1, box.w - 2, box.h - 2) && 
        !collidesWithBoxes(nxB + 1, box.y + 1, box.w - 2, box.h - 2, box.id)) {
      box.x = nxB;
    }
    const nyB = box.y + my;
    if (!collidesWithWalls(box.x + 1, nyB + 1, box.w - 2, box.h - 2) && 
        !collidesWithBoxes(box.x + 1, nyB + 1, box.w - 2, box.h - 2, box.id)) {
      box.y = nyB;
    }
  }

  // 6b. ── Vórtex Magnético sobre Caixas v9 ──
  for (const box of pushables) {
    let bfx = 0, bfy = 0;
    for (const [, p] of players) {
      if (p.isHot && p.magnetTimer > 0) {
        const bdx = (p.x + PLAYER_SIZE / 2) - (box.x + box.w / 2);
        const bdy = (p.y + PLAYER_SIZE / 2) - (box.y + box.h / 2);
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bdist > 35 && bdist <= 240) {
          const pullStrength = 3.2 * (1 - bdist / 240); // Força diminui com a distância
          bfx += (bdx / bdist) * pullStrength;
          bfy += (bdy / bdist) * pullStrength;
        }
      }
    }

    if (bfx !== 0 || bfy !== 0) {
      const nxBoxX = box.x + bfx;
      if (!collidesWithWalls(nxBoxX + 1, box.y + 1, box.w - 2, box.h - 2) && 
          !collidesWithBoxes(nxBoxX + 1, box.y + 1, box.w - 2, box.h - 2, box.id)) {
        box.x = nxBoxX;
      }
      const nxBoxY = box.y + bfy;
      if (!collidesWithWalls(box.x + 1, nxBoxY + 1, box.w - 2, box.h - 2) && 
          !collidesWithBoxes(box.x + 1, nxBoxY + 1, box.w - 2, box.h - 2, box.id)) {
        box.y = nxBoxY;
      }
    }
  }

  // 7. ── Infecção (Apenas em Partida InGame e Hots não Stunned!) ──
  if (gamePhase === Phase.INGAME) {
    const hots = [...players.values()].filter(p => p.isHot && !p.isStunned);
    const runners = [...players.values()].filter(p => !p.isHot);
    for (const hot of hots) {
      for (const runner of runners) {
        const dx = (hot.x + hot.w / 2) - (runner.x + runner.w / 2);
        const dy = (hot.y + hot.h / 2) - (runner.y + runner.h / 2);
        
        let infRad = INFECTION_RADIUS;
        if (hot.supernovaTimer > 0) infRad += 25; // Supernova aumenta raio de contágio!

        if (Math.sqrt(dx * dx + dy * dy) < infRad) {
          // Se o corredor tiver escudo de plasma ativo, absorve e empurra o pegador
          if (runner.shieldTimer > 0) {
            runner.shieldTimer = 0; // Consome escudo

            // Empurra o Hot 120 pixels na direção oposta
            const pushDist = 120;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const hux = dx / len;
            const huy = dy / len;
            const targetHotX = hot.x + hux * pushDist;
            const targetHotY = hot.y + huy * pushDist;
            
            if (!collidesWithWalls(targetHotX, hot.y, hot.w, hot.h) &&
                !collidesWithBoxes(targetHotX, hot.y, hot.w, hot.h, -1)) {
              hot.x = targetHotX;
            }
            if (!collidesWithWalls(hot.x, targetHotY, hot.w, hot.h) &&
                !collidesWithBoxes(hot.x, targetHotY, hot.w, hot.h, -1)) {
              hot.y = targetHotY;
            }

            broadcast({
              type: 'shieldPopped',
              runnerId: runner.id,
              runnerName: runner.name,
              hotId: hot.id,
              hotName: hot.name
            });
          } else {
            // Contamina normalmente e limpa buffs exclusivos de corredor
            runner.isHot = true;
            runner.speed = HOT_SPEED;
            runner.health = 100;
            runner.machinegunTimer = 0;
            runner.shieldTimer = 0;
            runner.invisibilityTimer = 0;
            broadcast({
              type: 'infected',
              playerId: runner.id,
              byPlayerId: hot.id,
              name: runner.name,
              byName: hot.name,
            });
          }
        }
      }
    }
    checkWinConditions();
  }

  // 8. ── Estado Periódico (Envia pickups v6 para os clientes!) ──
  if (tickCount % BROADCAST_EVERY === 0 && players.size > 0) {
    broadcast({
      type: 'gameState',
      players: [...players.values()].map(serializePlayer),
      pushables: pushables.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size, grabbedBy: b.grabbedBy })),
      phase: gamePhase,
      timer: Math.ceil(phaseTimer / TICK_RATE),
      runnersCount: [...players.values()].filter(p => !p.isHot).length,
      hotsCount: [...players.values()].filter(p => p.isHot).length,
      pickups: pickups.map(pk => ({ id: pk.id, x: pk.x, y: pk.y, type: pk.type })), // Envia os drops ativos
      coins: coins.map(c => ({ id: c.id, x: c.x, y: c.y })) // Envia as moedas ativas
    });
  }
}

setInterval(gameTick, TICK_MS);

server.listen(PORT, () => {
  console.log(`\n  ⚡ Servidor Único BraainHot v6 rodando em http://localhost:${PORT}\n`);
});
