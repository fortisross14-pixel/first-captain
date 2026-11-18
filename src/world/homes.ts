/** The rooms you can live in, in Saltwharf. Pembleton comes with Hester's trunk, wherever it goes. */
export type HomeId = 'hester' | 'court' | 'cup';

export interface HomeSpec {
  id: HomeId;
  name: string;
  /** The street place whose door leads up to it. */
  building: 'hester' | 'tenements' | 'coppercup';
  /** Monthly rent. */
  rent: number;
  w: number;
  d: number;
  /** Pembleton's tile. */
  ghost: { x: number; z: number };
  /** Window centres along the far wall. */
  windows: number[];
  wall: number;
  blurb: string;
}

export const HOMES_TO_LET: Record<HomeId, HomeSpec> = {
  hester: {
    id: 'hester', name: 'Hester\'s room', building: 'hester', rent: 0.6, w: 7, d: 5, ghost: { x: 5, z: 2 }, windows: [3.5], wall: 0x7a6c58,
    blurb: 'Over Pell\'s Chandlery: one window on the river, one stove, and the draughts Hester never fixed.',
  },
  court: {
    id: 'court', name: 'A room in Gull Court', building: 'tenements', rent: 0.4, w: 5, d: 4, ghost: { x: 4, z: 2 }, windows: [2.5], wall: 0x6a6450,
    blurb: 'Third floor back, Gull Court: cheap, damp and loud. The walls are thin enough to hear the neighbours think.',
  },
  cup: {
    id: 'cup', name: 'Rooms over the Copper Cup', building: 'coppercup', rent: 1.0, w: 9, d: 6, ghost: { x: 7, z: 3 }, windows: [2.5, 6.5], wall: 0x7a5a48,
    blurb: 'Two rooms knocked into one over the Copper Cup: warm from the taproom below, never quiet before midnight, and room for real furniture.',
  },
};
