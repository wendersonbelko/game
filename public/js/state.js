// ── Canvas & Contexto ──────────────────────────────────────────────────────────
export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');

// ── Estado Global do Jogo ─────────────────────────────────────────────────────
export const state = {
  // Conexão
  ws: null,
  myId: null,
  joined: false,

  // Mapa e entidades
  gameMap: null,
  players: new Map(),
  pushables: [],
  activePickups: [],
  activeCoins: [],
  targetPos: new Map(),

  // Fase e tempo
  phase: 'lobby',
  timer: 0,
  runnersCount: 0,
  hotsCount: 0,
  currentRound: 1,

  // Upgrades
  upgradeOptions: [],

  // Câmera e shake
  camX: 0,
  camY: 0,
  shakeX: 0,
  shakeY: 0,
  shakeMag: 0,

  // Efeitos visuais
  particles: [],
  laserBeams: [],

  // Mouse / Input
  mouseScreenX: 0,
  mouseScreenY: 0,
  mouseDown: false,
  grabbedBoxId: null,
  hoveringBoxId: null,

  // Teclas
  keys: { up: false, down: false, left: false, right: false, shift: false },
  lastInputJson: '',

  // UI
  selectedColor: '#00f0ff',
  selectedBotCount: 0,
  isRosterCollapsed: false,
  currentShopRole: null,

  // Flags
  alert10sFired: false,
};
