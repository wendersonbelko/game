import type { IPlayer } from '../../domain/entities/Player';
import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { GameSessionService } from '../services/GameSessionService';
import { GamePhase } from '../../domain/enums/GamePhase';

export class ChooseUpgradeUseCase {
  constructor(
    private readonly state: GameState,
    private readonly broadcaster: IBroadcaster,
    private readonly sessionSvc: GameSessionService,
  ) {}

  execute(player: IPlayer, upgradeId: string): void {
    if (player.hasChosenUpgrade) return;
    if (!player.offeredUpgrades?.includes(upgradeId)) return;

    player.upgrades = player.upgrades || {};
    player.upgrades[upgradeId] = (player.upgrades[upgradeId] || 0) + 1;
    player.hasChosenUpgrade = true;

    if (player.ws && (player.ws as unknown as { readyState: number }).readyState === 1) {
      (player.ws as unknown as { send: (d: string) => void }).send(
        JSON.stringify({ type: 'upgradeRegistered', upgradeId }),
      );
    }

    // Se todos os humanos já escolheram, avança a fase imediatamente
    const humans = [...this.state.players.values()].filter(p => !p.isBot);
    const allChosen = humans.every(h => h.hasChosenUpgrade);
    if (allChosen && this.state.gamePhase === GamePhase.UPGRADE) {
      this.state.phaseTimer = 1;
    }
  }
}
