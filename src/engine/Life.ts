import * as THREE from 'three';
import { Player } from '../actors/Player';
import type { Look } from '../actors/characterModel';
import type { Grid } from '../world/grid';
import { makeLamp } from '../world/props';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Weather } from '../game/calendar';

/**
 * Everything in Saltwharf that isn't a resident: gulls, crows, rats and cats; the crier,
 * the lamplighter, drunks and the constable; a funeral, a family turned out, Vane's men;
 * rain, the bonfire, lost things glinting in the gutter, and the dead.
 */
export interface LifeContext {
  hour: number;
  day: number;
  weather: Weather;
  player: THREE.Vector2;
  /** The dead are visible. */
  sight: boolean;
  holiday: string | null;
  headline: string;
  /** Lost things to show: quest id and tile. */
  lost: { id: number; x: number; z: number }[];
}

export interface LifeHooks {
  bubble(x: number, z: number, name: string, text: string): void;
  bell(strikes: number): void;
}

/** Scripted days. */
export const FUNERAL_DAY = 9;
export const EVICTION_DAY = 13;
export const VANE_START = 10;
export const VANE_DONE = 15;
const VANE_TILE = { x: 19, z: 6 };

type Cell = { x: number; z: number };

const LOOK = (o: Partial<Look> & Pick<Look, 'coat'>): Look => ({ skin: 0xd8b090, hair: 0x3a2a1e, trousers: 0x2a2622, shirt: 0xc8bca0, boots: 0x1a1612, hat: 'none', ...o });

/** A figure who walks a route in a time window: crier, lamplighter, drunk, constable, mourner. */
class Extra {
  readonly walker: Player;
  private i = 0;
  private wait = 0;
  private talkT = 2 + Math.random() * 4;
  active = false;
  constructor(
    scene: THREE.Scene, private readonly grid: Grid, look: Look,
    readonly name: string,
    readonly tag: string,
    private readonly route: Cell[],
    private readonly when: (c: LifeContext) => boolean,
    private readonly opts: { loop?: boolean; pause?: number; lines?: string[] | ((c: LifeContext) => string[]); talkEvery?: number; speed?: number; wobble?: boolean; hold?: (rig: Player['rig'], t: number, paused: boolean) => void } = {},
  ) {
    this.walker = new Player(grid, look, route[0].x + 0.5, route[0].z + 0.5);
    this.walker.speedMult = opts.speed ?? 0.8;
    this.walker.rig.root.visible = false;
    this.walker.rig.root.userData.life = tag;
    scene.add(this.walker.rig.root);
  }

  get root() {
    return this.walker.rig.root;
  }

  private next(): void {
    const last = this.route.length - 1;
    if (this.i >= last && !this.opts.loop) return;
    this.i = this.i >= last ? 0 : this.i + 1;
    this.walker.walkTo(this.route[this.i], () => (this.wait = this.opts.pause ?? 0));
  }

  update(dt: number, t: number, c: LifeContext, hooks: LifeHooks): void {
    const on = this.when(c);
    if (on !== this.active) {
      this.active = on;
      this.root.visible = on;
      if (on) {
        this.i = 0;
        this.walker.teleport(this.grid, this.route[0].x + 0.5, this.route[0].z + 0.5);
        this.wait = 0.5;
      }
    }
    if (!on) return;
    if (!this.walker.moving) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = 999;
        this.next();
      }
    }
    this.walker.update(dt, t);
    if (this.opts.wobble) {
      this.root.rotation.z = Math.sin(t * 2.3) * 0.12;
      this.root.position.x += Math.sin(t * 1.7) * 0.15;
    }
    this.opts.hold?.(this.walker.rig, t, !this.walker.moving);
    const lines = typeof this.opts.lines === 'function' ? this.opts.lines(c) : this.opts.lines;
    if (lines?.length) {
      this.talkT -= dt;
      if (this.talkT <= 0) {
        this.talkT = (this.opts.talkEvery ?? 9) * (0.7 + Math.random() * 0.6);
        const p = this.walker.position;
        if (Math.hypot(p.x - c.player.x, p.y - c.player.y) < 9) hooks.bubble(p.x, p.y, this.name, lines[Math.floor(Math.random() * lines.length)]);
      }
    }
  }
}

interface Bird {
  g: THREE.Group;
  wings: THREE.Mesh[];
  pos: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  flying: boolean;
  rest: number;
  zone: { x0: number; z0: number; x1: number; z1: number };
}

interface Critter {
  g: THREE.Group;
  pos: THREE.Vector2;
  to: THREE.Vector2;
  rest: number;
  speed: number;
  zone: { x0: number; z0: number; x1: number; z1: number };
}

const basic = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });

/** Boxes merged into one mesh: one draw call per creature. */
function solid(color: number, parts: [number, number, number, number, number, number, number?][]): THREE.Mesh {
  const geos = parts.map(([w, h, d, x, y, z, rx]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    return g;
  });
  return new THREE.Mesh(mergeGeometries(geos), basic(color));
}

function makeBird(color: number, wing: number, size: number): { g: THREE.Group; wings: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.add(solid(color, [[0.12, 0.1, 0.24, 0, 0.1, 0], [0.08, 0.08, 0.1, 0, 0.18, 0.12]]));
  // Both wings in one mesh: a flap squeezes the span, which reads well from above.
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.015, 0.14), basic(wing));
  w.position.set(0, 0.13, 0);
  w.scale.x = 0.6;
  const wings = [w];
  g.add(...wings);
  g.scale.setScalar(size);
  return { g, wings };
}

function makeRat(): THREE.Group {
  const g = new THREE.Group();
  g.add(solid(0x2a2420, [[0.1, 0.07, 0.2, 0, 0.04, 0], [0.015, 0.015, 0.18, 0, 0.03, -0.18]]));
  return g;
}

function makeCat(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(solid(color, [
    [0.16, 0.14, 0.34, 0, 0.14, 0], [0.14, 0.12, 0.12, 0, 0.26, 0.2],
    [0.04, 0.06, 0.03, -0.045, 0.34, 0.2], [0.04, 0.06, 0.03, 0.045, 0.34, 0.2],
    [0.03, 0.03, 0.26, 0, 0.26, -0.24, 0.7],
  ]));
  return g;
}

export class Life {
  private readonly root = new THREE.Group();
  private readonly extras: Extra[] = [];
  private readonly birds: Bird[] = [];
  private readonly rats: Critter[] = [];
  private readonly cats: Critter[] = [];
  private readonly ghosts: { rig: Player; route: Cell[]; i: number; name: string; lines: string[] }[] = [];
  private readonly rain: THREE.LineSegments;
  private readonly rainBase: Float32Array;
  private readonly bonfire: THREE.Group;
  private readonly fireLight: THREE.PointLight;
  private readonly flames: THREE.Mesh[] = [];
  private readonly sparks: THREE.Points;
  private readonly vaneLamp: THREE.Group;
  private readonly cart: THREE.Group;
  private readonly coffin: THREE.Mesh;
  private readonly glints = new Map<number, THREE.Mesh>();
  private readonly glintGeo = new THREE.OctahedronGeometry(0.12, 0);
  private readonly glintMat = new THREE.MeshStandardMaterial({ color: 0xf0d890, emissive: 0xf0c060, emissiveIntensity: 1.4, flatShading: true });
  private lastHour = -1;
  private readonly ghostMat = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  /** Tappable things: crier, ghosts, mourners, lost glints, the bonfire. userData.life names them. */
  readonly tappables: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, private readonly grid: Grid, private readonly hooks: LifeHooks, lamps: Cell[]) {
    scene.add(this.root);
    const g = grid;
    const route = (...c: [number, number][]) => c.map(([x, z]) => ({ x, z }));

    // The town crier, 08:00–09:30: Quay Street to the market, ringing the day's news.
    const crier = new Extra(scene, g, LOOK({ coat: 0x7a2420, shirt: 0xe0d6c0, hat: 'top', hatColor: 0x2a1a14, trousers: 0x2a2018 }), 'The crier', 'crier',
      route([1, 8], [14, 8], [14, 16], [11, 17]),
      (c) => c.hour >= 8 && c.hour < 9.5, {
        pause: 0.2, talkEvery: 6, speed: 0.9,
        lines: (c) => [`Hear ye! ${c.headline}`, 'Oyez, oyez! News of the day!', `${c.headline}! Read it in the Gazette!`],
        hold: (rig, t, paused) => {
          if (!paused) return;
          rig.armR.rotation.x = -2.2 - Math.sin(t * 12) * 0.25;
        },
      });
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 6), basic(0xb08a3e));
    bell.position.set(0, -0.62, 0.04);
    crier.walker.rig.armR.add(bell);
    this.extras.push(crier);

    // The lamplighter, 16:30–18:30, lamp to lamp with his pole.
    const lampStops = lamps.map((l) => g.nearestWalkable(Math.floor(l.x), Math.floor(l.z) + 1, 2) ?? { x: Math.floor(l.x), z: Math.floor(l.z) + 1 });
    const lighter = new Extra(scene, g, LOOK({ coat: 0x3a3428, hat: 'cap', hatColor: 0x2a2620 }), 'The lamplighter', 'lighter',
      lampStops, (c) => c.hour >= 16.5 && c.hour < 18.6, {
        pause: 2.2, speed: 1.0, talkEvery: 14,
        lines: ['Evening.', 'Light\'s coming.', 'Keep to the lamps tonight.', 'Old Bill went missing doing this round. Greymourne way. Never found him.'],
        hold: (rig, _t, paused) => {
          rig.armR.rotation.x = paused ? -2.9 : -0.3;
        },
      });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4), basic(0x4a3a28));
    pole.position.set(0, -1.1, 0.04);
    const wick = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffb050 }));
    wick.position.y = -0.8;
    pole.add(wick);
    lighter.walker.rig.armR.add(pole);
    this.extras.push(lighter);

    // Drunks, 22:00–01:30, from the Copper Cup to Gull Court, singing.
    const songs = ['♪ Champagne Charlie is me name... ♪', '♪ Oh the Rose of Tralee... ♪', '♪ ...and the Ratcliffe Highway... ♪', 'You\'re me best mate, you are.', 'Where\'s me hat?'];
    const late = (c: LifeContext) => c.hour >= 22 || c.hour < 1.5;
    this.extras.push(new Extra(scene, g, LOOK({ coat: 0x4a3a30, hat: 'cap' }), 'A drunk', 'drunk',
      route([18, 8], [14, 8], [14, 16], [4, 16], [14, 16], [14, 8]), late, { loop: true, pause: 3, speed: 0.55, wobble: true, lines: songs, talkEvery: 7 }));
    this.extras.push(new Extra(scene, g, LOOK({ coat: 0x3a3a44, hat: 'none', hair: 0x8a6a40 }), 'Another drunk', 'drunk',
      route([19, 8], [15, 8], [14, 15], [5, 16], [14, 15], [15, 8]), late, { loop: true, pause: 4, speed: 0.5, wobble: true, lines: songs, talkEvery: 8 }));

    // A constable walks Quay Street at night with his lantern. Safer near him.
    const constable = new Extra(scene, g, LOOK({ coat: 0x1a2030, shirt: 0x1a2030, hat: 'top', hatColor: 0x14161c, trousers: 0x14161c }), 'Constable', 'constable',
      route([2, 8], [29, 8]), (c) => c.hour >= 21 || c.hour < 5, {
        loop: true, pause: 4, speed: 0.6, talkEvery: 12,
        lines: ['Evening. Mind how you go.', 'Move along now.', 'Keep out of Gull Court, if you value your purse.', 'All quiet. Too quiet.'],
      });
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.09), new THREE.MeshBasicMaterial({ color: 0xffd080 }));
    lantern.position.set(0, -0.62, 0.05);
    constable.walker.rig.armR.add(lantern);
    this.extras.push(constable);

    // The funeral of old Sam Pike, the net-mender: day 9, 11:00.
    const mourn = LOOK({ coat: 0x121214, shirt: 0x121214, trousers: 0x121214, hat: 'top', hatColor: 0x0c0c0e });
    const funeral = (c: LifeContext) => c.day === FUNERAL_DAY && c.hour >= 11 && c.hour < 12.4;
    const path = route([3, 16], [14, 16], [14, 8], [1, 8]);
    const offsets = [0, 0.9, 1.8, 2.7];
    offsets.forEach((d, k) => {
      const e = new Extra(scene, g, k === 0 ? LOOK({ coat: 0x121214, hat: 'top', hatColor: 0x0c0c0e, shirt: 0xf0f0f0 }) : { ...mourn, skirt: k === 3, hat: k === 3 ? 'bonnet' : 'top' },
        k === 0 ? 'The undertaker' : 'A mourner', 'funeral',
        path, (c) => funeral(c) && c.hour >= 11 + d / 30, {
          speed: 0.35, lines: k === 3 ? ['Rest you, Sam.', 'Forty years he mended nets on that quay.', 'The fog had him at the end. He didn\'t know us.'] : undefined, talkEvery: 10,
          hold: (rig) => {
            if (k === 1 || k === 2) {
              rig.armL.rotation.x = -2.8;
              rig.armR.rotation.x = -2.8;
            }
          },
        });
      this.extras.push(e);
    });
    this.coffin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 1.6), basic(0x2a1a10));
    this.coffin.visible = false;
    this.coffin.userData.life = 'funeral';
    this.root.add(this.coffin);
    this.tappables.push(this.coffin);

    // A family turned out of Gull Court: day 13, a cart piled with their things.
    this.cart = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.6), basic(0x5a4028));
    bed.position.y = 0.45;
    this.cart.add(bed);
    for (const [x, z] of [[-0.55, 0.5], [0.55, 0.5]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 10), basic(0x3a2818));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.35, z);
      this.cart.add(w);
    }
    for (const [x, y, z, c] of [[0, 0.7, 0.3, 0x6a5a48], [0.2, 0.7, -0.4, 0x4a3a2e], [-0.2, 0.95, -0.2, 0x8a7a68], [0, 0.65, -0.1, 0x7a3a2a]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), basic(c));
      b.position.set(x, y, z);
      this.cart.add(b);
    }
    this.cart.position.set(2.0, 0, 15.5);
    this.cart.rotation.y = Math.PI / 2;
    this.cart.visible = false;
    this.root.add(this.cart);
    const evict = (c: LifeContext) => c.day === EVICTION_DAY && c.hour >= 8 && c.hour < 14;
    this.extras.push(new Extra(scene, g, LOOK({ coat: 0x4a4038, skin: 0x8a5a3a, hair: 0x15110e, hat: 'cap' }), 'Mr. Okafor', 'evict',
      route([4, 16], [6, 16]), evict, { loop: true, pause: 3, talkEvery: 9, lines: ['Six years we paid him. Six years.', 'Mind the chair, love. It was your grandmother\'s.', 'Grubb says the room\'s let already. To a Vane man.'],
        hold: (rig, _t, paused) => { if (!paused) { rig.armL.rotation.x = -2.6; rig.armR.rotation.x = -2.6; } } }));
    this.extras.push(new Extra(scene, g, LOOK({ coat: 0x5a3a4a, skin: 0x8a5a3a, hair: 0x15110e, skirt: true, hat: 'bonnet', hatColor: 0x4a3a3a }), 'Mrs. Okafor', 'evict',
      route([4, 15], [4, 15]), evict, { talkEvery: 11, lines: ['Where will we go?', 'Don\'t cry, Sola. Don\'t cry.', 'He never mended that roof once.'] }));

    // Vane's men put up a white lamp on the quay: days 10–14, then it shines for good.
    const lamp = makeLamp(true);
    this.vaneLamp = lamp.group;
    this.vaneLamp.position.set(VANE_TILE.x + 0.5, 0, VANE_TILE.z + 0.5);
    this.vaneLamp.visible = false;
    this.root.add(this.vaneLamp);
    const vaneWork = (c: LifeContext) => c.day >= VANE_START && c.day < VANE_DONE && c.hour >= 9 && c.hour < 16;
    const white = LOOK({ coat: 0xd8dce0, shirt: 0xd8dce0, trousers: 0x2a2e34, hat: 'cap', hatColor: 0xe8ecf0 });
    const hammer = (rig: Player['rig'], t: number, paused: boolean) => { if (paused) rig.armR.rotation.x = -1.6 - Math.max(0, Math.sin(t * 7)) * 0.9; };
    this.extras.push(new Extra(scene, g, white, 'A Vane Company man', 'vane', route([VANE_TILE.x - 1, VANE_TILE.z]), vaneWork, { hold: hammer, talkEvery: 10, lines: ['Light for all, courtesy of the Vane Company.', 'Stand back, please.', 'Mr. Vane wants it lit by Sunday.'] }));
    this.extras.push(new Extra(scene, g, white, 'A Vane Company man', 'vane', route([VANE_TILE.x + 1, VANE_TILE.z]), vaneWork, { hold: hammer }));

    // Gulls on the quay, crows and pigeons by the market and the court.
    const quay = { x0: 1, z0: 4, x1: 30, z1: 6 };
    const court = { x0: 1, z0: 15, x1: 16, z1: 16 };
    const mag = { x0: 6, z0: 19, x1: 8, z1: 21 };
    for (let i = 0; i < 7; i++) this.addBird(0xe8e8e4, 0x9aa0a4, 1.2, quay);
    for (let i = 0; i < 4; i++) this.addBird(0x15151a, 0x0e0e12, 1.0, court);
    for (let i = 0; i < 4; i++) this.addBird(0x7a7e86, 0x5a5e66, 0.85, mag);
    const lanes = [{ x0: 1, z0: 15, x1: 7, z1: 16 }, { x0: 22, z0: 16, x1: 22, z1: 24 }, { x0: 8, z0: 9, x1: 8, z1: 14 }, { x0: 14, z0: 9, x1: 14, z1: 14 }, { x0: 1, z0: 23, x1: 30, z1: 24 }];
    for (let i = 0; i < 6; i++) this.rats.push(this.critter(makeRat(), lanes[i % lanes.length], 2.6));
    this.cats.push(this.critter(makeCat(0x8a8680), { x0: 1, z0: 15, x1: 16, z1: 16 }, 0.6));
    this.cats.push(this.critter(makeCat(0xb06a30), { x0: 8, z0: 7, x1: 22, z1: 8 }, 0.6));

    // Rain: falling streaks around the player.
    const N = 700;
    this.rainBase = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = Math.random() * 12;
      const z = (Math.random() - 0.5) * 24;
      this.rainBase.set([x, y, z, x + 0.05, y - 0.45, z + 0.02], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainBase.slice(), 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xa8c0d8, transparent: true, opacity: 0.45 }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.root.add(this.rain);

    // Bonfire Night at the market.
    this.bonfire = new THREE.Group();
    this.bonfire.position.set(15.5, 0, 20.5);
    for (let i = 0; i < 6; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), basic(0x3a2818));
      log.rotation.set(0.6, (i / 6) * Math.PI * 2, 0);
      log.position.y = 0.4;
      this.bonfire.add(log);
    }
    for (const [s, c] of [[0.55, 0xff7a20], [0.38, 0xffb040], [0.22, 0xfff0a0]] as const) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.6, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
      f.position.y = s * 1.3;
      this.flames.push(f);
      this.bonfire.add(f);
    }
    const guy = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.2), basic(0x4a3a2a));
    guy.position.y = 1.6;
    const guyHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), basic(0xd8c8a0));
    guyHead.position.y = 2.0;
    this.bonfire.add(guy, guyHead);
    this.fireLight = new THREE.PointLight(0xff8a30, 0, 12, 1.4);
    this.fireLight.position.y = 1.4;
    this.bonfire.add(this.fireLight);
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(60 * 3);
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffc060, size: 0.08 }));
    this.bonfire.add(this.sparks);
    this.bonfire.visible = false;
    this.bonfire.userData.life = 'bonfire';
    this.root.add(this.bonfire);
    this.tappables.push(this.bonfire);

    // The dead of Saltwharf, seen only with the sight (Occult 3), or by anyone on All Hallows' Eve.
    const dead: [string, Look, Cell[], string[]][] = [
      ['A drowned sailor', LOOK({ coat: 0x2a3a4a, hat: 'cap' }), route([3, 5], [28, 5]), ['Cold down there. So cold.', 'The tide brought me back. Nobody else came.', 'They\'re lighting lamps that eat the dark. Then they\'ll eat you.']],
      ['A girl in a Regency bonnet', LOOK({ coat: 0xd8d0c0, skirt: true, hat: 'bonnet' }), route([2, 16], [12, 16], [12, 16]), ['Have you seen my mother? She went for bread in 1814.', 'Pembleton was kind to me. Tell him.', 'Don\'t open the trunk until the fog comes up the stairs.']],
      ['A lamplighter with no face', LOOK({ coat: 0x3a3428, hat: 'cap' }), route([20, 15], [27, 15], [27, 23]), ['I lit the white one. I lit the white one and it lit me.', 'Greymourne. Greymourne. The light goes in. The light does not come out.', 'Tell Mrs. Ashby he isn\'t dead. He\'s worse.']],
    ];
    for (const [name, look, r, lines] of dead) {
      const rig = new Player(g, look, r[0].x + 0.5, r[0].z + 0.5);
      rig.speedMult = 0.25;
      rig.rig.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = this.ghostMat;
          m.castShadow = false;
        }
      });
      rig.rig.root.visible = false;
      rig.rig.root.userData.life = `ghost:${this.ghosts.length}`;
      scene.add(rig.rig.root);
      this.tappables.push(rig.rig.root);
      this.ghosts.push({ rig, route: r, i: 0, name, lines });
    }
    for (const e of this.extras) if (['crier', 'funeral', 'vane', 'evict'].includes(e.tag)) this.tappables.push(e.root);
  }

  private rand(zone: { x0: number; z0: number; x1: number; z1: number }): Cell {
    for (let k = 0; k < 20; k++) {
      const x = zone.x0 + Math.floor(Math.random() * (zone.x1 - zone.x0 + 1));
      const z = zone.z0 + Math.floor(Math.random() * (zone.z1 - zone.z0 + 1));
      if (this.grid.isWalkable(x, z)) return { x, z };
    }
    return { x: zone.x0, z: zone.z0 };
  }

  private addBird(color: number, wing: number, size: number, zone: Bird['zone']): void {
    const { g, wings } = makeBird(color, wing, size);
    const c = this.rand(zone);
    const pos = new THREE.Vector3(c.x + Math.random(), 0, c.z + Math.random());
    g.position.copy(pos);
    g.rotation.y = Math.random() * 6;
    this.root.add(g);
    this.birds.push({ g, wings, pos, from: pos.clone(), to: pos.clone(), t: 0, flying: false, rest: Math.random() * 8, zone });
  }

  private critter(g: THREE.Group, zone: Critter['zone'], speed: number): Critter {
    const c = this.rand(zone);
    g.position.set(c.x + 0.5, 0, c.z + 0.5);
    this.root.add(g);
    return { g, pos: new THREE.Vector2(c.x + 0.5, c.z + 0.5), to: new THREE.Vector2(c.x + 0.5, c.z + 0.5), rest: Math.random() * 5, speed, zone };
  }

  /** Near the constable (for danger). */
  constableNear(x: number, z: number, r = 4): boolean {
    const c = this.extras.find((e) => e.tag === 'constable');
    return !!c?.active && Math.hypot(c.walker.position.x - x, c.walker.position.y - z) < r;
  }

  get bonfireLit(): boolean {
    return this.bonfire.visible;
  }

  ghost(i: number) {
    return this.ghosts[i];
  }

  update(dt: number, t: number, c: LifeContext): void {
    const night = c.hour >= 20 || c.hour < 6;
    // Church bells: one stroke each hour, the full count at six, noon and six.
    const h = Math.floor(c.hour);
    if (h !== this.lastHour) {
      if (this.lastHour >= 0 && h >= 6 && h <= 22) this.hooks.bell(h % 6 === 0 ? (h % 12 || 12) : 1);
      this.lastHour = h;
    }
    for (const e of this.extras) e.update(dt, t, c, this.hooks);

    // Coffin on the bearers' shoulders.
    const bearers = this.extras.filter((e) => e.tag === 'funeral').slice(1, 3);
    this.coffin.visible = bearers.every((b) => b.active);
    if (this.coffin.visible) {
      const [a, b] = bearers.map((x) => x.walker.position);
      this.coffin.position.set((a.x + b.x) / 2, 1.5, (a.y + b.y) / 2);
      this.coffin.rotation.y = Math.atan2(a.x - b.x, a.y - b.y);
    }
    this.cart.visible = c.day === EVICTION_DAY && c.hour >= 8 && c.hour < 14;
    const lampUp = c.day >= VANE_START + 2;
    if (lampUp !== this.vaneLamp.visible) {
      this.vaneLamp.visible = lampUp;
      if (lampUp) this.grid.block(VANE_TILE.x, VANE_TILE.z);
    }

    // Birds: peck about, scatter when you come close, settle somewhere else.
    for (const b of this.birds) {
      const quay = b.zone.z0 === 4;
      b.g.visible = !night && !(quay && c.weather === 'fog');
      if (!b.g.visible) continue;
      if (b.flying) {
        b.t += dt / 1.6;
        const k = Math.min(1, b.t);
        b.pos.lerpVectors(b.from, b.to, k);
        b.pos.y = Math.sin(k * Math.PI) * 2.2;
        b.g.rotation.y = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
        b.wings[0].scale.x = 0.35 + Math.abs(Math.sin(t * 22)) * 0.9;
        if (k >= 1) {
          b.flying = false;
          b.rest = 3 + Math.random() * 10;
          b.wings[0].scale.x = 0.6;
        }
      } else {
        b.rest -= dt;
        const near = Math.hypot(b.pos.x - c.player.x, b.pos.z - c.player.y) < 2.2;
        // Peck.
        b.g.rotation.x = Math.max(0, Math.sin(t * 5 + b.from.x)) * 0.5;
        if (near || b.rest <= 0) {
          const n = this.rand(b.zone);
          b.from.copy(b.pos);
          b.to.set(n.x + Math.random(), 0, n.z + Math.random());
          b.t = 0;
          b.flying = true;
          b.g.rotation.x = 0;
        }
      }
      b.g.position.copy(b.pos);
    }
    const crit = (k: Critter, visible: boolean, sitChance: number) => {
      k.g.visible = visible;
      if (!visible) return;
      const d = k.to.clone().sub(k.pos);
      const len = d.length();
      if (len < 0.05) {
        k.rest -= dt;
        if (k.rest <= 0) {
          const n = this.rand(k.zone);
          k.to.set(n.x + 0.5, n.z + 0.5);
          k.rest = Math.random() < sitChance ? 8 + Math.random() * 20 : 0.5 + Math.random() * 2;
        }
      } else {
        const step = Math.min(len, k.speed * dt);
        k.pos.addScaledVector(d.normalize(), step);
        k.g.rotation.y = Math.atan2(d.x, d.y);
      }
      // Scurry off when you come close.
      if (Math.hypot(k.pos.x - c.player.x, k.pos.y - c.player.y) < 1.5 && len < 0.05) k.rest = 0;
      k.g.position.set(k.pos.x, 0, k.pos.y);
    };
    for (const r of this.rats) crit(r, night || c.weather === 'fog', 0.2);
    for (const k of this.cats) crit(k, c.weather !== 'rain', 0.6);

    // Rain falls around wherever you stand.
    this.rain.visible = c.weather === 'rain';
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      const a = p.array as Float32Array;
      const fall = (t * 14) % 12;
      for (let i = 0; i < a.length; i += 3) {
        let y = this.rainBase[i + 1] - fall;
        if (y < 0) y += 12;
        a[i] = this.rainBase[i] + c.player.x;
        a[i + 1] = y;
        a[i + 2] = this.rainBase[i + 2] + c.player.y;
      }
      p.needsUpdate = true;
    }

    // Bonfire Night.
    const fire = c.holiday === 'bonfire' && (c.hour >= 18 || c.hour < 1);
    this.bonfire.visible = fire;
    if (fire) {
      this.flames.forEach((f, i) => {
        f.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 13 + i * 2) * 0.15, 1 + Math.cos(t * 8 + i) * 0.08);
        f.rotation.y = t * (0.5 + i * 0.3);
      });
      this.fireLight.intensity = 22 + Math.sin(t * 11) * 4 + Math.sin(t * 23) * 3;
      const sp = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sp.count; i++) {
        const life = (t * 0.6 + i / sp.count) % 1;
        const ang = i * 2.4;
        sp.setXYZ(i, Math.cos(ang) * 0.3 * (1 + life), 0.5 + life * 4, Math.sin(ang) * 0.3 * (1 + life));
      }
      sp.needsUpdate = true;
    } else this.fireLight.intensity = 0;

    // The dead walk from ten until four, if you can see them.
    const deadHour = c.hour >= 22 || c.hour < 4;
    this.ghostMat.opacity = 0.26 + Math.sin(t * 1.3) * 0.08;
    for (const gh of this.ghosts) {
      const show = c.sight && deadHour;
      if (show && !gh.rig.rig.root.visible) gh.rig.teleport(this.grid, gh.route[0].x + 0.5, gh.route[0].z + 0.5);
      gh.rig.rig.root.visible = show;
      if (!show) continue;
      if (!gh.rig.moving) {
        gh.i = (gh.i + 1) % gh.route.length;
        gh.rig.walkTo(gh.route[gh.i]);
      }
      gh.rig.update(dt * 0.6, t);
      gh.rig.rig.root.position.y = 0.08 + Math.sin(t * 1.5 + gh.i) * 0.05;
    }

    // Lost things glint where they fell.
    const want = new Set(c.lost.map((l) => l.id));
    for (const [id, m] of this.glints) if (!want.has(id)) { m.removeFromParent(); this.glints.delete(id); this.tappables.splice(this.tappables.indexOf(m), 1); }
    for (const l of c.lost) {
      let m = this.glints.get(l.id);
      if (!m) {
        m = new THREE.Mesh(this.glintGeo, this.glintMat);
        m.position.set(l.x + 0.5, 0.2, l.z + 0.5);
        m.userData.life = `lost:${l.id}`;
        this.root.add(m);
        this.glints.set(l.id, m);
        this.tappables.push(m);
      }
      m.rotation.y = t * 2;
      m.position.y = 0.2 + Math.sin(t * 3) * 0.05;
      this.glintMat.emissiveIntensity = 1 + Math.sin(t * 6) * 0.6;
    }
  }

  /** Which ambient thing a tap hit, if any. */
  pick(ray: THREE.Raycaster): string | null {
    const vis = this.tappables.filter((o) => o.visible);
    const hit = ray.intersectObjects(vis, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.life) o = o.parent;
    return o?.userData.life ?? null;
  }

  /** Where something tagged stands, for walking up to it. */
  where(tag: string): Cell | null {
    if (tag.startsWith('ghost:')) return this.ghosts[Number(tag.slice(6))].rig.cell;
    if (tag === 'bonfire') return { x: 14, z: 20 };
    if (tag.startsWith('lost:')) {
      const m = this.glints.get(Number(tag.slice(5)));
      return m ? { x: Math.floor(m.position.x), z: Math.floor(m.position.z) } : null;
    }
    const e = this.extras.find((x) => x.tag === tag && x.active);
    return e ? e.walker.cell : null;
  }
}
