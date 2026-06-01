const chatMessages = document.getElementById('chatMessages');
const hudFeed      = document.getElementById('hudFeed');

export function appendChatMessage(name, color, text) {
  const row = document.createElement('div');
  row.className = 'chat-msg-row';

  const nameSpan = document.createElement('span');
  nameSpan.className   = 'chat-msg-name';
  nameSpan.style.color = color || '#00f0ff';
  nameSpan.textContent = `${name}: `;

  const textSpan = document.createElement('span');
  textSpan.className   = 'chat-msg-text';
  textSpan.textContent = text;

  row.appendChild(nameSpan);
  row.appendChild(textSpan);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function addFeedItem(text) {
  const div = document.createElement('div');
  div.className   = 'feed-item';
  div.textContent = text;
  hudFeed.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, 3000);
  if (hudFeed.children.length > 5) hudFeed.firstChild.remove();
}

export function setupChatInput() {
  // O envio de mensagens está centralizado em keyboard.js (tecla ENTER)
  // Este módulo existe apenas para manter Chat isolado caso precise de lógica extra
}
