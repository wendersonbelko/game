import type { IPlayer } from '../../domain/entities/Player';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';

export class ChatUseCase {
  constructor(private readonly broadcaster: IBroadcaster) {}

  execute(player: IPlayer, text: string): void {
    const safe = (text || '').slice(0, 80).trim();
    if (!safe) return;

    this.broadcaster.broadcast({
      type: 'chat',
      playerId: player.id,
      name: player.name,
      color: player.color,
      text: safe,
    });
  }
}
