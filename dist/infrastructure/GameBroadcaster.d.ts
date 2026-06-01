import { WebSocketServer } from 'ws';
/**
 * IBroadcaster — contrato de envio de mensagens para clientes.
 * (Interface Segregation — D do SOLID)
 */
export interface IBroadcaster {
    broadcast(msg: object): void;
    sendTo(ws: WebSocket, msg: object): void;
}
/**
 * GameBroadcaster implementa IBroadcaster usando wss.clients.
 * Inverte a dependência: serviços dependem da interface, não do wss diretamente.
 */
export declare class GameBroadcaster implements IBroadcaster {
    private readonly wss;
    constructor(wss: WebSocketServer);
    broadcast(msg: object): void;
    sendTo(ws: WebSocket, msg: object): void;
}
//# sourceMappingURL=GameBroadcaster.d.ts.map