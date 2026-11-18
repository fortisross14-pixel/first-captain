import * as THREE from 'three';
import { mat } from '../world/materials';
import { mergeChildren } from '../world/merge';

export type HairStyle = 'short' | 'long' | 'bun' | 'bald' | 'wig' | 'curls';
export type HatKind = 'cap' | 'top' | 'bonnet' | 'bowler' | 'none';
export type WeaponKind = 'stick' | 'cudgel' | 'knife' | 'knuckles';

export interface Look {
  skin: number;
  hair: number;
  coat: number;
  trousers: number;
  shirt: number;
  boots: number;
  scarf?: number;
  hat: HatKind;
  hatColor?: number;
  /** Long skirt instead of trousers. */
  skirt?: boolean;
  /** 0.9–1.1 overall build. */
  build?: number;
  hairStyle?: HairStyle;
  /** Waistcoat colour. */
  vest?: number;
  /** Apron colour, for working people. */
  apron?: number;
  beard?: number;
  /** A cloak or cape over the shoulders. */
  cloak?: number;
  weapon?: WeaponKind;
  /** Iris colour. */
  eyes?: number;
  /** 0 child … 1 adult … 2 old: shrinks, greys and stoops. */
  age?: number;
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

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** A tapered, faceted tube: the basic low-poly limb and torso. */
const taper = (top: number, bottom: number, h: number, sides = 6) => new THREE.CylinderGeometry(top, bottom, h, sides);
const shade = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k).getHex();

function doubleSided(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, 0.85).clone());
  (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  m.castShadow = true;
  return m;
}

/**
 * A low-poly figure about 1.5 units tall, feet at y = 0, facing +z. Chunky and
 * readable from the street camera: a big head with a real face, collars, cuffs,
 * belts and boots, hair styles, hats, aprons, cloaks and a weapon in hand.
 * Everything merges into a few meshes per body part, so detail costs few draw calls.
 */
export function createCharacter(look: Look): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const s = look.build ?? 1;
  const woman = !!look.skirt;
  const coatDark = shade(look.coat, 0.72);
  const skinDark = shade(look.skin, 0.86);

  // --- Legs and boots ------------------------------------------------------
  const hipY = 0.66;
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, hipY, 0);
    if (!woman) {
      leg.add(part(taper(0.085, 0.07, 0.5, 6), look.trousers, 0, -0.27, 0));
      leg.add(part(box(0.15, 0.05, 0.16), shade(look.trousers, 0.8), 0, -0.5, 0));
    }
    leg.add(part(box(0.15, 0.12, 0.24), look.boots, 0, -0.6, 0.035));
    leg.add(part(box(0.16, 0.035, 0.27), shade(look.boots, 0.55), 0, -0.655, 0.04));
    leg.add(part(box(0.13, 0.05, 0.06), shade(look.boots, 1.3), 0, -0.57, 0.16));
    body.add(leg);
    legs.push(leg);
  }

  // --- Skirt, apron --------------------------------------------------------
  if (woman) {
    body.add(part(taper(0.2 * s, 0.35 * s, 0.6, 8), look.trousers, 0, 0.36, 0));
    body.add(part(taper(0.352 * s, 0.36 * s, 0.07, 8), shade(look.trousers, 0.7), 0, 0.075, 0));
    for (let i = 0; i < 4; i++) {
      const pleat = part(box(0.02, 0.5, 0.02), shade(look.trousers, 0.82), Math.sin(i * 1.6 + 0.8) * 0.27 * s, 0.33, Math.cos(i * 1.6 + 0.8) * 0.27 * s);
      body.add(pleat);
    }
  }
  if (look.apron !== undefined) {
    body.add(part(box(0.3 * s, woman ? 0.52 : 0.42, 0.02), look.apron, 0, woman ? 0.4 : 0.55, (woman ? 0.29 : 0.245) * s));
    body.add(part(box(0.2 * s, 0.2, 0.02), look.apron, 0, 0.86, 0.215 * s));
  }

  // --- Torso: coat, shirt front, waistcoat, lapels, belt -------------------
  body.add(part(taper(0.2 * s, 0.215 * s, 0.48, 8), look.coat, 0, 0.92, 0));
  // Shoulders rounded so the silhouette isn't a tube.
  for (const side of [-1, 1]) {
    const sh = part(new THREE.IcosahedronGeometry(0.1 * s, 0), look.coat, side * 0.19 * s, 1.12, 0);
    sh.scale.set(1, 0.75, 1);
    body.add(sh);
  }
  if (!woman) {
    const tails = doubleSided(new THREE.CylinderGeometry(0.225 * s, 0.27 * s, 0.32, 8, 1, true, Math.PI * 0.15, Math.PI * 1.7), look.coat);
    tails.position.y = 0.58;
    body.add(tails);
  }
  // Shirt front and the open coat.
  body.add(part(box(0.15 * s, 0.32, 0.04), look.shirt, 0, 1.0, 0.19 * s));
  if (look.vest !== undefined) {
    for (const side of [-1, 1]) body.add(part(box(0.075 * s, 0.24, 0.04), look.vest, side * 0.045 * s, 0.9, 0.2 * s));
    for (const y of [0.97, 0.9, 0.83]) body.add(part(box(0.02, 0.02, 0.02), 0xc8b080, 0.012, y, 0.225 * s));
  } else if (!woman) {
    for (const y of [0.96, 0.86]) body.add(part(box(0.025, 0.025, 0.02), 0xc8b080, 0.06, y, 0.215 * s));
  }
  for (const side of [-1, 1]) {
    const lapel = part(box(0.05, 0.24, 0.03), coatDark, side * 0.085 * s, 1.03, 0.2 * s);
    lapel.rotation.z = side * -0.32;
    body.add(lapel);
  }
  if (woman) {
    // Bodice waist and a lace collar.
    body.add(part(taper(0.205 * s, 0.205 * s, 0.05, 8), shade(look.coat, 0.6), 0, 0.7, 0));
  } else {
    body.add(part(taper(0.222 * s, 0.222 * s, 0.05, 8), 0x231e1a, 0, 0.72, 0));
    body.add(part(box(0.06, 0.05, 0.02), 0xb08a3e, 0, 0.72, 0.225 * s));
  }

  // Neck, collar and cravat or neckerchief.
  body.add(part(taper(0.06, 0.07, 0.1, 6), skinDark, 0, 1.2, 0));
  body.add(part(taper(0.09, 0.1, 0.06, 8), look.shirt, 0, 1.17, 0));
  if (look.scarf !== undefined) {
    const scarf = part(new THREE.TorusGeometry(0.11, 0.045, 5, 8), look.scarf, 0, 1.16, 0.01);
    scarf.rotation.x = Math.PI / 2;
    body.add(scarf);
    body.add(part(box(0.07, 0.18, 0.04), look.scarf, 0.06, 1.05, 0.18 * s));
  } else if (!woman) {
    // A cravat knot below the collar.
    body.add(part(box(0.06, 0.04, 0.03), shade(look.shirt, 0.85), 0, 1.1, 0.17 * s));
  }

  // Cloak: a cape from the shoulders to the knees.
  if (look.cloak !== undefined) {
    const cloak = doubleSided(new THREE.CylinderGeometry(0.2 * s, 0.34 * s, 0.82, 9, 1, true, Math.PI * 0.62, Math.PI * 1.76), look.cloak);
    cloak.position.set(0, 0.76, -0.01);
    body.add(cloak);
    body.add(part(taper(0.23 * s, 0.25 * s, 0.07, 9), shade(look.cloak, 0.8), 0, 1.15, 0));
  }

  // --- Arms and hands ------------------------------------------------------
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.255 * s, 1.11, 0);
    arm.add(part(taper(0.062, 0.055, 0.42, 6), look.coat, 0, -0.21, 0));
    arm.add(part(taper(0.064, 0.064, 0.06, 6), look.shirt, 0, -0.44, 0));
    // A mitten hand with a thumb.
    arm.add(part(box(0.075, 0.09, 0.065), look.skin, 0, -0.51, 0.005));
    arm.add(part(box(0.03, 0.05, 0.03), look.skin, -side * 0.035, -0.49, 0.03));
    body.add(arm);
    arms.push(arm);
  }
  // A weapon in the right hand.
  if (look.weapon) {
    const hand = arms[1];
    if (look.weapon === 'stick') {
      const st = part(taper(0.014, 0.018, 0.9, 5), 0x4a3020, 0, -0.56, 0.06);
      st.rotation.x = 0.15;
      hand.add(st, part(new THREE.IcosahedronGeometry(0.03, 0), 0x2a1a10, 0, -0.12, 0.05));
    } else if (look.weapon === 'cudgel') {
      const c = part(taper(0.045, 0.02, 0.42, 6), 0x5a3a22, 0, -0.66, 0.08);
      c.rotation.x = 0.5;
      hand.add(c);
    } else if (look.weapon === 'knife') {
      const k = part(box(0.02, 0.16, 0.008), 0xc8ccd0, 0, -0.62, 0.06);
      hand.add(k, part(box(0.03, 0.07, 0.02), 0x3a2a1a, 0, -0.53, 0.06));
    } else {
      const ring = part(new THREE.TorusGeometry(0.04, 0.012, 4, 8), 0x8a8a90, 0, -0.52, 0.045);
      hand.add(ring);
    }
  }

  // --- Head and face -------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = 1.24;
  const skull = part(new THREE.IcosahedronGeometry(0.19, 2), look.skin, 0, 0.17, 0);
  skull.scale.set(1, 1.1, 0.95);
  head.add(skull);
  const iris = look.eyes ?? 0x3a2a1e;
  for (const side of [-1, 1]) {
    head.add(part(box(0.06, 0.05, 0.02), 0xf4efe6, side * 0.065, 0.19, 0.172));
    head.add(part(box(0.032, 0.042, 0.02), iris, side * 0.06, 0.188, 0.18));
    head.add(part(box(0.014, 0.016, 0.01), 0x0e0a08, side * 0.06, 0.19, 0.188));
    const brow = part(box(0.07, 0.018, 0.02), shade(look.hair, 0.8), side * 0.066, 0.243, 0.172);
    brow.rotation.z = side * -0.12;
    head.add(brow);
    head.add(part(box(0.035, 0.07, 0.05), skinDark, side * 0.188, 0.17, 0));
    // Rosy cheeks.
    head.add(part(box(0.04, 0.022, 0.01), new THREE.Color(look.skin).lerp(new THREE.Color(0xd0706a), 0.35).getHex(), side * 0.105, 0.135, 0.168));
  }
  const nose = part(new THREE.ConeGeometry(0.03, 0.07, 4), skinDark, 0, 0.15, 0.2);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
  head.add(part(box(0.08, 0.018, 0.02), 0x7a3a32, 0, 0.09, 0.165));
  for (const side of [-1, 1]) head.add(part(box(0.018, 0.018, 0.02), 0x7a3a32, side * 0.045, 0.098, 0.162));

  // Hair.
  const style = look.hairStyle ?? (woman ? 'bun' : 'short');
  const hairCol = look.hair;
  if (style !== 'bald') {
    const cap = part(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2.2), hairCol, 0, 0.19, -0.01);
    head.add(cap);
    head.add(part(box(0.34, 0.16, 0.12), hairCol, 0, 0.14, -0.12));
    // Fringe.
    head.add(part(box(0.26, 0.05, 0.06), hairCol, 0, 0.3, 0.13));
  } else {
    for (const side of [-1, 1]) head.add(part(box(0.05, 0.08, 0.14), hairCol, side * 0.18, 0.18, -0.06));
  }
  if (style === 'long') {
    head.add(part(box(0.34, 0.34, 0.1), hairCol, 0, 0.02, -0.14));
    for (const side of [-1, 1]) head.add(part(box(0.06, 0.26, 0.1), hairCol, side * 0.18, 0.06, -0.02));
  } else if (style === 'bun') {
    head.add(part(new THREE.IcosahedronGeometry(0.09, 0), hairCol, 0, 0.28, -0.17));
    for (const side of [-1, 1]) head.add(part(box(0.05, 0.1, 0.08), hairCol, side * 0.18, 0.2, 0.02));
  } else if (style === 'wig' || style === 'curls') {
    for (const side of [-1, 1]) for (const y of [0.1, 0.2]) head.add(part(new THREE.IcosahedronGeometry(0.06, 0), hairCol, side * 0.19, y, -0.03));
    if (style === 'wig') head.add(part(box(0.06, 0.12, 0.04), 0x1a1a1a, 0, 0.04, -0.2));
  } else if (style === 'short') {
    for (const side of [-1, 1]) head.add(part(box(0.04, 0.1, 0.06), hairCol, side * 0.19, 0.16, 0.06));
  }
  if (look.beard !== undefined) {
    head.add(part(box(0.22, 0.1, 0.1), look.beard, 0, 0.04, 0.12));
    for (const side of [-1, 1]) head.add(part(box(0.04, 0.12, 0.08), look.beard, side * 0.17, 0.1, 0.07));
    head.add(part(box(0.1, 0.025, 0.02), look.beard, 0, 0.115, 0.18));
  }

  // Hats.
  const hatColor = look.hatColor ?? 0x24201c;
  const band = shade(hatColor, 0.55);
  if (look.hat === 'cap') {
    const crown = part(taper(0.2, 0.205, 0.08, 8), hatColor, 0, 0.35, -0.01);
    crown.scale.z = 1.05;
    head.add(crown, part(new THREE.IcosahedronGeometry(0.07, 0), hatColor, 0, 0.4, 0.02));
    const peak = part(box(0.26, 0.025, 0.14), shade(hatColor, 0.85), 0, 0.32, 0.17);
    peak.rotation.x = 0.15;
    head.add(peak);
  } else if (look.hat === 'top') {
    head.add(part(taper(0.29, 0.29, 0.025, 10), hatColor, 0, 0.35, 0));
    head.add(part(taper(0.16, 0.17, 0.32, 10), hatColor, 0, 0.52, 0));
    head.add(part(taper(0.172, 0.172, 0.05, 10), band, 0, 0.4, 0));
  } else if (look.hat === 'bowler') {
    head.add(part(taper(0.27, 0.27, 0.025, 10), hatColor, 0, 0.35, 0));
    head.add(part(new THREE.SphereGeometry(0.18, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), hatColor, 0, 0.36, 0));
    head.add(part(taper(0.182, 0.182, 0.04, 10), band, 0, 0.38, 0));
  } else if (look.hat === 'bonnet') {
    const bonnet = part(new THREE.SphereGeometry(0.235, 9, 5, 0, Math.PI * 2, 0, Math.PI / 1.8), hatColor, 0, 0.2, -0.04);
    bonnet.rotation.x = -0.4;
    head.add(bonnet);
    head.add(part(taper(0.25, 0.25, 0.03, 10), shade(hatColor, 0.8), 0, 0.27, 0.07));
    for (const side of [-1, 1]) {
      const ribbon = part(box(0.025, 0.14, 0.02), 0x7a2a2a, side * 0.15, 0.05, 0.1);
      ribbon.rotation.z = side * 0.3;
      head.add(ribbon);
    }
    head.add(part(box(0.08, 0.04, 0.03), 0x7a2a2a, 0, 0.0, 0.14));
  }
  body.add(head);

  // Age: children are small with big heads; the old are grey, a little bent.
  const age = look.age ?? 1;
  if (age < 1) {
    const k = 0.55 + age * 0.45;
    body.scale.setScalar(k);
    head.scale.setScalar(1 + (1 - age) * 0.35);
  } else if (age > 1.5) {
    body.rotation.x = 0.08;
    head.rotation.x = 0.1;
  }

  mergeChildren(root);
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
