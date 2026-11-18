export interface SlotSummary {
  slot: number;
  name: string;
  day: number;
  money: number;
  savedAt: number;
  age: number;
}

/** Title screen over the night-time docks: continue, three saved lives, a new life, install. */
export class Title {
  private readonly el: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly slots: (SlotSummary | null)[],
    latest: number | null,
    private readonly onLoad: (slot: number) => void,
    private readonly onNew: (slot: number) => void,
    private readonly onDelete: (slot: number) => void,
    install: { can: () => boolean; run: () => void },
  ) {
    const word = (w: string, start: number) => `<span class="w">${[...w].map((c, i) => `<span style="animation-delay:${(0.3 + (start + i) * 0.06).toFixed(2)}s">${c}</span>`).join('')}</span>`;
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="title-screen">
        <div class="lampglow" aria-hidden="true"></div>
        <div class="title-inner">
          <div class="kicker">London · 1871</div>
          <h1 aria-label="The Pale Lamps">${word('The', 0)} ${word('Pale', 4)} ${word('Lamps', 9)}</h1>
          <p class="sub">The city glows brighter every night, and the fog is getting worse.</p>
          <div class="title-buttons">
            ${latest ? `<button class="primary continue">Continue ${this.esc(slots[latest - 1]!.name)}</button>` : ''}
            <button class="${latest ? '' : 'primary '}new">Begin a new life</button>
            ${slots.some(Boolean) ? '<button class="lives">Saved lives</button>' : ''}
            <button class="install" hidden>Install on this device</button>
          </div>
          <div class="slot-list" hidden></div>
          <p class="note">Three lives can be saved on this device. The game saves as you play.</p>
        </div>
      </div>`,
    );
    this.el = root.querySelector('.title-screen') as HTMLElement;
    this.el.querySelector('.continue')?.addEventListener('click', () => latest && onLoad(latest));
    this.el.querySelector('.new')!.addEventListener('click', () => this.showSlots('new'));
    this.el.querySelector('.lives')?.addEventListener('click', () => this.showSlots('load'));
    const inst = this.el.querySelector('.install') as HTMLButtonElement;
    const refresh = () => (inst.hidden = !install.can());
    refresh();
    window.addEventListener('pale-lamps-installable', refresh);
    inst.addEventListener('click', () => install.run());
  }

  private esc(t: string): string {
    return t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  }

  /** The three slots: pick one to load, or one to begin a new life in. */
  private showSlots(mode: 'new' | 'load'): void {
    const list = this.el.querySelector('.slot-list') as HTMLElement;
    const when = (t: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    list.innerHTML = `<h3>${mode === 'new' ? 'Begin a new life in…' : 'Saved lives'}</h3>` + this.slots.map((s, i) => {
      const n = i + 1;
      if (!s) return `<div class="slot"><div><b>Slot ${n}</b><span>Empty</span></div>${mode === 'new' ? `<button data-act="new" data-slot="${n}" class="primary">Begin here</button>` : ''}</div>`;
      return `<div class="slot"><div><b>${this.esc(s.name)}</b><span>Slot ${n} · aged ${s.age} · day ${s.day + 1} · £${s.money.toFixed(2)}${s.savedAt ? ` · saved ${when(s.savedAt)}` : ''}</span></div>
        <div class="slot-acts">${mode === 'load' ? `<button data-act="load" data-slot="${n}" class="primary">Load</button><button data-act="delete" data-slot="${n}">Delete</button>` : `<button data-act="new" data-slot="${n}">Replace</button>`}</div></div>`;
    }).join('') + '<button class="slot-back">Back</button>';
    list.hidden = false;
    (this.el.querySelector('.title-buttons') as HTMLElement).hidden = true;
    list.querySelector('.slot-back')!.addEventListener('click', () => {
      list.hidden = true;
      (this.el.querySelector('.title-buttons') as HTMLElement).hidden = false;
    });
    list.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.slot);
      const act = b.dataset.act;
      if (act === 'load') this.onLoad(n);
      if (act === 'new') {
        if (this.slots[n - 1] && !confirm(`Replace the life of ${this.slots[n - 1]!.name}? This cannot be undone.`)) return;
        this.onNew(n);
      }
      if (act === 'delete' && confirm(`Delete the life of ${this.slots[n - 1]!.name}? This cannot be undone.`)) {
        this.onDelete(n);
        this.slots[n - 1] = null;
        this.showSlots('load');
      }
    }));
  }

  remove(): void {
    this.el.remove();
  }
}
