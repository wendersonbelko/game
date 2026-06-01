import { state }          from '../state.js';
import { UPGRADE_DETAILS } from '../constants.js';
import { selectUpgrade }   from '../input/keyboard.js';

export function showUpgradeModal(msg) {
  const upM = document.getElementById('upgradeModal');
  if (!upM) return;
  upM.classList.remove('hidden');

  document.getElementById('upgradeRoundScore').textContent = msg.roundScore;
  document.getElementById('upgradeTotalScore').textContent = msg.totalScore;
  document.getElementById('upgradeTimer').textContent      = state.timer;

  const optsContainer = document.getElementById('upgradeOptions');
  optsContainer.innerHTML = '';
  state.upgradeOptions = msg.options;

  msg.options.forEach((upId, index) => {
    const det  = UPGRADE_DETAILS[upId] || { icon: '⚙️', name: 'Upgrade Cyber', desc: 'Aprimoramento do Grid' };
    const card = document.createElement('div');
    card.className   = 'upgrade-card';
    card.dataset.id  = upId;

    const keyLabel = document.createElement('span');
    keyLabel.className   = 'upgrade-card-key';
    keyLabel.textContent = `Atalho [${index + 1}]`;
    card.appendChild(keyLabel);

    const icon = document.createElement('div');
    icon.className   = 'upgrade-card-icon';
    icon.textContent = det.icon;
    card.appendChild(icon);

    const title = document.createElement('div');
    title.className   = 'upgrade-card-title';
    title.textContent = det.name;
    card.appendChild(title);

    const desc = document.createElement('div');
    desc.className   = 'upgrade-card-desc';
    desc.textContent = det.desc;
    card.appendChild(desc);

    card.addEventListener('click', () => selectUpgrade(upId));
    optsContainer.appendChild(card);
  });
}

export function markUpgradeChosen(upgradeId) {
  const cards = document.querySelectorAll('.upgrade-card');
  cards.forEach(c => {
    if (c.dataset.id === upgradeId) {
      c.classList.add('selected');
    } else {
      c.style.opacity        = '0.3';
      c.style.pointerEvents  = 'none';
    }
  });
}
