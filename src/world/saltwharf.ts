import * as THREE from 'three';
import { Lighting } from '../engine/Lighting';
import { Grid } from './grid';
import type { Location, MapRect, Place } from './location';
import { HOUSES } from './saltwharfHomes';
import { SPOTS, buildSpot } from './scavenge';
import { EXITS } from './exits';
import { mergeSubtree } from './merge';
import { C, mat } from './materials';
import {
  makeBarge, makeBarrel, makeBollard, makeBuilding, makeCrateStack, makeFence, makeLamp,
  makePawnBalls, makePunchingBag, makeSign, makeStall, rng, type BuildingStyle,
} from './props';

export const MAP_W = 44;
export const MAP_H = 40;

/**
 * Rows 0–3 are the Thames, 4–6 the quay, 7–8 Quay Street, 9–14 the north block, 15–16 Rope Walk,
 * 17–22 the south block, 23–26 Back Lane, 27–31 its houses, 32–34 Church Street, 35–39 St. Botolph's and more houses.
 * The east end (x 31–43) holds Hollow Lane's mouth and more houses.
 */
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
  const mapRectsLater: MapRect[] = [];
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
    const short: Record<string, string> = { warehouse: 'Warehouse', hester: 'Chandlery', coppercup: 'Copper Cup', dockoffice: 'Dock Office', tenements: 'Gull Court', pawnbroker: 'Moss\'s', clothier: 'Rag & Bone' };
    mapRectsLater.push({ x: def.x, z: def.z, w: def.w, d: def.d, label: short[def.id] ?? def.name, kind: def.id === 'tenements' ? 'house' : 'shop', placeId: def.id });
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
  // Gaps are left for the roads out: north up Gravel Lane (x 37–38), west along Back Lane (z 23–26).
  for (let x = -6; x < MAP_W + 6; x += 4) if (x !== 34 && x !== 38) backdrop(x, MAP_H, 4, 5);
  backdrop(34, MAP_H, 3, 5);
  backdrop(39, MAP_H, 3, 5);
  for (let z = 7; z < MAP_H; z += 5) {
    backdrop(-6, z, 6, 5);
    if ((z < 10 || z > 14) && z !== 22) backdrop(MAP_W, z, 6, 5);
  }
  backdrop(MAP_W, 22, 6, 1);
  // Hollow Lane: the rookery's mouth, east of the houses. A dark archway, and the lane beyond.
  backdrop(MAP_W, 10, 6, 1);
  backdrop(MAP_W, 14, 6, 1);

  // The roads out: fingerposts at the gaps, and the Wherry Stairs down to the watermen.
  const exitSign = (id: string, text: string, w: number, x: number, z: number, ry: number) => {
    const g = new THREE.Group();
    const sign = makeSign(text, w, '#1a1214', '#d8c080');
    sign.position.set(x, 3.2, z);
    sign.rotation.y = ry;
    g.add(sign);
    g.userData.placeId = `exit:${id}`;
    root.add(g);
    tappables.push(g);
  };
  exitSign('hollow', 'HOLLOW LANE', 2.6, MAP_W + 0.05, 12.5, -Math.PI / 2);
  exitSign('market', 'TO LANTERN MARKET', 3.6, MAP_W + 0.05, 24.5, -Math.PI / 2);
  exitSign('north', 'INKWELL ROW · GREYMOURNE', 3.0, 38, MAP_H + 0.05, Math.PI);
  {
    const g = new THREE.Group();
    const stage = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 2.2), mat(C.woodDark));
    stage.position.set(36.5, 0.05, 2.9);
    g.add(stage);
    for (const [px, pz] of [[35.5, 1.9], [37.5, 1.9], [35.5, 3.9], [37.5, 3.9]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), mat(C.wood));
      post.position.set(px, 0.2, pz);
      g.add(post);
    }
    const boat = makeBarge();
    boat.scale.set(0.35, 0.6, 0.35);
    boat.position.set(36.5, -0.2, 1.2);
    g.add(boat);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), mat(C.wood));
    post.position.set(35.2, 1.2, 4.4);
    g.add(post);
    const sign = makeSign('WHERRY STAIRS', 1.8, '#1a1214', '#d8c080');
    sign.position.set(35.2, 2.2, 4.32);
    sign.rotation.y = Math.PI;
    g.add(sign);
    g.userData.placeId = 'exit:wherry';
    root.add(g);
    tappables.push(g);
  }
  for (const e of EXITS) places.push({ id: `exit:${e.id}`, name: e.title, description: e.description, door: e.door, faceTo: { x: e.door.x + (e.id === 'market' || e.id === 'hollow' ? 1 : 0.5), z: e.door.z + (e.id === 'north' ? 1 : e.id === 'wherry' ? -1 : 0.5) } });

  // --- Houses: every family has a door --------------------------------------
  const mapRects: MapRect[] = [];
  HOUSES.forEach((hd, i) => {
    const hgt = 4.6 + (i % 3) * 0.9;
    const b = makeBuilding(hd.w, hd.d, hgt, { wall: hd.wall, roof: i % 2 ? C.roofSlate : C.roofTile, roofType: 'gable', trim: C.timber }, 400 + i * 23, { doorOffset: hd.doorX + 0.5 - (hd.x + hd.w / 2), faceNorth: true });
    b.position.set(hd.x + hd.w / 2, 0, hd.z + hd.d / 2);
    b.userData.placeId = `house:${hd.key}`;
    root.add(b);
    tappables.push(b);
    grid.blockRect(hd.x, hd.z, hd.w, hd.d);
    places.push({ id: `house:${hd.key}`, name: hd.name, description: 'A narrow terraced house: two rooms up, two down, and a family in each.', door: { x: hd.doorX, z: hd.z - 1 }, faceTo: { x: hd.doorX + 0.5, z: hd.z } });
    mapRects.push({ x: hd.x, z: hd.z, w: hd.w, d: hd.d, label: hd.name.replace(/ (Back Lane|Church Street|Quay Street|Rope Walk)$/, ''), kind: 'house', placeId: `house:${hd.key}` });
  });

  // St. Botolph-by-the-River: the church, its spire, and the clergy house door.
  const church = new THREE.Group();
  church.userData.placeId = 'church';
  const nave = makeBuilding(9, 5, 6.2, { wall: C.stone, roof: C.roofSlate, roofType: 'gable', trim: 0x4a4440 }, 777, { doorOffset: -0.5, faceNorth: true, sign: 'ST. BOTOLPH' });
  nave.position.set(5.5, 0, 37.5);
  church.add(nave);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 2), mat(C.stone));
  tower.position.set(2, 4.5, 36.5);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.5, 4), mat(C.roofSlate));
  spire.position.set(2, 11.2, 36.5);
  spire.rotation.y = Math.PI / 4;
  church.add(tower, spire);
  root.add(church);
  tappables.push(church);
  grid.blockRect(1, 35, 9, 5);
  places.push({ id: 'church', name: 'St. Botolph-by-the-River', description: 'A soot-black church older than the docks, with a spire you can see from the river. Father Hale keeps the door open, and the poor box empty.', door: { x: 5, z: 34 }, faceTo: { x: 5.5, z: 35 } });
  mapRects.push({ x: 1, z: 35, w: 9, d: 5, label: 'St. Botolph\'s', kind: 'church', placeId: 'church' });

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

  // Rubbish heaps, slop buckets and the foreshore: worth a rummage.
  for (const sp of SPOTS) {
    const g = buildSpot(sp);
    root.add(g);
    tappables.push(g);
    grid.block(sp.x, sp.z);
    places.push({ id: `scav:${sp.id}`, name: sp.name, description: sp.description, door: sp.stand, faceTo: { x: sp.x + 0.5, z: sp.z + 0.5 } });
  }

  // Lamps: gaslights, and one cold white Vane Lamp outside the hiring office.
  const lampTiles: [number, number, boolean][] = [
    [2, 6, false], [9, 6, false], [16, 6, false], [23, 6, false], [30, 6, false],
    [5, 15, false], [13, 15, false], [20, 15, false], [27, 15, true],
    [4, 23, false], [16, 23, false], [26, 23, false],
    [36, 6, false], [42, 15, false], [33, 23, false], [10, 32, false], [24, 32, false], [38, 32, false],
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
    camera: { bounds: { minX: 5, maxX: MAP_W - 5, minZ: 4, maxZ: MAP_H - 5 }, view: 14, offsetZ: 2 },
    map: {
      w: MAP_W, h: MAP_H,
      rects: [
        ...mapRectsLater, ...mapRects,
        { x: 8, z: 17, w: 9, d: 6, label: 'Market', kind: 'open', placeId: 'market' },
        { x: 27, z: 16, w: 4, d: 7, label: 'Yard', kind: 'open', placeId: 'boxing' },
      ],
      streets: [
        { x: 1, z: 5.2, label: 'The quay' }, { x: 1, z: 7.6, label: 'Quay Street' }, { x: 1, z: 15.6, label: 'Rope Walk' },
        { x: 1, z: 24.6, label: 'Back Lane' }, { x: 13, z: 33.6, label: 'Church Street' }, { x: 43.6, z: 12.4, label: '‹ Hollow Lane' },
        { x: 43.6, z: 24.4, label: '‹ to Lantern Market' }, { x: 43.4, z: 32.9, label: '˄ Gravel Lane, north' },
        { x: 38.6, z: 2.6, label: 'Wherry Stairs ˅' },
      ],
    },
    fadeOccluders: true,
    lamps: lamps.filter((l) => !l.vane).map((l) => ({ x: l.position.x, z: l.position.z })),
    update,
    setWeather: (w) => (lighting.weather = w),
  };
}
