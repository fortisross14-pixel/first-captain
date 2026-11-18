import * as THREE from 'three';
import { createCharacter, type Look } from '../actors/characterModel';
import { Grid } from './grid';
import type { Location, Place } from './location';
import { C, glow, mat } from './materials';
import { mergeSubtree } from './merge';
import { rng } from './props';

/**
 * The insides of Saltwharf's buildings you can walk into: the Copper Cup, the chandlery,
 * the pawnshop, the clothier and the hiring office. The camera looks in from the street
 * side, so the far wall (z = D) carries the shelves, and the doorway is on the near side.
 */
export type InteriorKind = 'tavern' | 'shop' | 'office' | 'church';

export interface InteriorDef {
  id: string;
  name: string;
  kind: InteriorKind;
  w: number;
  d: number;
  /** What the counter is called, and what it says. */
  counter: [string, string];
  /** Opening hours (from, to); 24 means midnight. */
  open: [number, number];
  /** Who stands behind the counter. */
  keeper: string;
  floor: number;
  wall: number;
  /** Stairs up to rooms you might rent, and what they say. */
  stairs?: string;
}

export const INTERIORS: InteriorDef[] = [
  { id: 'church', name: 'St. Botolph-by-the-River', kind: 'church', w: 9, d: 7, counter: ['The altar rail', 'Worn smooth by two hundred years of knees. Father Hale keeps the candles lit with money he does not have.'], open: [7, 21], keeper: 'hale', floor: 0x5a5650, wall: 0x6a665e },
  { id: 'coppercup', name: 'The Copper Cup', kind: 'tavern', w: 9, d: 6, counter: ['The bar', 'Bessa\'s bar: brass taps, a slate of who owes what, and a cudgel under the counter for emergencies.'], open: [10, 24], keeper: 'bessa', floor: 0x5a3a24, wall: 0x6a4a32, stairs: 'The back stairs, up to the rooms Bessa lets over the taproom.' },
  { id: 'hester', name: 'Pell\'s Chandlery', kind: 'shop', w: 7, d: 5, counter: ['The counter', 'Candles by the pound, rope by the fathom, lamp oil, soap and ship\'s biscuit. Mrs. Pell knows the price of everything to the farthing.'], open: [7, 18], keeper: 'pell', floor: 0x4a3828, wall: 0x5a4a3a, stairs: 'Two crooked flights up to Hester\'s room. The Abbotts\' door is on the first-floor landing.' },
  { id: 'pawnbroker', name: 'Moss the Pawnbroker', kind: 'shop', w: 7, d: 5, counter: ['The counter', 'Behind the grille: watches, wedding rings, a stuffed owl, three violins and somebody\'s false teeth. Everything has a ticket.'], open: [8, 19], keeper: 'moss', floor: 0x3a3028, wall: 0x3a3a3e },
  { id: 'clothier', name: 'Rag & Bone Clothiers', kind: 'shop', w: 7, d: 5, counter: ['The counter', 'Coats on hooks, boots in pairs (mostly), and Lizzie\'s sewing machine clattering in the corner.'], open: [8, 18], keeper: 'lizzie', floor: 0x4a3a2a, wall: 0x6a5a48 },
  { id: 'dockoffice', name: 'Dock Hiring Office', kind: 'office', w: 8, d: 5, counter: ['Rudd\'s desk', 'A tally board, a stove, a list of ships due, and Foreman Rudd, who looks at you as if counting your teeth.'], open: [5, 15], keeper: 'rudd', floor: 0x3a3a3a, wall: 0x4a4440 },
];

export const isOpen = (def: InteriorDef, hour: number) => hour >= def.open[0] && hour < def.open[1];

const PATRON_LOOKS: Look[] = [
  { skin: 0xe0b896, hair: 0x3a2618, coat: 0x4a3a2e, trousers: 0x2e2a26, shirt: 0xd0c4a8, boots: 0x1e1a16, hat: 'cap', hatColor: 0x2a2620, beard: 0x3a2618 },
  { skin: 0xd8b090, hair: 0x6a4428, coat: 0x5a3a4a, trousers: 0x3a2a2a, shirt: 0xe0d6c0, boots: 0x1e1a16, hat: 'bonnet', hatColor: 0xd8ccb0, skirt: true },
  { skin: 0xc89a78, hair: 0x15110e, coat: 0x3a3a44, trousers: 0x2a2a2a, shirt: 0xc8c0a8, boots: 0x15110e, hat: 'bowler', hatColor: 0x1a1a1e, vest: 0x4a3a22 },
];

function box(w: number, h: number, d: number, color: number | THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildInterior(def: InteriorDef): Location {
  const { w: W, d: D } = def;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  const grid = new Grid(W, D);
  const places: Place[] = [];
  const tappables: THREE.Object3D[] = [];
  const r = rng(def.id.length * 97);
  const statics = new THREE.Group();
  scene.add(statics);

  // Floor boards, the far wall, two side walls.
  for (let x = 0; x < W; x++) statics.add(box(1, 0.1, D, new THREE.Color(def.floor).offsetHSL(0, 0, (r() - 0.5) * 0.05).getHex(), x + 0.5, -0.05, D / 2));
  statics.add(box(W, 3.2, 0.2, def.wall, W / 2, 1.6, D + 0.1));
  statics.add(box(0.2, 3.2, D, def.wall, -0.1, 1.6, D / 2));
  statics.add(box(0.2, 3.2, D, def.wall, W + 0.1, 1.6, D / 2));
  statics.add(box(W, 0.12, 0.25, C.timber, W / 2, 3.15, D));
  // A window in the far wall, lit by the hour.
  if (def.kind !== 'church') statics.add(box(1.2, 1.1, 0.05, glow.windowLit, W - 1.6, 1.9, D - 0.02));

  // Counter across the back, with the keeper's place behind it.
  const counter = new THREE.Group();
  counter.userData.placeId = 'counter';
  const cw = Math.min(W - 2, def.kind === 'office' ? 3 : 5);
  const cx = W / 2;
  counter.add(box(cw, 1.0, 0.7, C.woodDark, cx, 0.5, D - 2));
  counter.add(box(cw + 0.1, 0.08, 0.8, C.wood, cx, 1.04, D - 2));
  for (let y = 0; y < (def.kind === 'church' ? 0 : 3); y++) {
    const shelf = box(W - 1, 0.06, 0.35, C.wood, W / 2, 0.9 + y * 0.65, D - 0.2);
    statics.add(shelf);
    for (let i = 0; i < W * 2 - 3; i++) {
      if (r() < 0.25) continue;
      const tint = def.kind === 'tavern' ? [0x3a5a3a, 0x6a3a2a, 0xb08a3e] : def.kind === 'office' ? [0xd8ccb0, 0x8a7a5a] : [0xd8ccb0, 0x8a5a3a, 0x5a6a7a, 0x9a3a2a, 0x3a3a3a];
      statics.add(box(0.18, 0.28 + r() * 0.18, 0.2, tint[Math.floor(r() * tint.length)], 0.8 + i * 0.5, 1.07 + y * 0.65, D - 0.2));
    }
  }
  if (def.kind === 'tavern') {
    for (const tx of [1.5, 4.5, 7.5].slice(0, W > 8 ? 3 : 2)) {
      statics.add(box(1.1, 0.08, 0.8, C.wood, tx, 0.76, 1.6));
      statics.add(box(0.12, 0.74, 0.12, C.woodDark, tx, 0.37, 1.6));
      for (const sx of [-0.7, 0.7]) statics.add(box(0.4, 0.45, 0.4, C.woodDark, tx + sx, 0.22, 1.6));
      statics.add(box(0.09, 0.14, 0.09, 0xb08a3e, tx + 0.2, 0.87, 1.55));
      grid.block(Math.floor(tx), 1);
    }
    // Barrels by the wall.
    if (!def.stairs) for (const bz of [1.2, 2.4]) statics.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 8), mat(C.wood)).translateX(W - 0.5).translateY(0.45).translateZ(bz));
  } else if (def.kind === 'church') {
    // Pews either side of the aisle, the altar, three lancet windows, the register and the poor box.
    for (const pz of [2, 4]) for (const [x0, x1] of [[1, 3], [5, 7]]) {
      statics.add(box(x1 - x0 + 1, 0.45, 0.45, C.woodDark, (x0 + x1 + 1) / 2, 0.22, pz + 0.3));
      statics.add(box(x1 - x0 + 1, 0.7, 0.08, C.woodDark, (x0 + x1 + 1) / 2, 0.55, pz + 0.55));
      for (let x = x0; x <= x1; x++) grid.block(x, pz);
    }
    statics.add(box(2.2, 1.0, 0.8, 0xd8ccb0, W / 2, 0.5, D - 0.6));
    statics.add(box(0.1, 0.5, 0.1, 0xb08a3e, W / 2, 1.25, D - 0.6));
    statics.add(box(0.5, 0.06, 0.06, 0xb08a3e, W / 2, 1.38, D - 0.6));
    for (const [wx, col] of [[W / 2 - 2.4, 0x6a3a8a], [W / 2, 0xb04a2a], [W / 2 + 2.4, 0x2a5a9a]] as [number, number][]) {
      const glass = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, flatShading: true });
      statics.add(box(0.7, 1.8, 0.05, glass, wx, 2.0, D - 0.02));
    }
    for (const cx2 of [W / 2 - 1.4, W / 2 + 1.4]) {
      statics.add(box(0.08, 0.3, 0.08, 0xefe6d2, cx2, 1.15, D - 0.6));
      statics.add(box(0.05, 0.08, 0.05, glow.windowLit, cx2, 1.34, D - 0.6));
    }
    const lectern = new THREE.Group();
    lectern.userData.placeId = 'register';
    lectern.add(box(0.5, 1.0, 0.4, C.woodDark, W - 0.5, 0.5, 4.5));
    lectern.add(box(0.6, 0.06, 0.5, 0x3a2a1e, W - 0.5, 1.05, 4.5));
    lectern.add(box(0.45, 0.06, 0.35, 0xd8ccb0, W - 0.5, 1.1, 4.5));
    scene.add(lectern);
    tappables.push(lectern);
    grid.block(W - 1, 4);
    places.push({ id: 'register', name: 'The parish register', description: 'Births, marriages and burials since 1689, in a dozen hands. The older pages smell of river.', door: { x: W - 1, z: 3 }, faceTo: { x: W - 0.5, z: 4.5 } });
    const box2 = new THREE.Group();
    box2.userData.placeId = 'poorbox';
    box2.add(box(0.4, 0.9, 0.4, C.woodDark, 0.5, 0.45, 1.5));
    box2.add(box(0.42, 0.06, 0.42, C.iron, 0.5, 0.92, 1.5));
    scene.add(box2);
    tappables.push(box2);
    grid.block(0, 1);
    places.push({ id: 'poorbox', name: 'The poor box', description: 'Iron-bound, padlocked, and lighter than it should be.', door: { x: 1, z: 1 }, faceTo: { x: 0.5, z: 1.5 } });
  } else if (def.kind === 'office') {
    statics.add(box(1.6, 2.2, 0.06, 0x2a2a2a, 1.2, 1.6, D - 0.08));
    for (let i = 0; i < 6; i++) statics.add(box(1.3, 0.04, 0.02, 0xd8ccb0, 1.2, 0.8 + i * 0.3, D - 0.12));
    statics.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.0, 8), mat(C.iron, 0.6, 0.5)).translateX(W - 1).translateY(0.5).translateZ(1));
  } else {
    // A shop: hanging goods and a display table.
    statics.add(box(1.4, 0.08, 0.9, C.wood, 1.4, 0.76, 1.4));
    for (let i = 0; i < 4; i++) statics.add(box(0.25, 0.25, 0.25, [0x8a6a3a, 0x5a6a7a, 0xd8ccb0, 0x6a2a2a][i], 1.0 + i * 0.28, 0.93, 1.4));
    grid.block(1, 1);
  }
  scene.add(counter);
  tappables.push(counter);
  for (let x = Math.floor(cx - cw / 2); x < Math.ceil(cx + cw / 2); x++) grid.block(x, D - 2);
  for (let x = 0; x < W; x++) grid.block(x, D - 1);
  grid.unblock(Math.floor(cx), D - 1);
  places.push({ id: 'counter', name: def.counter[0], description: def.counter[1], door: { x: Math.floor(cx), z: D - 3 }, faceTo: { x: cx, z: D - 2 } });

  // The way out, at the front.
  const door = new THREE.Group();
  door.userData.placeId = 'exit';
  door.add(box(1.2, 0.05, 0.6, 0x2a2018, W / 2, 0.02, 0.3));
  scene.add(door);
  tappables.push(door);
  places.push({ id: 'exit', name: 'The door', description: 'Back out to the street.', door: { x: Math.floor(W / 2), z: 0 }, faceTo: { x: W / 2, z: -1 } });

  // Stairs on the left, except in the tavern, where the tables are.
  const stairX = def.kind === 'tavern' ? W - 1 : 0;
  if (def.stairs) {
    const stairs = new THREE.Group();
    stairs.userData.placeId = 'stairs';
    for (let i = 0; i < 5; i++) stairs.add(box(0.9, 0.2, 0.4, C.woodDark, stairX + 0.5, 0.1 + i * 0.2, 1 + i * 0.4));
    scene.add(stairs);
    tappables.push(stairs);
    for (let z = 1; z < 3; z++) grid.block(stairX, z);
    const foot = stairX === 0 ? 1 : stairX - 1;
    places.push({ id: 'stairs', name: 'Stairs up', description: def.stairs, door: { x: foot, z: 1 }, faceTo: { x: stairX + 0.5, z: 2 } });
  }

  // A couple of regulars, for company.
  if (def.kind === 'tavern') {
    PATRON_LOOKS.forEach((look, i) => {
      const rig = createCharacter(look);
      rig.root.position.set(1.5 + i * 3 + (i % 2 ? 0.7 : -0.7), 0, 1.6);
      rig.root.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
      rig.armR.rotation.x = -1.2;
      scene.add(rig.root);
    });
  }
  mergeSubtree(statics);

  // Lamplight and a warm fire.
  const hemi = new THREE.HemisphereLight(0xd8d0c0, 0x5a4030, 1.9);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.4);
  key.position.set(W / 2, 6, -3);
  key.target.position.set(W / 2, 0, D / 2);
  const lamp = new THREE.PointLight(0xffb060, 10, 12, 1.2);
  lamp.position.set(W / 2, 2.6, D / 2);
  scene.add(hemi, key, key.target, lamp);

  return {
    id: `int:${def.id}` as Location['id'],
    name: def.name,
    scene,
    grid,
    places,
    tappables,
    entries: { door: { x: W / 2, z: 0.6, faceX: W / 2, faceZ: D }, stairs: { x: stairX === 0 ? 1.5 : stairX - 0.5, z: 1.5, faceX: W / 2, faceZ: 0 } },
    camera: { bounds: { minX: W / 2, maxX: W / 2, minZ: D / 2 + 0.6, maxZ: D / 2 + 0.6 }, view: Math.max(8.5, W + 1.5), offsetZ: 0 },
    fadeOccluders: false,
    update: (_hour: number, t: number) => {
      lamp.intensity = 10 + Math.sin(t * 7) * 0.6;
    },
  };
}
