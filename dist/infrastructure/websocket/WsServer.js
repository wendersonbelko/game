"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWssServer = createWssServer;
const ws_1 = require("ws");
/**
 * WsServer — factory que cria o WebSocketServer anexado ao http.Server existente.
 */
function createWssServer(server) {
    return new ws_1.WebSocketServer({ server });
}
//# sourceMappingURL=WsServer.js.map