/**
 * BraainHot — Server v5
 * Servidor Único Autorizativo (Máximo 20 jogadores)
 * Aguarda 3 jogadores para iniciar Aquecimento de 60 segundos.
 * Após o Aquecimento, inicia Partida de 7 minutos.
 * Com Arma para Corredores (3 tiros seguidos, 5s recarga, reduz velocidade e empurra).
 * Sangue do Hot (100 HP, 3 hits paralisam por 10s).
 * Limite de Arrasto de Caixas (5s de tether max, recarrega solto).
 * Bate-papo por sessão e painel de jogadores.
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
const MAP_W = 2000;
const MAP_H = 1520;
const PLAYER_SIZE = 28;
const RUNNER_SPEED = 3.0;
const HOT_SPEED = 3.4;
const WARMUP_SECS = 60; // 60 segundos de aquecimento antes da caçada
const GAME_SECS = 420; // 7 minutos de caçada
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

  // ── Paredes externas da casa ──
  const hx = 3 * T, hy = 2 * T;
  const hw = 44 * T, hh = 32 * T;
  const hx2 = hx + hw, hy2 = hy + hh;

  addWall(hx, hy, hw, T);
  addWall(hx, hy, T, hh);
  addWall(hx2 - T, hy, T, hh);
  
  // Porta de entrada = gap de 4 tiles
  addWall(hx, hy2 - T, 18 * T, T);
  addWall(hx + 22 * T, hy2 - T, 22 * T, T);

  // ── Paredes internas ──
  const divY1 = hy + 11 * T;
  addWall(hx + T, divY1, 8 * T, T);
  addWall(hx + 11 * T, divY1, 10 * T, T);
  addWall(hx + 23 * T, divY1, 8 * T, T);
  addWall(hx + 33 * T, divY1, 10 * T, T);

  const divY2 = hy + 17 * T;
  addWall(hx + T, divY2, 6 * T, T);
  addWall(hx + 9 * T, divY2, 8 * T, T);
  addWall(hx + 19 * T, divY2, 10 * T, T);
  addWall(hx + 31 * T, divY2, 12 * T, T);

  // Verticais
  const vx1 = hx + 14 * T;
  addWall(vx1, hy + T, T, 4 * T);
  addWall(vx1, hy + 7 * T, T, 4 * T);

  const vx2 = hx + 30 * T;
  addWall(vx2, hy + T, T, 3 * T);
  addWall(vx2, hy + 6 * T, T, 5 * T);

  const vx3 = hx + 10 * T;
  addWall(vx3, divY2 + T, T, 4 * T);
  addWall(vx3, divY2 + 7 * T, T, 7 * T);

  const vx4 = hx + 24 * T;
  addWall(vx4, divY2 + T, T, 5 * T);
  addWall(vx4, divY2 + 8 * T, T, 6 * T);

  // Móveis fixos
  addWall(hx + 2 * T, hy + 2 * T, 5 * T, T);
  addWall(hx + 18 * T, hy + 5 * T, 4 * T, 2 * T);
  addWall(hx + 38 * T, hy + 2 * T, 4 * T, 3 * T);
  addWall(hx + 36 * T, divY2 + 3 * T, 4 * T, 3 * T);
  addWall(hx + 2 * T, divY2 + 3 * T, 2 * T, T);

  // Caixas empurráveis (tamanhos variados)
  const boxDefs = [
    { col: 5, row: 5, size: 'S' }, { col: 8, row: 3, size: 'M' }, { col: 10, row: 8, size: 'S' },
    { col: 17, row: 3, size: 'L' }, { col: 24, row: 8, size: 'M' }, { col: 20, row: 9, size: 'S' },
    { col: 33, row: 4, size: 'M' }, { col: 35, row: 8, size: 'S' }, { col: 37, row: 6, size: 'L' },
    { col: 12, row: 13, size: 'S' }, { col: 22, row: 14, size: 'M' }, { col: 35, row: 13, size: 'S' },
    { col: 5, row: 22, size: 'S' }, { col: 7, row: 25, size: 'S' },
    { col: 13, row: 20, size: 'L' }, { col: 16, row: 23, size: 'M' }, { col: 18, row: 20, size: 'S' },
    { col: 14, row: 25, size: 'M' },
    { col: 27, row: 22, size: 'M' }, { col: 30, row: 25, size: 'L' }, { col: 33, row: 21, size: 'S' },
    { col: 20, row: 30, size: 'M' }, { col: 25, row: 31, size: 'S' },
  ];

  const sizes = { S: 28, M: 40, L: 56 };
  for (const def of boxDefs) {
    const s = sizes[def.size];
    pushables.push({
      id: nextBoxId++,
      x: hx + def.col * T, y: hy + def.row * T,
      w: s, h: s,
      size: def.size,
      grabbedBy: null,
      targetX: null, targetY: null,
    });
  }

  // Zonas de velocidade
  speedZones = [
    { x: hx + 16 * T, y: hy + 12 * T, w: 5 * T, h: 4 * T, type: 'boost', label: '⚡ BOOST' },
    { x: hx + 26 * T, y: hy + 12 * T, w: 5 * T, h: 4 * T, type: 'slow', label: '❄ SLOW' },
    { x: hx + 2 * T, y: divY2 + 8 * T, w: 3 * T, h: 3 * T, type: 'boost', label: '⚡ BOOST' },
    { x: hx + 38 * T, y: divY2 + 8 * T, w: 3 * T, h: 3 * T, type: 'boost', label: '⚡ BOOST' },
  ];
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
  const hx = 3 * TILE + TILE, hy = 2 * TILE + TILE;
  const hw = 42 * TILE, hh = 30 * TILE;
  for (let tries = 0; tries < 200; tries++) {
    const x = hx + Math.random() * hw;
    const y = hy + Math.random() * hh;
    if (!collidesWithWalls(x, y, PLAYER_SIZE, PLAYER_SIZE) &&
        !collidesWithBoxes(x, y, PLAYER_SIZE, PLAYER_SIZE, -1)) {
      return { x, y };
    }
  }
  return { x: hx + 100, y: hy + 100 };
}

// ─── Lógica do Servidor ───
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const [, p] of players) {
    if (p.ws.readyState === 1) p.ws.send(data);
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
  broadcast({ type: 'phaseChange', phase: Phase.WARMUP, timer: WARMUP_SECS });
}

function startInGame() {
  gamePhase = Phase.INGAME;
  phaseTimer = GAME_SECS * TICK_RATE;
  const ids = [...players.keys()];
  const hotId = ids[Math.floor(Math.random() * ids.length)];
  const hotPlayer = players.get(hotId);
  if (hotPlayer) {
    hotPlayer.isHot = true;
    hotPlayer.speed = HOT_SPEED;
    hotPlayer.health = 100;
  }
  broadcast({ type: 'phaseChange', phase: Phase.INGAME, timer: GAME_SECS, hotAlphaId: hotId });
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
        input: { up: false, down: false, left: false, right: false },
        grabbedBox: null,
        mouseWorld: null,

        // --- Novas mecânicas da v5 ---
        ammo: 3,
        reloadTimer: 0,
        health: 100,
        isStunned: false,
        stunTimer: 0,
        speedDebuffTimer: 0,
        holdEnergy: 300,
      };

      players.set(pId, currentPlayer);

      // Welcome
      ws.send(JSON.stringify({
        type: 'welcome',
        id: pId,
        map: getMapData(),
        players: [...players.values()].map(serializePlayer),
        phase: gamePhase,
        timer: Math.ceil(phaseTimer / TICK_RATE),
        colors: PLAYER_COLORS,
      }));

      broadcast({ type: 'playerJoined', player: serializePlayer(currentPlayer) });

      // Inicia o warmup de 60s quando bate o 3º jogador
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
    }

    // ── ATIRAR COM ARMA (Mecânica v5) ──
    if (msg.type === 'shoot') {
      if (currentPlayer.isHot) return; // Apenas corredores atiram
      if (currentPlayer.isStunned) return;
      if (currentPlayer.reloadTimer > 0) return;
      if (currentPlayer.ammo <= 0) return;

      currentPlayer.ammo--;
      if (currentPlayer.ammo <= 0) {
        currentPlayer.reloadTimer = 5 * TICK_RATE; // 5 segundos de recarga
      }

      const px = currentPlayer.x + PLAYER_SIZE / 2;
      const py = currentPlayer.y + PLAYER_SIZE / 2;
      const tx = msg.tx;
      const ty = msg.ty;

      let dx = tx - px;
      let dy = ty - py;
      let len = Math.sqrt(dx * dx + dy * dy);
      
      if (len >= 1) {
        const maxRange = 600;
        if (len > maxRange) {
          dx = (dx / len) * maxRange;
          dy = (dy / len) * maxRange;
          len = maxRange;
        }

        const ux = dx / len;
        const uy = dy / len;

        let finalEx = px + dx;
        let finalEy = py + dy;
        let hitType = null;
        let hitTargetId = null;

        // Percorre o raio em passos curtos (5px)
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

            // Arrasta a caixa 30px na direção do tiro
            const pushDist = 35;
            const targetBoxX = boxHit.x + ux * pushDist;
            const targetBoxY = boxHit.y + uy * pushDist;
            if (!collidesWithWalls(targetBoxX, boxHit.y, boxHit.w, boxHit.h) &&
                !collidesWithBoxes(targetBoxX, boxHit.y, boxHit.w, boxHit.h, boxHit.id)) {
              boxHit.x = targetBoxX;
            }
            if (!collidesWithWalls(boxHit.x, targetBoxY, boxHit.w, boxHit.h) &&
                !collidesWithBoxes(boxHit.x, targetBoxY, boxHit.w, boxHit.h, boxHit.id)) {
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

            // Arrasta o jogador atingido por 30px
            const pushDist = 30;
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

            // Se for Pegador, perde sangue. 3 tiros (34 HP cada) zeram e paralisam
            if (playerHit.isHot && !playerHit.isStunned) {
              playerHit.health -= 34;
              if (playerHit.health <= 0) {
                playerHit.health = 0;
                playerHit.isStunned = true;
                playerHit.stunTimer = 10 * TICK_RATE; // Paralisado por 10s
                broadcast({ type: 'stunned', playerId: playerHit.id, name: playerHit.name });
              }
            }
            break;
          }
        }

        // Envia feixe de laser para o cliente renderizar
        broadcast({
          type: 'bulletTraced',
          shooterId: currentPlayer.id,
          sx: px, sy: py,
          ex: finalEx, ey: finalEy,
          hitType,
          color: currentPlayer.color
        });
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

    if (msg.type === 'grab') {
      if (currentPlayer.grabbedBox) return;
      // Não pode pegar se a energia estiver recarregando
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
  });

  ws.on('close', () => {
    if (currentPlayer) {
      if (currentPlayer.grabbedBox) {
        const box = pushables.find(b => b.id === currentPlayer.grabbedBox);
        if (box) box.grabbedBy = null;
      }
      players.delete(currentPlayer.id);
      broadcast({ type: 'playerLeft', id: currentPlayer.id });
      checkWinConditions();
    }
  });
});

// ─── Loop Principal (60 Hz) ───
function gameTick() {
  tickCount++;

  // Fase & Timer
  if (gamePhase === Phase.WARMUP || gamePhase === Phase.INGAME || gamePhase === Phase.ENDGAME) {
    phaseTimer--;
    if (phaseTimer <= 0) {
      if (gamePhase === Phase.WARMUP) startInGame();
      else if (gamePhase === Phase.INGAME) endGame('runners');
      else if (gamePhase === Phase.ENDGAME) resetGame();
      return;
    }
  }

  // ── Atualizar Estados Temporais de Jogadores ──
  for (const [, p] of players) {
    // 1. Recarga da arma (5s)
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
      }
    }

    // 3. Debuff de velocidade por tiro (0.5s)
    if (p.speedDebuffTimer > 0) {
      p.speedDebuffTimer--;
    }

    // 4. Limite de segurar objeto (5 segundos = 300 ticks)
    if (p.grabbedBox !== null) {
      p.holdEnergy--;
      if (p.holdEnergy <= 0) {
        p.holdEnergy = 0;
        // Solta a caixa automaticamente!
        const box = pushables.find(b => b.id === p.grabbedBox);
        if (box) box.grabbedBy = null;
        p.grabbedBox = null;
        p.mouseWorld = null;
      }
    } else {
      if (p.holdEnergy < 300) {
        p.holdEnergy++; // Recarrega na mesma velocidade
      }
    }
  }

  // ── Mover Jogadores (Livre em LOBBY, WARMUP e INGAME) ──
  for (const [, p] of players) {
    if (p.isStunned) continue; // Paralisado não se move!

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

    // Mover X
    let nx = p.x + dx * speed;
    if (!collidesWithWalls(nx, p.y, p.w, p.h) && !collidesWithBoxes(nx, p.y, p.w, p.h, -1)) {
      p.x = nx;
    }
    // Mover Y
    let ny = p.y + dy * speed;
    if (!collidesWithWalls(p.x, ny, p.w, p.h) && !collidesWithBoxes(p.x, ny, p.w, p.h, -1)) {
      p.y = ny;
    }
    // Clamps
    p.x = Math.max(TILE, Math.min(MAP_W - TILE - p.w, p.x));
    p.y = Math.max(TILE, Math.min(MAP_H - TILE - p.h, p.y));
  }

  // ── Mover Caixas Arrastadas ──
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

    // Limitar distância máxima do arrasto
    const afterX = box.x + mx;
    const afterY = box.y + my;
    const pdx = (afterX + box.w / 2) - (p.x + p.w / 2);
    const pdy = (afterY + box.h / 2) - (p.y + p.h / 2);
    if (Math.sqrt(pdx * pdx + pdy * pdy) > GRAB_RANGE + box.w / 2 + 20) {
      box.grabbedBy = null;
      p.grabbedBox = null;
      p.mouseWorld = null;
      continue;
    }

    // Mover com colisão
    const nxB = box.x + mx;
    if (!collidesWithWalls(nxB, box.y, box.w, box.h) && !collidesWithBoxes(nxB, box.y, box.w, box.h, box.id)) {
      box.x = nxB;
    }
    const nyB = box.y + my;
    if (!collidesWithWalls(box.x, nyB, box.w, box.h) && !collidesWithBoxes(box.x, nyB, box.w, box.h, box.id)) {
      box.y = nyB;
    }
  }

  // ── Infecção (Apenas em Partida InGame e Hots não Stunned!) ──
  if (gamePhase === Phase.INGAME) {
    const hots = [...players.values()].filter(p => p.isHot && !p.isStunned);
    const runners = [...players.values()].filter(p => !p.isHot);
    for (const hot of hots) {
      for (const runner of runners) {
        const dx = (hot.x + hot.w / 2) - (runner.x + runner.w / 2);
        const dy = (hot.y + hot.h / 2) - (runner.y + runner.h / 2);
        if (Math.sqrt(dx * dx + dy * dy) < INFECTION_RADIUS) {
          runner.isHot = true;
          runner.speed = HOT_SPEED;
          runner.health = 100; // Preenche vida
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
    checkWinConditions();
  }

  // ── Estado Periódico ──
  if (tickCount % BROADCAST_EVERY === 0 && players.size > 0) {
    broadcast({
      type: 'gameState',
      players: [...players.values()].map(serializePlayer),
      pushables: pushables.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size, grabbedBy: b.grabbedBy })),
      phase: gamePhase,
      timer: Math.ceil(phaseTimer / TICK_RATE),
      runnersCount: [...players.values()].filter(p => !p.isHot).length,
      hotsCount: [...players.values()].filter(p => p.isHot).length,
    });
  }
}

setInterval(gameTick, TICK_MS);

server.listen(PORT, () => {
  console.log(`\n  ⚡ Servidor Único BraainHot v5 rodando em http://localhost:${PORT}\n`);
});
