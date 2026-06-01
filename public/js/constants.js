// ── Cores ─────────────────────────────────────────────────────────────────────
export const DEFAULT_COLORS = [
  '#00f0ff', '#00ff88', '#aa66ff', '#ff66cc',
  '#ffcc00', '#ff8844', '#66ffcc', '#88aaff',
];

// ── Áudio ─────────────────────────────────────────────────────────────────────
export const SHOT_POOL_SIZE = 6;
export const MAX_HEAR_DIST  = 600;

// ── Pickup types config ───────────────────────────────────────────────────────
export const PICKUP_TYPES_CFG = {
  speed:       { label: '⚡ SPEED',   color: '#00ff88' },
  machinegun:  { label: '🔫 BURST',   color: '#ffcc00' },
  shield:      { label: '🛡️ SHIELD',  color: '#00f0ff' },
  supernova:   { label: '🔥 OVRDRV',  color: '#ff2244' },
  gravity:     { label: '🕸️ SLOW',    color: '#aa66ff' },
  invisibility:{ label: '👤 STEALTH', color: '#ffffff' },
  emp:         { label: '⚡ EMP',     color: '#ff00ff' },
  overdrive:   { label: '🔫 OVRDRV',  color: '#ff3300' },
  tracker:     { label: '🎯 RADAR',   color: '#ff5555' },
  phaseshift:  { label: '🌀 PHASE',   color: '#00ff88' },
  blink:       { label: '⚡ BLINK',   color: '#ff00ff' },
  repel:       { label: '🛡️ REPEL',   color: '#00d2ff' },
  magnetic:    { label: '🧲 MAGNET',  color: '#aa00ff' },
};

// ── Item names (collected feed) ───────────────────────────────────────────────
export const ITEM_NAMES = {
  speed:       'SUPER VELOCIDADE ⚡ (+40%)',
  machinegun:  'METRALHADORA BURST 🔫 (Rajada Tripla)',
  shield:      'ESCUDO DE PLASMA 🛡️ (Absorve infecção)',
  supernova:   'SUPERNOVA 🔥 (Calor & Velocidade)',
  gravity:     'AURA GRAVITACIONAL 🕸️ (Lentidão em área)',
  invisibility:'CAMUFLAGEM HOLOGRÁFICA 👤 (Fique Invisível)',
  emp:         'PULSO CYBER EMP ⚡ (Desativa armas/tether dos runners)',
  overdrive:   'CANHÃO OVERDRIVE 🔫 (Munição Infinita & Sem Recarga!)',
  tracker:     'RASTREADOR TÉRMICO 🎯 (Revela todos os runners!)',
  repel:       'PULSO REPULSOR 🛡️ (Empurra Overcharged ao redor)',
  magnetic:    'VÓRTEX MAGNET 🧲 (Puxa tudo ao redor)',
};

export const ITEM_COLORS = {
  speed:'#00ff88', machinegun:'#ffcc00', shield:'#00f0ff', supernova:'#ff2244',
  gravity:'#aa66ff', invisibility:'#ffffff', emp:'#ff00ff', overdrive:'#ff3300',
  tracker:'#ff5555', repel:'#00d2ff', magnetic:'#aa00ff',
};

// ── Loja ──────────────────────────────────────────────────────────────────────
export const RUNNER_SHOP_ITEMS = [
  { id:'speed',       name:'⚡ VELOCIDADE',    desc:'Super Velocidade (+40%)',           price:3 },
  { id:'blink',       name:'⚡ BLINK',         desc:'Teleporte Curto (160px)',            price:3 },
  { id:'shield',      name:'🛡️ PLASMA SHIELD', desc:'Escudo Protetor',                   price:4 },
  { id:'repel',       name:'🛡️ PULSO REPULSOR',desc:'Repele Overcharged ao Redor (6s)',  price:4 },
  { id:'machinegun',  name:'🔫 BURST LASER',   desc:'Metralhadora Burst',                price:4 },
  { id:'phaseshift',  name:'🌀 PHASE SHIFT',   desc:'Atravessa Paredes (4s)',            price:5 },
  { id:'invisibility',name:'👤 CHAMELEON',     desc:'Camuflagem (10s)',                  price:5 },
];

export const HOT_SHOP_ITEMS = [
  { id:'speed',    name:'⚡ VELOCIDADE',     desc:'Super Velocidade (+40%)',       price:3 },
  { id:'tracker',  name:'🎯 THERMAL RADAR',  desc:'Mira Neon Lock-On (10s)',       price:3 },
  { id:'gravity',  name:'🕸️ AURA GRAVIDADE', desc:'Desacelera Runners',            price:4 },
  { id:'magnetic', name:'🧲 VÓRTEX MAGNET',  desc:'Puxa Runners e Caixas (8s)',   price:4 },
  { id:'supernova',name:'🔥 OVERCHARGE',     desc:'Raio Contágio Ampliado',       price:4 },
  { id:'emp',      name:'⚡ EMP HACK',       desc:'Desativa Armas/Tethers',       price:5 },
];

// ── Inventário (slots Q/E) ────────────────────────────────────────────────────
export const POWER_LABELS = {
  phaseshift:  { name:'PHASE', desc:'Passa paredes' },
  blink:       { name:'BLINK', desc:'Teleporte' },
  speed:       { name:'SPEED', desc:'Velocidade' },
  machinegun:  { name:'BURST', desc:'Rajada' },
  shield:      { name:'SHIELD',desc:'Escudo' },
  invisibility:{ name:'CLOAK', desc:'Invisível' },
  repel:       { name:'REPEL', desc:'Repulsor' },
};

// ── Upgrades ──────────────────────────────────────────────────────────────────
export const UPGRADE_DETAILS = {
  runner_speed:         { icon:'🏃', name:'Sola de Grafeno',       desc:'+5% Velocidade como Runner' },
  hunter_speed:         { icon:'⚡', name:'Sobrecarga Dinâmica',    desc:'+5% Velocidade como Overcharged' },
  laser_cooldown:       { icon:'🔫', name:'Dissipador Criogênico',  desc:'-10% Recarga Arma Laser' },
  ammo_capacity:        { icon:'🔋', name:'Célula Amplificadora',   desc:'+1 Munição Máxima' },
  runner_stamina:       { icon:'🫁', name:'Pulmão Biônico',         desc:'+15% Estamina Máxima' },
  stamina_regen:        { icon:'🌀', name:'Neuro-Estimulante',      desc:'+20% Recarga Estamina' },
  tether_capacity:      { icon:'🧲', name:'Tether Quântico',        desc:'+15% Energia Máxima Tether' },
  tether_regen:         { icon:'🔋', name:'Condensador Tether',     desc:'+20% Recarga Energia Tether' },
  hunter_hp:            { icon:'🛡️', name:'Placa Reforçada',        desc:'+15 HP Máximo como Overcharged' },
  hunter_still_heal:    { icon:'🩹', name:'Nanomáquinas de Cura',   desc:'+25% Cura Parado como Overcharged' },
  still_heal_delay:     { icon:'⏱️', name:'Ativação Acelerada',     desc:'-1s Atraso para Iniciar Cura' },
  shield_duration:      { icon:'🛡️', name:'Escudo Longa Duração',   desc:'+2s Ativação do Plasma Shield' },
  invisibility_duration:{ icon:'👤', name:'Manto Prolongado',       desc:'+2s Duração Camuflagem Chameleon' },
  overdrive_duration:   { icon:'🔥', name:'Sobrecarga Estendida',   desc:'+1.5s Duração do Canhão Overdrive' },
  vortex_strength:      { icon:'🧲', name:'Gravidade Singular',     desc:'+15% Atração Vórtex Magnético' },
  emp_duration:         { icon:'⚡', name:'Hack de Frequência',     desc:'+1s Duração Hack de EMP' },
  tracker_duration:     { icon:'🎯', name:'Scanner de Retinas',     desc:'+2s Mira Neon Lock-On Radar' },
  gravity_slowness:     { icon:'🕸️', name:'Teias de Fluxo',         desc:'+10% Lerdeza Aura Gravitacional' },
  blink_range:          { icon:'🌀', name:'Hiperespacial',           desc:'+20px Alcance Teleporte Blink' },
  supernova_radius:     { icon:'💥', name:'Nova Estelar',            desc:'+20px Raio de Contágio Supernova' },
  coin_magnet:          { icon:'🧲', name:'Ímã de Fluxo',           desc:'+40px Raio Ímã Moedas passivo' },
  revive_immunity:      { icon:'🛡️', name:'Código Limpo',           desc:'+1s Imunidade ao Reviver' },
};
