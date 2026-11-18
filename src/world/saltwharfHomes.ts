/**
 * Where everyone in Saltwharf lives: the named buildings, and the terraced houses of
 * Back Lane, Church Street, Quay Street East and Rope Walk. Each house is a real building
 * on the map with a door you can knock on.
 */
export interface HouseDef {
  key: string;
  name: string;
  /** Footprint, in tiles; the door faces north onto the street above. */
  x: number;
  z: number;
  w: number;
  d: number;
  doorX: number;
  wall: number;
}

const BRICK = [0x5a3a2e, 0x7a4532, 0x4a4440, 0x6a4a3a, 0x8a7a68];
const h = (key: string, name: string, x: number, z: number, w: number, d: number, i: number): HouseDef => ({ key, name, x, z, w, d, doorX: x + Math.floor(w / 2), wall: BRICK[i % BRICK.length] });

export const HOUSES: HouseDef[] = [
  h('bl1', '1 Back Lane', 1, 27, 5, 5, 0), h('bl3', '3 Back Lane', 6, 27, 5, 5, 1), h('bl5', '5 Back Lane', 13, 27, 6, 5, 2),
  h('bl7', '7 Back Lane', 19, 27, 6, 5, 3), h('bl9', '9 Back Lane', 27, 27, 5, 5, 4), h('bl11', '11 Back Lane', 32, 27, 5, 5, 0),
  h('bl13', '13 Back Lane', 39, 27, 5, 5, 1),
  h('cs2', '2 Church Street', 13, 35, 6, 5, 3), h('cs4', '4 Church Street', 19, 35, 6, 5, 4), h('cs6', '6 Church Street', 27, 35, 5, 5, 0),
  h('cs8', '8 Church Street', 32, 35, 5, 5, 1), h('cs10', '10 Church Street', 39, 35, 5, 5, 2),
  h('qs20', '20 Quay Street', 34, 9, 4, 6, 2), h('qs22', '22 Quay Street', 38, 9, 5, 6, 3),
  h('rw9', '9 Rope Walk', 33, 17, 5, 6, 4), h('rw11', '11 Rope Walk', 38, 17, 5, 6, 0),
];

/** Homes for people to live in: the houses, and rooms in the named buildings. */
export const HOME_DOORS: Record<string, { name: string; door: { x: number; z: number } }> = {
  court: { name: 'Gull Court tenements', door: { x: 3, z: 16 } },
  cup: { name: 'rooms over the Copper Cup', door: { x: 18, z: 8 } },
  moss: { name: 'rooms over Moss\'s', door: { x: 19, z: 16 } },
  rag: { name: 'the attic over Rag & Bone', door: { x: 24, z: 16 } },
  hester: { name: 'Hester\'s building (over Pell\'s Chandlery)', door: { x: 11, z: 8 } },
  church: { name: 'the clergy house at St. Botolph\'s', door: { x: 5, z: 34 } },
  hollow: { name: 'Hollow Lane', door: { x: 43, z: 12 } },
  arch: { name: 'the Gull Court archway', door: { x: 7, z: 21 } },
  ...Object.fromEntries(HOUSES.map((d) => [d.key, { name: d.name, door: { x: d.doorX, z: d.z - 1 } }])),
};

/** Old addresses from earlier saves, mapped to houses. */
export const OLD_HOMES: Record<string, string[]> = {
  rope: ['rw9', 'rw11', 'qs20', 'qs22'],
  backw: ['bl1', 'bl3', 'bl5', 'cs2'],
  backe: ['bl9', 'bl11', 'bl13', 'cs8', 'cs10'],
};
