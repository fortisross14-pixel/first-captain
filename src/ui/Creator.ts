import type { Look } from '../actors/characterModel';
import {
  MAX_SKILL, SKILL_INFO, SKILLS, START_SKILL_POINTS,
  type Attraction, type Character, type Gender, type SkillId,
} from '../game/state';

const SKIN = [0xf0cfb0, 0xe0b896, 0xc89a78, 0x9a6a48, 0x6a4430];
const HAIR = [0x15110e, 0x3a2618, 0x6a4428, 0x9a4a22, 0xc8a870, 0x8a8a8a];
const COAT = [0x3c4a3a, 0x3a3a48, 0x5a3a2e, 0x4a4038, 0x6a2e2e, 0x2a2e34];
const HATS: Look['hat'][] = ['cap', 'bowler', 'bonnet', 'top', 'none'];
const HAT_NAMES: Record<Look['hat'], string> = { cap: 'Cap', bowler: 'Bowler', bonnet: 'Bonnet', top: 'Top hat', none: 'None' };
const BUILDS = [{ name: 'Slight', v: 0.9 }, { name: 'Average', v: 1 }, { name: 'Broad', v: 1.12 }];
const NAMES: Record<Gender, string[]> = {
  man: ['Thomas', 'Arthur', 'Edmund', 'Silas', 'Walter', 'Jonah'],
  woman: ['Ada', 'Clara', 'Maud', 'Eliza', 'Harriet', 'Rose'],
};

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Character creation in two steps: who you are (rows that open pickers), then five skill points. */
export class Creator {
  private readonly el: HTMLElement;
  private readonly draft: Character;
  private step: 1 | 2 = 1;

  constructor(root: HTMLElement, private readonly onChange: (c: Character) => void, onDone: (c: Character) => void, onBack: () => void) {
    this.draft = {
      first: NAMES.woman[Math.floor(Math.random() * 6)],
      last: '',
      gender: 'woman',
      attraction: 'men',
      look: {
        skin: SKIN[1], hair: HAIR[1], coat: COAT[0], trousers: 0x3a2e2a, shirt: 0xd8ccb0, boots: 0x1e1a16,
        scarf: 0x8a2e26, hat: 'bonnet', hatColor: 0x3a342c, skirt: true, build: 1, hairStyle: 'bun',
      },
      skills: { study: 0, strength: 0, arts: 0, charisma: 0, cunning: 0, occult: 0 },
    };
    const row = (field: string, label: string) => `<button class="crow" data-row="${field}"><span class="lbl">${label}</span><span class="val" data-val="${field}"></span><span class="chev">›</span></button>`;
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="creator">
        <div class="creator-sheet">
          <div class="step step1">
            <h2>Who are you?</h2>
            <p class="lead">You step off the train at London Bridge with one trunk and your late aunt's letter.</p>
            <div class="row two">
              <label>First name<input name="first" maxlength="16" autocomplete="off"></label>
              <label>Surname<input name="last" maxlength="16" autocomplete="off" placeholder="Hester's family name"></label>
            </div>
            <div class="crows">
              ${row('gender', 'Gender')}${row('attraction', 'Attracted to')}${row('skin', 'Skin')}${row('hair', 'Hair colour')}${row('hairStyle', 'Hair')}
              ${row('coat', 'Coat')}${row('skirt', 'Clothing')}${row('hat', 'Hat')}${row('build', 'Build')}
            </div>
            <div class="creator-actions">
              <button class="back">Back</button>
              <button class="primary next">Next: your skills</button>
            </div>
          </div>
          <div class="step step2" hidden>
            <h2>What can you do?</h2>
            <p class="lead">Five points to spend. Skills grow with practice; nothing here locks you into a path.</p>
            <h3>Skills <span class="points"></span></h3>
            <div class="skills">${SKILLS.map(
              (s) => `<div class="skill" data-skill="${s}">
                <div><div class="sname">${SKILL_INFO[s].name}</div><div class="sblurb">${SKILL_INFO[s].blurb}</div></div>
                <div class="stepper"><button class="minus" aria-label="Lower ${SKILL_INFO[s].name}">−</button><span class="val">0</span><button class="plus" aria-label="Raise ${SKILL_INFO[s].name}">+</button></div>
              </div>`,
            ).join('')}</div>
            <div class="creator-actions">
              <button class="back2">Back</button>
              <button class="primary begin" disabled>Begin</button>
            </div>
          </div>
        </div>
        <div class="picker" hidden><div class="picker-sheet"><h3></h3><div class="picker-opts"></div></div></div>
      </div>`,
    );
    this.el = root.querySelector('.creator') as HTMLElement;
    const first = this.el.querySelector('input[name=first]') as HTMLInputElement;
    const last = this.el.querySelector('input[name=last]') as HTMLInputElement;
    first.value = this.draft.first;
    first.addEventListener('input', () => { this.draft.first = first.value.trim(); this.refresh(); });
    last.addEventListener('input', () => { this.draft.last = last.value.trim(); this.refresh(); });
    this.el.querySelectorAll<HTMLButtonElement>('.crow').forEach((b) => b.addEventListener('click', () => this.openPicker(b.dataset.row!)));
    const picker = this.el.querySelector('.picker') as HTMLElement;
    picker.addEventListener('click', (e) => { if (e.target === picker) picker.hidden = true; });
    this.el.querySelectorAll<HTMLElement>('.skill').forEach((r) => {
      const id = r.dataset.skill as SkillId;
      r.querySelector('.minus')!.addEventListener('click', () => {
        if (this.draft.skills[id] > 0) this.draft.skills[id]--;
        this.refresh();
      });
      r.querySelector('.plus')!.addEventListener('click', () => {
        if (this.pointsLeft > 0 && this.draft.skills[id] < MAX_SKILL) this.draft.skills[id]++;
        this.refresh();
      });
    });
    this.el.querySelector('.back')!.addEventListener('click', onBack);
    this.el.querySelector('.next')!.addEventListener('click', () => this.goStep(2));
    this.el.querySelector('.back2')!.addEventListener('click', () => this.goStep(1));
    this.el.querySelector('.begin')!.addEventListener('click', () => {
      if (this.valid) onDone(structuredClone(this.draft));
    });
    this.refresh();
  }

  private goStep(n: 1 | 2): void {
    this.step = n;
    (this.el.querySelector('.step1') as HTMLElement).hidden = n !== 1;
    (this.el.querySelector('.step2') as HTMLElement).hidden = n !== 2;
    this.refresh();
  }

  /** Options for each row: colour swatches or named choices. */
  private options(field: string): { value: string; label: string; color?: number }[] {
    const sw = (a: number[]) => a.map((c) => ({ value: String(c), label: '', color: c }));
    switch (field) {
      case 'gender': return [{ value: 'man', label: 'Man' }, { value: 'woman', label: 'Woman' }];
      case 'attraction': return [{ value: 'men', label: 'Men' }, { value: 'women', label: 'Women' }, { value: 'both', label: 'Both' }];
      case 'skin': return sw(SKIN);
      case 'hair': return sw(HAIR);
      case 'coat': return sw(COAT);
      case 'hairStyle': return [['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['curls', 'Curls'], ['bald', 'Bald']].map(([value, label]) => ({ value, label }));
      case 'skirt': return [{ value: '0', label: 'Trousers' }, { value: '1', label: 'Skirt' }];
      case 'hat': return HATS.map((h) => ({ value: h, label: HAT_NAMES[h] }));
      case 'build': return BUILDS.map((b) => ({ value: String(b.v), label: b.name }));
      default: return [];
    }
  }

  private current(field: string): string {
    const d = this.draft;
    switch (field) {
      case 'gender': return d.gender;
      case 'attraction': return d.attraction;
      case 'skin': return String(d.look.skin);
      case 'hair': return String(d.look.hair);
      case 'coat': return String(d.look.coat);
      case 'hairStyle': return d.look.hairStyle ?? (d.look.skirt ? 'bun' : 'short');
      case 'skirt': return d.look.skirt ? '1' : '0';
      case 'hat': return d.look.hat;
      case 'build': return String(d.look.build ?? 1);
      default: return '';
    }
  }

  private openPicker(field: string): void {
    const picker = this.el.querySelector('.picker') as HTMLElement;
    const label = (this.el.querySelector(`[data-row="${field}"] .lbl`) as HTMLElement).textContent ?? '';
    picker.querySelector('h3')!.textContent = label;
    const box = picker.querySelector('.picker-opts') as HTMLElement;
    const cur = this.current(field);
    box.className = `picker-opts${this.options(field)[0]?.color !== undefined ? ' swatches' : ''}`;
    box.replaceChildren(...this.options(field).map((o) => {
      const b = document.createElement('button');
      b.className = `${o.color !== undefined ? 'swatch' : 'choice'}${o.value === cur ? ' on' : ''}`;
      if (o.color !== undefined) {
        b.style.background = hex(o.color);
        b.setAttribute('aria-label', `${label} ${hex(o.color)}`);
      } else b.textContent = o.label;
      b.addEventListener('click', () => {
        this.setField(field, o.value);
        picker.hidden = true;
        this.refresh();
      });
      return b;
    }));
    picker.hidden = false;
  }

  private setField(field: string, value: string): void {
    const d = this.draft;
    if (field === 'gender') {
      const g = value as Gender;
      if (g !== d.gender) {
        d.gender = g;
        // Sensible defaults the player can still change.
        d.look.skirt = g === 'woman';
        d.look.hat = g === 'woman' ? 'bonnet' : 'cap';
        d.look.hairStyle = g === 'woman' ? 'bun' : 'short';
        d.attraction = g === 'woman' ? 'men' : 'women';
        if (NAMES[g === 'man' ? 'woman' : 'man'].includes(d.first)) {
          d.first = NAMES[g][Math.floor(Math.random() * 6)];
          (this.el.querySelector('input[name=first]') as HTMLInputElement).value = d.first;
        }
      }
    } else if (field === 'attraction') d.attraction = value as Attraction;
    else if (field === 'skin' || field === 'hair' || field === 'coat') d.look[field] = Number(value);
    else if (field === 'skirt') d.look.skirt = value === '1';
    else if (field === 'hat') d.look.hat = value as Look['hat'];
    else if (field === 'build') d.look.build = Number(value);
    else if (field === 'hairStyle') d.look.hairStyle = value as Look['hairStyle'];
  }

  private get pointsLeft(): number {
    return START_SKILL_POINTS - SKILLS.reduce((a, s) => a + this.draft.skills[s], 0);
  }

  private get valid(): boolean {
    return this.draft.first.length > 0 && this.draft.last.length > 0 && this.pointsLeft === 0;
  }

  private refresh(): void {
    const d = this.draft;
    for (const el of this.el.querySelectorAll<HTMLElement>('[data-val]')) {
      const f = el.dataset.val!;
      const opt = this.options(f).find((o) => o.value === this.current(f));
      if (opt?.color !== undefined) el.innerHTML = `<i class="dot" style="background:${hex(opt.color)}"></i>`;
      else el.textContent = opt?.label ?? '';
    }
    for (const s of SKILLS) {
      const row = this.el.querySelector(`[data-skill="${s}"]`)!;
      row.querySelector('.val')!.textContent = String(d.skills[s]);
      (row.querySelector('.minus') as HTMLButtonElement).disabled = d.skills[s] === 0;
      (row.querySelector('.plus') as HTMLButtonElement).disabled = this.pointsLeft === 0;
    }
    const left = this.pointsLeft;
    this.el.querySelector('.points')!.textContent = left > 0 ? `${left} point${left === 1 ? '' : 's'} to place` : 'All points placed';
    const next = this.el.querySelector('.next') as HTMLButtonElement;
    next.disabled = !d.first || !d.last;
    next.textContent = !d.first || !d.last ? 'Name yourself first' : 'Next: your skills';
    const begin = this.el.querySelector('.begin') as HTMLButtonElement;
    begin.disabled = !this.valid;
    begin.textContent = left > 0 ? `Place ${left} more point${left === 1 ? '' : 's'}` : 'Begin';
    this.el.classList.toggle('on-step2', this.step === 2);
    this.onChange(d);
  }

  remove(): void {
    this.el.remove();
  }
}
