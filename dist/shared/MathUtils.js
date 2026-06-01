"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rectOverlap = rectOverlap;
exports.collidesWithWalls = collidesWithWalls;
exports.collidesWithBoxes = collidesWithBoxes;
exports.normalizeAngle = normalizeAngle;
exports.dist2D = dist2D;
exports.shuffle = shuffle;
exports.clamp = clamp;
// ─── Colisão de Retângulos ───────────────────────────────────────────────────
/** Retorna true se os dois retângulos se sobrepõem. */
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
/** Retorna true se o rect colide com qualquer parede da lista. */
function collidesWithWalls(x, y, w, h, walls) {
    for (const wall of walls) {
        if (rectOverlap(x, y, w, h, wall.x, wall.y, wall.w, wall.h))
            return true;
    }
    return false;
}
/** Retorna true se o rect colide com alguma caixa (excluindo excludeId). */
function collidesWithBoxes(x, y, w, h, boxes, excludeId) {
    for (const b of boxes) {
        if (b.id === excludeId)
            continue;
        if (rectOverlap(x, y, w, h, b.x, b.y, b.w, b.h))
            return true;
    }
    return false;
}
// ─── Ângulos ─────────────────────────────────────────────────────────────────
/** Normaliza ângulo para o intervalo [-π, π]. */
function normalizeAngle(a) {
    a = a % (2 * Math.PI);
    if (a > Math.PI)
        a -= 2 * Math.PI;
    if (a < -Math.PI)
        a += 2 * Math.PI;
    return a;
}
// ─── Distância ───────────────────────────────────────────────────────────────
/** Distância euclidiana entre dois pontos. */
function dist2D(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}
// ─── Embaralhar (Fisher-Yates) ────────────────────────────────────────────────
/** Retorna uma cópia do array embaralhada. */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// ─── Clamp ───────────────────────────────────────────────────────────────────
/** Mantém value entre min e max. */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
//# sourceMappingURL=MathUtils.js.map