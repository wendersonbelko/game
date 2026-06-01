"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameBroadcaster = void 0;
/**
 * GameBroadcaster implementa IBroadcaster usando wss.clients.
 * Inverte a dependência: serviços dependem da interface, não do wss diretamente.
 */
class GameBroadcaster {
    constructor(wss) {
        this.wss = wss;
    }
    broadcast(msg) {
        const data = JSON.stringify(msg);
        for (const client of this.wss.clients) {
            if (client.readyState === 1 /* OPEN */) {
                client.send(data);
            }
        }
    }
    sendTo(ws, msg) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(msg));
        }
    }
}
exports.GameBroadcaster = GameBroadcaster;
//# sourceMappingURL=GameBroadcaster.js.map