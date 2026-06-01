import { state }        from '../state.js';
import { showLobbyScreen } from './Screens.js';

export function showPodiumModal(msg) {
  const pdM = document.getElementById('podiumModal');
  if (!pdM) return;
  pdM.classList.remove('hidden');

  const podiumList          = document.getElementById('podiumList');
  const leaderboardContainer = document.getElementById('podiumLeaderboard');
  podiumList.innerHTML          = '';
  leaderboardContainer.innerHTML = '';

  const top3 = msg.leaderboard.slice(0, 3);
  const [o1st, o2nd, o3rd] = top3;

  const placesOrder = [
    { item: o2nd, place: '2nd', badge: '🥈', label: '2º LUGAR' },
    { item: o1st, place: '1st', badge: '🥇', label: '1º LUGAR' },
    { item: o3rd, place: '3rd', badge: '🥉', label: '3º LUGAR' },
  ];

  for (const o of placesOrder) {
    if (!o.item) continue;
    const pDiv = document.createElement('div');
    pDiv.className = `podium-place podium-place-${o.place}`;

    const avatar = document.createElement('div');
    avatar.className   = 'podium-avatar';
    avatar.textContent = o.item.isBot ? '🤖' : '👤';
    pDiv.appendChild(avatar);

    const name = document.createElement('div');
    name.className   = 'podium-name';
    name.style.color = o.item.color;
    name.textContent = o.item.name;
    pDiv.appendChild(name);

    const score = document.createElement('div');
    score.className   = 'podium-score';
    score.textContent = `${o.item.score} pts`;
    pDiv.appendChild(score);

    const pedestal = document.createElement('div');
    pedestal.className = 'podium-pedestal';
    const num = document.createElement('span');
    num.className   = 'podium-pedestal-num';
    num.textContent = o.badge;
    pedestal.appendChild(num);
    pDiv.appendChild(pedestal);

    podiumList.appendChild(pDiv);
  }

  msg.leaderboard.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'podium-leaderboard-row';

    const left = document.createElement('span');
    left.style.color = item.color;
    left.textContent = `${index + 1}. ${item.isBot ? '🤖 ' : ''}${item.name}`;
    row.appendChild(left);

    const right = document.createElement('span');
    right.style.fontWeight = 'bold';
    right.textContent = `${item.score} pts`;
    row.appendChild(right);

    leaderboardContainer.appendChild(row);
  });
}

export function setupPodiumClose() {
  const podiumCloseBtn = document.getElementById('podiumCloseBtn');
  if (!podiumCloseBtn) return;
  podiumCloseBtn.addEventListener('click', () => {
    const pdM = document.getElementById('podiumModal');
    if (pdM) pdM.classList.add('hidden');
    if (state.ws?.readyState === 1) {
      state.ws.send(JSON.stringify({ type: 'leaveToLobby' }));
    }
    showLobbyScreen();
  });
}
