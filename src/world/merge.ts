import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Geometry ready to merge: non-indexed, position + normal + colour, in the target's space. */
function prepared(mesh: THREE.Mesh, toTarget: THREE.Matrix4): THREE.BufferGeometry {
  let g = mesh.geometry.clone();
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = (mesh.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.applyMatrix4(toTarget);
  return g;
}

/** Plain materials (no glow, no transparency) can share one vertex-coloured material. */
const plain = (m: THREE.Material): m is THREE.MeshStandardMaterial => {
  const s = m as THREE.MeshStandardMaterial;
  return !!s.isMeshStandardMaterial && !s.transparent && (!s.emissive || s.emissive.getHex() === 0 || s.emissiveIntensity === 0) && !s.map;
};

const shared = new Map<string, THREE.MeshStandardMaterial>();
function sharedFor(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const key = `${m.roughness}|${m.metalness}|${m.side}`;
  let s = shared.get(key);
  if (!s) {
    s = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, side: m.side, flatShading: true });
    shared.set(key, s);
  }
  return s;
}

/** Bucket key: plain materials share by surface; special ones (glass, glow) stay apart. */
function keyFor(m: THREE.Material, cast: boolean): { key: string; mat: THREE.Material } {
  if (plain(m)) {
    const s = sharedFor(m);
    return { key: `${s.uuid}|${cast}`, mat: s };
  }
  return { key: `${m.uuid}|${cast}`, mat: m };
}

const mergeable = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh;
  if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return false;
  const mat = m.material as THREE.MeshStandardMaterial;
  return !Array.isArray(mat) && !mat.map;
};

/**
 * Merges every static mesh under `root` (whole subtree) into one mesh per material and shadow flag.
 * Textured meshes (signs) and instanced meshes are left alone. Cuts draw calls for scenery.
 */
export function mergeSubtree(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  root.traverse((o) => {
    if (o === root || !mergeable(o)) return;
    const { key, mat } = keyFor(o.material as THREE.Material, o.castShadow);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat, cast: o.castShadow, recv: true, geos: [], meshes: [] }));
    b.geos.push(prepared(o, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
    b.meshes.push(o);
  });
  for (const b of buckets.values()) {
    if (b.meshes.length < 2 && b.mat === b.meshes[0].material) continue;
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    for (const m of b.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    root.add(mesh);
  }
  // Drop groups left empty.
  const empty: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !(o as THREE.Light).isLight) empty.push(o);
  });
  for (const e of empty) e.removeFromParent();
}

/**
 * For animated rigs: merges only the direct mesh children of each group, so limbs keep moving.
 */
export function mergeChildren(root: THREE.Object3D): void {
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) groups.push(o);
  });
  for (const g of groups) {
    const buckets = new Map<string, { mat: THREE.Material; list: THREE.Mesh[] }>();
    for (const c of g.children) {
      if (!mergeable(c)) continue;
      const { key, mat } = keyFor(c.material as THREE.Material, c.castShadow);
      (buckets.get(key) ?? buckets.set(key, { mat, list: [] }).get(key)!).list.push(c);
    }
    for (const { mat, list } of buckets.values()) {
      if (list.length < 2 && mat === list[0].material) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        return prepared(m, m.matrix);
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      for (const m of list) m.removeFromParent();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = list[0].castShadow;
      g.add(mesh);
    }
  }
}
