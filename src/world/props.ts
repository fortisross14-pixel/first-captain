import * as THREE from 'three';
import { C, glow, mat } from './materials';

/** Small deterministic RNG so the district looks the same every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rt: number, rb: number, h: number, seg: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Gable roof with the ridge running along x. */
function gableRoof(w: number, d: number, rise: number, overhang: number, m: THREE.Material): THREE.Mesh {
  const W = w / 2 + overhang;
  const D = d / 2 + overhang;
  const A = [-W, 0, -D], B = [W, 0, -D], Cc = [W, 0, D], Dd = [-W, 0, D];
  const R1 = [-W, rise, 0], R2 = [W, rise, 0];
  const tris = [A, R2, B, A, R1, R2, Dd, Cc, R2, Dd, R2, R1, A, Dd, R1, B, R2, Cc];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeSign(text: string, width: number, bg = '#2b1d12', fg = '#e8cf8a'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 80);
  ctx.fillStyle = fg;
  let size = 46;
  ctx.font = `bold ${size}px Georgia, serif`;
  while (ctx.measureText(text).width > 460 && size > 20) {
    size -= 2;
    ctx.font = `bold ${size}px Georgia, serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, width * (96 / 512), 0.06), m);
  mesh.castShadow = true;
  return mesh;
}

export interface BuildingStyle {
  wall: number;
  roof: number;
  roofType: 'gable' | 'flat';
  trim?: number;
}

/**
 * A building whose local origin is the centre of its footprint at ground level.
 * The street-facing side is -z (north) when `faceNorth`, otherwise +z.
 */
export function makeBuilding(
  w: number,
  d: number,
  h: number,
  style: BuildingStyle,
  seed: number,
  opts: { doorOffset: number; faceNorth: boolean; sign?: string },
): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const wallM = mat(style.wall);
  const trimM = mat(style.trim ?? C.timber);
  g.add(box(w, h, d, wallM, 0, h / 2, 0));
  g.add(box(w + 0.08, 0.5, d + 0.08, mat(C.brickSoot), 0, 0.25, 0));
  // Storey bands
  const storeyH = 2.2;
  const storeys = Math.max(1, Math.floor((h - 0.3) / storeyH));
  for (let s = 1; s < storeys; s++) g.add(box(w + 0.06, 0.1, d + 0.06, trimM, 0, s * storeyH, 0));

  if (style.roofType === 'gable') {
    const roof = gableRoof(w, d, Math.min(2.2, d * 0.35), 0.25, mat(style.roof));
    roof.position.y = h;
    g.add(roof);
  } else {
    g.add(box(w + 0.1, 0.35, d + 0.1, mat(style.roof), 0, h + 0.17, 0));
  }
  // Chimneys
  const chimneys = Math.max(1, Math.round(w / 4));
  for (let i = 0; i < chimneys; i++) {
    const cx = -w / 2 + ((i + 0.5) * w) / chimneys + (r() - 0.5) * 0.6;
    const ch = 1.4 + r() * 0.8;
    g.add(box(0.55, ch, 0.55, mat(C.brickDark), cx, h + ch / 2 + 0.4, (r() - 0.5) * d * 0.4));
    g.add(cyl(0.12, 0.12, 0.35, 6, mat(0x6a4030), cx, h + ch + 0.55, 0));
  }

  // Windows on both long faces
  const front = opts.faceNorth ? -1 : 1;
  for (const side of [-1, 1]) {
    const zFace = side * (d / 2 + 0.03);
    const cols = Math.max(1, Math.floor(w / 1.4));
    for (let s = 0; s < storeys; s++) {
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + ((c + 0.5) * w) / cols;
        if (s === 0 && side === front && Math.abs(x - opts.doorOffset) < 0.9) continue;
        if (s === 0 && side === front && r() < 0.15) continue;
        const y = s * storeyH + 1.25;
        const lit = r() < 0.55;
        const win = box(0.55, 0.85, 0.05, lit ? glow.windowLit : glow.windowDark, x, y, zFace);
        win.castShadow = false;
        g.add(win);
        g.add(box(0.7, 0.08, 0.14, trimM, x, y - 0.47, zFace));
      }
    }
  }

  // Door and step
  const dz = front * (d / 2 + 0.04);
  g.add(box(0.9, 1.7, 0.08, mat(C.woodDark), opts.doorOffset, 0.85, dz));
  g.add(box(1.1, 0.12, 0.25, mat(C.stone), opts.doorOffset, 0.06, front * (d / 2 + 0.12)));
  g.add(box(1.05, 0.12, 0.1, trimM, opts.doorOffset, 1.76, dz));

  if (opts.sign) {
    const sign = makeSign(opts.sign, Math.min(w - 0.4, 3.6));
    sign.position.set(opts.doorOffset, 2.15, front * (d / 2 + 0.09));
    if (!opts.faceNorth) sign.rotation.y = 0;
    else sign.rotation.y = Math.PI;
    g.add(sign);
  }
  return g;
}

export function makeLamp(vane = false): { group: THREE.Group; lightY: number } {
  const g = new THREE.Group();
  const iron = mat(C.iron, 0.6, 0.5);
  g.add(cyl(0.14, 0.18, 0.25, 6, iron, 0, 0.12, 0));
  g.add(cyl(0.05, 0.07, 2.3, 6, iron, 0, 1.25, 0));
  g.add(box(0.45, 0.05, 0.05, iron, 0, 2.1, 0));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.11, 0.34, 6), vane ? glow.vaneLamp : glow.gasLamp);
  glass.position.y = 2.55;
  g.add(glass);
  g.add(cyl(0.02, 0.22, 0.14, 6, iron, 0, 2.79, 0));
  return { group: g, lightY: 2.55 };
}

export function makeCrateStack(seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.55 + r() * 0.25;
    const c = box(s, s, s, mat(r() < 0.5 ? C.wood : 0x7a5a36), (r() - 0.5) * 0.3, i * 0.6 + s / 2, (r() - 0.5) * 0.3);
    c.rotation.y = r() * 0.6;
    g.add(c);
  }
  return g;
}

export function makeBarrel(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.26, 0.26, 0.75, 8, mat(C.wood), 0, 0.375, 0));
  g.add(cyl(0.275, 0.275, 0.06, 8, mat(C.iron, 0.6, 0.4), 0, 0.15, 0));
  g.add(cyl(0.275, 0.275, 0.06, 8, mat(C.iron, 0.6, 0.4), 0, 0.6, 0));
  return g;
}

export function makeBollard(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.14, 0.17, 0.5, 7, mat(C.iron, 0.6, 0.4), 0, 0.25, 0));
  g.add(cyl(0.2, 0.2, 0.08, 7, mat(C.iron, 0.6, 0.4), 0, 0.52, 0));
  return g;
}

/** A market stall two tiles wide, centred on its origin. */
export function makeStall(canvas: number, goods: number[]): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(C.wood);
  g.add(box(1.8, 0.1, 0.8, wood, 0, 0.85, 0));
  g.add(box(1.7, 0.75, 0.05, mat(C.woodDark), 0, 0.42, 0.35));
  for (const x of [-0.85, 0.85]) for (const z of [-0.35, 0.35]) g.add(box(0.07, 2.0, 0.07, wood, x, 1.0, z));
  const awning = box(2.1, 0.06, 1.25, mat(canvas), 0, 2.0, -0.1);
  awning.rotation.x = -0.25;
  g.add(awning);
  goods.forEach((color, i) => {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(color));
    s.position.set(-0.6 + i * 0.4, 1.0, (i % 2) * 0.15 - 0.05);
    s.castShadow = true;
    g.add(s);
  });
  return g;
}

export function makeBarge(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(7.2, 0.9, 1.9, mat(0x3a2a1e), 0, 0.05, 0));
  g.add(box(7.0, 0.1, 1.7, mat(C.wood), 0, 0.52, 0));
  g.add(box(1.6, 0.9, 1.3, mat(0x4a3a2a), 2.4, 1.0, 0));
  g.add(box(1.8, 0.1, 1.5, mat(C.roofSlate), 2.4, 1.5, 0));
  g.add(cyl(0.07, 0.09, 4.2, 6, mat(C.woodDark), -1.2, 2.6, 0));
  const sail = box(0.05, 2.4, 1.6, mat(0x8a6a4a), -1.2, 2.9, 0.1);
  sail.rotation.x = 0.05;
  g.add(sail);
  for (let i = 0; i < 4; i++) g.add(box(0.7, 0.55, 0.7, mat(C.wood), -3 + i * 0.85, 0.85, (i % 2) * 0.4 - 0.2));
  return g;
}

export function makeFence(length: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(C.woodDark);
  const posts = Math.max(2, Math.round(length / 0.9) + 1);
  for (let i = 0; i < posts; i++) g.add(box(0.1, 1.0, 0.1, wood, -length / 2 + (i * length) / (posts - 1), 0.5, 0));
  g.add(box(length, 0.08, 0.06, wood, 0, 0.8, 0));
  g.add(box(length, 0.08, 0.06, wood, 0, 0.45, 0));
  return g;
}

export function makePawnBalls(): THREE.Group {
  const g = new THREE.Group();
  const brass = mat(C.brass, 0.35, 0.8);
  g.add(box(0.06, 0.06, 0.7, mat(C.iron), 0, 0, 0.35));
  const pos = [[-0.18, -0.35], [0.18, -0.35], [0, -0.62]];
  for (const [x, y] of pos) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), brass);
    s.position.set(x, y, 0.62);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

export function makePunchingBag(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(C.woodDark);
  g.add(box(0.12, 2.4, 0.12, wood, -0.5, 1.2, 0));
  g.add(box(0.8, 0.1, 0.1, wood, -0.15, 2.35, 0));
  g.add(cyl(0.2, 0.18, 0.8, 7, mat(0x6a3a2a), 0.15, 1.6, 0));
  return g;
}
