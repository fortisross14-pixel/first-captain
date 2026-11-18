import { NEED_NAMES, SKILL_INFO, SKILLS, fullName, type GameState, type NeedId } from '../game/state';
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
        <div class="topbar card">
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
        <div class="bottom-left">
          <button class="journal-btn" aria-label="Open journal">Journal</button>
          <button class="bag-btn" aria-label="Open bag">Bag</button>
          <button class="people-btn" aria-label="Open contacts">People</button>
        </div>
        <button class="speed" aria-label="Change time speed">1×</button>
        <div class="toast" role="status"></div>
        <div class="bubbles"></div>
        <div class="panel" hidden>
          <h2></h2>
          <p></p>
          <div class="actions"></div>
        </div>
        <div class="journal" hidden>
          <div class="journal-sheet">
            <h2></h2>
            <div class="journal-body"></div>
            <div class="actions settings">
              <button class="sound-toggle"></button>
              <button class="quality-toggle"></button>
            </div>
            <div class="actions">
              <button class="quit">Save &amp; quit to title</button>
              <button class="save">Save</button>
              <button class="primary close-journal">Close</button>
            </div>
          </div>
        </div>
        <div class="listsheet journal" hidden>
          <div class="journal-sheet">
            <h2></h2>
            <p class="meta list-sub"></p>
            <div class="list-rows"></div>
            <div class="actions"><button class="primary list-close">Close</button></div>
          </div>
        </div>
        <div class="modal" hidden>
          <div class="journal-sheet">
            <h2></h2>
            <div class="modal-body"></div>
            <div class="actions"><button class="primary modal-ok">Continue</button></div>
          </div>
        </div>
      </div>
      <div class="fade"></div>`,
    );
    this.el = root.querySelector('.hud') as HTMLElement;
    const speed = this.q<HTMLButtonElement>('.speed');
    speed.addEventListener('click', () => (speed.textContent = `${onSpeed()}×`));
    this.q('.journal-btn').addEventListener('click', () => (this.journalOpen = true));
    this.q('.close-journal').addEventListener('click', () => (this.journalOpen = false));
    this.q('.bag-btn').addEventListener('click', () => this.onBag?.());
    const goals = this.q('.goals');
    goals.addEventListener('click', () => {
      goals.setAttribute('aria-expanded', String(goals.getAttribute('aria-expanded') !== 'true'));
      this.renderGoals();
    });
    this.q('.people-btn').addEventListener('click', () => this.onPeople?.());
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
    return !this.q('.journal').hidden || !this.q('.modal').hidden || !this.q('.listsheet').hidden;
  }

  /** A report the player must acknowledge, such as the end of a shift. */
  modal(title: string, lines: string[]): Promise<void> {
    const m = this.q('.modal');
    m.querySelector('h2')!.textContent = title;
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
  showList(title: string, sub: string, rows: ListRow[]): void {
    const el = this.q('.listsheet');
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

  update(state: GameState, district: string, date: string, time: string, rentDue: string, jobLine = ''): void {
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

  journalHtml(state: GameState, rentLine: string, work = ''): string {
    const c = state.character;
    const gender = c.gender === 'man' ? 'Man' : 'Woman';
    const attraction = { men: 'men', women: 'women', both: 'men and women' }[c.attraction];
    return `
      <p class="meta">${gender} · attracted to ${attraction}</p>
      <h3>Skills</h3>
      <table class="sheet">${SKILLS.map((s) => `<tr><td>${SKILL_INFO[s].name}</td><td class="num">${c.skills[s]} / 20</td></tr>`).join('')}</table>
      <h3>Needs</h3>
      <table class="sheet">${NEEDS.map((n) => `<tr><td>${NEED_NAMES[n]}</td><td class="num">${Math.round(state.needs[n])}</td></tr>`).join('')}</table>
      <h3>Work</h3>
      <p class="pre">${work || 'Unemployed.'}</p>
      <h3>Purse</h3>
      <p>£${state.money.toFixed(2)}. ${rentLine}</p>`;
  }

  setJournal(title: string, html: string): void {
    this.q('.journal h2').textContent = title;
    this.q('.journal-body').innerHTML = html;
  }

  static titleFor(state: GameState): string {
    return fullName(state.character);
  }
}
