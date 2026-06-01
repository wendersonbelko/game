"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrabBoxUseCase = void 0;
const constants_1 = require("../../domain/constants");
class GrabBoxUseCase {
    constructor(state) {
        this.state = state;
    }
    executeGrab(player, boxId) {
        if (player.grabbedBox)
            return;
        if (player.holdEnergy <= 30)
            return;
        const box = this.state.pushables.find(b => b.id === boxId);
        if (!box || box.grabbedBy)
            return;
        const dx = (player.x + player.w / 2) - (box.x + box.w / 2);
        const dy = (player.y + player.h / 2) - (box.y + box.h / 2);
        if (Math.sqrt(dx * dx + dy * dy) > constants_1.GRAB_RANGE + box.w / 2)
            return;
        box.grabbedBy = player.id;
        player.grabbedBox = box.id;
    }
    executeDrag(player, x, y) {
        player.mouseWorld = { x, y };
    }
    executeRelease(player) {
        if (!player.grabbedBox)
            return;
        const box = this.state.pushables.find(b => b.id === player.grabbedBox);
        if (box)
            box.grabbedBy = null;
        player.grabbedBox = null;
        player.mouseWorld = null;
    }
}
exports.GrabBoxUseCase = GrabBoxUseCase;
//# sourceMappingURL=GrabBoxUseCase.js.map