import type { IWall } from '../domain/entities/Wall';
import type { IBox } from '../domain/entities/Box';
/** Retorna true se os dois retângulos se sobrepõem. */
export declare function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean;
/** Retorna true se o rect colide com qualquer parede da lista. */
export declare function collidesWithWalls(x: number, y: number, w: number, h: number, walls: readonly IWall[]): boolean;
/** Retorna true se o rect colide com alguma caixa (excluindo excludeId). */
export declare function collidesWithBoxes(x: number, y: number, w: number, h: number, boxes: readonly IBox[], excludeId: number | string): boolean;
/** Normaliza ângulo para o intervalo [-π, π]. */
export declare function normalizeAngle(a: number): number;
/** Distância euclidiana entre dois pontos. */
export declare function dist2D(x1: number, y1: number, x2: number, y2: number): number;
/** Retorna uma cópia do array embaralhada. */
export declare function shuffle<T>(arr: T[]): T[];
/** Mantém value entre min e max. */
export declare function clamp(value: number, min: number, max: number): number;
//# sourceMappingURL=MathUtils.d.ts.map