"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("../../domain/constants");
/**
 * HttpServer — cria e configura Express + serve os arquivos estáticos do frontend.
 */
class HttpServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.app.use(express_1.default.static(path_1.default.join(__dirname, '../../../public')));
        this.server = http_1.default.createServer(this.app);
    }
    listen() {
        this.server.listen(constants_1.PORT, () => {
            console.log(`\n  ⚡ BraainHot v2 (Clean Arch + TS) em http://localhost:${constants_1.PORT}\n`);
        });
    }
}
exports.HttpServer = HttpServer;
//# sourceMappingURL=HttpServer.js.map