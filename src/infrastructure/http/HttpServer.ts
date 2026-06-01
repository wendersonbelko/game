import express from 'express';
import http from 'http';
import path from 'path';
import { PORT } from '../../domain/constants';

/**
 * HttpServer — cria e configura Express + serve os arquivos estáticos do frontend.
 */
export class HttpServer {
  readonly app  = express();
  readonly server: http.Server;

  constructor() {
    this.app.use(express.static(path.join(__dirname, '../../../public')));
    this.server = http.createServer(this.app);
  }

  listen(): void {
    this.server.listen(PORT, () => {
      console.log(`\n  ⚡ BraainHot v2 (Clean Arch + TS) em http://localhost:${PORT}\n`);
    });
  }
}
