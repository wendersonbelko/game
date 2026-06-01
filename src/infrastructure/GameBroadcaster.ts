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
export class GameBroadcaster implements IBroadcaster {
  constructor(private readonly wss: WebSocketServer) {}

  broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(data);
      }
    }
  }

  sendTo(ws: WebSocket, msg: object): void {
    if ((ws as unknown as { readyState: number }).readyState === 1) {
      (ws as unknown as { send: (d: string) => void }).send(JSON.stringify(msg));
    }
  }
}
