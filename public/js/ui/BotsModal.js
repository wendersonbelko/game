import { state } from '../state.js';

const botsModal      = document.getElementById('botsModal');
const confirmBotsBtn = document.getElementById('confirmBotsBtn');
const closeBotsBtn   = document.getElementById('closeBotsBtn');
const botsNumBtns    = document.querySelectorAll('.bots-num-btn');

export function openBotsConfigurationModal() {
  if (!botsModal) return;
  botsModal.classList.remove('hidden');
  const currentBotCount = [...state.players.values()].filter(p => p.isBot).length;
  botsNumBtns.forEach(btn => {
    if (parseInt(btn.dataset.num) === currentBotCount) btn.classList.add('selected');
    else                                                btn.classList.remove('selected');
  });
  confirmBotsBtn.disabled = false;
  state.selectedBotCount = currentBotCount;
}

export function setupBotsModal() {
  if (!botsModal || !confirmBotsBtn || !closeBotsBtn) return;

  botsNumBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      botsNumBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedBotCount = parseInt(btn.dataset.num);
      confirmBotsBtn.disabled = false;
    });
  });

  confirmBotsBtn.addEventListener('click', () => {
    const count = state.selectedBotCount;
    if (count >= 0 && count <= 8 && state.ws?.readyState === 1) {
      state.ws.send(JSON.stringify({ type: 'addBots', count }));
    }
    botsModal.classList.add('hidden');
  });

  closeBotsBtn.addEventListener('click', () => botsModal.classList.add('hidden'));

  const openBotsBtn = document.getElementById('openBotsBtn');
  if (openBotsBtn) {
    openBotsBtn.addEventListener('click', () => {
      const humans = [...state.players.values()].filter(p => !p.isBot);
      if (state.joined && humans.length === 1) openBotsConfigurationModal();
    });
  }

  // Roster collapse
  const togglePlayerListBtn = document.getElementById('togglePlayerListBtn');
  const playerListPanel     = document.getElementById('playerListPanel');
  if (togglePlayerListBtn && playerListPanel) {
    togglePlayerListBtn.addEventListener('click', () => {
      state.isRosterCollapsed = !state.isRosterCollapsed;
      if (state.isRosterCollapsed) {
        playerListPanel.classList.add('collapsed');
        togglePlayerListBtn.textContent = '[+]';
      } else {
        playerListPanel.classList.remove('collapsed');
        togglePlayerListBtn.textContent = '[-]';
      }
    });
  }
}
