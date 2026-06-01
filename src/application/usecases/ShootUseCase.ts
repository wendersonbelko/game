import type { IPlayer } from '../../domain/entities/Player';
import type { CombatService } from '../services/CombatService';
import { TICK_RATE } from '../../domain/constants';

export class ShootUseCase {
  constructor(private readonly combatSvc: CombatService) {}

  execute(player: IPlayer, tx: number, ty: number): void {
    if (player.isHot)             return; // Somente runners atiram
    if (player.isStunned)         return;
    if (player.reloadTimer > 0)   return;
    if (player.ammo <= 0)         return;

    player.ammo--;
    if (player.ammo <= 0) {
      const cdMult = 1 - (player.upgrades?.laser_cooldown ?? 0) * 0.10;
      player.reloadTimer = Math.round(5 * TICK_RATE * cdMult);
    }

    if (player.machinegunTimer > 0) {
      this.combatSvc.performRaycast(player, tx, ty, -0.06, true);
      this.combatSvc.performRaycast(player, tx, ty,  0,    true);
      this.combatSvc.performRaycast(player, tx, ty,  0.06, true);
    } else {
      this.combatSvc.performRaycast(player, tx, ty, 0, false);
    }
  }

  executeReload(player: IPlayer): void {
    if (player.isHot)           return;
    if (player.isStunned)       return;
    if (player.reloadTimer > 0) return;

    const maxAmmo = 3 + (player.upgrades?.ammo_capacity ?? 0);
    if (player.ammo >= maxAmmo) return;

    const cdMult = 1 - (player.upgrades?.laser_cooldown ?? 0) * 0.10;
    player.reloadTimer = Math.round(2.5 * TICK_RATE * cdMult);
    player.ammo = 0;
  }
}
