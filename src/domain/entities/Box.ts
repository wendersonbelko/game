/** Caixa empurrável / arrastável do mapa. */
export interface IBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  size: 'S' | 'M' | 'L';
  /** ID do jogador que está arrastando, ou null se livre. */
  grabbedBy: string | null;
  /** Posição-alvo durante arrasto (preenchida pelo servidor). */
  targetX: number | null;
  targetY: number | null;
}
