/**
 * BraainHot v4 — Client Engine
 * Servidor Único Autorizativo (Máximo 20 jogadores)
 * Aguarda 3 jogadores para iniciar Aquecimento de 60 segundos.
 * Após o Aquecimento, inicia Partida de 7 minutos.
 */

// ── DOM ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lobbyEl = document.getElementById('lobby');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const hudEl = document.getElementById('hud');
const hudPhase = document.getElementById('hudPhase');
const hudTimer = document.getElementById('hudTimer');
const hudRunners = document.getElementById('hudRunners');
const hudHots = document.getElementById('hudHots');
const hudFeed = document.getElementById('hudFeed');
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const endMessage = document.getElementById('endMessage');
const hotSelectScreen = document.getElementById('hotSelectScreen');
const hotSelectName = document.getElementById('hotSelectName');
const colorPickerEl = document.getElementById('colorPicker');
const grabHint = document.getElementById('grabHint');

// ── Estado ──
let ws = null, myId = null, gameMap = null;
let players = new Map();
let pushables = [];
let phase = 'lobby', timer = 0, runnersCount = 0, hotsCount = 0;
let joined = false;
let camX = 0, camY = 0, shakeX = 0, shakeY = 0, shakeMag = 0;
let particles = [];
const targetPos = new Map();
const keys = { up: false, down: false, left: false, right: false };
let lastInputJson = '';

// Cores do personagem
const defaultColors = ['#00f0ff','#00ff88','#aa66ff','#ff66cc','#ffcc00','#ff8844','#66ffcc','#88aaff'];
let selectedColor = defaultColors[0];

// Mouse / Drag
let mouseScreenX = 0, mouseScreenY = 0;
let mouseDown = false;
let grabbedBoxId = null;
let hoveringBoxId = null;

// ── Resize ──
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ── Color Picker ──
function initColorPicker() {
  colorPickerEl.innerHTML = '';
  for (const c of defaultColors) {
    const div = document.createElement('div');
    div.className = 'color-swatch' + (c === selectedColor ? ' selected' : '');
    div.style.background = c;
    div.style.color = c;
    div.addEventListener('click', () => {
      selectedColor = c;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      div.classList.add('selected');
    });
    colorPickerEl.appendChild(div);
  }
}
initColorPicker();

// ── Input ──
const keyMap = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', W:'up', s:'down', S:'down', a:'left', A:'left', d:'right', D:'right' };

window.addEventListener('keydown', e => {
  if (document.activeElement === nameInput) return;
  const k = keyMap[e.key]; if (k) { keys[k] = true; e.preventDefault(); }
});

window.addEventListener('keyup', e => {
  if (document.activeElement === nameInput) return;
  const k = keyMap[e.key]; if (k) { keys[k] = false; e.preventDefault(); }
});

function sendInput() {
  if (!ws || ws.readyState !== 1 || !joined) return;
  const json = JSON.stringify(keys);
  if (json !== lastInputJson) { ws.send(JSON.stringify({ type: 'input', ...keys })); lastInputJson = json; }
}

// ── Mouse ──
canvas.addEventListener('mousemove', e => {
  mouseScreenX = e.clientX;
  mouseScreenY = e.clientY;
  if (grabbedBoxId !== null && ws && ws.readyState === 1) {
    const wx = mouseScreenX + camX - shakeX;
    const wy = mouseScreenY + camY - shakeY;
    ws.send(JSON.stringify({ type: 'drag', x: wx, y: wy }));
  }
  // Hover detection
  if (!mouseDown) {
    const wx = mouseScreenX + camX;
    const wy = mouseScreenY + camY;
    hoveringBoxId = null;
    for (const b of pushables) {
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
        hoveringBoxId = b.id;
        break;
      }
    }
    canvas.style.cursor = hoveringBoxId ? 'grab' : 'default';
  }
});

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0 || !joined) return;
  mouseDown = true;
  const wx = mouseScreenX + camX;
  const wy = mouseScreenY + camY;
  // Tentar pegar uma caixa
  for (const b of pushables) {
    if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'grab', boxId: b.id }));
        grabbedBoxId = b.id;
        canvas.classList.add('grabbing');
        grabHint.classList.remove('hidden');
      }
      break;
    }
  }
});

canvas.addEventListener('mouseup', () => {
  mouseDown = false;
  if (grabbedBoxId !== null) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'release' }));
    grabbedBoxId = null;
    canvas.classList.remove('grabbing');
    grabHint.classList.add('hidden');
  }
});

// ── WebSocket ──
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => console.log('Conectado ao Servidor Único');
  ws.onmessage = e => handleMessage(JSON.parse(e.data));
  ws.onclose = () => {
    joined = false;
    showLobbyScreen();
    setTimeout(connect, 2000);
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      myId = msg.id;
      gameMap = msg.map;
      pushables = msg.map.pushables;
      phase = msg.phase;
      timer = msg.timer;
      players.clear();
      targetPos.clear();
      for (const p of msg.players) {
        players.set(p.id, p);
        targetPos.set(p.id, { x: p.x, y: p.y });
      }
      showGame();
      break;

    case 'gameState':
      phase = msg.phase; timer = msg.timer;
      runnersCount = msg.runnersCount; hotsCount = msg.hotsCount;
      if (msg.pushables) pushables = msg.pushables;

      const ids = new Set();
      for (const sp of msg.players) {
        ids.add(sp.id);
        targetPos.set(sp.id, { x: sp.x, y: sp.y });
        const ex = players.get(sp.id);
        if (ex) {
          ex.isHot = sp.isHot; ex.name = sp.name; ex.alive = sp.alive; ex.color = sp.color;
        } else {
          players.set(sp.id, { ...sp });
        }
      }
      for (const [id] of players) {
        if (!ids.has(id)) { players.delete(id); targetPos.delete(id); }
      }
      updateHUD();
      break;

    case 'phaseChange':
      phase = msg.phase; timer = msg.timer || 0;
      if (msg.map) { gameMap = msg.map; pushables = msg.map.pushables; }
      endScreen.classList.add('hidden');
      hotSelectScreen.classList.add('hidden');
      if (phase === 'ingame' && msg.hotAlphaId) showHotSelect(msg.hotAlphaId);
      updateHUD();
      break;

    case 'playerJoined':
      players.set(msg.player.id, msg.player);
      targetPos.set(msg.player.id, { x: msg.player.x, y: msg.player.y });
      break;

    case 'playerLeft':
      players.delete(msg.id); targetPos.delete(msg.id);
      break;

    case 'infected':
      addFeedItem(`🔥 ${msg.byName} infectou ${msg.name}!`);
      shakeMag = 10;
      const inf = players.get(msg.playerId);
      if (inf) spawnInfectionBurst(inf.x, inf.y);
      break;

    case 'gameOver':
      showEndScreen(msg.winner);
      break;

    case 'error':
      alert(msg.message);
      break;
  }
}

// ── Entrar na Arena ──
joinBtn.addEventListener('click', doJoin);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

function doJoin() {
  const name = nameInput.value.trim() || 'Anon';
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: 'join',
    name,
    color: selectedColor
  }));
}

// ── UI Screens ──
function showGame() {
  lobbyEl.style.display = 'none';
  canvas.style.display = 'block';
  hudEl.classList.remove('hidden');
  endScreen.classList.add('hidden');
  hotSelectScreen.classList.add('hidden');
  joined = true;
  updateHUD();
}

function showLobbyScreen() {
  lobbyEl.style.display = 'flex';
  canvas.style.display = 'none';
  hudEl.classList.add('hidden');
  endScreen.classList.add('hidden');
  hotSelectScreen.classList.add('hidden');
  joined = false;
  myId = null;
  gameMap = null;
  players.clear();
}

function updateHUD() {
  const names = { lobby:'AGUARDANDO', warmup:'AQUECIMENTO', ingame:'CAÇADA', endgame:'FIM' };
  hudPhase.textContent = names[phase] || phase;

  if (phase === 'lobby' && players.size < 3) {
    hudPhase.textContent = `ESPERANDO (${players.size}/3)`;
  }

  const m = Math.floor(timer / 60), s = timer % 60;
  
  if (phase === 'lobby') {
    hudTimer.textContent = '--:--';
  } else {
    hudTimer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  hudTimer.className = (phase === 'ingame' && timer <= 20) ? 'urgent' : '';
  hudRunners.textContent = `🏃 ${runnersCount}`;
  hudHots.textContent = `🔥 ${hotsCount}`;
}

function addFeedItem(text) {
  const div = document.createElement('div');
  div.className = 'feed-item'; div.textContent = text;
  hudFeed.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 3000);
  if (hudFeed.children.length > 5) hudFeed.firstChild.remove();
}

function showHotSelect(hotId) {
  const p = players.get(hotId);
  hotSelectName.textContent = p ? p.name : '???';
  hotSelectScreen.classList.remove('hidden');
  setTimeout(() => hotSelectScreen.classList.add('hidden'), 3500);
}

function showEndScreen(w) {
  endScreen.classList.remove('hidden');
  endTitle.className = w === 'runners' ? 'runners-win' : 'hots-win';
  endTitle.textContent = w === 'runners' ? '🏃 CORREDORES VENCEM!' : '🔥 HOTS VENCEM!';
  endMessage.textContent = w === 'runners' ? 'O tempo acabou! Pelo menos um corredor sobreviveu!' : 'Todos foram infectados!';
}

// ── Particles ──
function spawnParticle(x, y, color, life, speed, size) {
  const a = Math.random() * Math.PI * 2;
  particles.push({ x, y, vx: Math.cos(a) * Math.random() * speed, vy: Math.sin(a) * Math.random() * speed - 1.5, life, maxLife: life, color, size: size || 3 });
}
function spawnInfectionBurst(x, y) {
  for (let i = 0; i < 25; i++) spawnParticle(x + 14, y + 14, `hsl(${10+Math.random()*30},100%,${50+Math.random()*30}%)`, 35 + Math.random() * 25, 4, 3 + Math.random() * 3);
}
function spawnHotTrail(x, y) {
  if (Math.random() > 0.4) return;
  spawnParticle(x + 14 + (Math.random()-0.5)*10, y + 14, `hsl(${Math.random()*40},100%,${50+Math.random()*30}%)`, 12 + Math.random() * 12, 0.8, 2 + Math.random() * 2);
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ── Camera ──
function updateCamera() {
  const me = players.get(myId);
  if (!me || !gameMap) return;
  const tx = me.x + 14 - canvas.width / 2;
  const ty = me.y + 14 - canvas.height / 2;
  const cx = Math.max(0, Math.min(gameMap.w - canvas.width, tx));
  const cy = Math.max(0, Math.min(gameMap.h - canvas.height, ty));
  camX += (cx - camX) * 0.1;
  camY += (cy - camY) * 0.1;
  if (shakeMag > 0) {
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag;
    shakeMag *= 0.88;
    if (shakeMag < 0.5) shakeMag = 0;
  } else { shakeX = shakeY = 0; }
}

// ── Interpolation ──
function interpolatePlayers() {
  for (const [id, p] of players) {
    const t = targetPos.get(id);
    if (!t) continue;
    p.x += (t.x - p.x) * 0.25;
    p.y += (t.y - p.y) * 0.25;
  }
}

// ── Rendering ──
function render() {
  if (!joined || !gameMap) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camX + shakeX, -camY + shakeY);
  drawFloor();
  drawSpeedZones();
  drawWalls();
  drawTethers();
  drawBoxes3D();
  drawPlayers();
  drawParticles();
  ctx.restore();
  drawMinimap();
}

function drawTethers() {
  for (const b of pushables) {
    if (b.grabbedBy) {
      const p = players.get(b.grabbedBy);
      if (!p) continue;
      const px = p.x + 14;
      const py = p.y + 14;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;

      ctx.save();
      ctx.strokeStyle = p.color || '#00f0ff';
      ctx.shadowColor = p.color || '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawFloor() {
  const T = gameMap.tile;
  const sc = Math.floor(camX / T), sr = Math.floor(camY / T);
  const ec = Math.ceil((camX + canvas.width) / T), er = Math.ceil((camY + canvas.height) / T);

  const hx = 3*T, hy = 2*T, hw = 44*T, hh = 32*T;
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(hx, hy, hw, hh);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
  ctx.lineWidth = 0.5;
  for (let c = sc; c <= ec; c++) { ctx.beginPath(); ctx.moveTo(c*T, sr*T); ctx.lineTo(c*T, er*T); ctx.stroke(); }
  for (let r = sr; r <= er; r++) { ctx.beginPath(); ctx.moveTo(sc*T, r*T); ctx.lineTo(ec*T, r*T); ctx.stroke(); }
}

function drawSpeedZones() {
  for (const z of gameMap.speedZones) {
    const a = 0.07 + Math.sin(Date.now() / 800) * 0.03;
    ctx.fillStyle = z.type === 'boost' ? `rgba(0,240,255,${a})` : `rgba(255,34,68,${a})`;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = z.type === 'boost' ? 'rgba(0,240,255,0.15)' : 'rgba(255,34,68,0.15)';
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.fillStyle = z.type === 'boost' ? 'rgba(0,240,255,0.3)' : 'rgba(255,34,68,0.3)';
    ctx.font = '10px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText(z.label, z.x + z.w/2, z.y + z.h/2 + 4);
  }
}

function drawWalls() {
  for (const w of gameMap.walls) {
    if (w.x + w.w < camX || w.x > camX + canvas.width || w.y + w.h < camY || w.y > camY + canvas.height) continue;
    ctx.fillStyle = '#14102a';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(136, 68, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }
}

function drawBoxes3D() {
  const depth = 10;

  for (const b of pushables) {
    if (b.x + b.w < camX - 20 || b.x > camX + canvas.width + 20 || b.y + b.h < camY - 20 || b.y > camY + canvas.height + 20) continue;

    const isGrabbed = b.grabbedBy !== null;
    const isHover = b.id === hoveringBoxId;
    const sizeColors = {
      S: { top: '#2a6b4a', front: '#1a4a32', side: '#144028', glow: 'rgba(0,255,136,0.3)' },
      M: { top: '#4a6b2a', front: '#324a1a', side: '#284014', glow: 'rgba(180,255,0,0.3)' },
      L: { top: '#6b4a2a', front: '#4a321a', side: '#402814', glow: 'rgba(255,160,0,0.3)' },
    };
    const colors = sizeColors[b.size] || sizeColors.M;

    ctx.save();

    if (isGrabbed) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(b.x + 6, b.y + 6 + depth, b.w, b.h);
    }

    if (isHover || isGrabbed) {
      ctx.shadowColor = isGrabbed ? 'rgba(255,255,0,0.5)' : colors.glow;
      ctx.shadowBlur = isGrabbed ? 20 : 12;
    }

    ctx.fillStyle = colors.side;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w + depth, b.y - depth);
    ctx.lineTo(b.x + b.w + depth, b.y + b.h - depth);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + depth, b.y - depth);
    ctx.lineTo(b.x + b.w + depth, b.y - depth);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = colors.front;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = isGrabbed ? 'rgba(255,255,0,0.6)' : (isHover ? 'rgba(0,255,136,0.5)' : 'rgba(0,255,136,0.25)');
    ctx.lineWidth = isGrabbed ? 2 : 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = 'rgba(0,255,136,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w * 0.3, b.y + 4);
    ctx.lineTo(b.x + b.w * 0.3, b.y + b.h - 4);
    ctx.moveTo(b.x + b.w * 0.7, b.y + 4);
    ctx.lineTo(b.x + b.w * 0.7, b.y + b.h - 4);
    ctx.moveTo(b.x + 4, b.y + b.h * 0.4);
    ctx.lineTo(b.x + b.w - 4, b.y + b.h * 0.4);
    ctx.stroke();

    if (b.w >= 35) {
      ctx.fillStyle = 'rgba(0,255,136,0.2)';
      ctx.font = `bold ${b.w > 45 ? 14 : 10}px Rajdhani`;
      ctx.textAlign = 'center';
      ctx.fillText(b.size === 'S' ? 'P' : b.size === 'M' ? 'M' : 'G', b.x + b.w/2, b.y + b.h/2 + 4);
    }

    ctx.restore();
  }
}

function drawPlayers() {
  for (const [id, p] of players) {
    const isMe = id === myId;
    const sz = 28;
    const cx = p.x + sz/2, cy = p.y + sz/2;

    if (p.isHot) spawnHotTrail(p.x, p.y);

    ctx.save();

    if (p.isHot) {
      ctx.shadowColor = 'rgba(255,34,68,0.6)';
      ctx.shadowBlur = 18 + Math.sin(Date.now() / 200) * 5;
    } else {
      ctx.shadowColor = p.color || '#00f0ff';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, sz/2, 0, Math.PI * 2);

    if (p.isHot) {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      grad.addColorStop(0, '#ffcc00');
      grad.addColorStop(0.5, '#ff4400');
      grad.addColorStop(1, '#cc0022');
      ctx.fillStyle = grad;
    } else {
      const baseColor = p.color || '#00f0ff';
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, baseColor);
      grad.addColorStop(1, darkenColor(baseColor, 0.4));
      ctx.fillStyle = grad;
    }
    ctx.fill();

    ctx.lineWidth = isMe ? 2.5 : 1.5;
    ctx.strokeStyle = isMe ? '#ffffff' : (p.isHot ? '#ff6644' : (p.color || '#44ccff'));
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = p.isHot ? '#ff8866' : (p.color || '#88ddff');
    ctx.font = 'bold 11px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, cx, p.y - 8);

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, sz/2 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMinimap() {
  if (!gameMap) return;
  const mmW = 160, mmH = 120;
  const mx = canvas.width - mmW - 12, my = canvas.height - mmH - 12;
  const sx = mmW / gameMap.w, sy = mmH / gameMap.h;

  ctx.fillStyle = 'rgba(5,5,20,0.8)';
  ctx.fillRect(mx, my, mmW, mmH);
  ctx.strokeStyle = 'rgba(0,240,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mmW, mmH);

  ctx.fillStyle = 'rgba(136,68,255,0.4)';
  for (const w of gameMap.walls) {
    ctx.fillRect(mx + w.x * sx, my + w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy));
  }

  ctx.fillStyle = 'rgba(0,255,136,0.3)';
  for (const b of pushables) {
    ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }

  for (const [id, p] of players) {
    ctx.fillStyle = id === myId ? '#ffffff' : (p.isHot ? '#ff2244' : (p.color || '#00f0ff'));
    ctx.fillRect(mx + p.x * sx - 1, my + p.y * sy - 1, 3, 3);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.strokeRect(mx + camX * sx, my + camY * sy, canvas.width * sx, canvas.height * sy);
}

// ── Game Loop ──
function gameLoop() {
  sendInput();
  interpolatePlayers();
  updateCamera();
  updateParticles();
  render();
  requestAnimationFrame(gameLoop);
}

connect();
requestAnimationFrame(gameLoop);
