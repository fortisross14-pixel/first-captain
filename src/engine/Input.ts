/** Touch-first input: tap to act, pinch (or mouse wheel) to zoom. */
export class Input {
  private readonly pointers = new Map<number, { x: number; y: number; startX: number; startY: number; t: number }>();
  private pinchStart = 0;
  private pinched = false;

  constructor(
    el: HTMLElement,
    private readonly onTap: (x: number, y: number) => void,
    private readonly onZoom: (factor: number) => void,
  ) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.onZoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: performance.now() });
    if (this.pointers.size === 1) this.pinched = false;
    if (this.pointers.size === 2) {
      this.pinchStart = this.spread();
      this.pinched = true;
    }
  }

  private move(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2 && this.pinchStart > 0) {
      const now = this.spread();
      if (now > 0) {
        this.onZoom(this.pinchStart / now);
        this.pinchStart = now;
      }
    }
  }

  private up(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p || this.pinched) return;
    const moved = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    if (moved < 14 && performance.now() - p.t < 600) this.onTap(e.clientX, e.clientY);
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
