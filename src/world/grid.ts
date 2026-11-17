export type TileKind = 'water' | 'quay' | 'street' | 'yard';

export interface Cell {
  x: number;
  z: number;
}

/** Walkability grid. Tile (x, z) covers world [x, x+1) × [z, z+1); +z points south. */
export class Grid {
  private readonly blocked: Uint8Array;
  private readonly kinds: TileKind[];

  constructor(readonly w: number, readonly h: number) {
    this.blocked = new Uint8Array(w * h);
    this.kinds = new Array<TileKind>(w * h).fill('street');
  }

  inBounds(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.w && z < this.h;
  }

  isWalkable(x: number, z: number): boolean {
    return this.inBounds(x, z) && this.blocked[z * this.w + x] === 0 && this.kinds[z * this.w + x] !== 'water';
  }

  block(x: number, z: number): void {
    if (this.inBounds(x, z)) this.blocked[z * this.w + x] = 1;
  }

  blockRect(x: number, z: number, w: number, d: number): void {
    for (let iz = z; iz < z + d; iz++) for (let ix = x; ix < x + w; ix++) this.block(ix, iz);
  }

  setKind(x: number, z: number, kind: TileKind): void {
    if (this.inBounds(x, z)) this.kinds[z * this.w + x] = kind;
  }

  kind(x: number, z: number): TileKind {
    return this.kinds[z * this.w + x];
  }

  /** Nearest walkable cell to (x, z), searching outward ring by ring. */
  nearestWalkable(x: number, z: number, maxRadius = 5): Cell | null {
    if (this.isWalkable(x, z)) return { x, z };
    for (let r = 1; r <= maxRadius; r++) {
      let best: Cell | null = null;
      let bestDist = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = x + dx;
          const cz = z + dz;
          if (!this.isWalkable(cx, cz)) continue;
          const d = dx * dx + dz * dz;
          if (d < bestDist) {
            bestDist = d;
            best = { x: cx, z: cz };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }
}
