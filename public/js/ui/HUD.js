import { state }         from '../state.js';
import { sfx10s }        from '../audio/AudioManager.js';
import { RUNNER_SHOP_ITEMS, HOT_SHOP_ITEMS, POWER_LABELS } from '../constants.js';

const hudPhase    = document.getElementById('hudPhase');
const hudTimer    = document.getElementById('hudTimer');
const hudRunners  = document.getElementById('hudRunners');
const hudHots     = document.getElementById('hudHots');
const weaponHud   = document.getElementById('weaponHud');
const energyBar   = document.getElementById('energyBar');
const staminaBar  = document.getElementById('staminaBar');
const ammoContainer = document.getElementById('ammoContainer');
const reloadAlert   = document.getElementById('reloadAlert');
const shopPanel   = document.getElementById('shopPanel');
const shopCoins   = document.getElementById('shopCoins');
const shopItems   = document.getElementById('shopItems');

// ── HUD Principal ─────────────────────────────────────────────────────────────

export function updateHUD() {
  const { phase, currentRound, timer, players, myId } = state;
  const PHASE_NAMES = {
    lobby:   players.size < 3 ? `ESPERANDO (${players.size}/3)` : 'AGUARDANDO',
    warmup:  `AQUECIMENTO (ONDA ${currentRound}/7)`,
    ingame:  `SOBRECARGA (ONDA ${currentRound}/7)`,
    endgame: 'FIM',
    upgrade: 'UPGRADE DE REDE',
    podium:  'PODIUM DA ARENA',
  };
  hudPhase.textContent = PHASE_NAMES[phase] || phase.toUpperCase();

  const m = Math.floor(timer / 60), s = timer % 60;
  hudTimer.textContent = phase === 'lobby'
    ? '--:--'
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  hudTimer.className = (phase === 'ingame' && timer <= 20) ? 'urgent' : '';

  hudRunners.textContent = `🏃 ${state.runnersCount}`;
  hudHots.textContent    = `⚡ ${state.hotsCount}`;

  // Alerta sonoro 10s finais
  if (phase === 'ingame' && timer <= 7 && timer > 0 && !state.alert10sFired) {
    state.alert10sFired = true;
    sfx10s.currentTime = 0;
    sfx10s.play().catch(() => {});
  }

  // Upgrade timer
  const upTimerEl = document.getElementById('upgradeTimer');
  if (upTimerEl && phase === 'upgrade') upTimerEl.textContent = timer;
}

// ── Weapon HUD ────────────────────────────────────────────────────────────────

export function updateWeaponHud() {
  const me = state.players.get(state.myId);
  if (!me) return;
  weaponHud.classList.remove('hidden');

  // Tether
  energyBar.style.width = `${(me.holdEnergy / 300) * 100}%`;

  // Stamina
  if (staminaBar) staminaBar.style.width = `${((me.stamina || 0) / 600) * 100}%`;

  const ammoRow = ammoContainer.parentElement;
  const energyPct = (me.holdEnergy / 300) * 100;

  if (me.isHot) {
    ammoRow.classList.add('hidden');
    reloadAlert.classList.add('hidden');
    energyBar.style.background = 'linear-gradient(90deg, #ff2244, #ff6600)';
    energyBar.style.boxShadow  = '0 0 10px rgba(255,34,68,0.5)';
  } else {
    ammoRow.classList.remove('hidden');
    if (energyPct < 20) {
      energyBar.style.background = 'linear-gradient(90deg, #ff2244, #ff6600)';
      energyBar.style.boxShadow  = '0 0 10px rgba(255,34,68,0.5)';
    } else {
      energyBar.style.background = 'linear-gradient(90deg, #00f0ff, #00ff88)';
      energyBar.style.boxShadow  = '0 0 10px rgba(0,240,255,0.4)';
    }

    // Munição
    ammoContainer.innerHTML = '';
    const maxAmmo = 3 + (me.upgrades?.ammo_capacity || 0);
    for (let i = 0; i < maxAmmo; i++) {
      const tick = document.createElement('div');
      tick.className = 'ammo-tick' + (i < me.ammo ? ' active' : '');
      ammoContainer.appendChild(tick);
    }

    // Recarga
    if (me.reloadTimer > 0) {
      reloadAlert.textContent = `RECARREGANDO (${(me.reloadTimer / 60).toFixed(1)}s)...`;
      reloadAlert.classList.remove('hidden');
    } else {
      reloadAlert.classList.add('hidden');
    }
  }

  // Slots de inventário Q/E
  const slotQEl = document.getElementById('slotQ');
  const slotEEl = document.getElementById('slotE');
  if (slotQEl && slotEEl) {
    if (me.isHot) {
      slotQEl.parentElement.parentElement.classList.add('hidden');
    } else {
      slotQEl.parentElement.parentElement.classList.remove('hidden');
      const updateSlot = (el, powerKey) => {
        el.className = 'inventory-slot';
        if (powerKey) {
          el.classList.add('active', powerKey);
          const cfg = POWER_LABELS[powerKey] || { name: powerKey.toUpperCase(), desc: 'POWERUP' };
          el.querySelector('.inventory-slot-label').textContent = cfg.name;
          el.querySelector('.inventory-slot-desc').textContent  = cfg.desc;
        } else {
          el.querySelector('.inventory-slot-label').textContent = 'VAZIO';
          el.querySelector('.inventory-slot-desc').textContent  = 'Vazio';
        }
      };
      updateSlot(slotQEl, me.slotQ);
      updateSlot(slotEEl, me.slotE);
    }
  }

  // Atalhos
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

  updateShopUI();
}

// ── Cyber Shop ────────────────────────────────────────────────────────────────

export function updateShopUI() {
  const me = state.players.get(state.myId);
  if (!me || !state.joined) { shopPanel.classList.add('hidden'); return; }

  shopPanel.classList.remove('hidden');
  shopCoins.textContent = `⚡ ${me.coins || 0}`;

  const myRole = me.isHot ? 'hot' : 'runner';
  if (state.currentShopRole !== myRole) {
    state.currentShopRole = myRole;
    shopItems.innerHTML = '';
    const items = me.isHot ? HOT_SHOP_ITEMS : RUNNER_SHOP_ITEMS;
    let idx = 1;
    for (const item of items) {
      const row   = document.createElement('div');
      row.className = 'shop-item';
      row.dataset.id    = item.id;
      row.dataset.price = item.price;

      const info  = document.createElement('div');
      info.className = 'shop-item-info';

      const name  = document.createElement('span');
      name.className = 'shop-item-name';
      const badge = document.createElement('span');
      badge.className   = 'shop-item-badge';
      badge.textContent = `[${idx++}] `;
      name.appendChild(badge);
      name.appendChild(document.createTextNode(item.name));

      const desc  = document.createElement('span');
      desc.className   = 'shop-item-desc';
      desc.textContent = item.desc;

      info.appendChild(name);
      info.appendChild(desc);

      const price = document.createElement('span');
      price.className   = 'shop-item-price';
      price.textContent = `🪙 ${item.price}`;

      row.appendChild(info);
      row.appendChild(price);
      row.addEventListener('click', () => {
        if (!row.classList.contains('disabled') && state.ws?.readyState === 1) {
          state.ws.send(JSON.stringify({ type: 'buyItem', itemId: item.id }));
        }
      });
      shopItems.appendChild(row);
    }
  }

  // Habilitar/desabilitar itens
  const myCoins = me.coins || 0;
  const slotsFull = !me.isHot && me.slotQ && me.slotE;
  for (const itemDiv of shopItems.children) {
    const price = parseInt(itemDiv.dataset.price);
    if (myCoins < price || slotsFull) itemDiv.classList.add('disabled');
    else                              itemDiv.classList.remove('disabled');
  }
}
