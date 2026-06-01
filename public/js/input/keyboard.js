import { state } from '../state.js';
import { openBotsConfigurationModal } from '../ui/BotsModal.js';

const keyMap = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  w:'up', W:'up', s:'down', S:'down', a:'left', A:'left', d:'right', D:'right',
};

// ── Envio de Input ao Servidor ────────────────────────────────────────────────

export function sendInput() {
  const { ws, joined, keys } = state;
  if (!ws || ws.readyState !== 1 || !joined) return;

  const chatInput = document.getElementById('chatInput');
  if (document.activeElement === chatInput) {
    keys.up = keys.down = keys.left = keys.right = false;
  }

  const json = JSON.stringify(keys);
  if (json !== state.lastInputJson) {
    ws.send(JSON.stringify({ type: 'input', ...keys }));
    state.lastInputJson = json;
  }
}

// ── Listeners de Teclado ─────────────────────────────────────────────────────

export function setupKeyboard() {
  const chatInput = document.getElementById('chatInput');
  const nameInput = document.getElementById('nameInput');

  window.addEventListener('keydown', (e) => {
    // Chat: ENTER envia ou foca
    if (e.key === 'Enter') {
      if (document.activeElement === chatInput) {
        const txt = chatInput.value.trim();
        const { ws } = state;
        if (txt && ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'chat', text: txt }));
        chatInput.value = '';
        chatInput.blur();
      } else if (state.joined && document.activeElement !== nameInput) {
        chatInput.focus();
        e.preventDefault();
      }
      return;
    }

    // Bloqueia movimento durante digitação
    if (document.activeElement === nameInput || document.activeElement === chatInput) return;

    // B — modal de bots
    if (e.key === 'b' || e.key === 'B') {
      const humans = [...state.players.values()].filter(p => !p.isBot);
      if (state.joined && humans.length === 1) openBotsConfigurationModal();
      e.preventDefault(); return;
    }

    // 1–3 durante upgrade
    if (state.phase === 'upgrade' && e.key >= '1' && e.key <= '3') {
      const index = parseInt(e.key) - 1;
      if (state.upgradeOptions?.[index]) selectUpgrade(state.upgradeOptions[index]);
      e.preventDefault(); return;
    }

    // 1–9 — compra rápida na loja
    if (e.key >= '1' && e.key <= '9') {
      const me = state.players.get(state.myId);
      if (me && state.joined && state.ws?.readyState === 1) {
        const container = document.getElementById('shopItems');
        if (container) {
          const itemDiv = container.children[parseInt(e.key) - 1];
          if (itemDiv && !itemDiv.classList.contains('disabled')) {
            state.ws.send(JSON.stringify({ type: 'buyItem', itemId: itemDiv.dataset.id }));
          }
        }
      }
      e.preventDefault(); return;
    }

    // R — recarga
    if (e.key === 'r' || e.key === 'R') {
      if (state.ws?.readyState === 1 && state.joined) state.ws.send(JSON.stringify({ type: 'reload' }));
      e.preventDefault(); return;
    }

    // Q / E — poderes
    if (e.key === 'q' || e.key === 'Q') {
      if (state.ws?.readyState === 1 && state.joined) state.ws.send(JSON.stringify({ type: 'activatePower', slot: 'Q' }));
      e.preventDefault(); return;
    }
    if (e.key === 'e' || e.key === 'E') {
      if (state.ws?.readyState === 1 && state.joined) state.ws.send(JSON.stringify({ type: 'activatePower', slot: 'E' }));
      e.preventDefault(); return;
    }

    // Shift — correr
    if (e.key === 'Shift') { state.keys.shift = true; e.preventDefault(); return; }

    const k = keyMap[e.key];
    if (k) { state.keys[k] = true; e.preventDefault(); }
  });

  window.addEventListener('keyup', (e) => {
    if (document.activeElement === nameInput || document.activeElement === chatInput) return;
    if (e.key === 'Shift') { state.keys.shift = false; e.preventDefault(); return; }
    const k = keyMap[e.key];
    if (k) { state.keys[k] = false; e.preventDefault(); }
  });
}

// ── selectUpgrade (chamado pelo teclado e pelo modal) ─────────────────────────
export function selectUpgrade(upId) {
  if (state.ws?.readyState === 1) {
    state.ws.send(JSON.stringify({ type: 'chooseUpgrade', upgradeId: upId }));
  }
}
