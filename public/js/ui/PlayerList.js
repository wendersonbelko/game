import { state } from '../state.js';

const playerListContent = document.getElementById('playerListContent');
const rankListContent   = document.getElementById('rankListContent');

export function updatePlayerList() {
  if (!state.joined) return;
  playerListContent.innerHTML = '';
  if (rankListContent) rankListContent.innerHTML = '';

  const sorted = [...state.players.values()].sort((a, b) => (b.score || 0) - (a.score || 0));

  // TOP 5 RANKING
  if (rankListContent) {
    sorted.slice(0, 5).forEach((p, index) => {
      const row  = document.createElement('div');
      row.className = 'player-row rank-row';
      row.style.borderLeft = `3px solid ${p.color || '#00f0ff'}`;

      const top  = document.createElement('div');
      top.className = 'player-row-top';

      const rankSpan = document.createElement('span');
      rankSpan.style.fontWeight  = 'bold';
      rankSpan.style.marginRight = '6px';
      rankSpan.style.color =
        index === 0 ? '#ffcc00' : index === 1 ? '#00f0ff' : index === 2 ? '#ff007f' : '#8844ff';
      rankSpan.textContent = `${index + 1}º`;
      top.appendChild(rankSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className  = 'player-row-name';
      nameSpan.style.color = p.color;
      nameSpan.style.flex  = '1';
      nameSpan.textContent = (p.isBot ? '🤖 ' : '') + p.name + (p.id === state.myId ? ' (Você)' : '');
      top.appendChild(nameSpan);

      const scoreSpan = document.createElement('span');
      scoreSpan.style.fontFamily  = 'monospace';
      scoreSpan.style.fontWeight  = 'bold';
      scoreSpan.textContent = `${p.score || 0} pts`;
      top.appendChild(scoreSpan);

      row.appendChild(top);
      rankListContent.appendChild(row);
    });
  }

  // ARENA ACTIVES
  for (const p of sorted) {
    const row = document.createElement('div');
    row.className = 'player-row';

    const top = document.createElement('div');
    top.className = 'player-row-top';

    const nameSpan = document.createElement('span');
    nameSpan.className   = 'player-row-name';
    nameSpan.style.color = p.color;
    nameSpan.textContent = (p.isBot ? '🤖 ' : '') + p.name +
      (p.id === state.myId ? ' (Você)' : '') + ` [${p.score || 0} pts]`;
    top.appendChild(nameSpan);

    const statusSpan = document.createElement('span');
    statusSpan.className = 'player-row-status';
    if (p.isStunned) {
      statusSpan.textContent = '⚡ REINICIANDO';
      statusSpan.className += ' status-tag-stunned';
    } else if (p.isHot) {
      statusSpan.textContent = '⚡ OVERCHARGED';
      statusSpan.className += ' status-tag-hot';
    } else {
      statusSpan.textContent = '🏃 RUNNER';
      statusSpan.className += ' status-tag-runner';
    }
    top.appendChild(statusSpan);
    row.appendChild(top);

    if (p.isHot) {
      const barOuter = document.createElement('div');
      barOuter.className = 'hp-bar-outer';
      const barInner = document.createElement('div');
      barInner.className = 'hp-bar-inner';
      const maxHP = 100 + (p.upgrades ? (p.upgrades.hunter_hp || 0) * 15 : 0);
      barInner.style.width = `${((p.health || 0) / maxHP) * 100}%`;
      barOuter.appendChild(barInner);
      row.appendChild(barOuter);
    }

    playerListContent.appendChild(row);
  }

  // Rank próprio no HUD
  const myRankIdx  = sorted.findIndex(p => p.id === state.myId);
  const me         = state.players.get(state.myId);
  const rankBadge  = document.getElementById('playerRankBadge');
  const scoreBadge = document.getElementById('playerScoreBadge');
  if (me && myRankIdx !== -1) {
    if (rankBadge)  rankBadge.textContent  = `${myRankIdx + 1}º`;
    if (scoreBadge) scoreBadge.textContent = `${me.score || 0} pts`;
  } else {
    if (rankBadge)  rankBadge.textContent  = '--';
    if (scoreBadge) scoreBadge.textContent = '0 pts';
  }

  // Botão bots — só para humano único
  const humans      = [...state.players.values()].filter(p => !p.isBot);
  const openBotsBtn = document.getElementById('openBotsBtn');
  if (openBotsBtn) {
    openBotsBtn.parentElement.style.display = humans.length === 1 ? 'block' : 'none';
  }
}
