import { state }       from '../state.js';
import { handleMessage } from './messages.js';
import { updateLobbyStatusOffline } from '../ui/LobbyStatus.js';
import { showLobbyScreen } from '../ui/Screens.js';

// ── WebSocket ─────────────────────────────────────────────────────────────────

export function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let host = location.host;
  if (!host || location.protocol === 'file:') {
    host = 'localhost:3000';
  }

  const ws = new WebSocket(`${proto}://${host}`);
  state.ws = ws;

  ws.onopen = () => {
    console.log('Conectado ao servidor');

    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) {
      joinBtn.disabled   = false;
      joinBtn.textContent = 'ENTRAR NA ARENA';
      joinBtn.style.opacity = '1';
      joinBtn.style.cursor  = 'pointer';
    }

    const badge = document.getElementById('lobbyStatusBadge');
    if (badge) {
      badge.textContent = 'CONECTADO';
      badge.className   = 'status-badge online';
    }
    const dot = document.querySelector('.status-indicator-dot');
    if (dot) dot.className = 'status-indicator-dot online';
  };

  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));

  ws.onclose = () => {
    state.joined = false;

    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) {
      joinBtn.disabled    = true;
      joinBtn.textContent = 'CONECTANDO AO SERVIDOR...';
      joinBtn.style.opacity = '0.5';
      joinBtn.style.cursor  = 'not-allowed';
    }

    showLobbyScreen();
    updateLobbyStatusOffline();
    setTimeout(connect, 2000);
  };
}
