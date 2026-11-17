import * as THREE from 'three';
import { mat } from '../world/materials';

export interface Look {
  skin: number;
  hair: number;
  coat: number;
  trousers: number;
  shirt: number;
  boots: number;
  scarf?: number;
  hat: 'cap' | 'top' | 'bonnet' | 'none';
  hatColor?: number;
  /** Long skirt instead of trousers. */
  skirt?: boolean;
  /** 0.9–1.1 overall build. */
  build?: number;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
}

function part(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, 0.85));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * A low-poly figure about 1.45 units tall, feet at y = 0, facing +z.
 * More detailed than the world props: face, collar, coat skirt, hands, boots.
 */
export function createCharacter(look: Look): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const s = look.build ?? 1;

  const hipY = 0.68;
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, hipY, 0);
    if (!look.skirt) leg.add(part(new THREE.BoxGeometry(0.15, 0.56, 0.17), look.trousers, 0, -0.29, 0));
    leg.add(part(new THREE.BoxGeometry(0.16, 0.13, 0.27), look.boots, 0, -0.62, 0.04));
    body.add(leg);
    legs.push(leg);
  }

  if (look.skirt) {
    body.add(part(new THREE.CylinderGeometry(0.2, 0.34, 0.62, 8), look.trousers, 0, 0.36, 0));
  }

  // Torso and coat
  body.add(part(new THREE.CylinderGeometry(0.19 * s, 0.22 * s, 0.46, 7), look.coat, 0, 0.92, 0));
  if (!look.skirt) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.235 * s, 0.27 * s, 0.3, 7, 1, true), mat(look.coat, 0.85));
    skirt.material = skirt.material.clone();
    (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    skirt.position.y = 0.6;
    skirt.castShadow = true;
    body.add(skirt);
  }
  body.add(part(new THREE.BoxGeometry(0.14, 0.3, 0.05), look.shirt, 0, 1.0, 0.19 * s));
  body.add(part(new THREE.CylinderGeometry(0.23 * s, 0.23 * s, 0.05, 7), 0x2a2420, 0, 0.72, 0));
  for (const y of [0.98, 0.88, 0.78]) body.add(part(new THREE.BoxGeometry(0.03, 0.03, 0.02), 0xc8b080, 0.05, y, 0.215 * s));
  if (look.scarf !== undefined) {
    const scarf = part(new THREE.TorusGeometry(0.12, 0.045, 5, 8), look.scarf, 0, 1.15, 0.01);
    scarf.rotation.x = Math.PI / 2;
    body.add(scarf);
    body.add(part(new THREE.BoxGeometry(0.07, 0.2, 0.04), look.scarf, 0.07, 1.04, 0.17));
  }

  // Arms
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.25 * s, 1.11, 0);
    arm.add(part(new THREE.BoxGeometry(0.11, 0.48, 0.12), look.coat, 0, -0.23, 0));
    arm.add(part(new THREE.BoxGeometry(0.12, 0.06, 0.13), look.shirt, 0, -0.47, 0));
    arm.add(part(new THREE.IcosahedronGeometry(0.06, 0), look.skin, 0, -0.53, 0.01));
    body.add(arm);
    arms.push(arm);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 1.2;
  head.add(part(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), look.skin, 0, 0.02, 0));
  head.add(part(new THREE.IcosahedronGeometry(0.16, 1), look.skin, 0, 0.18, 0));
  head.add(part(new THREE.BoxGeometry(0.04, 0.06, 0.05), look.skin, 0, 0.16, 0.16));
  for (const side of [-1, 1]) {
    head.add(part(new THREE.BoxGeometry(0.035, 0.035, 0.02), 0x15110e, side * 0.06, 0.21, 0.145));
    head.add(part(new THREE.BoxGeometry(0.06, 0.015, 0.02), look.hair, side * 0.06, 0.25, 0.145));
    head.add(part(new THREE.BoxGeometry(0.03, 0.06, 0.04), look.skin, side * 0.16, 0.18, 0));
  }
  head.add(part(new THREE.BoxGeometry(0.07, 0.015, 0.02), 0x6a3a30, 0, 0.1, 0.15));
  // Hair: cap of the head plus back
  const hair = part(new THREE.SphereGeometry(0.168, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2.1), look.hair, 0, 0.2, -0.01);
  head.add(hair);
  head.add(part(new THREE.BoxGeometry(0.28, 0.14, 0.1), look.hair, 0, 0.13, -0.11));

  const hatColor = look.hatColor ?? 0x24201c;
  if (look.hat === 'cap') {
    head.add(part(new THREE.CylinderGeometry(0.17, 0.18, 0.08, 8), hatColor, 0, 0.33, 0));
    head.add(part(new THREE.BoxGeometry(0.22, 0.02, 0.12), hatColor, 0, 0.3, 0.15));
  } else if (look.hat === 'top') {
    head.add(part(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 10), hatColor, 0, 0.32, 0));
    head.add(part(new THREE.CylinderGeometry(0.14, 0.15, 0.28, 10), hatColor, 0, 0.47, 0));
  } else if (look.hat === 'bonnet') {
    const bonnet = part(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 1.8), hatColor, 0, 0.18, -0.03);
    bonnet.rotation.x = -0.35;
    head.add(bonnet);
  }
  body.add(head);

  return { root, body, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], head };
}

/** Procedural walk / idle animation. `stride` 0 = idle, 1 = full walk. */
export function animateRig(rig: Rig, phase: number, stride: number, t: number): void {
  const swing = Math.sin(phase) * 0.65 * stride;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.armL.rotation.x = -swing * 0.8;
  rig.armR.rotation.x = swing * 0.8;
  rig.armL.rotation.z = -0.06;
  rig.armR.rotation.z = 0.06;
  const breathe = Math.sin(t * 1.8) * 0.012 * (1 - stride);
  rig.body.position.y = Math.abs(Math.sin(phase)) * 0.045 * stride + breathe;
  rig.body.rotation.x = 0.05 * stride;
  rig.head.rotation.y = Math.sin(t * 0.5) * 0.15 * (1 - stride);
}
