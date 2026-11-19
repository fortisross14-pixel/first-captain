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

export type BuildingKind = 'house' | 'shop' | 'warehouse' | 'church';

const STONE_TRIM = 0x9a9284;
const STAINED = new THREE.MeshStandardMaterial({ color: 0x2a1e3a, emissive: 0x7a4a8a, emissiveIntensity: 0.55, flatShading: true });
const DOOR_COLOURS = [0x1f3a2c, 0x4a1c1c, 0x1a1c22, 0x1c2a44, 0x3a2a1a];
const SHUTTERS = [0x2a3a2a, 0x3a2a22, 0x22303a];

/**
 * A building whose local origin is the centre of its footprint at ground level.
 * The street-facing side is -z (north) when `faceNorth`, otherwise +z. Only the street face
 * is detailed: the camera never sees the back. Everything plain merges into a few draw calls,
 * so the detail costs triangles, not draw calls.
 */
export function makeBuilding(
  w: number,
  d: number,
  h: number,
  style: BuildingStyle,
  seed: number,
  opts: { doorOffset: number; faceNorth: boolean; sign?: string; kind?: BuildingKind },
): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const kind: BuildingKind = opts.kind ?? (opts.sign ? 'shop' : 'house');
  const wallM = mat(style.wall);
  const trimM = mat(style.trim ?? C.timber);
  const stoneM = mat(STONE_TRIM);
  const darkM = mat(C.woodDark);
  const sootM = mat(new THREE.Color(style.wall).multiplyScalar(0.72).getHex());
  const brick = style.wall !== C.plaster && style.wall !== C.stone;
  const f = opts.faceNorth ? -1 : 1;
  const zf = f * (d / 2); // the street face
  /** A box on the street face, `out` metres proud of the wall. */
  const face = (bw: number, bh: number, depth: number, m: THREE.Material, x: number, y: number, out = 0) => {
    const b = box(bw, bh, depth, m, x, y, zf + f * (out + depth / 2));
    g.add(b);
    return b;
  };

  // Body, plinth, and soot gathered under the eaves.
  g.add(box(w, h, d, wallM, 0, h / 2, 0));
  g.add(box(w + 0.08, 0.5, d + 0.08, mat(C.brickSoot), 0, 0.25, 0));
  face(w, 0.7, 0.01, sootM, 0, h - 0.35);
  const storeyH = 2.2;
  const storeys = Math.max(1, Math.floor((h - 0.3) / storeyH));

  // String courses between storeys and stone quoins up the corners.
  for (let s = 1; s < storeys; s++) face(w + 0.04, 0.12, 0.06, kind === 'church' ? stoneM : brick ? stoneM : trimM, 0, s * storeyH);
  if (brick && kind !== 'church') {
    for (let y = 0.65, i = 0; y < h - 0.3; y += 0.34, i++) {
      const qw = i % 2 ? 0.22 : 0.36;
      for (const sx of [-1, 1]) face(qw, 0.3, 0.04, stoneM, sx * (w / 2 - qw / 2), y);
    }
  }

  // Cornice along the top, or a parapet for flat roofs.
  face(w + 0.16, 0.14, 0.14, kind === 'church' || brick ? stoneM : trimM, 0, h - 0.07);
  face(w + 0.26, 0.08, 0.24, kind === 'church' || brick ? stoneM : trimM, 0, h + 0.03);
  if (style.roofType === 'flat') {
    g.add(box(w + 0.1, 0.35, d + 0.1, mat(style.roof), 0, h + 0.17, 0));
    face(w, 0.55, 0.16, wallM, 0, h + 0.33);
    face(w + 0.1, 0.08, 0.22, stoneM, 0, h + 0.64);
  } else {
    const rise = Math.min(2.2, d * 0.35);
    const roof = gableRoof(w, d, rise, 0.25, mat(style.roof));
    roof.position.y = h;
    g.add(roof);
    g.add(box(w + 0.52, 0.1, 0.16, mat(0x3a3430), 0, h + rise + 0.03, 0));
    // Gutter along the front eave, and a downpipe at one corner.
    g.add(box(w + 0.5, 0.09, 0.1, mat(C.iron), 0, h - 0.02, zf + f * 0.27));
    const px = (r() < 0.5 ? -1 : 1) * (w / 2 - 0.12);
    g.add(cyl(0.045, 0.045, h, 6, mat(C.iron), px, h / 2, zf + f * 0.08));
    // Dormers on the front slope of the bigger roofs.
    if (w >= 5 && rise >= 1.2 && kind !== 'church') {
      const n = w >= 8 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const dx = n === 1 ? (r() - 0.5) * w * 0.3 : (i - 0.5) * w * 0.45;
        const dzz = zf * 0.48;
        const dy = h + rise * 0.48;
        g.add(box(0.9, 0.85, 0.9, wallM, dx, dy, dzz));
        g.add(box(0.5, 0.5, 0.05, r() < 0.5 ? glow.windowLit : glow.windowDark, dx, dy + 0.02, dzz + f * 0.46));
        g.add(box(0.62, 0.06, 0.1, stoneM, dx, dy - 0.26, dzz + f * 0.47));
        const cap = gableRoof(1.0, 1.0, 0.45, 0.06, mat(style.roof));
        cap.rotation.y = Math.PI / 2;
        cap.position.set(dx, dy + 0.42, dzz);
        g.add(cap);
      }
    }
  }

  // Chimney stacks: a cap band and a row of pots.
  const chimneys = kind === 'church' ? 0 : Math.max(1, Math.round(w / 4));
  for (let i = 0; i < chimneys; i++) {
    const cx = -w / 2 + ((i + 0.5) * w) / chimneys + (r() - 0.5) * 0.6;
    const cz = (r() - 0.5) * d * 0.4;
    const ch = 1.4 + r() * 0.8;
    const sw = 0.5 + Math.floor(r() * 3) * 0.2;
    g.add(box(sw, ch, 0.5, mat(C.brickDark), cx, h + ch / 2 + 0.4, cz));
    g.add(box(sw + 0.14, 0.12, 0.64, stoneM, cx, h + ch + 0.42, cz));
    const pots = Math.max(1, Math.round(sw / 0.3));
    for (let k = 0; k < pots; k++) {
      const ph = 0.25 + r() * 0.2;
      g.add(cyl(0.08, 0.1, ph, 6, mat([0x8a4a30, 0x6a4030, 0x9a5a3a][Math.floor(r() * 3)]), cx - sw / 2 + (k + 0.5) * (sw / pots), h + ch + 0.48 + ph / 2, cz));
    }
  }

  // Windows: sashes in a painted frame, glazing bars, a stone lintel and sill; shutters on some houses.
  const frameM = mat(kind === 'warehouse' ? C.woodDark : r() < 0.7 ? 0xd8d0bc : 0x2a2a2a);
  const shutterM = kind === 'house' && r() < 0.35 ? mat(SHUTTERS[Math.floor(r() * SHUTTERS.length)]) : null;
  const keystones = brick && r() < 0.5;
  const sash = (x: number, y: number, ww: number, wh: number, church = false) => {
    const lit = r() < 0.55;
    face(ww + 0.12, wh + 0.12, 0.04, frameM, x, y, -0.01);
    const glass = face(ww, wh, 0.04, church ? STAINED : lit ? glow.windowLit : glow.windowDark, x, y, 0.01);
    glass.castShadow = false;
    if (church) {
      face(0.04, wh, 0.03, darkM, x, y, 0.04);
      face(ww, 0.04, 0.03, darkM, x, y + wh * 0.15, 0.04);
      // A pointed head over the lancet.
      for (let k = 1; k <= 3; k++) face(ww * (1 - k * 0.28) + 0.1, 0.12, 0.06, stoneM, x, y + wh / 2 + 0.02 + k * 0.1, 0);
      return;
    }
    face(0.035, wh, 0.03, frameM, x, y, 0.04);
    face(ww, 0.05, 0.03, frameM, x, y, 0.04);
    face(ww + 0.3, 0.15, 0.1, stoneM, x, y + wh / 2 + 0.14);
    if (keystones) face(0.14, 0.22, 0.13, stoneM, x, y + wh / 2 + 0.16);
    face(ww + 0.28, 0.07, 0.16, stoneM, x, y - wh / 2 - 0.1);
    if (shutterM) for (const sx of [-1, 1]) face(0.26, wh + 0.04, 0.04, shutterM, x + sx * (ww / 2 + 0.2), y, 0.01);
  };
  const cols = Math.max(1, Math.floor(w / (kind === 'church' ? 2 : 1.4)));
  for (let s = 0; s < storeys; s++) {
    const top = s === storeys - 1 && storeys > 1;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + ((c + 0.5) * w) / cols;
      if (kind === 'church') {
        if (s > 0 || Math.abs(x - opts.doorOffset) < 1.2) continue;
        sash(x, 2.2, 0.5, 2.0, true);
        continue;
      }
      if (s === 0 && (kind === 'shop' || Math.abs(x - opts.doorOffset) < 0.9)) continue;
      if (s === 0 && kind === 'warehouse' && Math.abs(x - opts.doorOffset) < 1.6) continue;
      if (kind === 'warehouse' && s > 0 && Math.abs(x) < 0.8 && w >= 5) continue;
      if (s === 0 && r() < 0.12) continue;
      sash(x, s * storeyH + (top ? 1.2 : 1.3), 0.52, top ? 0.66 : 0.88);
    }
  }

  // The ground floor: a shopfront, a front door with its surround, cart doors, or a church porch.
  const dx = opts.doorOffset;
  if (kind === 'shop') {
    const sw = w - 0.5;
    for (const sx of [-1, 1]) face(0.2, 2.35, 0.16, trimM, sx * (sw / 2), 1.17);
    face(sw + 0.3, 0.46, 0.16, mat(0x1e2a24), 0, 2.15);
    face(sw + 0.42, 0.08, 0.24, trimM, 0, 2.42);
    // Display windows either side of the door, on stall-risers, with mullions.
    const left = -sw / 2 + 0.1;
    const right = sw / 2 - 0.1;
    const segs: [number, number][] = [[left, dx - 0.6], [dx + 0.6, right]];
    for (const [a, b] of segs) {
      const sww = b - a;
      if (sww < 0.4) continue;
      const cx = (a + b) / 2;
      face(sww, 0.55, 0.12, darkM, cx, 0.32);
      const glass = face(sww - 0.06, 1.2, 0.04, glow.windowLit, cx, 1.22, 0.02);
      glass.castShadow = false;
      const m = Math.max(1, Math.round(sww / 0.7));
      for (let k = 1; k < m; k++) face(0.05, 1.2, 0.04, trimM, a + (k * sww) / m, 1.22, 0.05);
      face(sww, 0.05, 0.05, trimM, cx, 1.5, 0.05);
    }
    face(1.1, 2.0, 0.06, trimM, dx, 1.0, -0.02);
    face(0.86, 1.8, 0.06, mat(DOOR_COLOURS[Math.floor(r() * DOOR_COLOURS.length)]), dx, 0.9, 0.01);
    face(0.5, 0.5, 0.03, glow.windowLit, dx, 1.3, 0.05).castShadow = false;
  } else if (kind === 'warehouse') {
    face(1.9, 2.3, 0.08, darkM, dx, 1.15, 0.0);
    face(0.06, 2.3, 0.04, mat(C.wood), dx, 1.15, 0.08);
    for (const yy of [0.5, 1.15, 1.8]) face(1.9, 0.06, 0.04, mat(C.wood), dx, yy, 0.08);
    // Loading doors stacked up the middle, and a hoist beam with its rope and hook.
    if (w >= 5) {
      for (let s = 1; s < storeys; s++) face(1.0, 1.6, 0.08, darkM, 0, s * storeyH + 1.0, 0);
      g.add(box(0.14, 0.14, 1.0, darkM, 0, h - 0.3, zf + f * 0.5));
      g.add(cyl(0.015, 0.015, 1.6, 4, mat(0x8a7a5a), 0, h - 1.1, zf + f * 0.95));
      g.add(box(0.1, 0.18, 0.04, mat(C.iron), 0, h - 1.95, zf + f * 0.95));
    }
  } else if (kind === 'church') {
    const buttM = mat(0x5e5a52);
    // Buttresses between the lancets, and at the corners.
    const bc = Math.max(1, Math.floor(w / 2));
    for (let k = 0; k <= bc; k++) {
      const bx = -w / 2 + (k * w) / bc + (k === 0 ? 0.17 : k === bc ? -0.17 : 0);
      if (Math.abs(bx - dx) < 1.0) continue;
      face(0.34, h * 0.42, 0.34, buttM, bx, h * 0.21);
      face(0.3, 0.5, 0.2, buttM, bx, h * 0.42 + 0.25);
    }
    face(1.5, 2.6, 0.2, stoneM, dx, 1.3);
    face(1.1, 2.2, 0.06, darkM, dx, 1.1, 0.2);
    for (let k = 1; k <= 3; k++) face(1.6 - k * 0.4, 0.16, 0.24, stoneM, dx, 2.6 + k * 0.14);
  } else {
    // A house door: panelled, with a fanlight, pilasters and a hood on brackets.
    face(0.86, 1.78, 0.06, mat(DOOR_COLOURS[Math.floor(r() * DOOR_COLOURS.length)]), dx, 0.92, -0.02);
    for (const py of [0.55, 1.25]) for (const sx of [-1, 1]) face(0.28, 0.5, 0.02, darkM, dx + sx * 0.19, py, 0.04);
    face(0.78, 0.26, 0.04, glow.windowLit, dx, 1.98, -0.01).castShadow = false;
    for (const sx of [-1, 1]) face(0.12, 2.25, 0.1, r() < 0.5 ? stoneM : trimM, dx + sx * 0.52, 1.12);
    face(1.3, 0.12, 0.34, stoneM, dx, 2.24);
    face(1.4, 0.06, 0.4, stoneM, dx, 2.33);
    g.add(cyl(0.03, 0.03, 0.04, 6, mat(C.brass, 0.4, 0.6), dx + 0.28, 0.95, zf + f * 0.06));
  }
  // Steps up to the door.
  g.add(box(1.2, 0.12, 0.3, mat(C.stone), dx, 0.06, zf + f * 0.15));
  if (kind === 'house') g.add(box(1.0, 0.12, 0.2, mat(C.stone), dx, 0.18, zf + f * 0.1));

  if (opts.sign) {
    const sign = makeSign(opts.sign, Math.min(w - 0.4, 3.6));
    sign.position.set(kind === 'shop' ? 0 : dx, kind === 'shop' ? 2.15 : kind === 'church' ? 3.3 : 2.75, zf + f * (kind === 'shop' ? 0.2 : 0.1));
    sign.rotation.y = opts.faceNorth ? Math.PI : 0;
    if (kind === 'shop') sign.scale.setScalar(Math.min(1, (w - 0.6) / Math.min(w - 0.4, 3.6)));
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
