/**
 * BraainHot v5 — Client Engine
 * Servidor Único Autorizativo (Máximo 20 jogadores)
 * Com Arma para Corredores (3 tiros seguidos, 5s recarga, reduz velocidade e empurra).
 * Sangue do Hot (100 HP, 3 hits paralisam por 10s).
 * Limite de Arrasto de Caixas (5s de tether max, recarrega solto).
 * Bate-papo por sessão e painel de jogadores.
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

// HUD v5
const weaponHud = document.getElementById('weaponHud');
const energyBar = document.getElementById('energyBar');
const staminaBar = document.getElementById('staminaBar');
const ammoContainer = document.getElementById('ammoContainer');
const reloadAlert = document.getElementById('reloadAlert');

const playerListPanel = document.getElementById('playerListPanel');
const togglePlayerListBtn = document.getElementById('togglePlayerListBtn');
const playerListContent = document.getElementById('playerListContent');

const chatArea = document.getElementById('chatArea');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

// LOJA CYBERPUNK (v7)
const shopPanel = document.getElementById('shopPanel');
const shopCoins = document.getElementById('shopCoins');
const shopItems = document.getElementById('shopItems');

// BOTS MODAL (v9)
const botsModal = document.getElementById('botsModal');
const confirmBotsBtn = document.getElementById('confirmBotsBtn');
const closeBotsBtn = document.getElementById('closeBotsBtn');
const botsNumBtns = document.querySelectorAll('.bots-num-btn');
let selectedBotCount = 0;

// ── Estado ──
let ws = null, myId = null, gameMap = null;
let players = new Map();
let pushables = [];
let activePickups = []; // Itens Cyberpunk v6
let activeCoins = [];   // Moedas Cyberpunk v7
let phase = 'lobby', timer = 0, runnersCount = 0, hotsCount = 0;
let joined = false;
let camX = 0, camY = 0, shakeX = 0, shakeY = 0, shakeMag = 0;
let particles = [];
let laserBeams = []; // Linhas de laser estéticas `{ sx, sy, ex, ey, life, maxLife, color }`
const targetPos = new Map();
const keys = { up: false, down: false, left: false, right: false, shift: false };
let lastInputJson = '';

// ── Áudio ──
let globalVolume = 0.20; // Volume mestre global [0..1]

// Web Audio Synth SFX para Moedas e Compras (v7)
let audioCtx = null;
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
document.addEventListener('click', initAudioContext, { once: true });
document.addEventListener('keydown', initAudioContext, { once: true });

function playCoinSfx() {
  initAudioContext();
  if (!audioCtx || globalVolume <= 0.001) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);
  
  gain.gain.setValueAtTime(globalVolume * 0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.12);
}

function playBuySfx() {
  initAudioContext();
  if (!audioCtx || globalVolume <= 0.001) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(784, audioCtx.currentTime + 0.12);
  
  gain.gain.setValueAtTime(globalVolume * 0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.18);
}

function playMagnetSfx() {
  initAudioContext();
  if (!audioCtx || globalVolume <= 0.001) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(330, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.35);
  
  gain.gain.setValueAtTime(globalVolume * 0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.40);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.40);
}

function playRepelSfx() {
  initAudioContext();
  if (!audioCtx || globalVolume <= 0.001) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.25);
  
  gain.gain.setValueAtTime(globalVolume * 0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.30);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.30);
}

const sfx10s = new Audio('10s.mp3');
sfx10s.volume = globalVolume;
let alert10sFired = false;

// Pool de sons de tiro (suporta rajadas rápidas sem travar)
const SHOT_POOL_SIZE = 6;
const shotPool = Array.from({ length: SHOT_POOL_SIZE }, () => {
  const a = new Audio('shot.mp3');
  a.volume = 0;
  return a;
});
let shotPoolIndex = 0;

function playShotSound(volume) {
  const snd = shotPool[shotPoolIndex % SHOT_POOL_SIZE];
  shotPoolIndex++;
  snd.currentTime = 0;
  // Multiplica o volume calculado pela distância pelo volume global
  snd.volume = Math.max(0, Math.min(1, volume * globalVolume));
  snd.play().catch(() => {});
}

const bgMusic = new Audio('background.mp3');
bgMusic.loop = true;
bgMusic.volume = globalVolume;
let bgMusicStarted = false;

function startBgMusic() {
  if (bgMusicStarted) return;
  bgMusicStarted = true;
  bgMusic.play().catch(() => {});
}

// Inicia a música no primeiro clique/tecla (política de autoplay dos navegadores)
document.addEventListener('click', startBgMusic, { once: true });
document.addEventListener('keydown', startBgMusic, { once: true });

// ── Controle de Volume ──
const volumeSlider = document.getElementById('volumeSlider');
const volumeLabel  = document.getElementById('volumeLabel');
const volumeIcon   = document.getElementById('volumeIcon');

function updateVolumeUI(val) {
  const pct = Math.round(val);
  volumeLabel.textContent = pct + '%';
  volumeIcon.textContent = pct === 0 ? '🔇' : pct < 40 ? '🔉' : '🔊';
  // Preenche a trilha do slider com gradiente neon proporcional
  volumeSlider.style.background =
    `linear-gradient(90deg, #00f0ff ${pct}%, rgba(0,240,255,0.12) ${pct}%)`;
}

volumeSlider.addEventListener('input', () => {
  const val = Number(volumeSlider.value);
  globalVolume = val / 100;
  bgMusic.volume = globalVolume;
  sfx10s.volume = globalVolume;
  // Atualiza em tempo real o volume de todos os tiros instanciados no pool
  for (const a of shotPool) {
    a.volume = globalVolume;
  }
  updateVolumeUI(val);
});

// Inicializa a UI com o valor padrão
updateVolumeUI(20);

// Cores do personagem
const defaultColors = ['#00f0ff','#00ff88','#aa66ff','#ff66cc','#ffcc00','#ff8844','#66ffcc','#88aaff'];
let selectedColor = defaultColors[0];

// Mouse / Drag / Shoot
let mouseScreenX = 0, mouseScreenY = 0;
let mouseDown = false;
let grabbedBoxId = null;
let hoveringBoxId = null;

// Roster state
let isRosterCollapsed = false;

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

// Desabilita o botão inicialmente até o handshake websocket estar aberto
joinBtn.disabled = true;
joinBtn.textContent = 'CONECTANDO AO SERVIDOR...';
joinBtn.style.opacity = '0.5';
joinBtn.style.cursor = 'not-allowed';

// ── Botão Entrar na Arena ──
joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Anon';
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'join', name, color: selectedColor }));
  }
});

// Helper para configurar e abrir o modal de bots com o estado atual pré-selecionado
function openBotsConfigurationModal() {
  if (!botsModal) return;
  botsModal.classList.remove('hidden');
  const currentBotCount = [...players.values()].filter(p => p.isBot).length;
  botsNumBtns.forEach(btn => {
    if (parseInt(btn.dataset.num) === currentBotCount) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
  confirmBotsBtn.disabled = false;
  selectedBotCount = currentBotCount;
}

// ── Bots Modal Listeners ──
if (botsNumBtns && confirmBotsBtn && closeBotsBtn && botsModal) {
  botsNumBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      botsNumBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBotCount = parseInt(btn.dataset.num);
      confirmBotsBtn.disabled = false;
    });
  });

  confirmBotsBtn.addEventListener('click', () => {
    if (selectedBotCount >= 0 && selectedBotCount <= 8) {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'addBots', count: selectedBotCount }));
      }
      botsModal.classList.add('hidden');
    }
  });

  closeBotsBtn.addEventListener('click', () => {
    botsModal.classList.add('hidden');
  });

  const openBotsBtn = document.getElementById('openBotsBtn');
  if (openBotsBtn) {
    openBotsBtn.addEventListener('click', () => {
      const humans = [...players.values()].filter(p => !p.isBot);
      if (joined && humans.length === 1) {
        openBotsConfigurationModal();
      }
    });
  }
}

// ── Roster Collapse/Expand ──
togglePlayerListBtn.addEventListener('click', () => {
  isRosterCollapsed = !isRosterCollapsed;
  if (isRosterCollapsed) {
    playerListPanel.classList.add('collapsed');
    togglePlayerListBtn.textContent = '[+]';
  } else {
    playerListPanel.classList.remove('collapsed');
    togglePlayerListBtn.textContent = '[-]';
  }
});

// ── Chat Key Interceptions ──
window.addEventListener('keydown', e => {
  // Pressionar ENTER foca o input de chat ou envia mensagem
  if (e.key === 'Enter') {
    if (document.activeElement === chatInput) {
      const txt = chatInput.value.trim();
      if (txt && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'chat', text: txt }));
      }
      chatInput.value = '';
      chatInput.blur();
    } else if (joined && document.activeElement !== nameInput) {
      chatInput.focus();
      e.preventDefault();
    }
  }

  // Ignora movimento se estiver digitando em inputs
  if (document.activeElement === nameInput || document.activeElement === chatInput) return;

  // Tecla B para abrir o modal de bots
  if (e.key === 'b' || e.key === 'B') {
    const humans = [...players.values()].filter(p => !p.isBot);
    if (joined && humans.length === 1) {
      openBotsConfigurationModal();
    }
    e.preventDefault();
    return;
  }

  // Atalhos de compra rápida da Cyber-Loja (teclas 1 a 9)
  if (e.key >= '1' && e.key <= '9') {
    const me = players.get(myId);
    if (me && joined && ws && ws.readyState === 1) {
      const shopItemsContainer = document.getElementById('shopItems');
      if (shopItemsContainer) {
        const index = parseInt(e.key) - 1;
        const itemDiv = shopItemsContainer.children[index];
        if (itemDiv && !itemDiv.classList.contains('disabled')) {
          const itemId = itemDiv.dataset.id;
          ws.send(JSON.stringify({ type: 'buyItem', itemId }));
        }
      }
    }
    e.preventDefault();
    return;
  }

  // Recarga manual rápida com a tecla R
  if (e.key === 'r' || e.key === 'R') {
    if (ws && ws.readyState === 1 && joined) {
      ws.send(JSON.stringify({ type: 'reload' }));
    }
    e.preventDefault();
    return;
  }

  // Ativação de poderes nos slots Q e E
  if (e.key === 'q' || e.key === 'Q') {
    if (ws && ws.readyState === 1 && joined) {
      ws.send(JSON.stringify({ type: 'activatePower', slot: 'Q' }));
    }
    e.preventDefault();
    return;
  }
  if (e.key === 'e' || e.key === 'E') {
    if (ws && ws.readyState === 1 && joined) {
      ws.send(JSON.stringify({ type: 'activatePower', slot: 'E' }));
    }
    e.preventDefault();
    return;
  }

  // Intercepta Shift para Correr
  if (e.key === 'Shift') {
    keys.shift = true;
    e.preventDefault();
  }

  const k = keyMap[e.key];
  if (k) { keys[k] = true; e.preventDefault(); }
});

window.addEventListener('keyup', e => {
  if (document.activeElement === nameInput || document.activeElement === chatInput) return;

  // Intercepta soltura do Shift
  if (e.key === 'Shift') {
    keys.shift = false;
    e.preventDefault();
  }

  const k = keyMap[e.key];
  if (k) { keys[k] = false; e.preventDefault(); }
});

const keyMap = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  w:'up', W:'up', s:'down', S:'down', a:'left', A:'left', d:'right', D:'right'
};

function sendInput() {
  if (!ws || ws.readyState !== 1 || !joined) return;
  // Se chat estiver focado, zera inputs de andar
  if (document.activeElement === chatInput) {
    keys.up = keys.down = keys.left = keys.right = false;
  }
  const json = JSON.stringify(keys);
  if (json !== lastInputJson) {
    ws.send(JSON.stringify({ type: 'input', ...keys }));
    lastInputJson = json;
  }
}

// ── Mouse & Shoot (v5) ──
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

  // 1. Tentar arrastar caixa
  let clickedBox = false;
  for (const b of pushables) {
    if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
      const me = players.get(myId);
      // Se tiver energia mínima
      if (me && me.holdEnergy > 30) {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'grab', boxId: b.id }));
          grabbedBoxId = b.id;
          canvas.classList.add('grabbing');
          grabHint.classList.remove('hidden');
        }
      }
      clickedBox = true;
      break;
    }
  }

  // 2. Se não clicou em caixa, atira com arma neon!
  if (!clickedBox) {
    const me = players.get(myId);
    if (me && !me.isHot && me.reloadTimer === 0 && me.ammo > 0) {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'shoot', tx: wx, ty: wy }));
      }
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
  ws.onopen = () => {
    console.log('Conectado ao Servidor Único');
    joinBtn.disabled = false;
    joinBtn.textContent = 'ENTRAR NA ARENA';
    joinBtn.style.opacity = '1';
    joinBtn.style.cursor = 'pointer';
  };
  ws.onmessage = e => handleMessage(JSON.parse(e.data));
  ws.onclose = () => {
    joined = false;
    joinBtn.disabled = true;
    joinBtn.textContent = 'CONECTANDO AO SERVIDOR...';
    joinBtn.style.opacity = '0.5';
    joinBtn.style.cursor = 'not-allowed';
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
      activePickups = msg.pickups || []; // Carrega pickups já presentes no mapa
      activeCoins = msg.coins || [];     // Carrega moedas já presentes no mapa
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
      if (msg.pickups !== undefined) activePickups = msg.pickups; // Captura drops v6!
      if (msg.coins !== undefined) activeCoins = msg.coins;     // Captura moedas v7!

      const ids = new Set();
      for (const sp of msg.players) {
        ids.add(sp.id);
        targetPos.set(sp.id, { x: sp.x, y: sp.y });
        const ex = players.get(sp.id);
        if (ex) {
          Object.assign(ex, sp); // Copia todas as novas mecânicas (ammo, health, energy, e buffs!)
        } else {
          players.set(sp.id, { ...sp });
        }
      }
      for (const [id] of players) {
        if (!ids.has(id)) { players.delete(id); targetPos.delete(id); }
      }
      updateHUD();
      updateWeaponHud();
      updatePlayerList();
      break;

    case 'phaseChange':
      phase = msg.phase; timer = msg.timer || 0;
      if (msg.map) { gameMap = msg.map; pushables = msg.map.pushables; }
      // Limpa pickups ao mudar para lobby/warmup
      if (phase === 'lobby' || phase === 'warmup') {
        activePickups = [];
        activeCoins = [];
      }
      // Reseta flag do alerta de 10s a cada nova partida
      alert10sFired = false;
      endScreen.classList.add('hidden');
      hotSelectScreen.classList.add('hidden');
      if (phase === 'ingame') {
        if (msg.hotAlphaIds && msg.hotAlphaIds.length > 0) {
          showHotSelect(msg.hotAlphaIds);
        } else if (msg.hotAlphaId) {
          showHotSelect([msg.hotAlphaId]);
        }
      }
      updateHUD();
      break;

    case 'playerJoined':
      players.set(msg.player.id, msg.player);
      targetPos.set(msg.player.id, { x: msg.player.x, y: msg.player.y });
      updatePlayerList();
      break;

    case 'playerLeft':
      players.delete(msg.id); targetPos.delete(msg.id);
      updatePlayerList();
      break;

    case 'infected':
      addFeedItem(`🔥 ${msg.byName} infectou ${msg.name}!`);
      shakeMag = 10;
      const inf = players.get(msg.playerId);
      if (inf) spawnInfectionBurst(inf.x, inf.y);
      break;

    case 'stunned':
      addFeedItem(`⚡ ${msg.name} (HOT) foi PARALISADO por 10 segundos!`);
      shakeMag = 14;
      const st = players.get(msg.playerId);
      if (st) spawnStunBurst(st.x, st.y);
      break;

    case 'bulletTraced':
      // Adiciona linha de laser neon de disparo
      laserBeams.push({
        sx: msg.sx, sy: msg.sy,
        ex: msg.ex, ey: msg.ey,
        life: 18, maxLife: 18,
        color: msg.color || '#00f0ff'
      });
      // Partículas no ponto de impacto
      spawnImpactSpark(msg.ex, msg.ey, msg.color || '#00f0ff');

      // Som de tiro com volume proporcional à distância do atirador
      {
        const me = players.get(myId);
        if (me) {
          const dx = msg.sx - (me.x + 14);
          const dy = msg.sy - (me.y + 14);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const MAX_HEAR_DIST = 600; // pixels — além disso não ouve nada
          const vol = Math.max(0, 1 - dist / MAX_HEAR_DIST) * 0.7;
          if (vol > 0.01) playShotSound(vol);
        } else {
          // Próprio atirador antes de receber posição — toca no volume máximo
          playShotSound(0.7);
        }
      }
      break;

    case 'chat':
      appendChatMessage(msg.name, msg.color, msg.text);
      break;

    case 'itemSpawned':
      spawnImpactSpark(msg.item.x + 10, msg.item.y + 10, '#00ff88');
      break;

    case 'coinSpawned':
      spawnImpactSpark(msg.coin.x + 8, msg.coin.y + 8, '#ffcc00');
      break;

    case 'coinCollected':
      activeCoins = activeCoins.filter(c => c.id !== msg.coinId);
      const collector = players.get(msg.playerId);
      if (collector) {
        for (let k = 0; k < 15; k++) {
          spawnParticle(collector.x + 14, collector.y + 14, '#ffcc00', 20 + Math.random()*15, 3.5);
        }
      }
      addFeedItem(`🪙 ${msg.playerName} coletou uma Moeda Dourada!`);
      playCoinSfx();
      break;

    case 'itemBought':
      if (msg.playerId === myId) {
        addFeedItem(`🛒 Compra efetuada com sucesso!`);
        playBuySfx();
        if (msg.itemId === 'magnetic') {
          playMagnetSfx();
        }
      }
      const buyer = players.get(msg.playerId);
      if (buyer) {
        for (let k = 0; k < 25; k++) {
          spawnParticle(buyer.x + 14, buyer.y + 14, '#00f0ff', 25 + Math.random()*15, 4.5);
        }
      }
      break;

    case 'powerActivated':
      if (msg.playerId === myId) {
        if (msg.powerType === 'repel') playRepelSfx();
      }
      break;

    case 'collected':
      const itemNames = {
        speed: 'SUPER VELOCIDADE ⚡ (+40%)',
        machinegun: 'METRALHADORA BURST 🔫 (Rajada Tripla)',
        shield: 'ESCUDO DE PLASMA 🛡️ (Absorve infecção)',
        supernova: 'SUPERNOVA 🔥 (Calor & Velocidade)',
        gravity: 'AURA GRAVITACIONAL 🕸️ (Lentidão em área)',
        invisibility: 'CAMUFLAGEM HOLOGRÁFICA 👤 (Fique Invisível)',
        emp: 'PULSO CYBER EMP ⚡ (Desativa armas/tether dos corredores)',
        overdrive: 'CANHÃO OVERDRIVE 🔫 (Munição Infinita & Sem Recarga!)',
        tracker: 'RASTREADOR TÉRMICO 🎯 (Revela todos os corredores!)',
        repel: 'PULSO REPULSOR 🛡️ (Empurra Hots ao redor)',
        magnetic: 'VÓRTEX MAGNÉTICO 🧲 (Puxa tudo ao redor)'
      };
      const label = itemNames[msg.itemType] || 'ITEM ESPECIAL';
      addFeedItem(`🎉 ${msg.playerName} coletou ${label}!`);
      
      const itemColors = { speed: '#00ff88', machinegun: '#ffcc00', shield: '#00f0ff', supernova: '#ff2244', gravity: '#aa66ff', invisibility: '#ffffff', emp: '#ff00ff', overdrive: '#ff3300', tracker: '#ff5555', repel: '#00d2ff', magnetic: '#aa00ff' };
      const col = itemColors[msg.itemType] || '#ffffff';

      if (msg.playerId === myId) {
        if (msg.itemType === 'magnetic') playMagnetSfx();
      }
      
      // Burst de partículas de feedback de coleta no player
      const cp = players.get(msg.playerId);
      if (cp) {
        for (let k = 0; k < 25; k++) {
          spawnParticle(cp.x + 14, cp.y + 14, col, 25 + Math.random()*20, 5, 2.5);
        }
      }
      break;

    case 'shieldPopped':
      addFeedItem(`🛡️ O Escudo de ${msg.runnerName} estourou e empurrou ${msg.hotName}!`);
      shakeMag = 18;
      const rp = players.get(msg.runnerId);
      if (rp) {
        // Shockwave de partículas azul neon de escudo
        for (let k = 0; k < 40; k++) {
          spawnParticle(rp.x + 14, rp.y + 14, '#00f0ff', 35 + Math.random()*25, 7, 3);
        }
      }
      break;

    case 'offerBots':
      openBotsConfigurationModal();
      break;

    case 'gameOver':
      showEndScreen(msg.winner);
      break;

    case 'error':
      alert(msg.message);
      break;
  }
}

// ── UI Screens ──
function showGame() {
  lobbyEl.style.display = 'none';
  canvas.style.display = 'block';
  hudEl.classList.remove('hidden');
  weaponHud.classList.remove('hidden');
  playerListPanel.classList.remove('hidden');
  chatArea.classList.remove('hidden');
  endScreen.classList.add('hidden');
  hotSelectScreen.classList.add('hidden');
  joined = true;
  updateHUD();
  chatMessages.innerHTML = ''; // Limpa mensagens anteriores
}

function showLobbyScreen() {
  lobbyEl.style.display = 'flex';
  canvas.style.display = 'none';
  hudEl.classList.add('hidden');
  weaponHud.classList.add('hidden');
  playerListPanel.classList.add('hidden');
  chatArea.classList.add('hidden');
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

  // Alerta sonoro dos 10 segundos finais da partida
  if (phase === 'ingame' && timer <= 10 && timer > 0 && !alert10sFired) {
    alert10sFired = true;
    sfx10s.currentTime = 0;
    sfx10s.play().catch(() => {}); // Silencia erros de autoplay
  }
}

// ── Atualização do Weapon HUD (v5) ──
function updateWeaponHud() {
  const me = players.get(myId);
  if (!me) return;

  // Mostra o HUD para ambos os papéis (Corredores e Hots)
  weaponHud.classList.remove('hidden');

  // 1. Tether Energy Bar (0-300 ticks)
  const energyPercent = (me.holdEnergy / 300) * 100;
  energyBar.style.width = `${energyPercent}%`;

  // 2. Estamina Bar (0-600 ticks)
  if (staminaBar) {
    const staminaPercent = ((me.stamina || 0) / 600) * 100;
    staminaBar.style.width = `${staminaPercent}%`;
  }

  // 2. Estilização e lógica baseadas no papel (Hot vs Runner)
  const ammoRow = ammoContainer.parentElement;
  if (me.isHot) {
    // Hot: esconde a arma e o alerta de recarga
    ammoRow.classList.add('hidden');
    reloadAlert.classList.add('hidden');

    // Estilo vermelho/laranja neon de calor
    energyBar.style.background = 'linear-gradient(90deg, #ff2244, #ff6600)';
    energyBar.style.boxShadow = '0 0 10px rgba(255,34,68,0.5)';
  } else {
    // Runner: exibe a munição da arma
    ammoRow.classList.remove('hidden');

    // Cor baseada na energia (cyan/green ou vermelho se estiver crítica)
    if (energyPercent < 20) {
      energyBar.style.background = 'linear-gradient(90deg, #ff2244, #ff6600)';
      energyBar.style.boxShadow = '0 0 10px rgba(255,34,68,0.5)';
    } else {
      energyBar.style.background = 'linear-gradient(90deg, #00f0ff, #00ff88)';
      energyBar.style.boxShadow = '0 0 10px rgba(0,240,255,0.4)';
    }

    // Ammo ticks (3 ticks)
    ammoContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const tick = document.createElement('div');
      tick.className = 'ammo-tick' + (i < me.ammo ? ' active' : '');
      ammoContainer.appendChild(tick);
    }

    // Reload indicator
    if (me.reloadTimer > 0) {
      const secs = (me.reloadTimer / 60).toFixed(1);
      reloadAlert.textContent = `RECARREGANDO (${secs}s)...`;
      reloadAlert.classList.remove('hidden');
    } else {
      reloadAlert.classList.add('hidden');
    }
  }

  // 3. Atualiza os Slots de Inventário de Poderes (Q & E)
  const slotQEl = document.getElementById('slotQ');
  const slotEEl = document.getElementById('slotE');
  
  if (slotQEl && slotEEl) {
    if (me.isHot) {
      // Oculta o container do inventário se for Pegador
      slotQEl.parentElement.parentElement.classList.add('hidden');
    } else {
      slotQEl.parentElement.parentElement.classList.remove('hidden');
      
      const powerLabels = {
        phaseshift: { name: 'PHASE', desc: 'Passa paredes' },
        blink: { name: 'BLINK', desc: 'Teleporte' },
        speed: { name: 'SPEED', desc: 'Velocidade' },
        machinegun: { name: 'BURST', desc: 'Rajada' },
        shield: { name: 'SHIELD', desc: 'Escudo' },
        invisibility: { name: 'CLOAK', desc: 'Invisível' },
        repel: { name: 'REPEL', desc: 'Repulsor' }
      };

      const updateSlot = (el, powerKey) => {
        el.className = 'inventory-slot';
        if (powerKey) {
          el.classList.add('active', powerKey);
          const cfg = powerLabels[powerKey] || { name: powerKey.toUpperCase(), desc: 'POWERUP' };
          el.querySelector('.inventory-slot-label').textContent = cfg.name;
          el.querySelector('.inventory-slot-desc').textContent = cfg.desc;
        } else {
          el.querySelector('.inventory-slot-label').textContent = 'VAZIO';
          el.querySelector('.inventory-slot-desc').textContent = 'Vazio';
        }
      };
      
      updateSlot(slotQEl, me.slotQ);
      updateSlot(slotEEl, me.slotE);
    }
  }

  // 3.5. Atualiza os atalhos com base no papel (Corredor vs Pegador)
  const shortcutsEl = document.querySelector('.hud-shortcuts');
  if (shortcutsEl) {
    if (me.isHot) {
      shortcutsEl.innerHTML = `
        <span class="shortcut-badge">⚡ [SHIFT] CORRER</span>
        <span class="shortcut-badge">🔥 TOQUE PARA CONTAMINAR</span>
      `;
    } else {
      shortcutsEl.innerHTML = `
        <span class="shortcut-badge">⚡ [SHIFT] CORRER</span>
        <span class="shortcut-badge">🔫 [R] RECARGA (2.5s)</span>
        <span class="shortcut-badge">🌀 [Q] PODER 1</span>
        <span class="shortcut-badge">⚡ [E] PODER 2</span>
      `;
    }
  }

  // 4. Atualiza a Cyber-Loja lateral
  updateShopUI();
}

let currentShopRole = null;
function updateShopUI() {
  const me = players.get(myId);
  if (!me || !joined) {
    shopPanel.classList.add('hidden');
    return;
  }

  shopPanel.classList.remove('hidden');
  shopCoins.textContent = `🪙 ${me.coins || 0}`;

  const myRole = me.isHot ? 'hot' : 'runner';
  if (currentShopRole !== myRole) {
    currentShopRole = myRole;
    shopItems.innerHTML = '';

    const runnerItems = [
      { id: 'speed', name: '⚡ VELOCIDADE', desc: 'Super Velocidade (+40%)', price: 3 },
      { id: 'blink', name: '⚡ BLINK', desc: 'Teleporte Curto (160px)', price: 3 },
      { id: 'shield', name: '🛡️ PLASMA SHIELD', desc: 'Escudo Protetor', price: 4 },
      { id: 'repel', name: '🛡️ PULSO REPULSOR', desc: 'Repele Hots ao Redor (6s)', price: 4 },
      { id: 'machinegun', name: '🔫 BURST LASER', desc: 'Metralhadora Burst', price: 4 },
      { id: 'phaseshift', name: '🌀 PHASE SHIFT', desc: 'Atravessa Paredes (4s)', price: 5 },
      { id: 'invisibility', name: '👤 CHAMELEON', desc: 'Invisibilidade (12s)', price: 5 },
    ];

    const hotItems = [
      { id: 'speed', name: '⚡ VELOCIDADE', desc: 'Super Velocidade (+40%)', price: 3 },
      { id: 'tracker', name: '🎯 THERMAL RADAR', desc: 'Mira Neon Lock-On (10s)', price: 3 },
      { id: 'gravity', name: '🕸️ AURA GRAVIDADE', desc: 'Desacelera Corredores', price: 4 },
      { id: 'magnetic', name: '🧲 VÓRTEX MAGNET', desc: 'Puxa Corredores e Caixas (8s)', price: 4 },
      { id: 'supernova', name: '🔥 SUPERNOVA', desc: 'Raio Contágio Ampliado', price: 4 },
      { id: 'emp', name: '⚡ EMP HACK', desc: 'Desativa Armas/Tethers', price: 5 },
    ];

    const items = me.isHot ? hotItems : runnerItems;

    let itemIdx = 1;
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.dataset.id = item.id;
      row.dataset.price = item.price;

      const info = document.createElement('div');
      info.className = 'shop-item-info';

      const name = document.createElement('span');
      name.className = 'shop-item-name';
      
      const badge = document.createElement('span');
      badge.className = 'shop-item-badge';
      badge.textContent = `[${itemIdx++}] `;
      
      name.appendChild(badge);
      name.appendChild(document.createTextNode(item.name));

      const desc = document.createElement('span');
      desc.className = 'shop-item-desc';
      desc.textContent = item.desc;

      info.appendChild(name);
      info.appendChild(desc);

      const price = document.createElement('span');
      price.className = 'shop-item-price';
      price.textContent = `🪙 ${item.price}`;

      row.appendChild(info);
      row.appendChild(price);

      row.addEventListener('click', () => {
        if (row.classList.contains('disabled')) return;
        ws.send(JSON.stringify({ type: 'buyItem', itemId: item.id }));
      });

      shopItems.appendChild(row);
    }
  }

  // Atualiza habilitado/desabilitado dos itens
  const myCoins = me.coins || 0;
  const slotsFull = !me.isHot && me.slotQ && me.slotE;

  for (const itemDiv of shopItems.children) {
    const price = parseInt(itemDiv.dataset.price);
    if (myCoins < price || slotsFull) {
      itemDiv.classList.add('disabled');
    } else {
      itemDiv.classList.remove('disabled');
    }
  }
}

// ── Lista de Jogadores Dinâmica (v5) ──
function updatePlayerList() {
  if (!joined) return;
  playerListContent.innerHTML = '';

  for (const [, p] of players) {
    const row = document.createElement('div');
    row.className = 'player-row';

    const top = document.createElement('div');
    top.className = 'player-row-top';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-row-name';
    nameSpan.style.color = p.color;
    nameSpan.textContent = (p.isBot ? '🤖 ' : '') + p.name + (p.id === myId ? ' (Você)' : '');
    top.appendChild(nameSpan);

    const statusSpan = document.createElement('span');
    statusSpan.className = 'player-row-status';
    if (p.isStunned) {
      statusSpan.textContent = '⚡ REINICIANDO';
      statusSpan.className += ' status-tag-stunned';
    } else if (p.isHot) {
      statusSpan.textContent = '🔥 PEGADOR';
      statusSpan.className += ' status-tag-hot';
    } else {
      statusSpan.textContent = '🏃 CORREDOR';
      statusSpan.className += ' status-tag-runner';
    }
    top.appendChild(statusSpan);
    row.appendChild(top);

    // Se for Hot, exibe sua barra de vida (HP)
    if (p.isHot) {
      const barOuter = document.createElement('div');
      barOuter.className = 'hp-bar-outer';
      const barInner = document.createElement('div');
      barInner.className = 'hp-bar-inner';
      barInner.style.width = `${p.health || 0}%`;
      barOuter.appendChild(barInner);
      row.appendChild(barOuter);
    }

    playerListContent.appendChild(row);
  }

  // Só exibe o rodapé de adicionar bots se houver exatamente 1 humano na sala
  const humans = [...players.values()].filter(p => !p.isBot);
  const openBotsBtn = document.getElementById('openBotsBtn');
  if (openBotsBtn) {
    const footer = openBotsBtn.parentElement;
    if (humans.length === 1) {
      footer.style.display = 'block';
    } else {
      footer.style.display = 'none';
    }
  }
}

// ── Bate-Papo por Sessão (v5) ──
function appendChatMessage(name, color, text) {
  const row = document.createElement('div');
  row.className = 'chat-msg-row';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'chat-msg-name';
  nameSpan.style.color = color || '#00f0ff';
  nameSpan.textContent = `${name}: `;

  const textSpan = document.createElement('span');
  textSpan.className = 'chat-msg-text';
  textSpan.textContent = text;

  row.appendChild(nameSpan);
  row.appendChild(textSpan);
  chatMessages.appendChild(row);

  // Auto scroll para o rodapé
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addFeedItem(text) {
  const div = document.createElement('div');
  div.className = 'feed-item'; div.textContent = text;
  hudFeed.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 3000);
  if (hudFeed.children.length > 5) hudFeed.firstChild.remove();
}

function showHotSelect(hotIds) {
  if (!Array.isArray(hotIds)) hotIds = [hotIds];
  const names = hotIds.map(id => {
    const p = players.get(id);
    return p ? p.name : '???';
  });
  
  const titleEl = document.querySelector('.hot-select-content h2');
  if (titleEl) {
    titleEl.textContent = names.length > 1 ? 'HOTS ALFAS SELECIONADOS' : 'HOT ALFA SELECIONADO';
  }
  
  hotSelectName.textContent = names.join(' & ');
  hotSelectScreen.classList.remove('hidden');
  setTimeout(() => hotSelectScreen.classList.add('hidden'), 3500);
}

function showEndScreen(w) {
  endScreen.classList.remove('hidden');
  endTitle.className = w === 'runners' ? 'runners-win' : 'hots-win';
  endTitle.textContent = w === 'runners' ? '🏃 CORREDORES VENCEM!' : '🔥 HOTS VENCEM!';
  endMessage.textContent = w === 'runners' ? 'O tempo acabou! Pelo menos um corredor sobreviveu!' : 'Todos foram infectados!';
}

// ── Particles & Lasers ──
function spawnParticle(x, y, color, life, speed, size) {
  const a = Math.random() * Math.PI * 2;
  particles.push({ x, y, vx: Math.cos(a) * Math.random() * speed, vy: Math.sin(a) * Math.random() * speed - 1.5, life, maxLife: life, color, size: size || 3 });
}
function spawnInfectionBurst(x, y) {
  for (let i = 0; i < 25; i++) spawnParticle(x + 14, y + 14, `hsl(${10+Math.random()*30},100%,${50+Math.random()*30}%)`, 35 + Math.random() * 25, 4, 3 + Math.random() * 3);
}
function spawnStunBurst(x, y) {
  for (let i = 0; i < 35; i++) spawnParticle(x + 14, y + 14, `hsl(280,100%,${60+Math.random()*20}%)`, 45 + Math.random() * 35, 6, 2.5 + Math.random() * 3);
}
function spawnImpactSpark(x, y, color) {
  for (let i = 0; i < 8; i++) spawnParticle(x, y, color, 15 + Math.random() * 15, 3, 1.5 + Math.random() * 1.5);
}
function spawnHotTrail(x, y) {
  if (Math.random() > 0.4) return;
  spawnParticle(x + 14 + (Math.random()-0.5)*10, y + 14, `hsl(${Math.random()*40},100%,${50+Math.random()*30}%)`, 12 + Math.random() * 12, 0.8, 2 + Math.random() * 2);
}
function spawnStunTrail(x, y) {
  if (Math.random() > 0.3) return;
  spawnParticle(x + 14 + (Math.random()-0.5)*10, y + 14, `hsl(280,100%,70%)`, 15 + Math.random() * 15, 0.5, 2 + Math.random() * 2);
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Atualizar lasers estéticos
  for (let i = laserBeams.length - 1; i >= 0; i--) {
    const b = laserBeams[i];
    b.life--;
    if (b.life <= 0) laserBeams.splice(i, 1);
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
  drawPickups(); // Desenha itens dropados cyberpunk v6
  drawCoins();   // Desenha as moedas 3D cyberpunk v7
  drawPlayers();
  drawLasers();
  drawParticles();
  ctx.restore();
  drawMinimap();
}

function drawLasers() {
  for (const b of laserBeams) {
    ctx.save();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 4 * (b.life / b.maxLife);
    ctx.shadowBlur = 10;
    ctx.shadowColor = b.color;
    ctx.beginPath();
    ctx.moveTo(b.sx, b.sy);
    ctx.lineTo(b.ex, b.ey);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 * (b.life / b.maxLife);
    ctx.stroke();
    ctx.restore();
  }
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

  const hx = 3*T, hy = 3*T, hw = 62*T, hh = 44*T;
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

// ── Desenhar Drops de Itens Cyberpunk v6 ──
function drawPickups() {
  for (const pk of activePickups) {
    const cx = pk.x + 10;
    const cy = pk.y + 10;
    
    // Animação de flutuação e rotação
    const floatOffset = Math.sin(Date.now() / 250 + pk.x) * 4;
    const rotateAngle = (Date.now() / 600) % (Math.PI * 2);
    
    // Configurações de cores baseadas no tipo
    const types = {
      speed: { label: '⚡ SPEED', color: '#00ff88' },
      machinegun: { label: '🔫 BURST', color: '#ffcc00' },
      shield: { label: '🛡️ SHIELD', color: '#00f0ff' },
      supernova: { label: '🔥 OVRDRV', color: '#ff2244' },
      gravity: { label: '🕸️ SLOW', color: '#aa66ff' },
      invisibility: { label: '👤 STEALTH', color: '#ffffff' },
      emp: { label: '⚡ EMP', color: '#ff00ff' },
      overdrive: { label: '🔫 OVRDRV', color: '#ff3300' },
      tracker: { label: '🎯 RADAR', color: '#ff5555' },
      phaseshift: { label: '🌀 PHASE', color: '#00ff88' },
      blink: { label: '⚡ BLINK', color: '#ff00ff' }
    };
    const cfg = types[pk.type] || types.speed;
    
    ctx.save();
    ctx.translate(cx, cy + floatOffset);
    ctx.rotate(rotateAngle);
    
    // Caixa 3D rotacionada
    ctx.shadowBlur = 15;
    ctx.shadowColor = cfg.color;
    ctx.fillStyle = cfg.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeRect(-8, -8, 16, 16);
    
    // Detalhe interno do cubo holográfico
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-4, -4, 8, 8);
    
    ctx.restore();
    
    // Texto flutuante
    ctx.save();
    ctx.fillStyle = cfg.color;
    ctx.font = 'bold 9px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.label, cx, pk.y - 12 + floatOffset);
    ctx.restore();
  }
}

// ── Desenhar Moedas Cyberpunk v7 ──
function drawCoins() {
  for (const c of activeCoins) {
    const cx = c.x + 8;
    const cy = c.y + 8;
    
    // Animação de flutuação e rotação 3D vertical
    const floatOffset = Math.sin(Date.now() / 200 + c.x) * 3;
    const rotateScale = Math.sin(Date.now() / 300);
    
    ctx.save();
    ctx.translate(cx, cy + floatOffset);
    ctx.scale(Math.abs(rotateScale) < 0.15 ? 0.15 : rotateScale, 1);
    
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffcc00';
    ctx.fillStyle = '#ffcc00';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Detalhe interno da moeda
    ctx.strokeStyle = '#e5a900';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 2.5);
    
    ctx.restore();
  }
}

function drawPlayers() {
  for (const [id, p] of players) {
    const isMe = id === myId;
    const sz = 28;
    const cx = p.x + sz/2, cy = p.y + sz/2;

    // --- Efeito de Rastreador Térmico (Radar Lock-On para Hots) ---
    const myPlayer = players.get(myId);
    if (myPlayer && myPlayer.isHot && myPlayer.trackerTimer > 0 && !p.isHot) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 34, 68, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 10;
      
      // Mira quadrada principal
      ctx.strokeRect(cx - sz/2 - 4, cy - sz/2 - 4, sz + 8, sz + 8);
      
      // Cantos de mira cyberpunk reticular
      ctx.fillStyle = '#ff2244';
      ctx.fillRect(cx - sz/2 - 6, cy - sz/2 - 6, 6, 2);
      ctx.fillRect(cx - sz/2 - 6, cy - sz/2 - 6, 2, 6);
      ctx.fillRect(cx + sz/2, cy - sz/2 - 6, 6, 2);
      ctx.fillRect(cx + sz/2 + 4, cy - sz/2 - 6, 2, 6);
      ctx.fillRect(cx - sz/2 - 6, cy + sz/2 + 4, 6, 2);
      ctx.fillRect(cx - sz/2 - 6, cy + sz/2, 2, 6);
      ctx.fillRect(cx + sz/2, cy + sz/2 + 4, 6, 2);
      ctx.fillRect(cx + sz/2 + 4, cy + sz/2, 2, 6);

      // Linha guia tracejada Hot -> Corredor
      ctx.strokeStyle = 'rgba(255, 34, 68, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(myPlayer.x + 14, myPlayer.y + 14);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    }

    // --- Efeito de Camuflagem Holográfica (Invisibilidade) ---
    const isInvisible = p.invisibilityTimer > 0;
    if (isInvisible && !isMe) {
      // Outros jogadores só veem um vulto muito sutil sem nome/tags
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.arc(cx, cy, sz/2, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#00f0ff';
      ctx.fill();
      ctx.strokeStyle = p.color || '#44ccff';
      ctx.stroke();
      ctx.restore();
      continue; // Ignora o resto do desenho (nome, tether, buffs, etc.)
    }

    // --- Partículas de Trails de Itens/Buffs v6 ---
    if (p.isHot && !p.isStunned) spawnHotTrail(p.x, p.y);
    if (p.isStunned) spawnStunTrail(p.x, p.y);
    
    // Rastro verde de Super Velocidade
    if (p.speedBoostTimer > 0 && Math.random() > 0.5) {
      spawnParticle(p.x + 14 + (Math.random()-0.5)*12, p.y + 14, '#00ff88', 12, 0.5, 1.5);
    }
    // Rastro ciano e verde de Phase Shift (Atravessar Parede)
    if (p.phaseshiftTimer > 0 && Math.random() > 0.4) {
      spawnParticle(p.x + 14 + (Math.random()-0.5)*12, p.y + 14, '#00ff88', 12, 0.5, 2);
    }
    // Rastro flamejante de Supernova para o Hot
    if (p.isHot && p.supernovaTimer > 0) {
      for (let k = 0; k < 2; k++) {
        spawnParticle(p.x + 14 + (Math.random()-0.5)*15, p.y + 14, '#ffcc00', 16, 1.2, 2.5);
      }
    }

    // --- Efeitos Visuais no Canvas (Auras e Escudos) v6 ---
    // 1. Aura Gravitacional do Hot (160px de raio roxo neon)
    if (p.isHot && p.gravityTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(170,102,255,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 10]);
      ctx.shadowColor = '#aa66ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Partículas roxas sugadas para o centro
      if (Math.random() > 0.6) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * 100;
        const px_part = cx + Math.cos(angle) * radius;
        const py_part = cy + Math.sin(angle) * radius;
        particles.push({
          x: px_part, y: py_part,
          vx: -Math.cos(angle) * 1.5, vy: -Math.sin(angle) * 1.5,
          life: 30, maxLife: 30,
          color: '#aa66ff', size: 1.5
        });
      }
    }

    // 2. Aura Cyber EMP do Hot (200px de raio magenta neon)
    if (p.isHot && p.empTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,0,255,0.3)';
      ctx.lineWidth = 3 + Math.sin(Date.now() / 80) * 1.5;
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, 200, 0, Math.PI * 2);
      ctx.stroke();

      // Desenha pequenos raios elétricos no raio de 200px
      for (let k = 0; k < 3; k++) {
        const angle = Math.random() * Math.PI * 2;
        const rStart = sz/2;
        const rEnd = 200;
        ctx.strokeStyle = 'rgba(255,100,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        let lx = cx + Math.cos(angle) * rStart;
        let ly = cy + Math.sin(angle) * rStart;
        ctx.moveTo(lx, ly);
        
        const steps = 4;
        for (let s = 1; s <= steps; s++) {
          const stepR = rStart + (rEnd - rStart) * (s / steps);
          const deviation = (Math.random() - 0.5) * 40;
          const sx_lightning = cx + Math.cos(angle) * stepR + Math.sin(angle) * deviation;
          const sy_lightning = cy + Math.sin(angle) * stepR - Math.cos(angle) * deviation;
          ctx.lineTo(sx_lightning, sy_lightning);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    if (isInvisible && isMe) {
      ctx.globalAlpha = 0.4; // Sua própria transparência
    }

    // 2. Glow principal do player
    if (p.isStunned) {
      ctx.shadowColor = 'rgba(136,68,255,0.75)';
      ctx.shadowBlur = 18 + Math.sin(Date.now() / 150) * 6;
    } else if (p.isHot) {
      // Se tiver Supernova, brilha MUITO mais quente e flamejante
      ctx.shadowColor = p.supernovaTimer > 0 ? '#ff3300' : 'rgba(255,34,68,0.6)';
      ctx.shadowBlur = p.supernovaTimer > 0 ? 25 : (18 + Math.sin(Date.now() / 200) * 5);
    } else {
      ctx.shadowColor = p.color || '#00f0ff';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, sz/2, 0, Math.PI * 2);

    if (p.isStunned) {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#aa66ff');
      grad.addColorStop(1, '#4400aa');
      ctx.fillStyle = grad;
    } else if (p.isHot) {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz/2);
      grad.addColorStop(0, '#ffcc00');
      grad.addColorStop(0.5, p.supernovaTimer > 0 ? '#ff1100' : '#ff4400');
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

    const hasPhaseShift = p.phaseshiftTimer > 0;
    ctx.lineWidth = isMe ? 2.5 : 1.5;
    ctx.strokeStyle = hasPhaseShift ? '#00ff88' : (isMe ? '#ffffff' : (p.isStunned ? '#aa66ff' : (p.isHot ? '#ff6644' : (p.color || '#44ccff'))));
    ctx.stroke();
    ctx.restore();

    // 3. Escudo de Plasma do Corredor (bolha protetora cyan neon)
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      // Bolha dá uma leve pulsada esteticamente
      ctx.arc(cx, cy, sz/2 + 8 + Math.sin(Date.now() / 100) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3b. Pulso Repulsor do Corredor (bolha protetora azul neon pulsante)
    if (p.repelTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00d2ff';
      ctx.shadowBlur = 15;
      
      // Bolha pulsante
      ctx.beginPath();
      ctx.arc(cx, cy, sz/2 + 10 + Math.sin(Date.now() / 80) * 2, 0, Math.PI * 2);
      ctx.stroke();
      
      // Ondas repulsivas expansivas secundárias
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.3)';
      ctx.lineWidth = 1;
      const t = (Date.now() / 400) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, sz/2 + 10 + t * 40, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.restore();
    }

    // 3c. Vórtex Magnético do Hot (anéis roxos que colapsam em direção ao Hot)
    if (p.isHot && p.magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#aa00ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#aa00ff';
      ctx.shadowBlur = 12;
      
      // Aura base
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.stroke();
      
      // Anéis magnéticos espirais colapsantes
      const t = (Date.now() / 600) % 1;
      const r = 240 * (1 - t);
      if (r > 24) {
        ctx.strokeStyle = `rgba(170, 0, 255, ${0.4 * t})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      const r2 = 240 * (1 - ((t + 0.5) % 1));
      if (r2 > 24) {
        ctx.strokeStyle = `rgba(170, 0, 255, ${0.4 * ((t + 0.5) % 1)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    }

    // Nome
    ctx.fillStyle = p.isStunned ? '#ccaaff' : (p.isHot ? '#ff8866' : (p.color || '#88ddff'));
    ctx.font = 'bold 11px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, cx, p.y - 8);

    // Stunned tag regressiva
    if (p.isStunned && p.stunTimer > 0) {
      const remainingSecs = Math.ceil(p.stunTimer / 60);
      ctx.fillStyle = '#ff2244';
      ctx.font = '9px Orbitron';
      ctx.fillText(`⚡ PARALISADO (${remainingSecs}s)`, cx, p.y - 20);
    }

    // --- Floating Buff Labels v6 ---
    let buffYOffset = p.y - 20;
    if (p.isStunned) buffYOffset = p.y - 32;

    const activeBuffs = [];
    if (p.speedBoostTimer > 0) activeBuffs.push({ label: `⚡ SPEED (${Math.ceil(p.speedBoostTimer/60)}s)`, color: '#00ff88' });
    if (p.phaseshiftTimer > 0) activeBuffs.push({ label: `🌀 PHASE (${Math.ceil(p.phaseshiftTimer/60)}s)`, color: '#00ff88' });
    if (p.machinegunTimer > 0) activeBuffs.push({ label: `🔫 BURST (${Math.ceil(p.machinegunTimer/60)}s)`, color: '#ffcc00' });
    if (p.shieldTimer > 0) activeBuffs.push({ label: `🛡️ SHIELD (${Math.ceil(p.shieldTimer/60)}s)`, color: '#00f0ff' });
    if (p.supernovaTimer > 0) activeBuffs.push({ label: `🔥 SUPERNOVA (${Math.ceil(p.supernovaTimer/60)}s)`, color: '#ff2244' });
    if (p.gravityTimer > 0) activeBuffs.push({ label: `🕸️ GRAVITY (${Math.ceil(p.gravityTimer/60)}s)`, color: '#aa66ff' });
    if (p.invisibilityTimer > 0 && isMe) activeBuffs.push({ label: `👤 STEALTH (${Math.ceil(p.invisibilityTimer/60)}s)`, color: '#ffffff' });
    if (p.empTimer > 0) activeBuffs.push({ label: `⚡ EMP HACK (${Math.ceil(p.empTimer/60)}s)`, color: '#ff00ff' });
    if (p.overdriveTimer > 0) activeBuffs.push({ label: `🔫 OVERDRV (${Math.ceil(p.overdriveTimer/60)}s)`, color: '#ff3300' });
    if (p.trackerTimer > 0) activeBuffs.push({ label: `🎯 RADAR (${Math.ceil(p.trackerTimer/60)}s)`, color: '#ff5555' });
    if (p.magnetTimer > 0) activeBuffs.push({ label: `🧲 VÓRTEX (${Math.ceil(p.magnetTimer/60)}s)`, color: '#aa00ff' });
    if (p.repelTimer > 0) activeBuffs.push({ label: `🛡️ REPEL (${Math.ceil(p.repelTimer/60)}s)`, color: '#00d2ff' });

    ctx.save();
    ctx.font = 'bold 8px Orbitron';
    ctx.textAlign = 'center';
    for (const bf of activeBuffs) {
      ctx.fillStyle = bf.color;
      ctx.shadowColor = bf.color;
      ctx.shadowBlur = 6;
      ctx.fillText(bf.label, cx, buffYOffset);
      buffYOffset -= 10;
    }
    ctx.restore();

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, sz/2 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Desenha o círculo holográfico de alcance do Tether/Arrasto (raio 70px)
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.stroke();

      const holdingBox = grabbedBoxId !== null || (p.grabbedBox !== undefined && p.grabbedBox !== null);
      let nearBox = false;
      if (!holdingBox) {
        for (const b of pushables) {
          const bx = b.x + b.w / 2;
          const by = b.y + b.h / 2;
          const dist = Math.sqrt((cx - bx) * (cx - bx) + (cy - by) * (cy - by));
          // Se estiver a alcance de arrasto (70px + metade da largura da caixa + margem)
          if (dist <= 70 + b.w / 2 + 10) {
            nearBox = true;
            break;
          }
        }
      }
      if (holdingBox || nearBox) {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
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
    ctx.fillStyle = id === myId ? '#ffffff' : (p.isStunned ? '#aa66ff' : (p.isHot ? '#ff2244' : (p.color || '#00f0ff')));
    ctx.fillRect(mx + p.x * sx - 1, my + p.y * sy - 1, 3, 3);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.strokeRect(mx + camX * sx, my + camY * sy, canvas.width * sx, canvas.height * sy);
}

// ── Atualização de Transparência dos HUDs sob Jogadores v9 ──
function updateHudOpacity() {
  if (!joined) return;

  const huds = [
    document.getElementById('volumeControl'),
    document.getElementById('shopPanel'),
    document.getElementById('weaponHud'),
    document.getElementById('playerListPanel'),
    document.getElementById('chatArea'),
    document.getElementById('hudTop')
  ];

  for (const hud of huds) {
    if (!hud) continue;
    
    // Se o elemento estiver oculto, não precisa processar
    if (hud.classList.contains('hidden') || hud.style.display === 'none') {
      hud.classList.remove('behind-hud');
      continue;
    }

    const rect = hud.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      hud.classList.remove('behind-hud');
      continue;
    }

    let overlap = false;
    for (const [id, p] of players) {
      // Posição do jogador na tela (tela de jogo)
      const sz = 28;
      const screenX = p.x - camX + shakeX;
      const screenY = p.y - camY + shakeY;

      // Caixa delimitadora do jogador na tela
      const pLeft = screenX;
      const pRight = screenX + sz;
      const pTop = screenY;
      const pBottom = screenY + sz;

      // Verifica se a caixa delimitadora do jogador se sobrepõe ao retângulo do HUD
      if (!(pRight < rect.left || 
            pLeft > rect.right || 
            pBottom < rect.top || 
            pTop > rect.bottom)) {
        overlap = true;
        break; // encontrou um jogador atrás deste HUD, pode sair do loop
      }
    }

    if (overlap) {
      hud.classList.add('behind-hud');
    } else {
      hud.classList.remove('behind-hud');
    }
  }
}

// ── Game Loop ──
function gameLoop() {
  sendInput();
  interpolatePlayers();
  updateCamera();
  updateParticles();
  updateHudOpacity();
  render();
  requestAnimationFrame(gameLoop);
}

connect();
requestAnimationFrame(gameLoop);
