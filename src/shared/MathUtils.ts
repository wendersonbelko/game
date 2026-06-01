import type { IWall } from '../domain/entities/Wall';
import type { IBox } from '../domain/entities/Box';

// ─── Colisão de Retângulos ───────────────────────────────────────────────────

/** Retorna true se os dois retângulos se sobrepõem. */
export function rectOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Retorna true se o rect colide com qualquer parede da lista. */
export function collidesWithWalls(
  x: number, y: number, w: number, h: number,
  walls: readonly IWall[],
): boolean {
  for (const wall of walls) {
    if (rectOverlap(x, y, w, h, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

/** Retorna true se o rect colide com alguma caixa (excluindo excludeId). */
export function collidesWithBoxes(
  x: number, y: number, w: number, h: number,
  boxes: readonly IBox[],
  excludeId: number | string,
): boolean {
  for (const b of boxes) {
    if (b.id === excludeId) continue;
    if (rectOverlap(x, y, w, h, b.x, b.y, b.w, b.h)) return true;
  }
  return false;
}

// ─── Ângulos ─────────────────────────────────────────────────────────────────

/** Normaliza ângulo para o intervalo [-π, π]. */
export function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ─── Distância ───────────────────────────────────────────────────────────────

/** Distância euclidiana entre dois pontos. */
export function dist2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Embaralhar (Fisher-Yates) ────────────────────────────────────────────────

/** Retorna uma cópia do array embaralhada. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Clamp ───────────────────────────────────────────────────────────────────

/** Mantém value entre min e max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
