import * as THREE from 'three';
import { createCharacter, type Look } from '../actors/characterModel';

/**
 * Cameo portraits rendered from each person's own 3D model: head and shoulders,
 * three-quarter view, lit like a studio photograph. Rendered once and cached.
 */
export class Portraits {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(25, 0.8, 0.1, 10);
  private readonly target = new THREE.WebGLRenderTarget(160, 200);
  private readonly cache = new Map<string, string>();
  private readonly canvas = document.createElement('canvas');

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xe8eefc, 0x9a8a80, 1.7));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
    key.position.set(1.2, 2.2, 2);
    const rim = new THREE.DirectionalLight(0x9fb8e8, 1.6);
    rim.position.set(-2, 1.8, -1.5);
    const fill = new THREE.DirectionalLight(0xffe8d0, 1.5);
    fill.position.set(0, 1.0, 3);
    this.scene.add(key, rim, fill);
    this.camera.position.set(0.55, 1.62, 1.95);
    this.camera.lookAt(0, 1.5, 0);
    this.canvas.width = 160;
    this.canvas.height = 200;
  }

  /** A data URL for this look, keyed by `id`. */
  get(id: string, look: Look): string {
    const hit = this.cache.get(id);
    if (hit) return hit;
    const rig = createCharacter({ ...look, weapon: undefined, cloak: undefined });
    rig.root.rotation.y = 0.25;
    rig.armL.rotation.x = 0.1;
    this.scene.add(rig.root);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevShadow = r.shadowMap.enabled;
    r.setRenderTarget(this.target);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    const px = new Uint8Array(160 * 200 * 4);
    r.readRenderTargetPixels(this.target, 0, 0, 160, 200, px);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    r.shadowMap.enabled = prevShadow;
    this.scene.remove(rig.root);
    rig.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    // Pixels come bottom-up; flip into a canvas.
    const ctx = this.canvas.getContext('2d')!;
    const img = ctx.createImageData(160, 200);
    for (let y = 0; y < 200; y++) img.data.set(px.subarray((199 - y) * 640, (200 - y) * 640), y * 640);
    ctx.clearRect(0, 0, 160, 200);
    ctx.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(id, url);
    return url;
  }

  forget(id: string): void {
    this.cache.delete(id);
  }
}
