export const TILE_W = 64;
export const TILE_H = 32;

export interface GridPoint { col: number; row: number }
export interface WorldPoint { x: number; y: number }

export function gridToWorld(col: number, row: number): WorldPoint {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

export function worldToGrid(x: number, y: number): GridPoint {
  return {
    col: Math.round((x / (TILE_W / 2) + y / (TILE_H / 2)) / 2),
    row: Math.round((y / (TILE_H / 2) - x / (TILE_W / 2)) / 2),
  };
}

export function keyOf(col: number, row: number): string {
  return `${col},${row}`;
}
