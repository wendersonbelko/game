import { state, canvas } from '../state.js';

// ── Listeners de Mouse ────────────────────────────────────────────────────────

export function setupMouse() {
  canvas.addEventListener('mousemove', (e) => {
    state.mouseScreenX = e.clientX;
    state.mouseScreenY = e.clientY;

    // Arrastar caixa enquanto segura
    if (state.grabbedBoxId !== null && state.ws?.readyState === 1) {
      const wx = state.mouseScreenX + state.camX - state.shakeX;
      const wy = state.mouseScreenY + state.camY - state.shakeY;
      state.ws.send(JSON.stringify({ type: 'drag', x: wx, y: wy }));
    }

    // Hover detection
    if (!state.mouseDown) {
      const wx = state.mouseScreenX + state.camX;
      const wy = state.mouseScreenY + state.camY;
      state.hoveringBoxId = null;
      for (const b of state.pushables) {
        if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
          state.hoveringBoxId = b.id;
          break;
        }
      }
      canvas.style.cursor = state.hoveringBoxId ? 'grab' : 'default';
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !state.joined) return;
    state.mouseDown = true;

    const wx = state.mouseScreenX + state.camX;
    const wy = state.mouseScreenY + state.camY;

    // 1. Tentar arrastar caixa
    let clickedBox = false;
    for (const b of state.pushables) {
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
        const me = state.players.get(state.myId);
        if (me && me.holdEnergy > 30 && state.ws?.readyState === 1) {
          state.ws.send(JSON.stringify({ type: 'grab', boxId: b.id }));
          state.grabbedBoxId = b.id;
          canvas.classList.add('grabbing');
          document.getElementById('grabHint').classList.remove('hidden');
        }
        clickedBox = true;
        break;
      }
    }

    // 2. Atirar se não clicou em caixa
    if (!clickedBox) {
      const me = state.players.get(state.myId);
      if (me && !me.isHot && me.reloadTimer === 0 && me.ammo > 0 && state.ws?.readyState === 1) {
        state.ws.send(JSON.stringify({ type: 'shoot', tx: wx, ty: wy }));
      }
    }
  });

  canvas.addEventListener('mouseup', () => {
    state.mouseDown = false;
    if (state.grabbedBoxId !== null) {
      if (state.ws?.readyState === 1) state.ws.send(JSON.stringify({ type: 'release' }));
      state.grabbedBoxId = null;
      canvas.classList.remove('grabbing');
      document.getElementById('grabHint').classList.add('hidden');
    }
  });
}
