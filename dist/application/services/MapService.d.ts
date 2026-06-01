import type { GameState } from '../GameState';
/**
 * MapService — Single Responsibility: geração procedimental do mapa.
 * Gera paredes, caixas e zonas de velocidade para cada rodada.
 */
export declare class MapService {
    private readonly state;
    constructor(state: GameState);
    /** Regenera todo o mapa (paredes, zonas, caixas). */
    generateMap(): void;
    /** Encontra uma posição de spawn livre para um jogador. */
    findSpawnPos(): {
        x: number;
        y: number;
    };
    /** Retorna os dados do mapa serializáveis para enviar ao cliente. */
    getMapData(): object;
}
//# sourceMappingURL=MapService.d.ts.map