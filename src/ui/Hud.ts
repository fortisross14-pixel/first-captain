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

/** In-game overlay: clock, purse, needs, objectives, place panel, journal, toasts and fades. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly q = <T extends HTMLElement>(sel: string) => this.el.querySelector(sel) as T;
  private toastTimer = 0;

  constructor(root: HTMLElement, onSpeed: () => number, private readonly onSave: () => void, private readonly onQuit: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud" hidden>
        <div class="col left">
          <div class="card clock">
            <div class="district"></div>
            <div class="date"></div>
            <div class="time"></div>
          </div>
          <div class="card needs">${NEEDS.map(
            (n) => `<div class="need" data-need="${n}"><span>${NEED_NAMES[n]}</span><div class="bar"><i></i></div></div>`,
          ).join('')}</div>
        </div>
        <div class="col right">
          <div class="card purse">
            <div class="money"></div>
            <div class="rent"></div>
            <div class="jobline"></div>
          </div>
          <div class="card objectives" hidden><div class="obj-title">To do</div><ul></ul></div>
        </div>
        <div class="bottom-left">
          <button class="journal-btn" aria-label="Open journal">Journal</button>
          <button class="bag-btn" aria-label="Open bag">Bag</button>
        </div>
        <button class="speed" aria-label="Change time speed">1×</button>
        <div class="toast" role="status"></div>
        <div class="panel" hidden>
          <h2></h2>
          <p></p>
          <div class="actions"></div>
        </div>
        <div class="journal" hidden>
          <div class="journal-sheet">
            <h2></h2>
            <div class="journal-body"></div>
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
    this.q('.list-close').addEventListener('click', () => (this.q('.listsheet').hidden = true));
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
    set('.district', district);
    set('.date', date);
    set('.time', time);
    set('.money', `£${state.money.toFixed(2)}`);
    set('.jobline', jobLine);
    set('.rent', state.rent.graceUntil !== null ? 'Rent overdue!' : `Rent £${state.rent.amount.toFixed(2)} due ${rentDue}`);
    for (const n of NEEDS) {
      const v = state.needs[n];
      const row = this.el.querySelector(`[data-need="${n}"]`) as HTMLElement;
      (row.querySelector('i') as HTMLElement).style.width = `${v}%`;
      row.classList.toggle('low', v < 25);
    }
  }

  setObjectives(items: { text: string; done: boolean }[]): void {
    // Only what is left to do, to keep the phone screen clear.
    const left = items.filter((i) => !i.done);
    const card = this.q('.objectives');
    card.hidden = left.length === 0;
    this.q('.objectives ul').replaceChildren(
      ...left.map((i) => {
        const li = document.createElement('li');
        li.textContent = i.text;
        return li;
      }),
    );
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
