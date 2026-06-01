"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatUseCase = void 0;
class ChatUseCase {
    constructor(broadcaster) {
        this.broadcaster = broadcaster;
    }
    execute(player, text) {
        const safe = (text || '').slice(0, 80).trim();
        if (!safe)
            return;
        this.broadcaster.broadcast({
            type: 'chat',
            playerId: player.id,
            name: player.name,
            color: player.color,
            text: safe,
        });
    }
}
exports.ChatUseCase = ChatUseCase;
//# sourceMappingURL=ChatUseCase.js.map