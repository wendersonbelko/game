import type { IWall } from '../../domain/entities/Wall';
import type { IBox } from '../../domain/entities/Box';
import type { ISpeedZone } from '../../domain/entities/SpeedZone';
import { TILE, MAP_W, MAP_H, PLAYER_SIZE } from '../../domain/constants';
import { collidesWithWalls, collidesWithBoxes, rectOverlap } from '../../shared/MathUtils';
import type { GameState } from '../GameState';

/**
 * MapService — Single Responsibility: geração procedimental do mapa.
 * Gera paredes, caixas e zonas de velocidade para cada rodada.
 */
export class MapService {
  constructor(private readonly state: GameState) {}

  /** Regenera todo o mapa (paredes, zonas, caixas). */
  generateMap(): void {
    this.state.walls = [];
    this.state.pushables = [];
    this.state.speedZones = [];
    this.state.nextBoxId = 1;

    const T = TILE;
    const addWall = (x: number, y: number, w: number, h: number): void => {
      this.state.walls.push({ x, y, w, h });
    };

    // ── Borda externa ──
    addWall(0, 0, MAP_W, T);
    addWall(0, MAP_H - T, MAP_W, T);
    addWall(0, 0, T, MAP_H);
    addWall(MAP_W - T, 0, T, MAP_H);

    // ── Paredes externas da casa (62x44 tiles) ──
    const hx = 3 * T, hy = 3 * T;
    const hw = 62 * T, hh = 44 * T;
    const hx2 = hx + hw, hy2 = hy + hh;

    addWall(hx, hy, hw, T);
    addWall(hx, hy, T, hh);
    addWall(hx2 - T, hy, T, hh);
    // Porta de entrada (gap de 4 tiles no meio da parede inferior)
    addWall(hx, hy2 - T, 28 * T, T);
    addWall(hx + 32 * T, hy2 - T, 30 * T, T);

    // ── Divisórias horizontais procedimentais ──
    const hDividers = [
      Math.floor(Math.random() * 5) + 12,
      Math.floor(Math.random() * 5) + 26,
    ];
    for (const row of hDividers) {
      let col = 1;
      while (col < 61) {
        if (Math.random() < 0.6) {
          const wLen = Math.floor(Math.random() * 9) + 6;
          const endCol = Math.min(61, col + wLen);
          const actualLen = endCol - col;
          if (actualLen >= 3) addWall(hx + col * T, hy + row * T, actualLen * T, T);
          col = endCol;
        }
        col += Math.floor(Math.random() * 4) + 6;
      }
    }

    // ── Divisórias verticais procedimentais ──
    const vDividers = [
      Math.floor(Math.random() * 5) + 13,
      Math.floor(Math.random() * 5) + 29,
      Math.floor(Math.random() * 5) + 45,
    ];
    for (const col of vDividers) {
      let row = 1;
      while (row < 43) {
        if (Math.random() < 0.6) {
          const hLen = Math.floor(Math.random() * 9) + 6;
          const endRow = Math.min(43, row + hLen);
          const actualLen = endRow - row;
          if (actualLen >= 3) addWall(hx + col * T, hy + row * T, T, actualLen * T);
          row = endRow;
        }
        row += Math.floor(Math.random() * 4) + 6;
      }
    }

    // ── Pilares táticos (6–10) ──
    const numPillars = Math.floor(Math.random() * 5) + 6;
    let pillarsAdded = 0, pillarAttempts = 0;
    while (pillarsAdded < numPillars && pillarAttempts < 100) {
      pillarAttempts++;
      const col = Math.floor(Math.random() * 58) + 2;
      const row = Math.floor(Math.random() * 40) + 2;
      const size = Math.random() < 0.5 ? 1 : 2;
      const px = hx + col * T, py = hy + row * T;
      const pw = size * T, ph = size * T;
      if (!collidesWithWalls(px - T, py - T, pw + 2 * T, ph + 2 * T, this.state.walls)) {
        addWall(px, py, pw, ph);
        pillarsAdded++;
      }
    }

    // ── Zonas de velocidade (4 boosts + 2 slows) ──
    const zoneDefs: Array<{ type: 'boost' | 'slow'; label: string }> = [
      { type: 'boost', label: '⚡ BOOST' },
      { type: 'boost', label: '⚡ BOOST' },
      { type: 'boost', label: '⚡ BOOST' },
      { type: 'boost', label: '⚡ BOOST' },
      { type: 'slow', label: '❄ SLOW' },
      { type: 'slow', label: '❄ SLOW' },
    ];
    for (const def of zoneDefs) {
      const zw = def.type === 'boost'
        ? (Math.floor(Math.random() * 2) + 4) * T
        : (Math.floor(Math.random() * 2) + 5) * T;
      const zh = def.type === 'boost'
        ? (Math.floor(Math.random() * 2) + 2) * T
        : 3 * T;
      let placed = false, attempts = 0;
      while (!placed && attempts < 100) {
        attempts++;
        const col = Math.floor(Math.random() * (60 - zw / T)) + 1;
        const row = Math.floor(Math.random() * (42 - zh / T)) + 1;
        const zx = hx + col * T, zy = hy + row * T;
        const collidesW = this.state.walls.some(w => rectOverlap(zx, zy, zw, zh, w.x, w.y, w.w, w.h));
        const collidesZ = this.state.speedZones.some(z => rectOverlap(zx, zy, zw, zh, z.x, z.y, z.w, z.h));
        if (!collidesW && !collidesZ) {
          this.state.speedZones.push({ x: zx, y: zy, w: zw, h: zh, type: def.type, label: def.label });
          placed = true;
        }
      }
    }

    // ── Caixas barricadas (37 total: 15S + 12M + 10L) ──
    const boxSizesList: Array<'S' | 'M' | 'L'> = [
      ...Array<'S'>(15).fill('S'),
      ...Array<'M'>(12).fill('M'),
      ...Array<'L'>(10).fill('L'),
    ];
    const sizes = { S: 28, M: 40, L: 56 };
    for (const size of boxSizesList) {
      const s = sizes[size];
      let placed = false, attempts = 0;
      while (!placed && attempts < 150) {
        attempts++;
        const rx = hx + T + Math.random() * (hw - 2 * T - s);
        const ry = hy + T + Math.random() * (hh - 2 * T - s);
        if (
          !collidesWithWalls(rx - 2, ry - 2, s + 4, s + 4, this.state.walls) &&
          !collidesWithBoxes(rx - 2, ry - 2, s + 4, s + 4, this.state.pushables, -1)
        ) {
          this.state.pushables.push({
            id: this.state.nextBoxId++,
            x: rx, y: ry, w: s, h: s,
            size,
            grabbedBy: null,
            targetX: null, targetY: null,
          });
          placed = true;
        }
      }
    }
  }

  /** Encontra uma posição de spawn livre para um jogador. */
  findSpawnPos(): { x: number; y: number } {
    const hx = 3 * TILE + TILE, hy = 3 * TILE + TILE;
    const hw = 60 * TILE, hh = 42 * TILE;

    // Tentativa 1: livre de paredes e caixas
    for (let i = 0; i < 300; i++) {
      const x = hx + Math.random() * (hw - PLAYER_SIZE);
      const y = hy + Math.random() * (hh - PLAYER_SIZE);
      if (
        !collidesWithWalls(x, y, PLAYER_SIZE, PLAYER_SIZE, this.state.walls) &&
        !collidesWithBoxes(x, y, PLAYER_SIZE, PLAYER_SIZE, this.state.pushables, -1)
      ) return { x, y };
    }

    // Tentativa 2: fallback — livre apenas de paredes
    for (let i = 0; i < 200; i++) {
      const x = hx + Math.random() * (hw - PLAYER_SIZE);
      const y = hy + Math.random() * (hh - PLAYER_SIZE);
      if (!collidesWithWalls(x, y, PLAYER_SIZE, PLAYER_SIZE, this.state.walls)) return { x, y };
    }

    return { x: hx + 100, y: hy + 100 };
  }

  /** Retorna os dados do mapa serializáveis para enviar ao cliente. */
  getMapData(): object {
    return {
      w: MAP_W, h: MAP_H, tile: TILE,
      walls: this.state.walls,
      pushables: this.state.pushables.map(b => ({
        id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size, grabbedBy: b.grabbedBy,
      })),
      speedZones: this.state.speedZones,
    };
  }
}
