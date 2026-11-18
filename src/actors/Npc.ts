import * as THREE from 'three';
import type { Activity, Resident, Stop } from '../game/residents';
import type { Grid } from '../world/grid';
import { Player } from './Player';

/** Small things people hold while they work. Built once, shared. */
const propMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true });
const PROPS: Partial<Record<Activity, () => THREE.Object3D>> = {
  sell: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.12, 8), propMat(0x8a6a3a)));
    const goods = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), propMat(0x9a3a2a));
    goods.position.y = 0.08;
    g.add(goods);
    return g;
  },
  flowers: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), propMat(0x4a6a3a)));
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), propMat(0x8a5ab0));
    b.position.y = 0.12;
    g.add(b);
    return g;
  },
  read: () => new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.13), propMat(0x5a2a22)),
  sweep: () => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 4), propMat(0x6a5038));
    h.position.y = -0.35;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.08), propMat(0x8a7a50));
    b.position.y = -0.85;
    g.add(h, b);
    return g;
  },
  drink: () => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 7), propMat(0x8a7a6a)),
  smoke: () => new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), propMat(0xd8d0c0)),
  mend: () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.16), propMat(0xb8b0a0)),
  haul: () => new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.32), propMat(0x7a5a38)),
  wash: () => new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.2, 9), propMat(0x6a5a48)),
  sick: () => new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.34), propMat(0x5a5650)),
};

/** A resident walking their daily routine. Reuses the player's walker and model. */
export class Npc {
  readonly walker: Player;
  private stopKey = '';
  /** Paused while the player talks to them. */
  held = false;
  /** Walking somewhere of their own accord (to a neighbour, or to you). */
  visiting = false;
  /** What they are doing at their stop. */
  act: Activity | null = null;
  private prop: THREE.Object3D | null = null;
  private propFor: Activity | null = null;
  private home = { x: 0, z: 0 };
  private haulT = 0;
  private seed: number;

  constructor(readonly res: Resident, private readonly grid: Grid) {
    this.walker = new Player(grid, res.look, res.home.x + 0.5, res.home.z + 0.5);
    this.walker.rig.root.userData.npcId = res.id;
    this.walker.rig.root.visible = false;
    this.seed = res.id.length * 1.37 + res.id.charCodeAt(0) * 0.11;
  }

  private meshes: THREE.Mesh[] | null = null;
  private shadow = true;

  /** Only people near you cast shadows: the shadow pass is the expensive one. */
  setShadow(on: boolean): void {
    if (on === this.shadow) return;
    this.shadow = on;
    this.meshes ??= (() => { const m: THREE.Mesh[] = []; this.walker.rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) m.push(o as THREE.Mesh); }); return m; })();
    for (const m of this.meshes) m.castShadow = on;
  }

  get visible(): boolean {
    return this.walker.rig.root.visible;
  }

  /** At their stop and not walking: doing their thing. */
  get idle(): boolean {
    return this.visible && !this.walker.moving && !this.visiting && !this.held;
  }

  private cellFor(stop: Stop | null): { x: number; z: number } {
    const c = stop ?? this.res.home;
    return this.grid.nearestWalkable(c.x, c.z, 3) ?? { x: this.res.home.x, z: this.res.home.z };
  }

  /** Moves toward the current stop. `walk` false snaps there (when the player can't see). */
  follow(stop: Stop | null, walk: boolean): void {
    this.act = stop?.act ?? null;
    const key = stop ? `${stop.x},${stop.z}` : 'home';
    if (key === this.stopKey || this.held || this.visiting) return;
    this.stopKey = key;
    const root = this.walker.rig.root;
    const target = this.cellFor(stop);
    this.home = target;
    if (!walk) {
      root.visible = stop !== null;
      this.walker.teleport(this.grid, target.x + 0.5, target.z + 0.5);
      return;
    }
    if (stop) {
      if (!root.visible) {
        const door = this.cellFor(null);
        this.walker.teleport(this.grid, door.x + 0.5, door.z + 0.5);
        root.visible = true;
      }
      this.walker.walkTo(target);
    } else if (root.visible) {
      this.walker.walkTo(target, () => (root.visible = false));
    }
  }

  /** Walk somewhere for your own reasons; `release` sends you back to your routine. */
  visit(cell: { x: number; z: number }, onArrive: () => void): boolean {
    if (!this.visible || this.held) return false;
    this.visiting = true;
    const ok = this.walker.walkTo(cell, onArrive);
    if (!ok) this.visiting = false;
    return ok;
  }

  release(): void {
    this.visiting = false;
    this.stopKey = '';
  }

  update(dt: number, t: number): void {
    if (!this.visible) return;
    this.walker.update(dt, t);
    const working = !this.walker.moving && !this.visiting;
    // Dockers carry crates up and down the quay.
    if (this.act === 'haul' && working && !this.held) {
      this.haulT += dt;
      if (this.haulT > 7) {
        this.haulT = 0;
        const c = this.walker.cell;
        const back = c.x > this.home.x ? this.home : { x: this.home.x + 3, z: this.home.z };
        if (this.grid.isWalkable(back.x, back.z)) this.walker.walkTo(back);
      }
    }
    const act = this.act && !this.visiting && (working || this.act === 'haul') ? this.act : null;
    this.setProp(act);
    const r = this.walker.rig;
    r.head.rotation.x = 0;
    r.head.rotation.z = 0;
    r.body.rotation.y = 0;
    r.body.rotation.z = 0;
    r.body.position.x = 0;
    if (act && !this.walker.moving) this.pose(act, t + this.seed);
    else if (act === 'haul') this.pose(act, t + this.seed);
  }

  private setProp(act: Activity | null): void {
    if (act === this.propFor) return;
    this.propFor = act;
    this.prop?.removeFromParent();
    this.prop = null;
    const make = act ? PROPS[act] : undefined;
    if (!make) return;
    const p = make();
    const rig = this.walker.rig;
    if (act === 'haul') {
      p.position.set(0, 1.42, 0.12);
      rig.body.add(p);
    } else if (act === 'wash') {
      p.position.set(0, 0.1, 0.42);
      rig.root.add(p);
    } else if (act === 'sick') {
      p.position.set(0, 0.95, 0);
      rig.body.add(p);
    } else {
      p.position.set(0, -0.58, 0.06);
      rig.armR.add(p);
    }
    this.prop = p;
  }

  /** Idle poses on top of the breathing animation. */
  private pose(act: Activity, t: number): void {
    const r = this.walker.rig;
    const pulse = (period: number, len: number) => {
      const x = (t % period) / len;
      return x < 1 ? Math.sin(x * Math.PI) : 0;
    };
    switch (act) {
      case 'sell':
        r.armR.rotation.x = -0.9;
        r.armL.rotation.x = -2.6 * pulse(5, 1.1);
        r.head.rotation.x = -0.15 * pulse(5, 1.1);
        break;
      case 'flowers':
        r.armR.rotation.x = -1.2;
        r.armL.rotation.x = -0.4;
        r.body.rotation.y = Math.sin(t * 0.9) * 0.15;
        break;
      case 'box': {
        const j = Math.sin(t * 9);
        r.armL.rotation.x = -1.5 - Math.max(0, j) * 0.4;
        r.armR.rotation.x = -1.5 - Math.max(0, -j) * 0.4;
        r.armL.rotation.z = 0.3;
        r.armR.rotation.z = -0.3;
        r.body.position.y = Math.abs(Math.sin(t * 4.5)) * 0.05;
        r.body.rotation.y = Math.sin(t * 2.2) * 0.25;
        break;
      }
      case 'read':
      case 'count':
        r.armL.rotation.x = -1.0;
        r.armR.rotation.x = -1.0 + (act === 'count' ? Math.sin(t * 5) * 0.12 : 0);
        r.armL.rotation.z = 0.35;
        r.armR.rotation.z = -0.35;
        r.head.rotation.x = 0.35;
        r.head.rotation.y = 0;
        break;
      case 'sweep':
        r.armL.rotation.x = -0.8;
        r.armR.rotation.x = -0.6;
        r.body.rotation.y = Math.sin(t * 3) * 0.45;
        break;
      case 'drink':
      case 'smoke': {
        const lift = pulse(act === 'drink' ? 6 : 8, 1.4);
        r.armR.rotation.x = -0.4 - lift * 2.0;
        r.armR.rotation.z = -0.25 * lift;
        r.head.rotation.x = -0.25 * lift;
        break;
      }
      case 'mend':
        r.armL.rotation.x = -1.1;
        r.armR.rotation.x = -1.1 + Math.sin(t * 7) * 0.15;
        r.armL.rotation.z = 0.3;
        r.armR.rotation.z = -0.3 - Math.max(0, Math.sin(t * 3.5)) * 0.35;
        r.head.rotation.x = 0.3;
        break;
      case 'haul':
        r.armL.rotation.x = -2.6;
        r.armR.rotation.x = -2.6;
        r.armL.rotation.z = 0.15;
        r.armR.rotation.z = -0.15;
        break;
      case 'wash':
        r.body.rotation.x = 0.55;
        r.armL.rotation.x = -1.1 + Math.sin(t * 6) * 0.3;
        r.armR.rotation.x = -1.1 - Math.sin(t * 6) * 0.3;
        break;
      case 'feed':
        r.armR.rotation.x = -1.4 * pulse(3, 0.6);
        r.armL.rotation.x = -0.7;
        r.head.rotation.x = 0.25;
        break;
      case 'preach':
        r.armL.rotation.z = -1.1 - Math.sin(t * 1.3) * 0.2;
        r.armR.rotation.z = 1.1 + Math.sin(t * 1.1) * 0.2;
        r.armL.rotation.x = -0.4;
        r.armR.rotation.x = -0.4;
        r.head.rotation.x = -0.15;
        break;
      case 'watch':
        r.armL.rotation.x = 0.35;
        r.armR.rotation.x = 0.35;
        r.head.rotation.y = Math.sin(t * 0.35) * 0.9;
        break;
      case 'sick':
        r.body.rotation.x = 0.35;
        r.armL.rotation.x = -1.0;
        r.armR.rotation.x = -1.0;
        r.armL.rotation.z = 0.5;
        r.armR.rotation.z = -0.5;
        r.body.position.x = Math.sin(t * 40) * 0.006;
        r.head.rotation.x = 0.3;
        break;
      case 'confused':
        r.head.rotation.z = Math.sin(t * 0.6) * 0.3;
        r.body.rotation.y = Math.sin(t * 0.4) * 0.3;
        r.armL.rotation.x = 0.1;
        r.armR.rotation.x = 0.1;
        break;
      case 'play': {
        r.body.position.y = Math.abs(Math.sin(t * 6)) * 0.12;
        r.armL.rotation.x = -1.6 + Math.sin(t * 6) * 0.6;
        r.armR.rotation.x = -1.6 - Math.sin(t * 6) * 0.6;
        r.body.rotation.y = t * 1.5;
        break;
      }
      case 'lean':
        r.body.rotation.z = 0.12;
        r.armL.rotation.x = -1.0;
        r.armR.rotation.x = -1.0;
        r.armL.rotation.z = 0.55;
        r.armR.rotation.z = -0.55;
        break;
    }
  }
}
