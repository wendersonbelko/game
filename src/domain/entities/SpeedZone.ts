/** Zona de velocidade (boost ou slow) no mapa. */
export interface ISpeedZone {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'boost' | 'slow';
  label: string;
}
