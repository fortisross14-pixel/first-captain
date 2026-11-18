import * as THREE from 'three';
import { createCharacter } from '../actors/characterModel';
import { Grid } from './grid';
import type { Location, Place } from './location';
import { C, mat } from './materials';
import { rng } from './props';
import { FURNITURE, buildFurniture, footprint, type HomeLayout } from './furniture';
import { HOMES_TO_LET, type HomeSpec } from './homes';

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
    scarf: 0xffffff, hat: 'top', build: 0.95, hairStyle: 'wig',
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

/** Your home: Hester's room by default, or wherever you have moved her trunk (and Pembleton) to. */
export function buildHesterRoom(spec: HomeSpec = HOMES_TO_LET.hester): Location {
  const W = spec.w;
  const D = spec.d;
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
  const floorBoards: THREE.Mesh[] = [];
  for (let i = 0; i < D * 2; i++) {
    const v = r();
    const c = new THREE.Color(0x4a3524).offsetHSL(0, 0, (v - 0.5) * 0.05);
    const b = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
    b.userData.v = v;
    floorBoards.push(b);
    b.position.set(W / 2, -0.05, i * 0.5 + 0.25);
    b.receiveShadow = true;
    scene.add(b);
  }

  // Walls: the far (south) wall and the two sides. The near wall is cut away for the camera.
  const wallM = new THREE.MeshStandardMaterial({ color: spec.wall, roughness: 0.9, flatShading: true });
  const damp = mat(0x4a4236);
  scene.add(box(W + 0.4, WALL_H, 0.2, wallM, W / 2, WALL_H / 2, D + 0.1));
  scene.add(box(0.2, WALL_H, D, wallM, W + 0.1, WALL_H / 2, D / 2));
  // West wall with a doorway at z 1–2.
  scene.add(box(0.2, WALL_H, 1, wallM, -0.1, WALL_H / 2, 0.5));
  scene.add(box(0.2, WALL_H, D - 2, wallM, -0.1, WALL_H / 2, 2 + (D - 2) / 2));
  scene.add(box(0.2, 0.9, 1, wallM, -0.1, WALL_H - 0.45, 1.5));
  scene.add(box(W + 0.4, 0.25, 0.24, mat(C.woodDark), W / 2, 0.12, D + 0.02));
  scene.add(box(1.4, 1.1, 0.04, damp, W - 1.4, 2.2, D - 0.02));
  scene.add(box(0.04, 0.9, 1.3, damp, W - 0.02, 0.7, 1.2));

  // Window on the far wall: glass glows with the daylight outside.
  const glass = new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0x9fb0c0, emissiveIntensity: 0.6, flatShading: true });
  for (const wx of spec.windows) {
    scene.add(box(1.1, 1.2, 0.05, glass, wx, 1.75, D - 0.03));
    scene.add(box(1.3, 0.1, 0.18, mat(C.woodDark), wx, 1.1, D - 0.06));
    scene.add(box(0.06, 1.2, 0.08, mat(C.woodDark), wx, 1.75, D - 0.05));
    scene.add(box(1.1, 0.06, 0.08, mat(C.woodDark), wx, 1.75, D - 0.05));
  }

  // The doorway down to the street
  const door = new THREE.Group();
  door.add(box(0.06, 2.1, 0.9, mat(C.woodDark), 0.02, 1.05, 1.5));
  door.rotation.y = 0;
  place('door', 'Stairs down', spec.id === 'cup' ? 'Down the back stairs into the taproom.' : spec.id === 'court' ? 'Three flights of stairs that smell of cabbage, down to Gull Court.' : 'Two flights of crooked stairs down to Quay Street.', door, { x: 0, z: 1 }, { x: -1, z: 1.5 });

  // Mr. Pembleton
  const ghost = makeGhost();
  ghost.position.set(spec.ghost.x + 0.5, 0.15, spec.ghost.z + 0.5);
  ghost.rotation.y = -Math.PI / 2 - 0.6;
  place('pembleton', 'Mr. Pembleton', 'Late of this parish. Very late.', ghost, { x: spec.ghost.x - 1, z: spec.ghost.z }, { x: spec.ghost.x + 0.5, z: spec.ghost.z + 0.5 });
  grid.block(spec.ghost.x, spec.ghost.z);

  // --- The furniture: rebuilt from your layout whenever it changes -----------
  const extras: Location['extras'] = {};
  const furnRoot = new THREE.Group();
  scene.add(furnRoot);
  let furnBlocked: { x: number; z: number }[] = [];
  const furnObjs = new Map<number, THREE.Object3D>();
  const fixedPlaces = places.length;
  const furnish = (layout: HomeLayout, cat: boolean) => {
    for (const t of furnBlocked) grid.unblock(t.x, t.z);
    furnBlocked = [];
    furnRoot.clear();
    furnObjs.clear();
    places.splice(fixedPlaces);
    tappables.splice(0, tappables.length, ...tappables.filter((o) => o.parent !== furnRoot && !o.userData.furniture));
    for (const m of floorBoards) (m.material as THREE.MeshStandardMaterial).color.setHex(new THREE.Color(layout.floor).offsetHSL(0, 0, ((m.userData.v as number) - 0.5) * 0.05).getHex());
    wallM.color.setHex(layout.wall);
    const seen = new Map<string, number>();
    for (const it of layout.items) {
      if (it.stored) continue;
      const def = FURNITURE[it.type];
      const obj = buildFurniture(it.type, it.color);
      const turned = it.rot % 2 === 1;
      const w = turned ? def.d : def.w;
      const d = turned ? def.w : def.d;
      const cx = it.x + w / 2;
      const cz = def.kind === 'wall' ? D - 0.5 : it.z + d / 2;
      obj.position.set(cx, 0, cz);
      obj.rotation.y = def.kind === 'wall' ? 0 : (it.rot * Math.PI) / 2;
      const n = (seen.get(it.type) ?? 0) + 1;
      seen.set(it.type, n);
      const id = n === 1 ? it.type : `${it.type}#${it.uid}`;
      obj.userData.placeId = id;
      obj.userData.furniture = it.uid;
      furnRoot.add(obj);
      furnObjs.set(it.uid, obj);
      tappables.push(obj);
      if (def.kind === 'floor') {
        for (const t of footprint(it.type, it.x, it.z, it.rot)) {
          grid.block(t.x, t.z);
          furnBlocked.push(t);
        }
      }
      // Where you stand to use it: the first free tile in front.
      const th = (it.rot * Math.PI) / 2;
      const fx = def.kind === 'wall' ? 0 : -Math.sin(th);
      const fz = def.kind === 'wall' ? -1 : -Math.cos(th);
      let door = { x: Math.floor(cx), z: Math.floor(cz) };
      for (let k = 1; k < 6; k++) {
        const tx = Math.floor(cx + fx * k * 0.5);
        const tz = Math.floor(cz + fz * k * 0.5);
        if (tx < 0 || tz < 0 || tx >= W || tz >= D) break;
        if (def.kind !== 'floor' || !footprint(it.type, it.x, it.z, it.rot).some((t) => t.x === tx && t.z === tz)) {
          door = { x: tx, z: tz };
          break;
        }
      }
      places.push({ id, name: def.title, description: def.text, door, faceTo: { x: cx, z: cz } });
    }
    // The cat sleeps on the end of the bed.
    const bed = layout.items.find((x) => x.type === 'bed' && !x.stored);
    if (cat && bed) {
      const c = catObj.clone();
      const turned = bed.rot % 2 === 1;
      c.position.set(bed.x + (turned ? 0.5 : 1.6), 0, bed.z + (turned ? 1.6 : 0.5));
      c.userData.placeId = 'cat';
      furnRoot.add(c);
      tappables.push(c);
      places.push({ id: 'cat', name: 'Grey cat', description: 'A thin grey cat who has decided this is her room now. She has not decided about you.', door: { x: Math.min(W - 1, bed.x + 2), z: Math.max(0, bed.z - 1) }, faceTo: { x: c.position.x, z: c.position.z } });
    }
  };
  const objectFor = (uid: number) => furnObjs.get(uid) ?? null;

  const catObj = new THREE.Group();
  const fur = mat(0x5a5a62);
  catObj.add(box(0.36, 0.18, 0.2, fur, 0, 0.72, 0));
  catObj.add(box(0.16, 0.15, 0.16, fur, 0.22, 0.8, 0));
  for (const dz of [-0.05, 0.05]) catObj.add(box(0.04, 0.06, 0.03, fur, 0.26, 0.9, dz));
  catObj.add(box(0.26, 0.04, 0.04, fur, -0.24, 0.68, 0.07));

  // Lighting
  const hemi = new THREE.HemisphereLight(0xb0b8c8, 0x4a3828, 1.4);
  scene.add(hemi);
  const windowLight = new THREE.DirectionalLight(0xc8d4e0, 1.4);
  windowLight.position.set(W / 2, 6, D + 4);
  windowLight.target.position.set(W / 2, 0, 1.5);
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
    windowLight.intensity = 0.8 + day * 2.0;
    windowLight.color.setHex(day > 0.3 ? 0xd8dce0 : 0x6f84b0);
    glass.emissiveIntensity = 0.15 + day * 0.8;
    glass.emissive.setHex(day > 0.3 ? 0xa8b4c0 : 0x2a3a5a);
    hemi.intensity = 1.6 + day * 0.6;
    const night = 1 - day;
    const candle = furnRoot.getObjectByName('candle') as THREE.Mesh | undefined;
    candleLight.intensity = candle ? night * (9 + Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.4) : night * 3;
    if (candle) {
      candle.getWorldPosition(candleLight.position);
      candleLight.position.y += 0.3;
      (candle.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + night * 2;
    }
    ghost.position.y = 0.15 + Math.sin(t * 1.3) * 0.06;
  };

  return {
    id: 'hesterRoom',
    name: spec.name,
    scene,
    grid,
    places,
    tappables,
    entries: {
      door: { x: 0.5, z: 1.5, faceX: 3, faceZ: 1.5 },
      bed: { x: 1.5, z: 3.5, faceX: 3, faceZ: 2 },
    },
    camera: { bounds: { minX: W / 2, maxX: W / 2, minZ: D - 0.2, maxZ: D - 0.2 }, view: W + 1.2, offsetZ: 0 },
    fadeOccluders: false,
    extras,
    furnish,
    objectFor,
    update,
  };
}
