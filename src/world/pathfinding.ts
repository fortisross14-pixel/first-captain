import type { Cell, Grid } from './grid';

export interface Point {
  x: number;
  z: number;
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

/** A* over the grid with 8-way movement; diagonals may not cut corners. */
export function findPath(grid: Grid, start: Cell, goal: Cell): Cell[] | null {
  if (!grid.isWalkable(goal.x, goal.z)) return null;
  const w = grid.w;
  const size = grid.w * grid.h;
  const g = new Float32Array(size).fill(Infinity);
  const f = new Float32Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open: number[] = [];

  const idx = (x: number, z: number) => z * w + x;
  const h = (x: number, z: number) => {
    const dx = Math.abs(x - goal.x);
    const dz = Math.abs(z - goal.z);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };

  const s = idx(start.x, start.z);
  g[s] = 0;
  f[s] = h(start.x, start.z);
  open.push(s);
  const goalIdx = idx(goal.x, goal.z);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === goalIdx) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w;
    const cz = (cur - cx) / w;

    for (const [dx, dz] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!grid.isWalkable(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!grid.isWalkable(cx + dx, cz) || !grid.isWalkable(cx, cz + dz))) continue;
      const ni = idx(nx, nz);
      if (closed[ni]) continue;
      const cost = g[cur] + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
      if (cost < g[ni]) {
        g[ni] = cost;
        f[ni] = cost + h(nx, nz);
        came[ni] = cur;
        open.push(ni);
      }
    }
  }

  if (came[goalIdx] === -1 && goalIdx !== s) return null;
  const path: Cell[] = [];
  for (let c = goalIdx; c !== -1; c = came[c]) {
    path.push({ x: c % w, z: Math.floor(c / w) });
    if (c === s) break;
  }
  return path.reverse();
}

/** True if a body of the given radius can walk straight from a to b (world units). */
export function clearLine(grid: Grid, a: Point, b: Point, radius = 0.3): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return true;
  const nx = -dz / len;
  const nz = dx / len;
  const steps = Math.ceil(len / 0.15);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    for (const o of [-radius, 0, radius]) {
      if (!grid.isWalkable(Math.floor(px + nx * o), Math.floor(pz + nz * o))) return false;
    }
  }
  return true;
}

/** Converts a cell path into world waypoints and removes points that line of sight makes unnecessary. */
export function smoothPath(grid: Grid, from: Point, cells: Cell[]): Point[] {
  const pts: Point[] = [from, ...cells.slice(1).map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }))];
  if (pts.length <= 2) return pts.slice(1);
  const out: Point[] = [];
  let anchor = pts[0];
  let i = 1;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && clearLine(grid, anchor, pts[j + 1])) j++;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}
