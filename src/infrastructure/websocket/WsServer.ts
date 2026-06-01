import { WebSocketServer as WssLib } from 'ws';
import type http from 'http';

/**
 * WsServer — factory que cria o WebSocketServer anexado ao http.Server existente.
 */
export function createWssServer(server: http.Server): WssLib {
  return new WssLib({ server });
}
