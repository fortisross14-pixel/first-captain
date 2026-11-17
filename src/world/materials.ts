import * as THREE from 'three';

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared flat-shaded material, cached by colour and options. */
export function mat(color: number, roughness = 0.9, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
    cache.set(key, m);
  }
  return m;
}

/** Materials whose glow follows the clock. Game updates their emissive intensity each frame. */
export const glow = {
  windowLit: new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffb45a, emissiveIntensity: 0, flatShading: true }),
  windowDark: new THREE.MeshStandardMaterial({ color: 0x1d2226, roughness: 0.3, metalness: 0.2, flatShading: true }),
  gasLamp: new THREE.MeshStandardMaterial({ color: 0x5a4a30, emissive: 0xffa040, emissiveIntensity: 0, flatShading: true }),
  vaneLamp: new THREE.MeshStandardMaterial({ color: 0x9fb4c4, emissive: 0xd8ecff, emissiveIntensity: 0.4, flatShading: true }),
};

export const C = {
  cobble: 0x4d4b47,
  quay: 0x6b6258,
  quayEdge: 0x3e3a35,
  yard: 0x5c4a36,
  water: 0x23343a,
  brickDark: 0x5a3a2e,
  brickRed: 0x7a4532,
  brickSoot: 0x4a4440,
  plaster: 0x9a8f7c,
  timber: 0x3b2a1e,
  roofSlate: 0x2f3338,
  roofTile: 0x5b3328,
  wood: 0x6b4a2e,
  woodDark: 0x3a2818,
  iron: 0x1f2124,
  brass: 0xb08a3e,
  canvasRed: 0x7a2e2a,
  canvasGreen: 0x3e5a3a,
  canvasOchre: 0x9a7a3a,
  stone: 0x7a756c,
};
