import { state }                               from '../state.js';
import { ITEM_NAMES, ITEM_COLORS }              from '../constants.js';
import { playCoinSfx, playBuySfx, playMagnetSfx, playRepelSfx, sfx10s, playShotSound } from '../audio/AudioManager.js';
import { spawnImpactSpark, spawnInfectionBurst, spawnStunBurst, spawnParticle } from '../particles/ParticleSystem.js';
import { showGame, showLobbyScreen, showEndScreen, showHotSelect } from '../ui/Screens.js';
import { updateHUD, updateWeaponHud, updateShopUI }                from '../ui/HUD.js';
import { updatePlayerList }                     from '../ui/PlayerList.js';
import { updateLobbyStatusPanel }               from '../ui/LobbyStatus.js';
import { appendChatMessage, addFeedItem }       from '../ui/Chat.js';
import { openBotsConfigurationModal }           from '../ui/BotsModal.js';
import { showUpgradeModal, markUpgradeChosen }  from '../ui/UpgradeModal.js';
import { showPodiumModal }                      from '../ui/PodiumModal.js';

// ── Roteador de Mensagens WebSocket ──────────────────────────────────────────

export function handleMessage(msg) {
  switch (msg.type) {

    // ── Boas-vindas (join confirmado) ─────────────────────────────────────────
    case 'welcome':
      state.myId  = msg.id;
      state.gameMap  = msg.map;
      state.pushables = msg.map.pushables;
      state.phase    = msg.phase;
      state.timer    = msg.timer;
      state.currentRound = msg.currentRound || 1;
      state.activePickups = msg.pickups || [];
      state.activeCoins   = msg.coins   || [];
      state.players.clear();
      state.targetPos.clear();
      for (const p of msg.players) {
        state.players.set(p.id, p);
        state.targetPos.set(p.id, { x: p.x, y: p.y });
      }
      showGame();
      break;

    // ── Estado periódico do jogo ──────────────────────────────────────────────
    case 'gameState':
      state.phase       = msg.phase;
      state.timer       = msg.timer;
      state.currentRound = msg.currentRound || state.currentRound;
      state.runnersCount = msg.runnersCount;
      state.hotsCount    = msg.hotsCount;
      if (msg.pushables)  state.pushables    = msg.pushables;
      if (msg.pickups !== undefined) state.activePickups = msg.pickups;
      if (msg.coins   !== undefined) state.activeCoins   = msg.coins;

      updateLobbyStatusPanel(msg);

      // Contagem regressiva intro
      if (msg.introFreezeTimer !== undefined && msg.introFreezeTimer > 0 && state.phase === 'ingame') {
        const cTimer = document.getElementById('introCountdown');
        if (cTimer) cTimer.textContent = msg.introFreezeTimer;
        document.getElementById('hotSelectScreen').classList.remove('hidden');
      } else if (state.phase === 'ingame') {
        document.getElementById('hotSelectScreen').classList.add('hidden');
      }

      {
        const ids = new Set();
        for (const sp of msg.players) {
          ids.add(sp.id);
          state.targetPos.set(sp.id, { x: sp.x, y: sp.y });
          const ex = state.players.get(sp.id);
          if (ex) Object.assign(ex, sp);
          else    state.players.set(sp.id, { ...sp });
        }
        for (const [id] of state.players) {
          if (!ids.has(id)) { state.players.delete(id); state.targetPos.delete(id); }
        }
      }

      updateHUD();
      updateWeaponHud();
      updatePlayerList();
      break;

    // ── Mudança de fase ───────────────────────────────────────────────────────
    case 'phaseChange': {
      state.phase = msg.phase; state.timer = msg.timer || 0;
      state.currentRound = msg.currentRound || 1;
      if (msg.map) { state.gameMap = msg.map; state.pushables = msg.map.pushables; }
      if (state.phase === 'lobby' || state.phase === 'warmup') {
        state.activePickups = [];
        state.activeCoins   = [];
      }
      state.alert10sFired = false;

      document.getElementById('endScreen').classList.add('hidden');
      document.getElementById('hotSelectScreen').classList.add('hidden');
      const upM = document.getElementById('upgradeModal');
      const pdM = document.getElementById('podiumModal');
      if (upM) upM.classList.add('hidden');
      if (pdM) pdM.classList.add('hidden');

      if (state.phase === 'ingame') {
        if (msg.hotAlphaIds?.length > 0) showHotSelect(msg.hotAlphaIds);
        else if (msg.hotAlphaId)         showHotSelect([msg.hotAlphaId]);
      }
      updateHUD();
      break;
    }

    // ── Jogadores ─────────────────────────────────────────────────────────────
    case 'playerJoined':
      state.players.set(msg.player.id, msg.player);
      state.targetPos.set(msg.player.id, { x: msg.player.x, y: msg.player.y });
      updatePlayerList();
      break;

    case 'playerLeft':
      state.players.delete(msg.id); state.targetPos.delete(msg.id);
      updatePlayerList();
      break;

    // ── Infecção ──────────────────────────────────────────────────────────────
    case 'infected':
      addFeedItem(`🔥 ${msg.byName} infectou ${msg.name}!`);
      state.shakeMag = 10;
      { const inf = state.players.get(msg.playerId); if (inf) spawnInfectionBurst(inf.x, inf.y); }
      break;

    case 'stunned':
      addFeedItem(`⚡ ${msg.name} (HOT) foi PARALISADO por 10 segundos!`);
      state.shakeMag = 14;
      { const st = state.players.get(msg.playerId); if (st) spawnStunBurst(st.x, st.y); }
      break;

    // ── Tiro ──────────────────────────────────────────────────────────────────
    case 'bulletTraced':
      state.laserBeams.push({
        sx: msg.sx, sy: msg.sy,
        ex: msg.ex, ey: msg.ey,
        life: 18, maxLife: 18,
        color: msg.color || '#00f0ff',
      });
      spawnImpactSpark(msg.ex, msg.ey, msg.color || '#00f0ff');
      {
        const me = state.players.get(state.myId);
        if (me) {
          const dx = msg.sx - (me.x + 14), dy = msg.sy - (me.y + 14);
          const dist = Math.sqrt(dx*dx + dy*dy);
          const vol = Math.max(0, 1 - dist / 600) * 0.7;
          if (vol > 0.01) playShotSound(vol);
        } else {
          playShotSound(0.7);
        }
      }
      break;

    // ── Chat ──────────────────────────────────────────────────────────────────
    case 'chat':
      appendChatMessage(msg.name, msg.color, msg.text);
      break;

    // ── Pickups e moedas ──────────────────────────────────────────────────────
    case 'itemSpawned':
      spawnImpactSpark(msg.item.x + 10, msg.item.y + 10, '#00ff88');
      break;

    case 'coinSpawned':
      spawnImpactSpark(msg.coin.x + 8, msg.coin.y + 8, '#00f0ff');
      break;

    case 'coinCollected':
      state.activeCoins = state.activeCoins.filter(c => c.id !== msg.coinId);
      {
        const collector = state.players.get(msg.playerId);
        if (collector) {
          for (let k = 0; k < 15; k++)
            spawnParticle(collector.x + 14, collector.y + 14, '#00f0ff', 20 + Math.random()*15, 3.5);
        }
      }
      addFeedItem(`⚡ ${msg.playerName} coletou uma Célula de Energia!`);
      playCoinSfx();
      break;

    // ── Compra de item ────────────────────────────────────────────────────────
    case 'itemBought':
      if (msg.playerId === state.myId) {
        addFeedItem('🛒 Compra efetuada com sucesso!');
        playBuySfx();
        if (msg.itemId === 'magnetic') playMagnetSfx();
      }
      {
        const buyer = state.players.get(msg.playerId);
        if (buyer) {
          for (let k = 0; k < 25; k++)
            spawnParticle(buyer.x + 14, buyer.y + 14, '#00f0ff', 25 + Math.random()*15, 4.5);
        }
      }
      break;

    // ── Poderes ───────────────────────────────────────────────────────────────
    case 'powerActivated':
      if (msg.playerId === state.myId && msg.powerType === 'repel') playRepelSfx();
      break;

    // ── Item coletado (pickup) ────────────────────────────────────────────────
    case 'collected': {
      const label = ITEM_NAMES[msg.itemType] || 'ITEM ESPECIAL';
      addFeedItem(`🎉 ${msg.playerName} coletou ${label}!`);
      if (msg.playerId === state.myId && msg.itemType === 'magnetic') playMagnetSfx();
      const col = ITEM_COLORS[msg.itemType] || '#ffffff';
      const cp  = state.players.get(msg.playerId);
      if (cp) {
        for (let k = 0; k < 25; k++)
          spawnParticle(cp.x + 14, cp.y + 14, col, 25 + Math.random()*20, 5, 2.5);
      }
      break;
    }

    // ── Escudo estourado ──────────────────────────────────────────────────────
    case 'shieldPopped':
      addFeedItem(`🛡️ O Escudo de ${msg.runnerName} estourou e empurrou ${msg.hotName}!`);
      state.shakeMag = 18;
      {
        const rp = state.players.get(msg.runnerId);
        if (rp) {
          for (let k = 0; k < 40; k++)
            spawnParticle(rp.x + 14, rp.y + 14, '#00f0ff', 35 + Math.random()*25, 7, 3);
        }
      }
      break;

    // ── Bots ──────────────────────────────────────────────────────────────────
    case 'offerBots':
      openBotsConfigurationModal();
      break;

    // ── Fim de jogo ───────────────────────────────────────────────────────────
    case 'gameOver':
      showEndScreen(msg.winner);
      if (msg.nextPhase === 'upgrade') {
        state.phase = 'upgrade'; state.timer = 15; updateHUD();
      }
      break;

    case 'upgradeOffer':
      state.phase = 'upgrade'; state.timer = msg.timer || 15; updateHUD();
      state.upgradeOptions = msg.options;
      showUpgradeModal(msg);
      break;

    case 'upgradeRegistered':
      markUpgradeChosen(msg.upgradeId);
      break;

    case 'gameOverPodium':
      state.phase = 'podium'; state.timer = msg.timer || 20; updateHUD();
      showPodiumModal(msg);
      break;

    // ── AFK ───────────────────────────────────────────────────────────────────
    case 'afkWarning': {
      const overlay = document.getElementById('afkWarningOverlay');
      const timerEl = document.getElementById('afkCountdown');
      if (overlay && timerEl) { overlay.classList.remove('hidden'); timerEl.textContent = msg.timeLeft; }
      break;
    }

    case 'afkWarningReset': {
      const overlay = document.getElementById('afkWarningOverlay');
      if (overlay) overlay.classList.add('hidden');
      break;
    }

    // ── Kick para lobby ───────────────────────────────────────────────────────
    case 'kickToLobby':
      showLobbyScreen();
      { const pdM = document.getElementById('podiumModal'); if (pdM) pdM.classList.add('hidden'); }
      { const afk = document.getElementById('afkWarningOverlay'); if (afk) afk.classList.add('hidden'); }
      if (msg.reason) alert(msg.reason);
      break;

    case 'error':
      alert(msg.message);
      break;
  }
}
