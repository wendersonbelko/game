/**
 * BraainHot v2 — Client Engine (Refatorado)
 * Entry Point — Composition Root
 * Importa e inicializa todos os módulos em ordem.
 */

import { initColorPicker, setupJoinButton, setupResize } from './ui/Screens.js';
import { initVolumeControl }    from './audio/AudioManager.js';
import { setupKeyboard }        from './input/keyboard.js';
import { setupMouse }           from './input/mouse.js';
import { setupBotsModal }       from './ui/BotsModal.js';
import { setupPodiumClose }     from './ui/PodiumModal.js';
import { connect }              from './network/connection.js';
import { gameLoop }             from './render/Renderer.js';

// ── Inicialização ─────────────────────────────────────────────────────────────

// 1. Canvas e resize responsivo
setupResize();

// 2. UI inicial (color picker, botão join, volume)
initColorPicker();
setupJoinButton();
initVolumeControl();

// 3. Input (teclado e mouse)
setupKeyboard();
setupMouse();

// 4. Modais
setupBotsModal();
setupPodiumClose();

// 5. WebSocket — conecta ao servidor
connect();

// 6. Game Loop
requestAnimationFrame(gameLoop);
