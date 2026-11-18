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

/** Engraved emblems for the dock tokens. */
const TOKEN = {
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
          <button class="tok watch speed" aria-label="Change time speed">
            <span class="hex" aria-hidden="true"><span class="hexin">${TOKEN.watch}</span></span>
            <span class="lab speed-lab">1×</span>
          </button>
        </nav>
        <div class="toast gs" role="status"></div>
        <div class="floaters" aria-hidden="true"></div>
        <div class="celebrate" aria-live="polite"></div>
        <div class="bubbles"></div>
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
              <button role="tab" data-page="missions" aria-selected="false">Missions</button>
              <button role="tab" data-page="options" aria-selected="false">Options</button>
            </div>
            <div class="journal-body page-skills"></div>
            <div class="journal-body page-missions" hidden></div>
            <div class="journal-body page-options" hidden>
              <div class="opt"><span>Sound</span><button class="sound-toggle"></button></div>
              <div class="opt"><span>Graphics</span><button class="quality-toggle"></button></div>
              <div class="opt"><span>Save the game</span><button class="save">Save</button></div>
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
    this.q('.list-close').addEventListener('click', () => (this.q('.listsheet').hidden = true));
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
    this.q('.journal .quit').addEventListener('click', () => this.onQuit());
  }

  set visible(v: boolean) {
    this.el.hidden = !v;
  }

  /** True while a menu covers the world and taps should not reach it. */
  get blocking(): boolean {
    return !this.q('.journal').hidden || !this.q('.modal').hidden || !this.q('.listsheet').hidden || this.q('.celebrate').children.length > 0;
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
    for (const p of ['skills', 'missions', 'options']) this.q(`.page-${p}`).hidden = p !== page;
  }

  set journalOpen(open: boolean) {
    this.q('.journal').hidden = !open;
    if (open) this.renderJournal?.();
  }

  renderJournal: (() => void) | null = null;
  onBag: (() => void) | null = null;
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
    const hour = this.q('.w-hour');
    const min = this.q('.w-min');
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

  hidePlace(): void {
    this.q('.panel').hidden = true;
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

  setJournal(title: string, skills: string, missions: string): void {
    this.q('.journal h2').textContent = title;
    this.q('.page-skills').innerHTML = skills;
    this.q('.page-missions').innerHTML = missions;
  }

  static titleFor(state: GameState): string {
    return fullName(state.character);
  }
}
