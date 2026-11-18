import * as THREE from 'three';
import { C, mat } from './materials';
import { rng } from './props';

export type SpotKind = 'heap' | 'bucket' | 'foreshore';

/** Places in Saltwharf worth rummaging: rubbish heaps in the alleys, slop buckets, the foreshore at low tide. */
export interface ScavengeSpot {
  id: string;
  kind: SpotKind;
  name: string;
  description: string;
  /** The tile the pile sits on (blocked). */
  x: number;
  z: number;
  /** Where you stand to rummage. */
  stand: { x: number; z: number };
}

export const SPOTS: ScavengeSpot[] = [
  { id: 'heap-back1', kind: 'heap', name: 'Rubbish heap', description: 'Ash, cabbage stalks, broken crockery and whatever the houses on Back Lane threw out the window.', x: 12, z: 29, stand: { x: 11, z: 29 } },
  { id: 'heap-back2', kind: 'heap', name: 'Rubbish heap', description: 'A heap the dust-men forgot. Something glints, or it is only wet.', x: 26, z: 30, stand: { x: 25, z: 30 } },
  { id: 'heap-back3', kind: 'heap', name: 'Rubbish heap', description: 'Sacking, straw and a dead cat nobody has claimed.', x: 38, z: 28, stand: { x: 37, z: 28 } },
  { id: 'heap-church', kind: 'heap', name: 'Behind the church', description: 'Where the sexton tips the sweepings: candle ends, hymn books, old flowers.', x: 12, z: 38, stand: { x: 11, z: 38 } },
  { id: 'heap-lane', kind: 'heap', name: 'Alley midden', description: 'The narrow way toward Hollow Lane. Rookery rubbish: rags, bones, bottles.', x: 33, z: 11, stand: { x: 32, z: 11 } },
  { id: 'bucket-court', kind: 'bucket', name: 'Slop buckets', description: 'Gull Court\'s buckets, waiting for the night-soil man. Not only slops go in.', x: 7, z: 20, stand: { x: 8, z: 20 } },
  { id: 'bucket-cup', kind: 'bucket', name: 'Pot-boy\'s bucket', description: 'By the Copper Cup\'s back door: dregs, corks, and what drinkers drop under the benches.', x: 21, z: 16, stand: { x: 21, z: 15 } },
  { id: 'foreshore', kind: 'foreshore', name: 'The foreshore', description: 'When the tide goes out, the mudlarks come down the steps. The river gives back what London drops.', x: 41, z: 4, stand: { x: 41, z: 5 } },
];

type Loot = [string, number];
/** Weights; '£' is a few pennies, '' is nothing at all. */
const LOOT: Record<SpotKind, Loot[]> = {
  heap: [['rags', 30], ['bottle', 18], ['bones', 16], ['pipe', 9], ['buttons', 9], ['glove', 6], ['spoon', 3], ['watch', 1], ['£', 8], ['', 20]],
  bucket: [['bottle', 24], ['rags', 14], ['apple', 12], ['buttons', 10], ['pipe', 8], ['£', 14], ['ring', 1], ['', 22]],
  foreshore: [['copper', 18], ['rope', 18], ['bottle', 14], ['bones', 10], ['buttons', 6], ['spoon', 4], ['ring', 3], ['watch', 2], ['£', 14], ['', 14]],
};

/** One rummage: Cunning finds more, and finds it faster. */
export function rummage(kind: SpotKind, cunning: number, rand = Math.random): string {
  const table = LOOT[kind].map(([id, w]) => [id, id === '' ? Math.max(4, w - cunning * 1.5) : w] as Loot);
  const total = table.reduce((a, [, w]) => a + w, 0);
  let x = rand() * total;
  for (const [id, w] of table) if ((x -= w) < 0) return id;
  return '';
}

/** A low, dark pile, a pair of buckets, or driftwood on the mud. */
export function buildSpot(spot: ScavengeSpot): THREE.Group {
  const g = new THREE.Group();
  const r = rng(spot.x * 131 + spot.z * 17);
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    g.add(m);
  };
  if (spot.kind === 'heap') {
    const cols = [0x3a3328, 0x4a4030, 0x2e2a24, 0x5a4a34, 0x6a5a40];
    for (let i = 0; i < 7; i++) {
      const s = 0.22 + r() * 0.25;
      box(s, s * 0.6, s, cols[Math.floor(r() * cols.length)], (r() - 0.5) * 0.6, s * 0.3 + (i > 3 ? 0.15 : 0), (r() - 0.5) * 0.6, r() * 3);
    }
    box(0.5, 0.3, 0.35, 0x7a6a4a, 0.1, 0.15, -0.15, 0.4); // a sack
    const shard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), mat(0xd8d0b8));
    shard.position.set(-0.2, 0.32, 0.1);
    g.add(shard);
  } else if (spot.kind === 'bucket') {
    for (const [dx, dz] of [[-0.2, 0], [0.22, 0.12]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.42, 8), mat(C.woodDark));
      b.position.set(dx, 0.21, dz);
      b.castShadow = true;
      g.add(b);
      const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 8), mat(C.iron, 0.6, 0.4));
      hoop.position.set(dx, 0.36, dz);
      g.add(hoop);
    }
  } else {
    box(1.0, 0.08, 0.14, 0x5a4a38, 0, 0.05, 0, 0.3);
    box(0.7, 0.08, 0.12, 0x4a3a2a, 0.1, 0.12, 0.2, -0.5);
    for (let i = 0; i < 4; i++) box(0.12, 0.08, 0.1, C.stone, (r() - 0.5) * 0.8, 0.04, (r() - 0.5) * 0.6, r() * 3);
  }
  g.position.set(spot.x + 0.5, 0, spot.z + 0.5);
  g.userData.placeId = `scav:${spot.id}`;
  return g;
}
