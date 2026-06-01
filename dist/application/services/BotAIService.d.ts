import type { GameState } from '../GameState';
import type { IBroadcaster } from '../../infrastructure/GameBroadcaster';
import type { PickupService } from './PickupService';
import type { CombatService } from './CombatService';
/**
 * BotAIService — Single Responsibility: lógica completa da IA dos bots.
 * Personalidades, pathfinding multinível, detecção de travamento,
 * tiro tático, sabotagem e barricada de caixas.
 */
export declare class BotAIService {
    private readonly state;
    private readonly broadcaster;
    private readonly pickupSvc;
    private readonly combatSvc;
    constructor(state: GameState, broadcaster: IBroadcaster, pickupSvc: PickupService, combatSvc: CombatService);
    updateAll(): void;
    private updateBotAI;
    private _hotBotAI;
    private _runnerBotAI;
    private _triggerBotShoot;
    private _tryActivatePowers;
    private _tryBotBuy;
    private _findBestCollectable;
    private _smartWander;
    private _checkBotStuck;
    private _findSmartDir;
    private _calcEnvForces;
    private _applyDir;
    private _isInNarrowPassage;
    private _ensureBotAI;
}
//# sourceMappingURL=BotAIService.d.ts.map