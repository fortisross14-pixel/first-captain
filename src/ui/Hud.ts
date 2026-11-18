import { NEED_NAMES, fullName, type GameState, type NeedId } from '../game/state';
import { sfx } from '../engine/sfx';
import type { Place } from '../world/location';

export interface ListRow {
  label: string;
  sub: string;
  actions: Action[];
}

export interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}

const NEEDS: NeedId[] = ['hunger', 'rest', 'social', 'health'];

/** A bubble in the interaction pie; one with children opens a ring of its own. */
export type PieIcon = 'talk' | 'kind' | 'romance' | 'business' | 'mean' | 'ask' | 'favour' | 'family';
export interface PieItem {
  label: string;
  sub?: string;
  icon?: PieIcon;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: PieItem[];
}

const PIE_ICONS: Record<PieIcon, string> = {
  talk: '<path d="M4 6h16v9H10l-4 3v-3H4z"/>',
  kind: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M9 11h6"/>',
  romance: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  business: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.9 2.5 2.1-1 2-2.5 2-2.2-.6-2.6-1.5M12 6v1.5M12 16.5V18"/>',
  mean: '<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>',
  ask: '<path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V15"/><circle cx="12" cy="18.5" r=".6"/><circle cx="12" cy="12" r="9"/>',
  family: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><circle cx="10" cy="14" r="1.6"/><circle cx="14.5" cy="15" r="1.2"/><path d="M8 20c0-2 1-3 2-3s2 1 2 3M13 20c0-1.5.7-2.5 1.5-2.5S16 18.5 16 20"/>',
  favour: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1"/>',
};
const pieIcon = (i: PieIcon) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIE_ICONS[i]}</svg>`;

/** Engraved emblems for the dock tokens. */
const TOKEN = {
  map: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  journal: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/></svg>',
  bag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9h12l-1 11H7z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M9.5 13h5"/></svg>',
  people: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.6 2.8-5.2 5.5-5.2s4.9 1.6 5.5 5.2"/><path d="M15.5 5.6a3 3 0 0 1 0 5.2M17.5 14.2c1.6.6 2.6 2.1 3 4.8"/></svg>',
  watch: '<svg viewBox="0 0 48 48" width="44" height="44"><circle cx="24" cy="26" r="19" class="w-case"/><circle cx="24" cy="26" r="15.5" class="w-face"/><rect x="21.5" y="2" width="5" height="4" rx="1.5" class="w-crown"/><g class="w-ticks">' +
    Array.from({ length: 12 }, (_, i) => `<line x1="24" y1="12.5" x2="24" y2="${i % 3 === 0 ? 15.5 : 14.2}" transform="rotate(${i * 30} 24 26)"/>`).join('') +
    '</g><line x1="24" y1="26" x2="24" y2="18" class="w-hour"/><line x1="24" y1="26" x2="24" y2="14" class="w-min"/><circle cx="24" cy="26" r="1.6" class="w-pin"/></svg>',
};

/** Small line icons so the needs need no text labels. */
const svg = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS: Record<NeedId, string> = {
  hunger: svg('<path d="M4 13c0-4 3.6-7 8-7s8 3 8 7v4H4z"/><path d="M8 10l1 2M12 9v3M16 10l-1 2"/>'),
  rest: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  social: svg('<circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3 19c.5-3.5 2.8-5 5.5-5s5 1.5 5.5 5M14 18.5c.3-2.4 1.6-3.6 3.5-3.6s3 1.2 3.5 3.6"/>'),
  health: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
};

/** In-game overlay: clock, purse, needs, objectives, place panel, journal, toasts and fades. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly q = <T extends HTMLElement>(sel: string) => this.el.querySelector(sel) as T;
  private toastTimer = 0;

  constructor(root: HTMLElement, onSpeed: () => number, private readonly onSave: () => void, private readonly onQuit: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud" hidden>
        <div class="topbar gs">
          <div class="tb-time"><div class="time"></div><div class="date"></div></div>
          <button class="tok watch speed" aria-label="Change time speed">
            <span class="hex" aria-hidden="true"><span class="hexin">${TOKEN.watch}</span></span>
            <span class="lab speed-lab">1×</span>
          </button>
          <div class="tb-needs">${NEEDS.map(
            (n) => `<div class="need" data-need="${n}" role="img" aria-label="${NEED_NAMES[n]}" title="${NEED_NAMES[n]}">${ICONS[n]}<div class="bar"><i></i></div></div>`,
          ).join('')}</div>
          <div class="tb-purse"><div class="money"></div><div class="rent"></div></div>
        </div>
        <button class="goals" aria-expanded="false" hidden>
          <span class="goals-first"></span>
          <span class="goals-rest"></span>
        </button>
        <nav class="dock" aria-label="Menus">
          <button class="tok journal-btn" aria-label="Open journal">
            <span class="hex" aria-hidden="true"><span class="hexin">${TOKEN.journal}</span></span>
            <span class="lab">Journal</span>
          </button>
          <button class="tok bag-btn" aria-label="Open bag">
            <span class="hex" aria-hidden="true"><span class="hexin">${TOKEN.bag}</span><b class="cnt bag-count"></b></span>
            <span class="lab">Bag</span>
          </button>
          <button class="tok people-btn" aria-label="Open people">
            <span class="hex" aria-hidden="true"><span class="hexin">${TOKEN.people}</span><b class="cnt people-count"></b></span>
            <span class="lab">People</span>
          </button>
          <button class="tok map-btn" aria-label="Open the map">
            <span class="hex" aria-hidden="true"><span class="hexin">${TOKEN.map}</span></span>
            <span class="lab">Map</span>
          </button>
        </nav>
        <div class="mapview" hidden>
          <div class="map-sheet">
            <div class="tabs map-tabs"><button data-map="london" aria-selected="false">London</button><button data-map="district" aria-selected="true">Saltwharf</button></div>
            <div class="map-body"></div>
            <div class="map-card"></div>
            <div class="actions"><button class="primary map-close">Close</button></div>
          </div>
        </div>
        <div class="toast gs" role="status"></div>
        <div class="floaters" aria-hidden="true"></div>
        <div class="celebrate" aria-live="polite"></div>
        <div class="bubbles"></div>
        <button class="decor-btn" hidden aria-label="Decor"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/></svg><span>Decor</span></button>
        <div class="decor-bar" hidden><div class="decor-title"></div><div class="decor-acts"></div></div>
        <div class="swatch-pop" hidden><div class="swatch-sheet"><h3></h3><div class="swatch-opts"></div></div></div>
        <div class="pie" hidden><div class="pie-ring"></div><div class="pie-card"></div></div>
        <div class="panel gs ruled" hidden>
          <h2></h2>
          <p></p>
          <div class="actions"></div>
        </div>
        <div class="journal" hidden>
          <div class="journal-sheet diary">
            <span class="ribbon" aria-hidden="true"></span>
            <h2></h2>
            <div class="tabs" role="tablist">
              <button role="tab" data-page="skills" aria-selected="true">Skills</button>
              <button role="tab" data-page="missions" aria-selected="false">Quests</button>
              <button role="tab" data-page="work" aria-selected="false">Work</button>
              <button role="tab" data-page="standing" aria-selected="false">Standing</button>
              <button role="tab" data-page="options" aria-selected="false">Options</button>
            </div>
            <div class="journal-body page-skills"></div>
            <div class="journal-body page-missions" hidden></div>
            <div class="journal-body page-work" hidden></div>
            <div class="journal-body page-standing" hidden></div>
            <div class="journal-body page-options" hidden>
              <div class="opt"><span>Sound</span><button class="sound-toggle"></button></div>
              <div class="opt"><span>Graphics</span><button class="quality-toggle"></button></div>
              <div class="opt"><span>Save the game</span><button class="save">Save</button></div>
              <div class="opt"><span>Install as an app</span><button class="install-btn">Install</button></div>
              <div class="opt"><span>Leave Saltwharf for now</span><button class="quit">Save &amp; quit to title</button></div>
            </div>
            <div class="actions">
              <button class="primary close-journal">Close</button>
            </div>
          </div>
        </div>
        <div class="listsheet journal" hidden>
          <div class="journal-sheet gs ruled">
            <h2></h2>
            <p class="meta list-sub"></p>
            <div class="tabs list-tabs" role="tablist" hidden></div>
            <div class="list-top"></div>
            <div class="list-rows"></div>
            <div class="actions"><button class="primary list-close">Close</button></div>
          </div>
        </div>
        <div class="modal" hidden>
          <div class="journal-sheet gs ruled">
            <p class="meta modal-sub" hidden></p>
            <h2></h2>
            <div class="stamp-slot"></div>
            <div class="modal-body"></div>
            <div class="actions"><button class="primary modal-ok">Continue</button></div>
          </div>
        </div>
      </div>
      <div class="fade"></div>`,
    );
    this.el = root.querySelector('.hud') as HTMLElement;
    const speed = this.q<HTMLButtonElement>('.speed');
    const play = (el: HTMLElement, cls: string, ms: number) => {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      window.setTimeout(() => el.classList.remove(cls), ms);
    };
    speed.addEventListener('click', () => {
      this.q('.speed-lab').textContent = `${onSpeed()}×`;
      play(speed, 'whirl', 700);
      sfx('tick');
    });
    const journalBtn = this.q('.journal-btn');
    journalBtn.addEventListener('click', () => {
      play(journalBtn, 'open', 700);
      sfx('page');
      window.setTimeout(() => (this.journalOpen = true), 260);
    });
    this.q('.close-journal').addEventListener('click', () => (this.journalOpen = false));
    this.el.querySelectorAll<HTMLButtonElement>('.journal-sheet.diary .tabs button').forEach((b) => b.addEventListener('click', () => this.journalPage(b.dataset.page!)));
    const bag = this.q('.bag-btn');
    bag.addEventListener('click', () => {
      play(bag, 'flip', 800);
      sfx('flip');
      window.setTimeout(() => this.onBag?.(), 220);
    });
    const goals = this.q('.goals');
    goals.addEventListener('click', () => {
      goals.setAttribute('aria-expanded', String(goals.getAttribute('aria-expanded') !== 'true'));
      this.renderGoals();
    });
    const people = this.q('.people-btn');
    people.addEventListener('click', () => {
      play(people, 'flip', 800);
      sfx('flip');
      window.setTimeout(() => this.onPeople?.(), 220);
    });
    this.q('.list-close').addEventListener('click', () => this.closeList());
    this.q('.decor-btn').addEventListener('click', () => this.onDecor?.());
    const mapBtn = this.q('.map-btn');
    mapBtn.addEventListener('click', () => {
      play(mapBtn, 'flip', 800);
      sfx('page');
      this.onMap?.('district');
    });
    this.q('.map-close').addEventListener('click', () => (this.q('.mapview').hidden = true));
    this.el.querySelectorAll<HTMLButtonElement>('.map-tabs button').forEach((b) => b.addEventListener('click', () => { sfx('page'); this.onMap?.(b.dataset.map as 'london' | 'district'); }));
    this.q('.mapview').addEventListener('click', (e) => { if (e.target === this.q('.mapview')) this.q('.mapview').hidden = true; });
    // Tap the dark backdrop around a sheet to close it.
    for (const sel of ['.journal:not(.listsheet)', '.listsheet']) {
      const el = this.q(sel);
      el.addEventListener('click', (e) => {
        if (e.target === el) el.hidden = true;
      });
    }
    this.q('.sound-toggle').addEventListener('click', () => this.onSound && (this.q('.sound-toggle').textContent = this.onSound()));
    this.q('.quality-toggle').addEventListener('click', () => this.onQuality && (this.q('.quality-toggle').textContent = this.onQuality()));
    this.q('.journal .save').addEventListener('click', () => this.onSave());
    this.q('.install-btn').addEventListener('click', () => this.onInstall?.());
    this.q('.journal .quit').addEventListener('click', () => this.onQuit());
  }

  set visible(v: boolean) {
    this.el.hidden = !v;
  }

  /** True while a menu covers the world and taps should not reach it. */
  get blocking(): boolean {
    return !this.q('.mapview').hidden || !this.q('.pie').hidden || !this.q('.journal').hidden || !this.q('.modal').hidden || !this.q('.listsheet').hidden || this.q('.celebrate').children.length > 0;
  }

  /** A report the player must acknowledge, such as the end of a shift. */
  modal(title: string, lines: string[], stamp = '', variant: '' | 'letter' | 'gazette' = '', subtitle = ''): Promise<void> {
    const m = this.q('.modal');
    m.querySelector('h2')!.textContent = title;
    const sheet = m.querySelector('.journal-sheet') as HTMLElement;
    sheet.classList.toggle('letter', variant === 'letter');
    sheet.classList.toggle('gazette', variant === 'gazette');
    const sub = m.querySelector('.modal-sub') as HTMLElement;
    sub.textContent = subtitle;
    sub.hidden = !subtitle;
    const slot = m.querySelector('.stamp-slot') as HTMLElement;
    slot.textContent = stamp;
    slot.className = `stamp-slot${stamp ? ' on' : ''}`;
    m.querySelector('.modal-body')!.replaceChildren(
      ...lines.map((l) => {
        const p = document.createElement('p');
        p.textContent = l;
        return p;
      }),
    );
    m.hidden = false;
    return new Promise((res) => {
      const ok = m.querySelector('.modal-ok') as HTMLButtonElement;
      ok.onclick = () => {
        m.hidden = true;
        res();
      };
    });
  }

  private journalPage(page: string): void {
    sfx('page');
    this.el.querySelectorAll<HTMLButtonElement>('.journal-sheet.diary .tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.page === page)));
    for (const p of ['skills', 'missions', 'work', 'standing', 'options']) this.q(`.page-${p}`).hidden = p !== page;
  }

  set journalOpen(open: boolean) {
    this.q('.journal').hidden = !open;
    if (open) this.renderJournal?.();
  }

  renderJournal: (() => void) | null = null;
  onBag: (() => void) | null = null;
  onDecor: (() => void) | null = null;

  set decorButton(v: boolean) {
    this.q('.decor-btn').hidden = !v;
  }

  /** The decor bar: a title and buttons; null hides it. */
  decorBar(title: string | null, actions: Action[] = []): void {
    const bar = this.q('.decor-bar');
    bar.hidden = title === null;
    this.q('.dock').classList.toggle('decor-hide', title !== null);
    if (title === null) return;
    bar.querySelector('.decor-title')!.textContent = title;
    bar.querySelector('.decor-acts')!.replaceChildren(...actions.map((a) => {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      if (a.primary) b.classList.add('primary');
      b.addEventListener('click', () => a.onClick());
      return b;
    }));
  }

  /** A row of colour swatches; tap one and it closes. */
  pickColor(title: string, colors: number[], current: number, onPick: (c: number) => void): void {
    const pop = this.q('.swatch-pop');
    pop.querySelector('h3')!.textContent = title;
    pop.querySelector('.swatch-opts')!.replaceChildren(...colors.map((c) => {
      const b = document.createElement('button');
      b.className = `swatch${c === current ? ' on' : ''}`;
      b.style.background = `#${c.toString(16).padStart(6, '0')}`;
      b.addEventListener('click', () => {
        pop.hidden = true;
        onPick(c);
      });
      return b;
    }));
    pop.onclick = (e) => { if (e.target === pop) pop.hidden = true; };
    pop.hidden = false;
  }
  onInstall: (() => void) | null = null;
  onMap: ((view: 'london' | 'district') => void) | null = null;

  /** The map: an SVG, a card for what you tapped, and a button to go there. */
  showMap(view: 'london' | 'district', svg: string, onPick: (id: string) => { title: string; text: string; go?: () => void; goLabel?: string } | null): void {
    const m = this.q('.mapview');
    m.querySelectorAll<HTMLButtonElement>('.map-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.map === view)));
    const body = m.querySelector('.map-body') as HTMLElement;
    body.innerHTML = svg;
    const card = m.querySelector('.map-card') as HTMLElement;
    card.innerHTML = view === 'london' ? '<b>London, 1871</b><span>Tap a district.</span>' : '<b>Saltwharf Docks</b><span>Tap a building to walk there.</span>';
    body.querySelectorAll<SVGElement>('[data-id]').forEach((el) => el.addEventListener('click', () => {
      const info = onPick(el.dataset.id!);
      if (!info) return;
      sfx('click');
      body.querySelectorAll('.picked').forEach((x) => x.classList.remove('picked'));
      el.classList.add('picked');
      card.replaceChildren();
      const b = document.createElement('b');
      b.textContent = info.title;
      const t = document.createElement('span');
      t.textContent = info.text;
      card.append(b, t);
      if (info.go) {
        const go = document.createElement('button');
        go.className = 'primary';
        go.textContent = info.goLabel ?? (view === 'london' ? 'Open' : 'Walk there');
        go.addEventListener('click', () => { if (view !== 'london' || info.goLabel) m.hidden = true; info.go!(); });
        card.appendChild(go);
      }
    }));
    m.hidden = false;
  }
  onPeople: (() => void) | null = null;
  /** Toggle handlers return the button's new label. */
  onSound: (() => string) | null = null;
  onQuality: (() => string) | null = null;

  setSettingLabels(sound: string, quality: string): void {
    this.q('.sound-toggle').textContent = sound;
    this.q('.quality-toggle').textContent = quality;
  }

  closeList(): void {
    this.q('.listsheet').hidden = true;
    this.onClosed?.();
  }

  /** A list of rows with buttons, used for shops and the bag. Calling it again re-renders in place. */
  showList(title: string, sub: string, rows: ListRow[], tabs?: { labels: string[]; active: number; onTab: (i: number) => void }, top = ''): void {
    const el = this.q('.listsheet');
    const tabBar = el.querySelector('.list-tabs') as HTMLElement;
    tabBar.hidden = !tabs;
    if (tabs) {
      tabBar.replaceChildren(...tabs.labels.map((l, i) => {
        const b = document.createElement('button');
        b.textContent = l;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(i === tabs.active));
        b.addEventListener('click', () => {
          sfx('page');
          tabs.onTab(i);
        });
        return b;
      }));
    }
    (el.querySelector('.list-top') as HTMLElement).innerHTML = top;
    el.querySelector('h2')!.textContent = title;
    el.querySelector('.list-sub')!.textContent = sub;
    el.querySelector('.list-rows')!.replaceChildren(
      ...rows.map((r) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        const text = document.createElement('div');
        const l = document.createElement('div');
        l.className = 'lr-label';
        l.textContent = r.label;
        const sb = document.createElement('div');
        sb.className = 'lr-sub';
        sb.textContent = r.sub;
        text.append(l, sb);
        const btns = document.createElement('div');
        btns.className = 'lr-actions';
        for (const a of r.actions) {
          const b = document.createElement('button');
          b.textContent = a.label;
          b.disabled = !!a.disabled;
          b.addEventListener('click', () => a.onClick());
          btns.appendChild(b);
        }
        row.append(text, btns);
        return row;
      }),
    );
    el.hidden = false;
  }

  private lastMoney: number | null = null;
  private lastNeeds: Partial<Record<NeedId, number>> = {};
  private celebrating: Promise<void> = Promise.resolve();

  /** A number that floats up from a point on screen: money earned, hunger restored. */
  floater(text: string, x: number, y: number, kind: 'gain' | 'loss'): void {
    const f = document.createElement('div');
    f.className = `floater ${kind}`;
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.q('.floaters').appendChild(f);
    window.setTimeout(() => f.remove(), 1600);
  }

  /**
   * The big moments, queued so they never overlap.
   * promotion: a moonlit broadsheet slams in with a PROMOTED stamp.
   * goal: a ghost-lilac seal presses onto a handbill as fog crosses it.
   * skill: a sigil draws itself in light around the new level.
   * friend: a calling card turns over to show the new friendship and its reward.
   */
  celebrate(kind: 'promotion' | 'goal' | 'skill' | 'friend', kicker: string, title: string, sub: string): Promise<void> {
    const run = async () => {
      const host = this.q('.celebrate');
      const el = document.createElement('div');
      el.className = `cel cel-${kind}`;
      const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      const motes = Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = 80 + (i % 3) * 34;
        return `<span style="--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 90)}px;animation-delay:${0.45 + (i % 5) * 0.06}s"></span>`;
      }).join('');
      const text = `<span class="k">${esc(kicker)}</span><span class="tt">${esc(title)}</span><span class="ss">${esc(sub)}</span>`;
      const inner = {
        promotion: `<div class="card"><div class="inner gs ruled"><span class="k">Saltwharf Gazette · Extra</span><span class="tt">${esc(title)}</span><span class="ss">${esc(sub)}</span></div><span class="stamp">${esc(kicker)}</span></div>`,
        goal: `<div class="card"><div class="inner gs ruled">${text}</div><div class="wisp"></div><div class="seal">✦</div></div>`,
        skill: `<svg class="sigil" viewBox="0 0 230 230" aria-hidden="true"><circle cx="115" cy="115" r="100"/><circle cx="115" cy="115" r="86"/><path d="M115 15 L201 165 L29 165 Z"/><path d="M115 215 L29 65 L201 65 Z"/></svg><div class="card">${text}</div>`,
        friend: `<div class="card calling"><div class="inner gs ruled">${text}</div></div>`,
      }[kind];
      el.innerHTML = `${inner}<div class="motes">${motes}</div>`;
      host.appendChild(el);
      sfx(kind === 'skill' ? 'chime' : 'fanfare');
      // Tap to skip; otherwise it fades by itself.
      await new Promise<void>((res) => {
        const done = () => {
          el.classList.add('out');
          window.setTimeout(() => {
            el.remove();
            res();
          }, 350);
        };
        const t = window.setTimeout(done, kind === 'skill' ? 2300 : 2900);
        el.addEventListener('click', () => {
          window.clearTimeout(t);
          done();
        }, { once: true });
      });
    };
    this.celebrating = this.celebrating.then(run);
    return this.celebrating;
  }

  update(state: GameState, district: string, date: string, time: string, rentDue: string, jobLine = ''): void {
    // Pocket watch hands follow the game clock.
    const [hh, mm] = time.split(':').map(Number);
    const stopped = this.q('.tok.watch').classList.contains('stopped');
    const hour = stopped ? null : this.q('.w-hour');
    const min = stopped ? null : this.q('.w-min');
    hour?.setAttribute('transform', `rotate(${((hh % 12) + mm / 60) * 30} 24 26)`);
    min?.setAttribute('transform', `rotate(${mm * 6} 24 26)`);
    // Token backs show counts.
    const bagN = state.inventory.reduce((a, i) => a + i.qty, 0);
    const known = Object.values(state.relations ?? {}).filter((r) => r.met).length;
    this.q('.bag-count').textContent = bagN ? String(bagN) : '';
    const unread = state.letters?.filter((l) => !l.read).length ?? 0;
    this.q('.journal-btn').dataset.letters = unread ? String(unread) : '';
    this.q('.people-count').textContent = known ? String(known) : '';
    // Floating deltas for money and big need changes.
    if (this.lastMoney !== null && Math.abs(state.money - this.lastMoney) >= 0.005) {
      const r = this.q('.tb-purse').getBoundingClientRect();
      const d = state.money - this.lastMoney;
      this.floater(`${d > 0 ? '+' : '−'}£${Math.abs(d).toFixed(2)}`, r.left + r.width / 2, r.bottom + 4, d > 0 ? 'gain' : 'loss');
    }
    this.lastMoney = state.money;
    for (const n of NEEDS) {
      const prev = this.lastNeeds[n];
      const v = state.needs[n];
      if (prev !== undefined && Math.abs(v - prev) >= 4) {
        const icon = this.el.querySelector(`[data-need="${n}"]`) as HTMLElement;
        const r = icon.getBoundingClientRect();
        const d = Math.round(v - prev);
        this.floater(`${d > 0 ? '+' : ''}${d}`, r.left + r.width / 2, r.bottom + 4, d > 0 ? 'gain' : 'loss');
      }
      this.lastNeeds[n] = v;
    }
    const set = (sel: string, text: string) => {
      const e = this.q(sel);
      if (e.textContent !== text) e.textContent = text;
    };
    set('.date', `${date.replace(/ \d{4}$/, '')} · ${district}`);
    set('.time', time);
    set('.money', `£${state.money.toFixed(2)}`);
    this.jobLine = jobLine;
    set('.rent', !state.housed
      ? `Homeless`
      : state.rent.graceUntil !== null ? 'Rent overdue!' : `Rent ${rentDue}`);
    if (this.lastJobLine !== jobLine) {
      this.lastJobLine = jobLine;
      this.renderGoals();
    }
    for (const n of NEEDS) {
      const v = state.needs[n];
      const row = this.el.querySelector(`[data-need="${n}"]`) as HTMLElement;
      (row.querySelector('i') as HTMLElement).style.width = `${v}%`;
      row.setAttribute('aria-label', `${NEED_NAMES[n]} ${Math.round(v)}`);
      row.classList.toggle('low', v < 25);
    }
  }

  private jobLine = '';
  private lastJobLine = '';
  private goalItems: string[] = [];

  /** Goals and work, shown as one tappable line that expands. */
  setGoals(items: string[]): void {
    this.goalItems = items;
    this.renderGoals();
  }

  private renderGoals(): void {
    const btn = this.q<HTMLButtonElement>('.goals');
    const lines = [...this.jobLine.split('\n').filter(Boolean), ...this.goalItems];
    btn.hidden = lines.length === 0;
    const open = btn.getAttribute('aria-expanded') === 'true';
    this.q('.goals-first').textContent = lines[0] ?? '';
    this.q('.goals-rest').textContent = open ? lines.slice(1).join('\n') : lines.length > 1 ? `+${lines.length - 1}` : '';
  }

  showPlace(place: Place, actions: Action[]): void {
    const panel = this.q('.panel');
    panel.querySelector('h2')!.textContent = place.name;
    panel.querySelector('p')!.textContent = place.description;
    const all: Action[] = [...actions, { label: 'Close', onClick: () => this.hidePlace() }];
    panel.querySelector('.actions')!.replaceChildren(
      ...all.map((a) => {
        const b = document.createElement('button');
        b.textContent = a.label;
        b.disabled = !!a.disabled;
        if (a.primary) b.classList.add('primary');
        b.addEventListener('click', () => a.onClick());
        return b;
      }),
    );
    panel.hidden = false;
  }

  /** Something was closed: a good moment to save. */
  onClosed: (() => void) | null = null;

  hidePlace(): void {
    const was = !this.q('.panel').hidden || !this.q('.pie').hidden;
    this.q('.panel').hidden = true;
    this.q('.pie').hidden = true;
    if (was) this.onClosed?.();
  }

  /**
   * The Sims-style interaction pie: a cameo of the person in the middle, a ring of
   * bubbles around them; groups open a second ring, and the middle takes you back.
   */
  showPie(info: { name: string; relation: string; note: string; portrait: string | null; x: number; y: number }, items: PieItem[]): void {
    this.q('.panel').hidden = true;
    const pie = this.q('.pie');
    const ring = pie.querySelector('.pie-ring') as HTMLElement;
    const card = pie.querySelector('.pie-card') as HTMLElement;
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    card.innerHTML = `<b>${esc(info.name)}</b><span>${esc(info.relation)}</span><p>${esc(info.note)}</p>`;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const render = (list: PieItem[], group: PieItem | null) => {
      const n = list.length + (group ? 0 : 1);
      const big = !group;
      const wide = vw > vh * 1.25;
      const short = wide && vh < 560;
      let r = Math.min(big ? 118 : 128, Math.max(92, n * (big ? 17 : 21)));
      if (short) r = Math.min(r, Math.max(78, (vh - 120) / 2 - 36));
      // Keep the whole ring on screen, clear of the top bar, the dock and the name card.
      const card = wide ? Math.min(vw * 0.4, 420) + 16 : 0;
      const lo = wide ? card + r + 44 : r + 46;
      const hi = vw - r - 44 - (wide ? 100 : 0);
      const cx = Math.max(lo, Math.min(Math.max(lo, hi), info.x));
      const cy = Math.max(r + (short ? 92 : 96), Math.min(vh - r - (wide ? 40 : 235), info.y));
      ring.style.left = `${cx}px`;
      ring.style.top = `${cy}px`;
      const hub = document.createElement('button');
      hub.className = `pie-hub${group ? ' back' : ''}`;
      hub.innerHTML = group
        ? `<span class="bk">‹</span><span class="gl">${esc(group.label)}</span>`
        : `${info.portrait ? `<img src="${info.portrait}" alt="">` : ''}`;
      hub.setAttribute('aria-label', group ? 'Back' : info.name);
      hub.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx('click');
        if (group) render(items, null);
      });
      const bubbles = list.map((it, i) => {
        const b = document.createElement('button');
        b.className = `pie-b${it.icon ? ' ic' : ''}${it.primary ? ' primary' : ''}${it.children ? ' grp' : ''}`;
        b.disabled = !!it.disabled || (!!it.children && it.children.every((c) => c.disabled));
        b.innerHTML = `${it.icon ? pieIcon(it.icon) : ''}<span class="t">${esc(it.label)}</span>${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ''}`;
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        b.style.setProperty('--x', `${Math.round(Math.cos(a) * r)}px`);
        b.style.setProperty('--y', `${Math.round(Math.sin(a) * r)}px`);
        b.style.animationDelay = `${i * 0.03}s`;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.children) {
            sfx('page');
            render(it.children, it);
          } else it.onClick?.();
        });
        return b;
      });
      if (!group) {
        const bye = document.createElement('button');
        bye.className = 'pie-b ic bye';
        bye.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg><span class="t">Goodbye</span>';
        const a = -Math.PI / 2 + (list.length / n) * Math.PI * 2;
        bye.style.setProperty('--x', `${Math.round(Math.cos(a) * r)}px`);
        bye.style.setProperty('--y', `${Math.round(Math.sin(a) * r)}px`);
        bye.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hidePlace();
        });
        bubbles.push(bye);
      }
      ring.replaceChildren(hub, ...bubbles);
    };
    render(items, null);
    pie.onclick = () => this.hidePlace();
    pie.hidden = false;
  }

  /** A Sims-style bubble with an icon: what you said, or how they took it. */
  iconBubble(x: number, y: number, what: string, tone: 'mine' | 'good' | 'bad'): void {
    const ICON: Record<string, string> = {
      chat: PIE_ICONS.talk, joke: '<circle cx="12" cy="12" r="8"/><path d="M8 14c1.2 2 6.8 2 8 0M9 10h.01M15 10h.01"/>', gossip: '<path d="M4 7h12v7H9l-3 3v-3H4z"/><path d="M18 9h2v7h-2v3l-3-3"/>',
      compliment: '<path d="M12 3l2.5 5.5 6 .7-4.5 4 1.3 6-5.3-3-5.3 3 1.3-6-4.5-4 6-.7z"/>', flirt: PIE_ICONS.romance, debate: '<path d="M4 19h16M6 19V9l6-5 6 5v10M10 19v-5h4v5"/>',
      brag: '<path d="M6 20V10l3-3 3 3 3-3 3 3v10z"/>', confide: '<path d="M12 4a6 6 0 0 0-6 6v3l-2 3h16l-2-3v-3a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0"/>',
      business: PIE_ICONS.business, gift: PIE_ICONS.favour, insult: PIE_ICONS.mean,
      love: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/>', good: '<path d="M5 12l4.5 4.5L19 7"/>',
      bad: '<path d="M7 17c1.5-2.5 8.5-2.5 10 0M9 10h.01M15 10h.01"/><circle cx="12" cy="12" r="8"/>', angry: '<path d="M13 3 6 13h5l-1 8 7-10h-5z" fill="currentColor"/>',
    };
    const b = document.createElement('div');
    b.className = `ibubble ${tone}`;
    b.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[what] ?? PIE_ICONS.talk}</svg>`;
    b.style.left = `${Math.max(40, Math.min(window.innerWidth - 40, x))}px`;
    b.style.top = `${Math.max(90, y)}px`;
    this.q('.bubbles').appendChild(b);
    setTimeout(() => b.remove(), 1800);
  }

  /** A speech bubble at a screen position, for a passer-by's greeting. */
  bubble(name: string, text: string, x: number, y: number): void {
    const b = document.createElement('div');
    b.className = 'bubble';
    const n = document.createElement('b');
    n.textContent = name;
    b.append(n, document.createTextNode(text));
    b.style.left = `${Math.max(80, Math.min(window.innerWidth - 80, x))}px`;
    b.style.top = `${Math.max(90, y)}px`;
    this.q('.bubbles').appendChild(b);
    setTimeout(() => b.remove(), 3200);
  }

  toast(text: string, ms = 2600): void {
    const t = this.q('.toast');
    t.textContent = text;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  }

  /** Fades the screen to black (true) or back (false). */
  fade(toBlack: boolean): Promise<void> {
    const f = document.querySelector('.fade') as HTMLElement;
    f.classList.toggle('on', toBlack);
    return new Promise((r) => setTimeout(r, 450));
  }

  setJournal(title: string, skills: string, missions: string, standing = '', work = ''): void {
    this.q('.journal h2').textContent = title;
    this.q('.page-skills').innerHTML = skills;
    this.q('.page-missions').innerHTML = missions;
    this.q('.page-work').innerHTML = work;
    this.q('.page-standing').innerHTML = standing;
  }

  static titleFor(state: GameState): string {
    return fullName(state.character);
  }
}
