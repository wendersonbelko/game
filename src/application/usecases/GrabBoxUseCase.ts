import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import { GRAB_RANGE } from '../../domain/constants';

export class GrabBoxUseCase {
  constructor(private readonly state: GameState) {}

  executeGrab(player: IPlayer, boxId: number): void {
    if (player.grabbedBox)        return;
    if (player.holdEnergy <= 30)  return;

    const box = this.state.pushables.find(b => b.id === boxId);
    if (!box || box.grabbedBy) return;

    const dx = (player.x + player.w / 2) - (box.x + box.w / 2);
    const dy = (player.y + player.h / 2) - (box.y + box.h / 2);
    if (Math.sqrt(dx * dx + dy * dy) > GRAB_RANGE + box.w / 2) return;

    box.grabbedBy = player.id;
    player.grabbedBox = box.id;

  }

  executeDrag(player: IPlayer, x: number, y: number): void {
    player.mouseWorld = { x, y };
  }

  executeRelease(player: IPlayer): void {
    if (!player.grabbedBox) return;
    const box = this.state.pushables.find(b => b.id === player.grabbedBox);
    if (box) box.grabbedBy = null;
    player.grabbedBox = null;
    player.mouseWorld = null;
  }
}
