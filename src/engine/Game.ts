import * as THREE from 'three';
import { Player } from '../actors/Player';
import { animateRig, createCharacter, type Look, type Rig } from '../actors/characterModel';
import { Hud } from '../ui/Hud';
import { buildSaltwharf, MAP_H, MAP_W, type District, type Place } from '../world/saltwharf';
import { CameraRig } from './CameraRig';
import { Clock } from './Clock';
import { Input } from './Input';
import { Lighting } from './Lighting';

const PLAYER_LOOK: Look = {
  skin: 0xe0b896, hair: 0x3a2618, coat: 0x3c4a3a, trousers: 0x2e2a26, shirt: 0xd8ccb0,
  boots: 0x1e1a16, scarf: 0x8a2e26, hat: 'cap', hatColor: 0x3a342c,
};

/** Townsfolk standing about so the district is not empty. They come alive in M5. */
const EXTRAS: { look: Look; x: number; z: number; face: number }[] = [
  { look: { skin: 0xc89a78, hair: 0x5a3a22, coat: 0x5a4a3a, trousers: 0x3a3028, shirt: 0xb0a890, boots: 0x201a14, hat: 'cap', build: 1.1 }, x: 7.5, z: 5.5, face: -2.4 },
  { look: { skin: 0xe8c4a0, hair: 0x9a4a22, coat: 0x6a2e2e, trousers: 0x3a2a2a, shirt: 0xe0d6c0, boots: 0x201a14, hat: 'bonnet', hatColor: 0xd8ccb0, skirt: true, build: 0.92 }, x: 19.5, z: 8.2, face: 0.3 },
  { look: { skin: 0x8a5a3a, hair: 0x15110e, coat: 0x2e3440, trousers: 0x26262a, shirt: 0xc8c0a8, boots: 0x151210, hat: 'top', scarf: 0x2e4a3a }, x: 11.5, z: 20.0, face: Math.PI },
];

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly clock = new Clock();
  private readonly district: District;
  private readonly player: Player;
  private readonly lighting: Lighting;
  private readonly hud: Hud;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly marker: THREE.Mesh;
  private readonly extras: Rig[] = [];
  private markerLife = 0;
  private readonly faded = new Set<THREE.Object3D>();
  private readonly fadedMats = new Map<THREE.Material, THREE.Material>();
  private occlusionTimer = 0;
  private money = 1.0;
  private last = performance.now();
  private elapsed = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.district = buildSaltwharf(this.scene);
    this.rig = new CameraRig({ minX: 5, maxX: MAP_W - 5, minZ: 9, maxZ: MAP_H - 6 });
    this.lighting = new Lighting(this.scene, new THREE.Vector3(MAP_W / 2, 0, MAP_H / 2), this.district.lamps, this.rig.distance);

    const { spawn } = this.district;
    this.player = new Player(this.district.grid, PLAYER_LOOK, spawn.x + 0.5, spawn.z + 0.5);
    this.player.faceToward({ x: spawn.x + 0.5, z: spawn.z - 2 });
    this.scene.add(this.player.rig.root);
    this.rig.snap(this.player.position.x, this.player.position.y + 2);

    for (const e of EXTRAS) {
      const r = createCharacter(e.look);
      r.root.position.set(e.x, 0, e.z);
      r.root.rotation.y = e.face;
      this.scene.add(r.root);
      this.district.grid.block(Math.floor(e.x), Math.floor(e.z));
      this.extras.push(r);
    }

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.4, 20),
      new THREE.MeshBasicMaterial({ color: 0xf0d890, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.03;
    this.scene.add(this.marker);

    // Testing aid: ?hour=21 starts the day at that hour.
    const startHour = Number(new URLSearchParams(location.search).get('hour'));
    if (startHour > 0 && startHour < 24) this.clock.minutes = (startHour - 7) * 60 + (startHour < 7 ? 24 * 60 : 0);

    this.hud = new Hud(container, () => this.clock.cycleSpeed());
    new Input(this.renderer.domElement, (x, y) => this.tap(x, y), (f) => this.rig.zoomBy(f));

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.hud.toast('Tap the street to walk. Tap a building to visit it.');
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
  }

  private tap(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);

    const solid = this.district.tappables.filter((o) => !this.faded.has(o));
    const hit = this.raycaster.intersectObjects(solid, true)[0];
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.placeId) o = o.parent;
      const place = o && this.district.places.find((p) => p.id === o!.userData.placeId);
      if (place) {
        this.goToPlace(place);
        return;
      }
    }

    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return;
    const cell = this.district.grid.nearestWalkable(Math.floor(p.x), Math.floor(p.z), 3);
    if (!cell) return;
    this.hud.hidePlace();
    if (this.player.walkTo(cell)) this.showMarker(cell.x + 0.5, cell.z + 0.5);
  }

  private goToPlace(place: Place): void {
    this.hud.hidePlace();
    const ok = this.player.walkTo(place.door, () => {
      this.player.faceToward(place.faceTo);
      this.hud.showPlace(place);
    });
    if (ok) this.showMarker(place.door.x + 0.5, place.door.z + 0.5);
    else this.hud.toast("You can't find a way there.");
  }

  private showMarker(x: number, z: number): void {
    this.marker.position.x = x;
    this.marker.position.z = z;
    this.markerLife = 1;
  }

  /** Fades buildings standing between the camera and the player so you never lose sight of yourself. */
  private updateOcclusion(): void {
    const cam = this.rig.camera.position;
    const occluders = new Set<THREE.Object3D>();
    for (const h of [0.4, 1.0, 1.5]) {
      const target = new THREE.Vector3(this.player.position.x, h, this.player.position.y);
      const dir = target.clone().sub(cam);
      const far = dir.length() - 0.4;
      this.raycaster.set(cam, dir.normalize());
      this.raycaster.far = far;
      for (const hit of this.raycaster.intersectObjects(this.district.tappables, true)) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.placeId) o = o.parent;
        if (o) occluders.add(o);
      }
    }
    this.raycaster.far = Infinity;
    for (const o of this.faded) if (!occluders.has(o)) this.setFaded(o, false);
    for (const o of occluders) if (!this.faded.has(o)) this.setFaded(o, true);
  }

  private setFaded(group: THREE.Object3D, fade: boolean): void {
    if (fade) this.faded.add(group);
    else this.faded.delete(group);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (fade) {
        const orig = mesh.material as THREE.Material;
        mesh.userData.orig = orig;
        let f = this.fadedMats.get(orig);
        if (!f) {
          f = orig.clone();
          f.transparent = true;
          f.opacity = 0.18;
          f.depthWrite = false;
          this.fadedMats.set(orig, f);
        }
        mesh.material = f;
        mesh.castShadow = false;
      } else if (mesh.userData.orig) {
        mesh.material = mesh.userData.orig;
        mesh.castShadow = true;
      }
    });
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;

    this.clock.tick(dt);
    this.player.update(dt, this.elapsed);
    this.extras.forEach((r, i) => animateRig(r, 0, 0, this.elapsed + i * 2));
    this.district.update(this.elapsed);
    this.lighting.update(this.clock.hour, this.elapsed);
    // Look a little south of the player so the screen shows more street than river.
    this.rig.update(dt, this.player.position.x, this.player.position.y + 2);
    this.occlusionTimer -= dt;
    if (this.occlusionTimer <= 0) {
      this.occlusionTimer = 0.1;
      this.updateOcclusion();
    }

    if (this.markerLife > 0) {
      this.markerLife = Math.max(0, this.markerLife - dt * 1.2);
      const m = this.marker.material as THREE.MeshBasicMaterial;
      m.opacity = this.markerLife * 0.9;
      this.marker.scale.setScalar(1 + (1 - this.markerLife) * 0.5);
    }

    this.hud.setClock(this.clock.formatDate(), this.clock.formatTime());
    this.hud.setPurse(this.money, this.clock.formatShortDate(this.clock.rentDue));
    this.renderer.render(this.scene, this.rig.camera);
  }
}
