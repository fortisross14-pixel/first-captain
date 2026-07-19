import { keyOf, type GridPoint } from './iso';

const DIRECTIONS: GridPoint[] = [
  { col: 1, row: 0 }, { col: -1, row: 0 },
  { col: 0, row: 1 }, { col: 0, row: -1 },
];

export function findPath(
  start: GridPoint,
  goal: GridPoint,
  width: number,
  height: number,
  blocked: Set<string>,
): GridPoint[] {
  if (blocked.has(keyOf(goal.col, goal.row))) return [];
  const queue: GridPoint[] = [start];
  const cameFrom = new Map<string, GridPoint | null>();
  cameFrom.set(keyOf(start.col, start.row), null);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.col === goal.col && current.row === goal.row) break;

    for (const direction of DIRECTIONS) {
      const next = { col: current.col + direction.col, row: current.row + direction.row };
      const nextKey = keyOf(next.col, next.row);
      if (next.col < 0 || next.row < 0 || next.col >= width || next.row >= height) continue;
      if (blocked.has(nextKey) || cameFrom.has(nextKey)) continue;
      cameFrom.set(nextKey, current);
      queue.push(next);
    }
  }

  const goalKey = keyOf(goal.col, goal.row);
  if (!cameFrom.has(goalKey)) return [];

  const path: GridPoint[] = [];
  let current: GridPoint | null = goal;
  while (current) {
    path.push(current);
    current = cameFrom.get(keyOf(current.col, current.row)) ?? null;
  }
  return path.reverse().slice(1);
}
