import type { Look } from '../actors/characterModel';
import type { Person } from './social';

/** What someone is doing at a stop: an idle pose, a prop in hand, the things they mutter. */
export type Activity =
  | 'sell' | 'box' | 'read' | 'sweep' | 'mend' | 'drink' | 'haul' | 'wash' | 'feed' | 'count'
  | 'preach' | 'watch' | 'flowers' | 'smoke' | 'sick' | 'confused' | 'lean' | 'play';

export interface Stop {
  /** Hours of the day, from inclusive, to exclusive; may wrap past midnight. */
  from: number;
  to: number;
  x: number;
  z: number;
  act?: Activity;
}

export interface Resident extends Person {
  look: Look;
  /** Where they go when not out: they vanish through this door tile. */
  home: { x: number; z: number };
  schedule: Stop[];
  /** Moves to Saltwharf on this day (newcomers). */
  arrives?: number;
}

const L = (o: Partial<Look> & Pick<Look, 'skin' | 'hair' | 'coat'>): Look => ({
  trousers: 0x2e2a26, shirt: 0xd0c4a8, boots: 0x1e1a16, hat: 'none', ...o,
});

/** The people of Saltwharf. Positions are street tiles (see world/saltwharf.ts). */
export const AUTHORED_RESIDENTS: Resident[] = [
  {
    id: 'nell', name: 'Nell Hartigan', gender: 'woman', attraction: 'both', cls: 'lower', traits: ['brave', 'jovial'],
    role: 'Dockworker and bare-knuckle boxer',
    look: L({ hairStyle: 'bun', eyes: 0x3a6a4a, skin: 0xe0b896, hair: 0x9a4a22, coat: 0x4a3a2e, trousers: 0x3a3028, hat: 'cap', build: 1.08 }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 5, to: 7, x: 29, z: 19, act: 'box' }, { from: 7, to: 14, x: 12, z: 5, act: 'haul' }, { from: 14, to: 17, x: 29, z: 18, act: 'box' }, { from: 17, to: 18, x: 10, z: 20, act: 'watch' }, { from: 18, to: 23, x: 17, z: 7, act: 'drink' }],
  },
  {
    id: 'bessa', name: 'Bessa Hartigan', gender: 'woman', attraction: 'men', cls: 'lower', traits: ['open', 'greedy'],
    role: 'Landlady of the Copper Cup',
    look: L({ apron: 0xd8ccb0, eyes: 0x4a3020, skin: 0xe8c4a0, hair: 0x6a4428, coat: 0x6a2e2e, trousers: 0x3a2a2a, skirt: true, hat: 'bonnet', hatColor: 0xd8ccb0, build: 1.05 }),
    home: { x: 18, z: 8 },
    schedule: [{ from: 10, to: 12, x: 20, z: 8, act: 'sweep' }, { from: 12, to: 24, x: 20, z: 8, act: 'count' }],
  },
  {
    id: 'rudd', name: 'Foreman Rudd', gender: 'man', attraction: 'women', cls: 'lower', traits: ['serious', 'cynical'],
    role: 'Foreman at the Dock Hiring Office',
    look: L({ beard: 0x5a5a5a, vest: 0x2a2a30, eyes: 0x4a5a6a, skin: 0xc89a78, hair: 0x5a5a5a, coat: 0x3a3a48, hat: 'cap', hatColor: 0x2a2a30, build: 1.1 }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 5, to: 15, x: 25, z: 7, act: 'watch' }, { from: 19, to: 22, x: 16, z: 8, act: 'drink' }],
  },
  {
    id: 'moss', name: 'Moss', gender: 'man', attraction: 'women', cls: 'middle', traits: ['greedy', 'cynical'],
    role: 'Pawnbroker',
    look: L({ vest: 0x4a3a22, hairStyle: 'bald', eyes: 0x3a3a3a, skin: 0xd8b090, hair: 0x8a8a8a, coat: 0x2a2e34, shirt: 0xb8b0a0, hat: 'top', build: 0.92 }),
    home: { x: 19, z: 16 },
    schedule: [{ from: 8, to: 12, x: 21, z: 16, act: 'count' }, { from: 12, to: 19, x: 21, z: 16, act: 'lean' }],
  },
  {
    id: 'pell', name: 'Mrs. Agnes Pell', gender: 'woman', attraction: 'men', cls: 'middle', traits: ['pious', 'serious'],
    role: 'Chandler, downstairs from Hester\'s room',
    look: L({ apron: 0xe0d6c0, eyes: 0x4a5a7a, skin: 0xf0cfb0, hair: 0x8a8a8a, coat: 0x2e3a2e, trousers: 0x2a2a2a, skirt: true, hat: 'bonnet', hatColor: 0x2a2a2a }),
    home: { x: 11, z: 8 },
    schedule: [{ from: 7, to: 9, x: 10, z: 7, act: 'sweep' }, { from: 9, to: 18, x: 10, z: 7, act: 'count' }],
  },
  {
    id: 'grubb', name: 'Mr. Grubb', gender: 'man', attraction: 'women', cls: 'middle', traits: ['greedy', 'proud'],
    role: 'Landlord',
    look: L({ vest: 0x6a5a2a, beard: 0x3a2618, skin: 0xe8c0a0, hair: 0x3a2618, coat: 0x4a3a2a, shirt: 0xe0d6c0, hat: 'top', build: 1.12 }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 10, to: 12, x: 9, z: 16, act: 'watch' }, { from: 12, to: 14, x: 15, z: 23, act: 'watch' }, { from: 14, to: 16, x: 24, z: 15, act: 'watch' }],
  },
  {
    id: 'tom', name: 'Tom Fairley', gender: 'man', attraction: 'women', cls: 'lower', traits: ['shy', 'romantic'],
    role: 'Young stevedore',
    look: L({ eyes: 0x4a6a9a, skin: 0xe0b896, hair: 0xc8a870, coat: 0x5a4a3a, hat: 'cap', build: 0.95 }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 6, to: 14, x: 17, z: 5, act: 'haul' }, { from: 15, to: 19, x: 8, z: 5, act: 'mend' }],
  },
  {
    id: 'ruby', name: 'Ruby Kettle', gender: 'woman', attraction: 'men', cls: 'lower', traits: ['cynical', 'open'],
    role: 'Seller of flowers, and of other things',
    look: L({ hairStyle: 'long', eyes: 0x3a5a3a, skin: 0xe8c4a0, hair: 0x15110e, coat: 0x7a2e4a, trousers: 0x3a2030, skirt: true, scarf: 0xc8a870 }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 16, to: 2, x: 15, z: 16, act: 'flowers' }],
  },
  {
    id: 'hale', name: 'Father Ambrose Hale', gender: 'man', attraction: 'women', cls: 'middle', traits: ['pious', 'intellectual'],
    role: 'Curate of St. Botolph-by-the-River',
    look: L({ eyes: 0x5a4a3a, skin: 0xf0cfb0, hair: 0x6a4428, coat: 0x15151a, shirt: 0xf0f0f0, hat: 'top', hatColor: 0x15151a }),
    home: { x: 0, z: 12 },
    schedule: [{ from: 8, to: 12, x: 12, z: 20, act: 'preach' }, { from: 15, to: 17, x: 4, z: 16, act: 'read' }],
  },
  {
    id: 'quill', name: 'Dr. Ezra Quill', gender: 'man', attraction: 'men', cls: 'middle', traits: ['intellectual', 'eccentric'],
    role: 'Disgraced physician, visiting the sick',
    look: L({ beard: 0x15110e, vest: 0x2e4a3a, skin: 0xc89a78, hair: 0x15110e, coat: 0x2e3440, shirt: 0xc8c0a8, hat: 'top', scarf: 0x2e4a3a }),
    home: { x: 0, z: 12 },
    schedule: [{ from: 12, to: 17, x: 2, z: 15, act: 'read' }],
  },
  {
    id: 'mag', name: 'Old Mag Doyle', gender: 'woman', attraction: 'men', cls: 'lower', traits: ['eccentric', 'open'],
    role: 'Sleeps rough by Gull Court; sees everything',
    look: L({ hairStyle: 'long', cloak: 0x3a3430, eyes: 0x6a7a8a, skin: 0xd8b090, hair: 0xb0b0b0, coat: 0x4a4038, trousers: 0x3a3430, skirt: true, scarf: 0x5a3a2e, build: 0.9 }),
    home: { x: 7, z: 21 },
    schedule: [{ from: 7, to: 17, x: 7, z: 20, act: 'feed' }, { from: 17, to: 7, x: 7, z: 20, act: 'watch' }],
  },
  {
    id: 'silas', name: 'Silas Crane', gender: 'man', attraction: 'both', cls: 'lower', traits: ['cynical', 'proud'],
    role: 'Fence; friends in Hollow Lane',
    look: L({ vest: 0x1a1214, eyes: 0x2a2a2a, skin: 0xe0b896, hair: 0x15110e, coat: 0x2a1a1e, shirt: 0x8a2e26, hat: 'top', hatColor: 0x1a1214 }),
    home: { x: 31, z: 12 },
    schedule: [{ from: 17, to: 1, x: 22, z: 19, act: 'smoke' }],
  },
  {
    id: 'lizzie', name: 'Lizzie Barlow', gender: 'woman', attraction: 'women', cls: 'lower', traits: ['romantic', 'shy'],
    role: 'Seamstress at Rag & Bone',
    look: L({ apron: 0xe8e0d0, eyes: 0x4a6a9a, skin: 0xf0cfb0, hair: 0xc8a870, coat: 0x3a4a5a, trousers: 0x2a3440, skirt: true, hat: 'bonnet', hatColor: 0xa89880 }),
    home: { x: 24, z: 16 },
    schedule: [{ from: 8, to: 18, x: 25, z: 16, act: 'mend' }, { from: 19, to: 21, x: 19, z: 8, act: 'drink' }],
  },
  {
    id: 'jem', name: 'Jem Cotter', gender: 'man', attraction: 'men', cls: 'lower', traits: ['jovial', 'greedy'],
    role: 'Costermonger',
    look: L({ vest: 0x4a3a2a, hairStyle: 'curls', skin: 0x9a6a48, hair: 0x3a2618, coat: 0x6a5a2e, scarf: 0x2e5a8a, hat: 'cap', hatColor: 0x4a3a2a }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 6, to: 15, x: 9, z: 19, act: 'sell' }, { from: 18, to: 22, x: 21, z: 8, act: 'drink' }],
  },
  {
    id: 'hannah', name: 'Hannah Rudd', gender: 'woman', attraction: 'men', cls: 'lower', traits: ['serious', 'brave'],
    role: 'Laundress; the foreman\'s sister',
    look: L({ apron: 0xe0d8c8, skin: 0xc89a78, hair: 0x5a3a22, coat: 0x5a5048, trousers: 0x3a3430, skirt: true, hat: 'bonnet', hatColor: 0xd8ccb0 }),
    home: { x: 3, z: 16 },
    schedule: [{ from: 7, to: 12, x: 5, z: 16, act: 'wash' }, { from: 12, to: 17, x: 13, z: 23, act: 'wash' }],
  },
  {
    id: 'ashby', name: 'Mrs. Constance Ashby', gender: 'woman', attraction: 'men', cls: 'middle', traits: ['serious', 'eccentric'],
    role: 'A widow, new to Gull Court. Or is she a widow?',
    look: L({ hairStyle: 'bun', eyes: 0x5a6a7a, skin: 0xe8d0b8, hair: 0x2a2018, coat: 0x141418, trousers: 0x141418, skirt: true, hat: 'bonnet', hatColor: 0x0e0e10, build: 0.92 }),
    home: { x: 3, z: 16 },
    arrives: 16,
    schedule: [{ from: 9, to: 12, x: 6, z: 6, act: 'watch' }, { from: 14, to: 17, x: 14, z: 16, act: 'watch' }],
  },
];

/**
 * Everyone who lives in Saltwharf right now: the hand-written residents still alive,
 * and the generated people old enough to be out. Rebuilt from the population each night.
 */
export const RESIDENTS: Resident[] = [...AUTHORED_RESIDENTS];

/** The stop for a given hour, or null if they are at home. */
export function stopAt(r: Resident, hour: number): Stop | null {
  for (const s of r.schedule) {
    const inside = s.from <= s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to;
    if (inside) return s;
  }
  return null;
}
