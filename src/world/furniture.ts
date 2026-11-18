import * as THREE from 'three';
import { C, mat } from './materials';

/**
 * Furniture for Hester's room. Every piece is built in its own space: its footprint is
 * centred on the origin with its back toward +z, and `rot` turns it in quarter turns.
 * Floor pieces block their tiles; rugs lie under things; wall pieces hang on the far wall.
 */
export type FurnitureType =
  | 'bed' | 'trunk' | 'basin' | 'stove' | 'larder' | 'table' | 'rug' | 'curtains' | 'bookshelf' | 'mirror' | 'workbench'
  | 'armchair' | 'wardrobe' | 'plant' | 'painting' | 'clock' | 'lamp' | 'cradle';

export interface FurnitureDef {
  type: FurnitureType;
  name: string;
  w: number;
  d: number;
  kind: 'floor' | 'rug' | 'wall';
  /** Colour choices for the part that can be recoloured. */
  colors: number[];
  /** What it's called when you tap it, and what it says. */
  title: string;
  text: string;
  /** Adds to the room's comfort. */
  comfort?: number;
  /** Can't be sold or thrown out (Hester's things). */
  keep?: boolean;
}

export const FURNITURE: Record<FurnitureType, FurnitureDef> = {
  bed: { type: 'bed', name: 'Bed', w: 2, d: 1, kind: 'floor', colors: [0x4a3a4a, 0x6a2a32, 0x2e3a6a, 0x3a4a3a, 0x8a7a5a], title: 'Bed', text: 'Horsehair and old springs. Better than the street.', keep: true },
  trunk: { type: 'trunk', name: 'Hester\'s trunk', w: 1, d: 1, kind: 'floor', colors: [0x4a3020], title: 'Hester\'s trunk', text: 'A brass plate on the lid has been rubbed smooth by someone\'s thumb, over many years.', keep: true },
  basin: { type: 'basin', name: 'Washstand', w: 1, d: 1, kind: 'floor', colors: [0x6b4a2e, 0x3a2818, 0x8a7a68], title: 'Washstand', text: 'Cold water and a sliver of carbolic soap.', keep: true },
  stove: { type: 'stove', name: 'Stove', w: 1, d: 1, kind: 'floor', colors: [0x1f2124], title: 'Stove', text: 'Cast iron, with a pipe through the ceiling.', keep: true },
  larder: { type: 'larder', name: 'Larder', w: 1, d: 1, kind: 'floor', colors: [0x6b4a2e, 0x3a2818, 0x5a6a5a], title: 'Larder', text: 'A narrow cupboard that smells of old cheese.', keep: true },
  table: { type: 'table', name: 'Table and chair', w: 1, d: 1, kind: 'floor', colors: [0x6b4a2e, 0x3a2818, 0x8a6a4a], title: 'Table and chair', text: 'A rickety table, one chair and a candle stub. Hester read here every night.', keep: true },
  rug: { type: 'rug', name: 'Turkey rug', w: 3, d: 2, kind: 'rug', colors: [0x6a2a32, 0x2e3a6a, 0x3a5a3a, 0x7a5a2a, 0x4a2a4a], title: 'Turkey rug', text: 'Red and blue and only slightly moth-eaten.', comfort: 1 },
  curtains: { type: 'curtains', name: 'Velvet curtains', w: 2, d: 1, kind: 'wall', colors: [0x5a1f2e, 0x1f2e5a, 0x2e4a2e, 0x4a3a2a, 0x3a2a4a], title: 'Velvet curtains', text: 'Darker nights, deeper sleep.', comfort: 1 },
  bookshelf: { type: 'bookshelf', name: 'Bookshelf', w: 1, d: 1, kind: 'floor', colors: [0x3a2818, 0x6b4a2e, 0x2a2a2a], title: 'Bookshelf', text: 'Sermons, sea stories, a ladies\' almanac for 1849 and three volumes on the drainage of the Fens.', comfort: 1 },
  mirror: { type: 'mirror', name: 'Looking-glass', w: 1, d: 1, kind: 'wall', colors: [0xb08a3e, 0x2a2a2a, 0x8a8a90], title: 'Looking-glass', text: 'Speckled at the edges. It is kinder than most mirrors.', comfort: 1 },
  workbench: { type: 'workbench', name: 'Workbench', w: 1, d: 1, kind: 'floor', colors: [0x6b4a2e, 0x3a2818], title: 'Workbench', text: 'A vice, a gouge, a pot of glue and a pile of river driftwood.' },
  armchair: { type: 'armchair', name: 'Armchair', w: 1, d: 1, kind: 'floor', colors: [0x6a2a32, 0x2e3a6a, 0x3a5a3a, 0x7a6a4a, 0x2a2a2a], title: 'Armchair', text: 'Sagging, button-backed, and the best seat in Saltwharf.', comfort: 1 },
  wardrobe: { type: 'wardrobe', name: 'Wardrobe', w: 1, d: 1, kind: 'floor', colors: [0x3a2818, 0x6b4a2e, 0x5a4a3a], title: 'Wardrobe', text: 'Your clothes hang straight and keep longer in it.', comfort: 1 },
  plant: { type: 'plant', name: 'Aspidistra', w: 1, d: 1, kind: 'floor', colors: [0x8a4a2a, 0x3a5a6a, 0xd8ccb0], title: 'Aspidistra', text: 'The cast-iron plant: it survives darkness, gas fumes and neglect. Like everyone else here.', comfort: 1 },
  painting: { type: 'painting', name: 'Seascape', w: 1, d: 1, kind: 'wall', colors: [0xb08a3e, 0x3a2818, 0x2a2a2a], title: 'Seascape', text: 'A ship in a storm, by nobody in particular. It makes the room feel bigger.', comfort: 1 },
  clock: { type: 'clock', name: 'Wall clock', w: 1, d: 1, kind: 'wall', colors: [0x6b4a2e, 0x2a2a2a], title: 'Wall clock', text: 'It ticks louder than it should, and slightly fast.', comfort: 1 },
  lamp: { type: 'lamp', name: 'Oil lamp', w: 1, d: 1, kind: 'floor', colors: [0xb08a3e, 0x6a8aa0, 0x8a3a2a], title: 'Oil lamp', text: 'Read after dark without burning candles.' },
  cradle: { type: 'cradle', name: 'Cradle', w: 1, d: 1, kind: 'floor', colors: [0x8a6a4a, 0xd8ccb0, 0x6a8aa0], title: 'Cradle', text: 'Rocks if you breathe on it. Babies sleep better in it, and so do their parents.', comfort: 1 },
};

export interface HomeItem {
  uid: number;
  type: FurnitureType;
  x: number;
  z: number;
  rot: number;
  color: number;
  stored?: boolean;
}

export interface HomeLayout {
  items: HomeItem[];
  wall: number;
  floor: number;
}

export const WALL_COLORS = [0x7a6c58, 0x5a6a6a, 0x6a5a4a, 0x4a5a4a, 0x6a4a4a, 0x8a8070, 0x3a4458];
export const FLOOR_COLORS = [0x4a3524, 0x3a2a1c, 0x5a4a38, 0x2a2420, 0x6a5440];

/** Hester's room as she left it, plus anything bought before furniture could be moved. */
export function defaultLayout(owned: string[]): HomeLayout {
  let uid = 1;
  const it = (type: FurnitureType, x: number, z: number, rot = 0, color = FURNITURE[type].colors[0]): HomeItem => ({ uid: uid++, type, x, z, rot, color });
  const items = [it('bed', 0, 4), it('trunk', 2, 4), it('basin', 4, 4), it('stove', 6, 4), it('larder', 6, 1, 1), it('table', 3, 2)];
  if (owned.includes('rug')) items.push(it('rug', 2, 2));
  if (owned.includes('curtains')) items.push(it('curtains', 3, 4));
  if (owned.includes('bookshelf')) items.push(it('bookshelf', 5, 4));
  if (owned.includes('mirror')) items.push(it('mirror', 4, 4));
  if (owned.includes('workbench')) items.push(it('workbench', 3, 4));
  return { items, wall: 0x7a6c58, floor: 0x4a3524 };
}

/** Tiles a piece covers at a position and rotation. */
export function footprint(type: FurnitureType, x: number, z: number, rot: number): { x: number; z: number }[] {
  const def = FURNITURE[type];
  const turned = rot % 2 === 1;
  const w = turned ? def.d : def.w;
  const d = turned ? def.w : def.d;
  const out: { x: number; z: number }[] = [];
  for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, z: z + dz });
  return out;
}

function box(w: number, h: number, d: number, color: number | THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Build one piece of furniture, in its own space. */
export function buildFurniture(type: FurnitureType, color: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(C.woodDark);
  switch (type) {
    case 'bed':
      g.add(box(2.0, 0.35, 0.95, wood, 0, 0.25, 0), box(1.9, 0.18, 0.85, 0x8a8070, 0, 0.5, 0), box(1.3, 0.12, 0.88, color, 0.3, 0.62, 0), box(0.45, 0.14, 0.6, 0xb8ae98, -0.7, 0.64, 0), box(0.12, 0.9, 0.95, wood, -0.96, 0.45, 0));
      break;
    case 'trunk':
      g.add(box(0.8, 0.5, 0.55, color, 0, 0.25, 0.1), box(0.84, 0.08, 0.59, mat(C.iron, 0.6, 0.4), 0, 0.42, 0.1), box(0.12, 0.14, 0.04, mat(C.brass, 0.35, 0.8), 0, 0.35, -0.19));
      break;
    case 'basin': {
      g.add(box(0.7, 0.8, 0.5, color, 0, 0.4, 0.1));
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.14, 8), mat(0xd0ccc0));
      b.position.set(0, 0.87, 0.1);
      g.add(b);
      break;
    }
    case 'stove': {
      g.add(box(0.75, 0.75, 0.6, mat(C.iron, 0.7, 0.4), 0, 0.38, 0), box(0.8, 0.06, 0.65, mat(0x2a2a2a, 0.6, 0.5), 0, 0.78, 0));
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 6), mat(C.iron, 0.6, 0.5));
      pipe.position.set(0.1, 1.95, 0.1);
      g.add(pipe);
      break;
    }
    case 'larder':
      g.add(box(0.9, 1.6, 0.5, color, 0, 0.8, 0.22), box(0.38, 1.4, 0.04, wood, -0.22, 0.85, -0.05), box(0.38, 1.4, 0.04, wood, 0.22, 0.85, -0.05));
      break;
    case 'table': {
      g.add(box(0.9, 0.06, 0.7, color, 0, 0.75, 0));
      for (const dx of [-0.38, 0.38]) for (const dz of [-0.28, 0.28]) g.add(box(0.06, 0.72, 0.06, wood, dx, 0.36, dz));
      g.add(box(0.45, 0.05, 0.45, wood, 0, 0.45, -0.75), box(0.45, 0.5, 0.05, wood, 0, 0.72, -0.95));
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0xffb050, emissiveIntensity: 0.6 }));
      candle.position.set(0.1, 0.87, 0.1);
      candle.name = 'candle';
      g.add(candle);
      break;
    }
    case 'rug':
      g.add(box(2.6, 0.03, 1.7, color, 0, 0.02, 0), box(2.2, 0.035, 1.3, new THREE.Color(color).lerp(new THREE.Color(0x2e3a6a), 0.5).getHex(), 0, 0.025, 0), box(1.2, 0.04, 0.5, C.brass, 0, 0.03, 0));
      break;
    case 'curtains':
      for (const dx of [-0.75, 0.75]) g.add(box(0.35, 1.7, 0.08, color, dx, 1.85, 0.41));
      g.add(box(1.9, 0.12, 0.1, mat(C.brass, 0.4, 0.7), 0, 2.75, 0.41));
      break;
    case 'bookshelf': {
      g.add(box(0.8, 1.9, 0.35, color, 0, 0.95, 0.28));
      const cols = [0x6a2a2a, 0x2e4a3a, 0x3a3a6a, 0x7a5a2a, 0x4a2a4a, 0x2a3a4a];
      for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) g.add(box(0.12, 0.42, 0.25, cols[(i + row * 2) % cols.length], -0.28 + i * 0.14, 0.42 + row * 0.6, 0.22));
      break;
    }
    case 'mirror':
      g.add(box(0.5, 0.7, 0.05, mat(color, 0.4, 0.7), 0, 1.95, 0.46), box(0.4, 0.6, 0.03, new THREE.MeshStandardMaterial({ color: 0x9fb6cc, roughness: 0.05, metalness: 0.9, flatShading: true }), 0, 1.95, 0.43));
      break;
    case 'workbench':
      g.add(box(1.0, 0.08, 0.6, color, 0, 0.8, 0.05));
      for (const dx of [-0.42, 0.42]) g.add(box(0.08, 0.78, 0.5, wood, dx, 0.39, 0.05));
      g.add(box(0.25, 0.12, 0.15, 0x8a6a4a, -0.2, 0.9, 0), box(0.05, 0.05, 0.3, mat(C.iron, 0.6, 0.5), 0.25, 0.86, 0));
      break;
    case 'armchair':
      g.add(box(0.75, 0.4, 0.7, color, 0, 0.3, 0), box(0.75, 0.6, 0.18, color, 0, 0.75, 0.27), box(0.14, 0.3, 0.7, color, -0.33, 0.6, 0), box(0.14, 0.3, 0.7, color, 0.33, 0.6, 0));
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.25, 0.25]) g.add(box(0.07, 0.12, 0.07, wood, dx, 0.06, dz));
      break;
    case 'wardrobe':
      g.add(box(0.9, 2.2, 0.55, color, 0, 1.1, 0.18), box(0.02, 1.9, 0.02, mat(C.brass, 0.35, 0.8), 0, 1.1, -0.1), box(0.95, 0.1, 0.6, wood, 0, 2.25, 0.18));
      break;
    case 'plant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 8), mat(color));
      pot.position.set(0, 0.16, 0);
      g.add(pot);
      for (let i = 0; i < 6; i++) {
        const leaf = box(0.08, 0.6, 0.02, 0x2e5a2e, Math.cos(i) * 0.1, 0.6, Math.sin(i) * 0.1);
        leaf.rotation.set(Math.sin(i * 2) * 0.5, i, Math.cos(i * 3) * 0.4);
        g.add(leaf);
      }
      break;
    }
    case 'painting':
      g.add(box(0.8, 0.6, 0.05, color, 0, 1.9, 0.46), box(0.68, 0.48, 0.03, 0x3a5a6a, 0, 1.9, 0.43), box(0.3, 0.12, 0.02, 0x8a7a5a, -0.1, 1.82, 0.41));
      break;
    case 'clock': {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), mat(0xefe6d2));
      face.rotation.x = Math.PI / 2;
      face.position.set(0, 2.1, 0.44);
      g.add(box(0.5, 0.55, 0.06, color, 0, 2.1, 0.47), face, box(0.02, 0.14, 0.02, 0x15110e, 0, 2.14, 0.41));
      break;
    }
    case 'lamp': {
      g.add(box(0.4, 0.7, 0.4, mat(C.woodDark), 0, 0.35, 0.1));
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 8), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 1.2 }));
      glass.position.set(0, 0.92, 0.1);
      g.add(glass, box(0.18, 0.06, 0.18, mat(color, 0.4, 0.7), 0, 0.75, 0.1));
      break;
    }
    case 'cradle':
      g.add(box(0.8, 0.35, 0.5, color, 0, 0.35, 0), box(0.85, 0.05, 0.12, wood, 0, 0.12, -0.2), box(0.85, 0.05, 0.12, wood, 0, 0.12, 0.2), box(0.7, 0.1, 0.4, 0xe0d8c8, 0, 0.5, 0));
      break;
  }
  return g;
}
