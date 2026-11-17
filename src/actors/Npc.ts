import type { Resident, Stop } from '../game/residents';
import type { Grid } from '../world/grid';
import { Player } from './Player';

/** A resident walking their daily routine. Reuses the player's walker and model. */
export class Npc {
  readonly walker: Player;
  private stopKey = '';
  /** Paused while the player talks to them. */
  held = false;

  constructor(readonly res: Resident, private readonly grid: Grid) {
    this.walker = new Player(grid, res.look, res.home.x + 0.5, res.home.z + 0.5);
    this.walker.rig.root.userData.npcId = res.id;
    this.walker.rig.root.visible = false;
  }

  get visible(): boolean {
    return this.walker.rig.root.visible;
  }

  private cellFor(stop: Stop | null): { x: number; z: number } {
    const c = stop ?? this.res.home;
    return this.grid.nearestWalkable(c.x, c.z, 3) ?? { x: this.res.home.x, z: this.res.home.z };
  }

  /** Moves toward the current stop. `walk` false snaps there (when the player can't see). */
  follow(stop: Stop | null, walk: boolean): void {
    const key = stop ? `${stop.x},${stop.z}` : 'home';
    if (key === this.stopKey || this.held) return;
    this.stopKey = key;
    const root = this.walker.rig.root;
    const target = this.cellFor(stop);
    if (!walk) {
      root.visible = stop !== null;
      this.walker.teleport(this.grid, target.x + 0.5, target.z + 0.5);
      return;
    }
    if (stop) {
      if (!root.visible) {
        const door = this.cellFor(null);
        this.walker.teleport(this.grid, door.x + 0.5, door.z + 0.5);
        root.visible = true;
      }
      this.walker.walkTo(target);
    } else if (root.visible) {
      this.walker.walkTo(target, () => (root.visible = false));
    }
  }

  update(dt: number, t: number): void {
    if (this.visible) this.walker.update(dt, t);
  }
}
