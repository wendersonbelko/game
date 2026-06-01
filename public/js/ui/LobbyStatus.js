export function updateLobbyStatusPanel(msg) {
  const badge       = document.getElementById('lobbyStatusBadge');
  const dot         = document.querySelector('.status-indicator-dot');
  const count       = document.getElementById('lobbyPlayersCount');
  const waves       = document.getElementById('lobbyWavesInfo');
  const progressBar = document.getElementById('lobbyWavesProgressBar');
  const list        = document.getElementById('lobbyTop3List');

  if (badge) { badge.textContent = 'CONECTADO'; badge.className = 'status-badge online'; }
  if (dot)   dot.className = 'status-indicator-dot online';

  const totalPlayers = msg.players ? msg.players.length : 0;
  const humanPlayers = msg.players ? msg.players.filter(p => !p.isBot).length : 0;
  const botPlayers   = totalPlayers - humanPlayers;
  if (count) {
    count.textContent = botPlayers > 0 ? `${humanPlayers} (${botPlayers} 🤖)` : `${humanPlayers}`;
  }

  const round     = msg.currentRound || 1;
  const passed    = round - 1;
  const remaining = 7 - round;
  if (waves) {
    if      (msg.phase === 'lobby')                      waves.textContent = 'Aguardando Início';
    else if (msg.phase === 'podium' || msg.phase === 'endgame') waves.textContent = 'Torneio Concluído';
    else                                                 waves.textContent = `Onda ${round}/7 (Faltam ${remaining})`;
  }
  if (progressBar) {
    progressBar.style.width = (msg.phase === 'podium' || msg.phase === 'endgame')
      ? '100%' : `${(passed / 7) * 100}%`;
  }

  if (list) {
    list.innerHTML = '';
    const sorted = [...(msg.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    const top3   = sorted.slice(0, 3);
    const badges = ['🥇', '🥈', '🥉'];
    const colors = ['#ffcc00', '#00f0ff', '#ff007f'];

    for (let i = 0; i < 3; i++) {
      const p   = top3[i];
      const row = document.createElement('div');
      row.className = 'lobby-top3-row';

      if (p) {
        row.style.borderLeft = `3px solid ${p.color || '#00f0ff'}`;
        const leftDiv = document.createElement('div');
        leftDiv.className = 'lobby-top3-left';
        const badgeSpan = document.createElement('span');
        badgeSpan.className   = 'lobby-top3-badge';
        badgeSpan.style.color = colors[i];
        badgeSpan.textContent = badges[i];
        leftDiv.appendChild(badgeSpan);
        const nameSpan = document.createElement('span');
        nameSpan.className   = 'lobby-top3-name';
        nameSpan.style.color = p.color || '#fff';
        nameSpan.textContent = (p.isBot ? '🤖 ' : '') + p.name;
        leftDiv.appendChild(nameSpan);
        row.appendChild(leftDiv);
        const scoreSpan = document.createElement('span');
        scoreSpan.className   = 'lobby-top3-score';
        scoreSpan.textContent = `${p.score || 0} pts`;
        row.appendChild(scoreSpan);
      } else {
        row.style.opacity    = '0.35';
        row.style.borderLeft = '3px dashed rgba(255,255,255,0.15)';
        const leftDiv = document.createElement('div');
        leftDiv.className = 'lobby-top3-left';
        const badgeSpan = document.createElement('span');
        badgeSpan.className   = 'lobby-top3-badge';
        badgeSpan.textContent = badges[i];
        leftDiv.appendChild(badgeSpan);
        const nameSpan = document.createElement('span');
        nameSpan.className   = 'lobby-top3-name';
        nameSpan.textContent = '—';
        leftDiv.appendChild(nameSpan);
        row.appendChild(leftDiv);
        const scoreSpan = document.createElement('span');
        scoreSpan.className   = 'lobby-top3-score';
        scoreSpan.textContent = '0 pts';
        row.appendChild(scoreSpan);
      }
      list.appendChild(row);
    }
  }
}

export function updateLobbyStatusOffline() {
  const badge       = document.getElementById('lobbyStatusBadge');
  const dot         = document.querySelector('.status-indicator-dot');
  const count       = document.getElementById('lobbyPlayersCount');
  const waves       = document.getElementById('lobbyWavesInfo');
  const progressBar = document.getElementById('lobbyWavesProgressBar');
  const list        = document.getElementById('lobbyTop3List');

  if (badge) { badge.textContent = 'OFFLINE'; badge.className = 'status-badge'; }
  if (dot)   dot.className = 'status-indicator-dot';
  if (count) count.textContent = '0';
  if (waves) waves.textContent = 'Desconectado';
  if (progressBar) progressBar.style.width = '0%';
  if (list) list.innerHTML = '<div class="lobby-top3-empty">Servidor offline. Tentando reconectar...</div>';
}
