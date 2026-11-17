import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(55);
const DISTANCE = 40;
/** Visible width in tiles across the short side of the screen. */
const MIN_VIEW = 9;
const MAX_VIEW = 26;

/**
 * Angled top-down orthographic camera standing over the river and looking south at the
 * shopfronts, following a target. Orthographic keeps the classic handheld look and makes
 * the visible area predictable on any screen shape.
 */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly distance = DISTANCE;
  private readonly focus = new THREE.Vector3();
  /** Tiles visible across the narrower screen dimension. */
  view = 14;
  private aspect = 1;

  constructor(private readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 120);
  }

  resize(w: number, h: number): void {
    this.aspect = w / h;
    this.project();
  }

  zoomBy(factor: number): void {
    this.view = THREE.MathUtils.clamp(this.view * factor, MIN_VIEW, MAX_VIEW);
    this.project();
  }

  snap(x: number, z: number): void {
    this.focus.set(x, 0, z);
    this.apply();
  }

  update(dt: number, x: number, z: number): void {
    const tx = THREE.MathUtils.clamp(x, this.bounds.minX, this.bounds.maxX);
    const tz = THREE.MathUtils.clamp(z, this.bounds.minZ, this.bounds.maxZ);
    const k = 1 - Math.exp(-dt * 4);
    this.focus.x += (tx - this.focus.x) * k;
    this.focus.z += (tz - this.focus.z) * k;
    this.apply();
  }

  private project(): void {
    const halfW = this.aspect < 1 ? this.view / 2 : (this.view / 2) * this.aspect;
    const halfH = halfW / this.aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private apply(): void {
    const y = Math.sin(PITCH) * DISTANCE;
    const back = Math.cos(PITCH) * DISTANCE;
    this.camera.position.set(this.focus.x, y, this.focus.z - back);
    this.camera.lookAt(this.focus.x, 0.6, this.focus.z);
  }
}
