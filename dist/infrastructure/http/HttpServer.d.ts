import http from 'http';
/**
 * HttpServer — cria e configura Express + serve os arquivos estáticos do frontend.
 */
export declare class HttpServer {
    readonly app: import("express-serve-static-core").Express;
    readonly server: http.Server;
    constructor();
    listen(): void;
}
//# sourceMappingURL=HttpServer.d.ts.map