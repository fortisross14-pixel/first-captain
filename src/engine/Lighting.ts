import * as THREE from 'three';
import { glow } from '../world/materials';

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

/** Sun, moon, fog and gaslight, all driven by the hour of day. */
export class Lighting {
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly fog: THREE.Fog;
  private readonly lampLights: { light: THREE.PointLight; vane: boolean; seed: number }[] = [];
  private readonly sky = new THREE.Color();
  /** Today's weather: rain darkens and greys the light; a fog bank closes in. */
  weather: 'clear' | 'rain' | 'fog' = 'clear';
  private wet = 0;
  private murk = 0;

  constructor(scene: THREE.Scene, center: THREE.Vector3, lamps: { position: THREE.Vector3; vane: boolean }[], private readonly cameraDistance: number) {
    this.hemi = new THREE.HemisphereLight(0xc8d0d8, 0x3a3228, 1.2);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -22; cam.right = 22; cam.top = 22; cam.bottom = -22; cam.near = 1; cam.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.copy(center);
    scene.add(this.sun, this.sun.target);

    this.fog = new THREE.Fog(0x8a9290, cameraDistance, cameraDistance + 40);
    scene.fog = this.fog;
    scene.background = this.sky;

    // Point lights are costly on phones: a pool of six follows the camera, lighting the nearest lamps.
    // The rest still glow.
    this.lamps = lamps.map((l, i) => ({ position: l.position.clone(), vane: l.vane, seed: i * 1.7 }));
    for (let i = 0; i < Math.min(Lighting.POOL, lamps.length); i++) {
      const light = new THREE.PointLight(0xffa850, 0, 10, 1.4);
      scene.add(light);
      this.lampLights.push({ light, vane: false, seed: i });
    }
    this.focus(center.x, center.z);
  }

  static readonly POOL = 6;
  private readonly lamps: { position: THREE.Vector3; vane: boolean; seed: number }[];
  private focusAt = { x: Infinity, z: Infinity };

  /** Move the pool of lights to the lamps nearest (x, z). Cheap; only re-sorts after a few steps. */
  focus(x: number, z: number): void {
    if (Math.hypot(x - this.focusAt.x, z - this.focusAt.z) < 1.5) return;
    this.focusAt = { x, z };
    const near = [...this.lamps].sort((a, b) => Math.hypot(a.position.x - x, a.position.z - z) - Math.hypot(b.position.x - x, b.position.z - z));
    this.lampLights.forEach((l, i) => {
      const lamp = near[i];
      l.light.position.copy(lamp.position);
      l.light.color.setHex(lamp.vane ? 0xd8ecff : 0xffa850);
      l.vane = lamp.vane;
      l.seed = lamp.seed;
    });
  }

  update(hour: number, t: number): void {
    // day: 0 at night, 1 at full day
    const day = smooth(5, 7.5, hour) * (1 - smooth(17, 19.5, hour));
    const dusk = Math.max(0, 1 - Math.abs(hour - 18.3) / 1.6) + Math.max(0, 1 - Math.abs(hour - 6.6) / 1.3);
    const night = 1 - day;
    this.wet += ((this.weather === 'rain' ? 1 : 0) - this.wet) * 0.02;
    this.murk += ((this.weather === 'fog' ? 1 : 0) - this.murk) * 0.02;

    // Sun travels east to west, kept on the river side so the shopfronts facing the camera are lit.
    const ang = ((hour - 6) / 12) * Math.PI;
    const c = this.sun.target.position;
    this.sun.position.set(c.x + Math.cos(ang) * 30, 8 + Math.sin(Math.max(0.15, ang)) * 30, c.z - 18);
    this.sun.intensity = (0.95 + day * 1.6) * (1 - this.wet * 0.4 - this.murk * 0.3);
    this.sun.color.setHSL(0.09, 0.5 * dusk + 0.15, 0.75 - 0.15 * dusk);
    if (night > 0.6) this.sun.color.setHex(0x9fb2d8); // moonlight

    this.hemi.intensity = 1.55 + day * 0.45;
    this.hemi.color.setHSL(0.6, 0.22 - day * 0.08, 0.55 + day * 0.22);

    const dayFog = new THREE.Color(0x8a928e);
    const duskFog = new THREE.Color(0x8a6a5a);
    const nightFog = new THREE.Color(0x263044);
    this.sky.copy(nightFog).lerp(dayFog, day).lerp(duskFog, Math.min(0.6, dusk * 0.5));
    this.sky.lerp(new THREE.Color(0x5a6268), this.wet * 0.35 * day).lerp(new THREE.Color(night > 0.5 ? 0x2a3038 : 0xa8aca8), this.murk * 0.5);
    this.fog.color.copy(this.sky);
    // Fog thickens at night and creeps closer to the camera; a fog bank closes right in.
    this.fog.near = this.cameraDistance - 4 - night * 2 - this.murk * 10;
    this.fog.far = this.cameraDistance + 40 - night * 8 - this.murk * 20 - this.wet * 6;

    const lampGlow = Math.max(smooth(16.8, 18.5, hour), 1 - smooth(5.8, 7.5, hour));
    glow.gasLamp.emissiveIntensity = lampGlow * 2.4;
    glow.vaneLamp.emissiveIntensity = 0.5 + lampGlow * 3.2;
    glow.windowLit.emissiveIntensity = 0.1 + lampGlow * 0.9;
    for (const l of this.lampLights) {
      const flicker = l.vane ? 1 : 0.92 + Math.sin(t * 7 + l.seed) * 0.04 + Math.sin(t * 13 + l.seed * 3) * 0.04;
      l.light.intensity = lampGlow * (l.vane ? 30 : 24) * flicker;
    }
  }
}
