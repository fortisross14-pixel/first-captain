import * as THREE from 'three';
import { createCharacter } from '../actors/characterModel';
import { Grid } from './grid';
import type { Location, Place } from './location';
import { C, mat } from './materials';
import { rng } from './props';

const W = 7;
const D = 5;
const WALL_H = 3;

function box(w: number, h: number, d: number, color: number | THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Mr. Pembleton: a translucent Georgian gentleman, bound to the building since 1790. */
export function makeGhost(): THREE.Group {
  const rig = createCharacter({
    skin: 0xffffff, hair: 0xffffff, coat: 0xffffff, trousers: 0xffffff, shirt: 0xffffff, boots: 0xffffff,
    scarf: 0xffffff, hat: 'top', build: 0.95,
  });
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0xaecbe0, emissive: 0x5d86a8, emissiveIntensity: 0.9, transparent: true, opacity: 0.55,
    depthWrite: false, flatShading: true,
  });
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = ghostMat;
      m.castShadow = false;
    }
  });
  // Tails of a Georgian coat.
  const tails = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.06), ghostMat);
  tails.position.set(0, 0.5, -0.2);
  rig.body.add(tails);
  rig.armL.rotation.x = -0.3;
  rig.armR.rotation.z = 0.5;
  const light = new THREE.PointLight(0x8fb8e0, 2.5, 3.5, 1.5);
  light.position.y = 1.1;
  rig.root.add(light);
  return rig.root;
}

export function buildHesterRoom(): Location {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  const grid = new Grid(W, D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) grid.setKind(x, z, 'street');
  const places: Place[] = [];
  const tappables: THREE.Object3D[] = [];

  const place = (
    id: string, name: string, description: string, obj: THREE.Object3D,
    door: { x: number; z: number }, faceTo: { x: number; z: number },
  ) => {
    obj.userData.placeId = id;
    scene.add(obj);
    tappables.push(obj);
    places.push({ id, name, description, door, faceTo });
  };

  // Floorboards
  const r = rng(31);
  const boardGeo = new THREE.BoxGeometry(W, 0.1, 0.48);
  for (let i = 0; i < D * 2; i++) {
    const c = new THREE.Color(0x4a3524).offsetHSL(0, 0, (r() - 0.5) * 0.05);
    const b = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
    b.position.set(W / 2, -0.05, i * 0.5 + 0.25);
    b.receiveShadow = true;
    scene.add(b);
  }

  // Walls: the far (south) wall and the two sides. The near wall is cut away for the camera.
  const wallM = mat(0x7a6c58);
  const damp = mat(0x4a4236);
  scene.add(box(W + 0.4, WALL_H, 0.2, wallM, W / 2, WALL_H / 2, D + 0.1));
  scene.add(box(0.2, WALL_H, D, wallM, W + 0.1, WALL_H / 2, D / 2));
  // West wall with a doorway at z 1–2.
  scene.add(box(0.2, WALL_H, 1, wallM, -0.1, WALL_H / 2, 0.5));
  scene.add(box(0.2, WALL_H, 3, wallM, -0.1, WALL_H / 2, 3.5));
  scene.add(box(0.2, 0.9, 1, wallM, -0.1, WALL_H - 0.45, 1.5));
  scene.add(box(W + 0.4, 0.25, 0.24, mat(C.woodDark), W / 2, 0.12, D + 0.02));
  scene.add(box(1.4, 1.1, 0.04, damp, 5.6, 2.2, D - 0.02));
  scene.add(box(0.04, 0.9, 1.3, damp, W - 0.02, 0.7, 1.2));

  // Window on the far wall: glass glows with the daylight outside.
  const glass = new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0x9fb0c0, emissiveIntensity: 0.6, flatShading: true });
  scene.add(box(1.1, 1.2, 0.05, glass, 3.5, 1.75, D - 0.03));
  scene.add(box(1.3, 0.1, 0.18, mat(C.woodDark), 3.5, 1.1, D - 0.06));
  scene.add(box(0.06, 1.2, 0.08, mat(C.woodDark), 3.5, 1.75, D - 0.05));
  scene.add(box(1.1, 0.06, 0.08, mat(C.woodDark), 3.5, 1.75, D - 0.05));

  // Bed against the far wall (tiles 0–1, 4)
  const bed = new THREE.Group();
  bed.add(box(2.0, 0.35, 0.95, mat(C.woodDark), 1, 0.25, 4.5));
  bed.add(box(1.9, 0.18, 0.85, mat(0x8a8070), 1, 0.5, 4.5));
  bed.add(box(1.3, 0.12, 0.88, mat(0x4a3a4a), 1.3, 0.62, 4.5));
  bed.add(box(0.45, 0.14, 0.6, mat(0xb8ae98), 0.3, 0.64, 4.5));
  bed.add(box(0.12, 0.9, 0.95, mat(C.woodDark), 0.04, 0.45, 4.5));
  place('bed', 'Old bed', 'A sagging horsehair mattress on a frame that complains when you sit. It is still better than the street.',
    bed, { x: 1, z: 3 }, { x: 1, z: 4.5 });
  grid.block(0, 4); grid.block(1, 4);

  // Hester's trunk at the foot of the bed
  const trunk = new THREE.Group();
  trunk.add(box(0.8, 0.5, 0.55, mat(0x4a3020), 2.5, 0.25, 4.6));
  trunk.add(box(0.84, 0.08, 0.59, mat(C.iron, 0.6, 0.4), 2.5, 0.42, 4.6));
  trunk.add(box(0.12, 0.14, 0.04, mat(C.brass, 0.35, 0.8), 2.5, 0.35, 4.31));
  place('trunk', "Hester's trunk", 'Locked tight. A brass plate on the lid has been rubbed smooth by someone\'s thumb, over many years.',
    trunk, { x: 2, z: 3 }, { x: 2.5, z: 4.6 });
  grid.block(2, 4);

  // Washstand with a cracked basin under the window
  const wash = new THREE.Group();
  wash.add(box(0.7, 0.8, 0.5, mat(C.wood), 4.5, 0.4, 4.6));
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.14, 8), mat(0xd0ccc0));
  basin.position.set(4.5, 0.87, 4.6);
  wash.add(basin);
  wash.add(box(0.02, 0.15, 0.3, mat(0x5a5040), 4.55, 0.88, 4.6));
  place('basin', 'Cracked washbasin', 'Cold water and a sliver of carbolic soap. The crack has been mended with candle wax.',
    wash, { x: 4, z: 3 }, { x: 4.5, z: 4.6 });
  grid.block(4, 4);

  // Cast-iron stove with a pipe through the ceiling
  const stove = new THREE.Group();
  stove.add(box(0.75, 0.75, 0.6, mat(C.iron, 0.7, 0.4), 6.4, 0.38, 4.5));
  stove.add(box(0.8, 0.06, 0.65, mat(0x2a2a2a, 0.6, 0.5), 6.4, 0.78, 4.5));
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 6), mat(C.iron, 0.6, 0.5));
  pipe.position.set(6.5, 1.95, 4.6);
  stove.add(pipe);
  place('stove', 'Cold stove', 'No coal, no kindling, nothing to cook. It has not been lit since Hester died.',
    stove, { x: 6, z: 3 }, { x: 6.4, z: 4.5 });
  grid.block(6, 4);

  // Larder cupboard on the east wall
  const larder = new THREE.Group();
  larder.add(box(0.5, 1.6, 0.9, mat(C.wood), 6.72, 0.8, 1.5));
  larder.add(box(0.04, 1.4, 0.38, mat(C.woodDark), 6.45, 0.85, 1.28));
  larder.add(box(0.04, 1.4, 0.38, mat(C.woodDark), 6.45, 0.85, 1.72));
  place('larder', 'Larder', 'A narrow cupboard that smells of old cheese.', larder, { x: 5, z: 1 }, { x: 6.7, z: 1.5 });
  grid.block(6, 1);

  // Table, chair and candle
  const table = new THREE.Group();
  table.add(box(0.9, 0.06, 0.7, mat(C.wood), 3.5, 0.75, 2.5));
  for (const dx of [-0.38, 0.38]) for (const dz of [-0.28, 0.28]) table.add(box(0.06, 0.72, 0.06, mat(C.woodDark), 3.5 + dx, 0.36, 2.5 + dz));
  table.add(box(0.45, 0.05, 0.45, mat(C.woodDark), 3.5, 0.45, 1.75));
  table.add(box(0.45, 0.5, 0.05, mat(C.woodDark), 3.5, 0.72, 1.55));
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0xffb050, emissiveIntensity: 0.4 }));
  candle.position.set(3.6, 0.87, 2.6);
  table.add(candle);
  scene.add(table);
  grid.block(3, 2);

  // The doorway down to the street
  const door = new THREE.Group();
  door.add(box(0.06, 2.1, 0.9, mat(C.woodDark), 0.02, 1.05, 1.5));
  door.rotation.y = 0;
  place('door', 'Stairs down', 'Two flights of crooked stairs down to Quay Street.', door, { x: 0, z: 1 }, { x: -1, z: 1.5 });

  // Mr. Pembleton
  const ghost = makeGhost();
  ghost.position.set(5.5, 0.15, 2.5);
  ghost.rotation.y = -Math.PI / 2 - 0.6;
  place('pembleton', 'Mr. Pembleton', 'Late of this parish. Very late.', ghost, { x: 4, z: 2 }, { x: 5.5, z: 2.5 });
  grid.block(5, 2);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xb0b8c8, 0x4a3828, 1.4);
  scene.add(hemi);
  const windowLight = new THREE.DirectionalLight(0xc8d4e0, 1.4);
  windowLight.position.set(3.5, 6, D + 4);
  windowLight.target.position.set(3.5, 0, 1.5);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(1024, 1024);
  const sc = windowLight.shadow.camera;
  sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6;
  scene.add(windowLight, windowLight.target);
  const candleLight = new THREE.PointLight(0xffa850, 0, 7, 1.3);
  candleLight.position.set(3.6, 1.2, 2.6);
  scene.add(candleLight);

  const update = (hour: number, t: number) => {
    const day = THREE.MathUtils.smoothstep(hour, 5.5, 7.5) * (1 - THREE.MathUtils.smoothstep(hour, 17, 19));
    windowLight.intensity = 0.35 + day * 2.2;
    windowLight.color.setHex(day > 0.3 ? 0xd8dce0 : 0x6f84b0);
    glass.emissiveIntensity = 0.15 + day * 0.8;
    glass.emissive.setHex(day > 0.3 ? 0xa8b4c0 : 0x2a3a5a);
    hemi.intensity = 1.0 + day * 0.7;
    const night = 1 - day;
    candleLight.intensity = night * (9 + Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.4);
    (candle.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + night * 2;
    ghost.position.y = 0.15 + Math.sin(t * 1.3) * 0.06;
  };

  return {
    id: 'hesterRoom',
    name: "Hester's room",
    scene,
    grid,
    places,
    tappables,
    entries: {
      door: { x: 0.5, z: 1.5, faceX: 3, faceZ: 1.5 },
      bed: { x: 1.5, z: 3.5, faceX: 3, faceZ: 2 },
    },
    camera: { bounds: { minX: 3.5, maxX: 3.5, minZ: 4.8, maxZ: 4.8 }, view: 8.2, offsetZ: 0 },
    fadeOccluders: false,
    update,
  };
}
