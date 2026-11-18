import * as THREE from 'three';
import { Lighting } from '../engine/Lighting';
import { Grid } from './grid';
import type { Location, Place } from './location';
import { mergeSubtree } from './merge';
import { C, mat } from './materials';
import {
  makeBarge, makeBarrel, makeBollard, makeBuilding, makeCrateStack, makeFence, makeLamp,
  makePawnBalls, makePunchingBag, makeStall, rng, type BuildingStyle,
} from './props';

export const MAP_W = 32;
export const MAP_H = 26;

/** Rows 0–3 are the Thames, 4–6 the quay, 7–8 Quay Street, 9–14 the north block, 15–16 Rope Walk, 17–22 the south block. */
const WATER_ROWS = 4;
const QUAY_END = 7;

interface BuildingDef {
  id: string;
  name: string;
  description: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  doorX: number;
  faceNorth: boolean;
  sign?: string;
  style: BuildingStyle;
}

const BUILDINGS: BuildingDef[] = [
  {
    id: 'warehouse', name: 'Bellamy & Sons Warehouse', x: 1, z: 9, w: 7, d: 6, h: 5.2, doorX: 4, faceNorth: true,
    sign: 'BELLAMY & SONS', style: { wall: C.brickSoot, roof: C.roofSlate, roofType: 'gable' },
    description: 'Tea, rope and tallow stacked to the rafters. The foreman hires by the day when the ships come in.',
  },
  {
    id: 'hester', name: "Hester's Building", x: 9, z: 9, w: 5, d: 6, h: 6.4, doorX: 11, faceNorth: true,
    sign: "PELL'S CHANDLERY", style: { wall: C.brickRed, roof: C.roofTile, roofType: 'gable', trim: 0x2a1f18 },
    description: "Pell's Chandlery sells candles and ship's stores downstairs. Your late aunt's room is up two flights of crooked stairs. Rent is due at the end of the month.",
  },
  {
    id: 'coppercup', name: 'The Copper Cup', x: 15, z: 9, w: 7, d: 6, h: 4.6, doorX: 18, faceNorth: true,
    sign: 'THE COPPER CUP', style: { wall: C.plaster, roof: C.roofTile, roofType: 'gable', trim: C.timber },
    description: 'A low, warm dockside tavern. Bessa Hartigan runs it and is always short of hands behind the bar.',
  },
  {
    id: 'dockoffice', name: 'Dock Hiring Office', x: 23, z: 9, w: 8, d: 6, h: 4.2, doorX: 26, faceNorth: true,
    sign: 'DOCK HIRING OFFICE', style: { wall: C.brickDark, roof: C.roofSlate, roofType: 'flat' },
    description: 'Where the stevedores are picked each morning. Strong backs wanted, no questions asked.',
  },
  {
    id: 'tenements', name: 'Gull Court Tenements', x: 1, z: 17, w: 6, d: 6, h: 6.8, doorX: 3, faceNorth: true,
    style: { wall: C.brickSoot, roof: C.roofSlate, roofType: 'gable' },
    description: 'Five storeys of damp rooms and too many families. Every window has a story, and most of them are sad.',
  },
  {
    id: 'pawnbroker', name: 'Moss the Pawnbroker', x: 17, z: 17, w: 5, d: 6, h: 5, doorX: 19, faceNorth: true,
    sign: 'PAWNBROKER', style: { wall: C.brickDark, roof: C.roofSlate, roofType: 'gable', trim: 0x2a2a2a },
    description: 'Three brass balls over the door. Moss buys anything and asks nothing, at a fraction of what it is worth.',
  },
  {
    id: 'clothier', name: 'Rag & Bone Clothiers', x: 23, z: 17, w: 4, d: 6, h: 4.6, doorX: 24, faceNorth: true,
    sign: 'RAG & BONE', style: { wall: C.plaster, roof: C.roofTile, roofType: 'gable', trim: 0x3a2a20 },
    description: 'Secondhand coats, boots and bonnets. Some still smell of their last owner.',
  },
];

export const CAMERA_DISTANCE = 40;

export function buildSaltwharf(): Location {
  const scene = new THREE.Scene();
  const grid = new Grid(MAP_W, MAP_H);
  const places: Place[] = [];
  const tappables: THREE.Object3D[] = [];
  const lamps: { position: THREE.Vector3; vane: boolean }[] = [];
  const root = new THREE.Group();
  root.name = 'saltwharf';
  scene.add(root);

  // --- Ground -------------------------------------------------------------
  for (let z = 0; z < MAP_H; z++) {
    for (let x = 0; x < MAP_W; x++) {
      if (z < WATER_ROWS) grid.setKind(x, z, 'water');
      else if (z < QUAY_END) grid.setKind(x, z, 'quay');
    }
  }
  for (let z = 18; z <= 20; z++) grid.setKind(29, z, 'yard');

  const r = rng(1871);
  const tileGeo = new THREE.BoxGeometry(0.97, 0.12, 0.97);
  const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const landTiles = MAP_W * (MAP_H - WATER_ROWS);
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, landTiles);
  tiles.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  let n = 0;
  for (let z = WATER_ROWS; z < MAP_H; z++) {
    for (let x = 0; x < MAP_W; x++) {
      const kind = grid.kind(x, z);
      const base = kind === 'quay' ? C.quay : kind === 'yard' ? C.yard : C.cobble;
      m4.makeTranslation(x + 0.5, -0.06 + (r() - 0.5) * 0.02, z + 0.5);
      tiles.setMatrixAt(n, m4);
      col.setHex(base).offsetHSL(0, 0, (r() - 0.5) * 0.06);
      tiles.setColorAt(n, col);
      n++;
    }
  }
  root.add(tiles);

  // Bedrock under the tiles so gaps read as mortar.
  const bed = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 16, 1, MAP_H - WATER_ROWS + 10), mat(0x24221f));
  bed.position.set(MAP_W / 2, -0.62, WATER_ROWS + (MAP_H - WATER_ROWS + 10) / 2);
  bed.receiveShadow = true;
  root.add(bed);

  // Quay wall dropping into the river.
  const wall = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 16, 1.4, 0.4), mat(C.quayEdge));
  wall.position.set(MAP_W / 2, -0.7, WATER_ROWS - 0.2);
  root.add(wall);

  // --- River --------------------------------------------------------------
  const waterGeo = new THREE.PlaneGeometry(MAP_W + 40, 22, 36, 11).toNonIndexed();
  waterGeo.rotateX(-Math.PI / 2);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array as Float32Array);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.35, metalness: 0.1, flatShading: true }));
  water.position.set(MAP_W / 2, -0.45, WATER_ROWS - 11);
  water.receiveShadow = true;
  root.add(water);

  const barge = makeBarge();
  barge.position.set(8, -0.25, 2);
  root.add(barge);
  const barge2 = makeBarge();
  barge2.scale.setScalar(0.8);
  barge2.rotation.y = Math.PI;
  barge2.position.set(23, -0.25, 1.4);
  root.add(barge2);

  // Far bank silhouettes, softened by fog.
  const far = rng(9);
  for (let i = 0; i < 16; i++) {
    const w = 3 + far() * 4;
    const h = 4 + far() * 8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), mat(0x2a2c2e));
    b.position.set(-12 + i * 4.2, h / 2 - 0.5, -16 - far() * 3);
    root.add(b);
  }

  // --- Buildings ----------------------------------------------------------
  BUILDINGS.forEach((def, i) => {
    const doorOffset = def.doorX + 0.5 - (def.x + def.w / 2);
    const b = makeBuilding(def.w, def.d, def.h, def.style, 100 + i * 17, { doorOffset, faceNorth: def.faceNorth, sign: def.sign });
    b.position.set(def.x + def.w / 2, 0, def.z + def.d / 2);
    b.userData.placeId = def.id;
    root.add(b);
    tappables.push(b);
    grid.blockRect(def.x, def.z, def.w, def.d);
    const doorZ = def.faceNorth ? def.z - 1 : def.z + def.d;
    places.push({
      id: def.id, name: def.name, description: def.description,
      door: { x: def.doorX, z: doorZ },
      faceTo: { x: def.doorX + 0.5, z: def.faceNorth ? def.z : def.z + def.d },
    });
    if (def.id === 'pawnbroker') {
      const balls = makePawnBalls();
      balls.position.set(def.doorX + 1.3, 2.9, def.z);
      balls.rotation.y = Math.PI;
      root.add(balls);
    }
  });

  // Backdrop terraces closing off the district to the south, west and east.
  const back = rng(77);
  const backdrop = (x: number, z: number, w: number, d: number) => {
    const h = 5 + back() * 4;
    const style: BuildingStyle = { wall: [C.brickSoot, C.brickDark, C.brickRed][Math.floor(back() * 3)], roof: C.roofSlate, roofType: 'gable' };
    const b = makeBuilding(w, d, h, style, Math.floor(back() * 1000), { doorOffset: 0, faceNorth: true });
    b.position.set(x + w / 2, 0, z + d / 2);
    root.add(b);
  };
  for (let x = -6; x < MAP_W + 6; x += 4) backdrop(x, 25, 4, 5);
  for (let z = 7; z < 25; z += 5) {
    backdrop(-6, z, 6, 5);
    backdrop(MAP_W, z, 6, 5);
  }
  for (let x = 0; x < MAP_W; x++) grid.block(x, 25);

  // --- Market corner and boxing yard -------------------------------------
  const stalls: [number, number, number, number[]][] = [
    [9, 18, C.canvasRed, [0x9a2a20, 0xb04030, 0x8a8a2a]],
    [12, 18, C.canvasGreen, [0xc0a060, 0xa08040, 0xd0b070]],
    [9, 21, C.canvasOchre, [0x6a7a8a, 0x5a6a7a, 0x7a8a9a]],
    [12, 21, C.canvasRed, [0x6a8a3a, 0x8a5a2a, 0x7a9a4a]],
  ];
  for (const [x, z, canvas, goods] of stalls) {
    const s = makeStall(canvas, goods);
    s.position.set(x + 1, 0, z + 0.5);
    s.userData.placeId = 'market';
    root.add(s);
    tappables.push(s);
    grid.block(x, z);
    grid.block(x + 1, z);
  }
  places.push({
    id: 'market', name: 'Saltwharf Market',
    description: 'Eel pies, hot potatoes, yesterday\'s bread and fish of uncertain age. Cheap enough to keep you alive.',
    door: { x: 11, z: 19 }, faceTo: { x: 11.5, z: 18.5 },
  });

  // Boxing yard: fenced 3×5, gate on the north side.
  const yard = new THREE.Group();
  yard.userData.placeId = 'boxing';
  const fenceN1 = makeFence(1); fenceN1.position.set(28.5, 0, 17.05); yard.add(fenceN1);
  const fenceN2 = makeFence(1); fenceN2.position.set(30.5, 0, 17.05); yard.add(fenceN2);
  const fenceS = makeFence(3); fenceS.position.set(29.5, 0, 21.95); yard.add(fenceS);
  const fenceW = makeFence(5); fenceW.rotation.y = Math.PI / 2; fenceW.position.set(28.05, 0, 19.5); yard.add(fenceW);
  const fenceE = makeFence(5); fenceE.rotation.y = Math.PI / 2; fenceE.position.set(30.95, 0, 19.5); yard.add(fenceE);
  const bag = makePunchingBag(); bag.position.set(29.5, 0, 21); yard.add(bag);
  root.add(yard);
  tappables.push(yard);
  for (let z = 17; z <= 21; z++) { grid.block(28, z); grid.block(30, z); }
  grid.block(29, 21);
  places.push({
    id: 'boxing', name: 'The Boxing Yard',
    description: 'Mud, sawdust and a punching bag that has seen better decades. Nell Hartigan trains here at dawn.',
    door: { x: 29, z: 16 }, faceTo: { x: 29.5, z: 18 },
  });

  // --- Small props --------------------------------------------------------
  const crateTiles = [[5, 5], [6, 5], [13, 4], [14, 5], [26, 5], [1, 7], [7, 16], [27, 22], [16, 22]];
  crateTiles.forEach(([x, z], i) => {
    const c = makeCrateStack(i * 13 + 5);
    c.position.set(x + 0.5, 0, z + 0.5);
    root.add(c);
    grid.block(x, z);
  });
  const barrelTiles = [[20, 5], [21, 5], [15, 4], [14, 18], [8, 22], [22, 16], [31, 8]];
  barrelTiles.forEach(([x, z]) => {
    const b = makeBarrel();
    b.position.set(x + 0.5, 0, z + 0.5);
    root.add(b);
    grid.block(x, z);
  });
  for (const x of [3, 10, 18, 29]) {
    const b = makeBollard();
    b.position.set(x + 0.5, 0, WATER_ROWS + 0.25);
    root.add(b);
    grid.block(x, WATER_ROWS);
  }

  // Lamps: gaslights, and one cold white Vane Lamp outside the hiring office.
  const lampTiles: [number, number, boolean][] = [
    [2, 6, false], [9, 6, false], [16, 6, false], [23, 6, false], [30, 6, false],
    [5, 15, false], [13, 15, false], [20, 15, false], [27, 15, true],
    [4, 23, false], [16, 23, false], [26, 23, false],
  ];
  for (const [x, z, vane] of lampTiles) {
    const { group, lightY } = makeLamp(vane);
    group.position.set(x + 0.5, 0, z + 0.5);
    root.add(group);
    grid.block(x, z);
    lamps.push({ position: new THREE.Vector3(x + 0.5, lightY, z + 0.5), vane });
  }

  // --- Merge static scenery to save draw calls ------------------------------
  // Tappable groups merge on their own, so fading one building still works.
  for (const t of tappables) mergeSubtree(t);
  mergeSubtree(barge);
  mergeSubtree(barge2);
  const statics = new THREE.Group();
  for (const c of [...root.children]) {
    if (tappables.includes(c) || c === water || c === tiles || c === barge || c === barge2) continue;
    statics.add(c);
  }
  root.add(statics);
  mergeSubtree(statics);

  const lighting = new Lighting(scene, new THREE.Vector3(MAP_W / 2, 0, MAP_H / 2), lamps, CAMERA_DISTANCE);


  // --- Animation ----------------------------------------------------------
  const pos = waterGeo.attributes.position as THREE.BufferAttribute;
  const update = (hour: number, t: number) => {
    lighting.update(hour, t);
    for (let i = 0; i < pos.count; i++) {
      const bx = waterBase[i * 3];
      const bz = waterBase[i * 3 + 2];
      pos.setY(i, Math.sin(bx * 0.6 + t * 0.9) * 0.08 + Math.cos(bz * 0.9 + t * 0.7) * 0.06);
    }
    pos.needsUpdate = true;
    waterGeo.computeVertexNormals();
    barge.position.y = -0.25 + Math.sin(t * 0.8) * 0.05;
    barge.rotation.z = Math.sin(t * 0.6) * 0.015;
    barge2.position.y = -0.25 + Math.sin(t * 0.7 + 1) * 0.05;
  };

  return {
    id: 'saltwharf',
    name: 'Saltwharf Docks',
    scene,
    grid,
    places,
    tappables,
    entries: {
      hester: { x: 11.5, z: 8.5, faceX: 11.5, faceZ: 6 },
    },
    camera: { bounds: { minX: 5, maxX: MAP_W - 5, minZ: 9, maxZ: MAP_H - 6 }, view: 14, offsetZ: 2 },
    fadeOccluders: true,
    lamps: lamps.filter((l) => !l.vane).map((l) => ({ x: l.position.x, z: l.position.z })),
    update,
  };
}
