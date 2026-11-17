import * as THREE from 'three';
import type { Grid } from '../world/grid';
import { findPath, smoothPath, type Point } from '../world/pathfinding';
import { animateRig, createCharacter, type Look, type Rig } from './characterModel';

const SPEED = 3.0;
const TURN_RATE = 12;

export class Player {
  readonly rig: Rig;
  readonly position = new THREE.Vector2();
  private path: Point[] = [];
  private heading = 0;
  private phase = 0;
  private stride = 0;
  private onArrive: (() => void) | null = null;

  constructor(private readonly grid: Grid, look: Look, x: number, z: number) {
    this.rig = createCharacter(look);
    this.position.set(x, z);
    this.rig.root.position.set(x, 0, z);
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  get cell(): { x: number; z: number } {
    return { x: Math.floor(this.position.x), z: Math.floor(this.position.y) };
  }

  /** Walks to a tile. Returns false if there is no route. */
  walkTo(target: { x: number; z: number }, onArrive?: () => void): boolean {
    const start = this.grid.nearestWalkable(this.cell.x, this.cell.z, 2);
    if (!start) return false;
    const cells = findPath(this.grid, start, target);
    if (!cells) return false;
    this.path = smoothPath(this.grid, { x: this.position.x, z: this.position.y }, cells);
    this.onArrive = onArrive ?? null;
    if (this.path.length === 0) this.arrive();
    return true;
  }

  faceToward(p: { x: number; z: number }): void {
    this.heading = Math.atan2(p.x - this.position.x, p.z - this.position.y);
  }

  private arrive(): void {
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }

  update(dt: number, t: number): void {
    let wantStride = 0;
    if (this.path.length) {
      const target = this.path[0];
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.y;
      const dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (dist <= step) {
        this.position.set(target.x, target.z);
        this.path.shift();
        if (!this.path.length) this.arrive();
      } else {
        this.position.x += (dx / dist) * step;
        this.position.y += (dz / dist) * step;
        this.heading = Math.atan2(dx, dz);
      }
      wantStride = 1;
    }
    this.stride += (wantStride - this.stride) * Math.min(1, dt * 10);
    this.phase += dt * 9 * this.stride;

    const root = this.rig.root;
    root.position.set(this.position.x, 0, this.position.y);
    let diff = this.heading - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    root.rotation.y += diff * Math.min(1, dt * TURN_RATE);
    animateRig(this.rig, this.phase, this.stride, t);
  }
}
