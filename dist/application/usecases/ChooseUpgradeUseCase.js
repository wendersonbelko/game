"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChooseUpgradeUseCase = void 0;
const GamePhase_1 = require("../../domain/enums/GamePhase");
class ChooseUpgradeUseCase {
    constructor(state, broadcaster, sessionSvc) {
        this.state = state;
        this.broadcaster = broadcaster;
        this.sessionSvc = sessionSvc;
    }
    execute(player, upgradeId) {
        if (player.hasChosenUpgrade)
            return;
        if (!player.offeredUpgrades?.includes(upgradeId))
            return;
        player.upgrades = player.upgrades || {};
        player.upgrades[upgradeId] = (player.upgrades[upgradeId] || 0) + 1;
        player.hasChosenUpgrade = true;
        if (player.ws && player.ws.readyState === 1) {
            player.ws.send(JSON.stringify({ type: 'upgradeRegistered', upgradeId }));
        }
        // Se todos os humanos já escolheram, avança a fase imediatamente
        const humans = [...this.state.players.values()].filter(p => !p.isBot);
        const allChosen = humans.every(h => h.hasChosenUpgrade);
        if (allChosen && this.state.gamePhase === GamePhase_1.GamePhase.UPGRADE) {
            this.state.phaseTimer = 1;
        }
    }
}
exports.ChooseUpgradeUseCase = ChooseUpgradeUseCase;
//# sourceMappingURL=ChooseUpgradeUseCase.js.map