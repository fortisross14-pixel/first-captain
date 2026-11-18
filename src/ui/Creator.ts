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

/** Character creation: name, gender, attraction, look and five skill points. */
export class Creator {
  private readonly el: HTMLElement;
  private readonly draft: Character;

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

    const swatches = (name: string, colors: number[]) =>
      `<div class="swatches" data-field="${name}">${colors
        .map((c) => `<button class="swatch" data-value="${c}" style="background:${hex(c)}" aria-label="${name} ${hex(c)}"></button>`)
        .join('')}</div>`;
    const seg = (name: string, opts: [string, string][]) =>
      `<div class="seg" data-field="${name}">${opts.map(([v, l]) => `<button data-value="${v}">${l}</button>`).join('')}</div>`;

    root.insertAdjacentHTML(
      'beforeend',
      `<div class="creator">
        <div class="creator-sheet">
          <h2>Who are you?</h2>
          <p class="lead">You step off the train at London Bridge with one trunk and your late aunt's letter.</p>
          <div class="row two">
            <label>First name<input name="first" maxlength="16" autocomplete="off"></label>
            <label>Surname<input name="last" maxlength="16" autocomplete="off" placeholder="Hester's family name"></label>
          </div>
          <div class="row"><span class="lbl">Gender</span>${seg('gender', [['man', 'Man'], ['woman', 'Woman']])}</div>
          <div class="row"><span class="lbl">Attracted to</span>${seg('attraction', [['men', 'Men'], ['women', 'Women'], ['both', 'Both']])}</div>
          <div class="row"><span class="lbl">Skin</span>${swatches('skin', SKIN)}</div>
          <div class="row"><span class="lbl">Hair</span>${swatches('hair', HAIR)}</div>
          <div class="row"><span class="lbl">Coat</span>${swatches('coat', COAT)}</div>
          <div class="row"><span class="lbl">Clothing</span>${seg('skirt', [['0', 'Trousers'], ['1', 'Skirt']])}</div>
          <div class="row"><span class="lbl">Hair</span>${seg('hairStyle', [['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['curls', 'Curls'], ['bald', 'Bald']])}</div>
          <div class="row"><span class="lbl">Hat</span>${seg('hat', HATS.map((h) => [h, HAT_NAMES[h]] as [string, string]))}</div>
          <div class="row"><span class="lbl">Build</span>${seg('build', BUILDS.map((b) => [String(b.v), b.name] as [string, string]))}</div>
          <h3>Skills <span class="points"></span></h3>
          <div class="skills">${SKILLS.map(
            (s) => `<div class="skill" data-skill="${s}">
              <div><div class="sname">${SKILL_INFO[s].name}</div><div class="sblurb">${SKILL_INFO[s].blurb}</div></div>
              <div class="stepper"><button class="minus" aria-label="Lower ${SKILL_INFO[s].name}">−</button><span class="val">0</span><button class="plus" aria-label="Raise ${SKILL_INFO[s].name}">+</button></div>
            </div>`,
          ).join('')}</div>
          <div class="creator-actions">
            <button class="back">Back</button>
            <button class="primary begin" disabled>Begin</button>
          </div>
        </div>
      </div>`,
    );
    this.el = root.querySelector('.creator') as HTMLElement;
    const first = this.el.querySelector('input[name=first]') as HTMLInputElement;
    const last = this.el.querySelector('input[name=last]') as HTMLInputElement;
    first.value = this.draft.first;
    first.addEventListener('input', () => { this.draft.first = first.value.trim(); this.refresh(); });
    last.addEventListener('input', () => { this.draft.last = last.value.trim(); this.refresh(); });

    this.el.querySelectorAll<HTMLElement>('.swatches').forEach((group) => {
      group.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (!b) return;
        const field = group.dataset.field as 'skin' | 'hair' | 'coat';
        this.draft.look[field] = Number(b.dataset.value);
        this.refresh();
      });
    });
    this.el.querySelectorAll<HTMLElement>('.seg').forEach((group) => {
      group.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (!b) return;
        this.setField(group.dataset.field!, b.dataset.value!);
        this.refresh();
      });
    });
    this.el.querySelectorAll<HTMLElement>('.skill').forEach((row) => {
      const id = row.dataset.skill as SkillId;
      row.querySelector('.minus')!.addEventListener('click', () => {
        if (this.draft.skills[id] > 0) this.draft.skills[id]--;
        this.refresh();
      });
      row.querySelector('.plus')!.addEventListener('click', () => {
        if (this.pointsLeft > 0 && this.draft.skills[id] < MAX_SKILL) this.draft.skills[id]++;
        this.refresh();
      });
    });
    this.el.querySelector('.back')!.addEventListener('click', onBack);
    this.el.querySelector('.begin')!.addEventListener('click', () => {
      if (this.valid) onDone(structuredClone(this.draft));
    });
    this.refresh();
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
    const mark = (field: string, value: string) =>
      this.el.querySelectorAll<HTMLButtonElement>(`[data-field="${field}"] button`).forEach((b) => b.classList.toggle('on', b.dataset.value === value));
    mark('gender', d.gender);
    mark('attraction', d.attraction);
    mark('skin', String(d.look.skin));
    mark('hair', String(d.look.hair));
    mark('coat', String(d.look.coat));
    mark('skirt', d.look.skirt ? '1' : '0');
    mark('hat', d.look.hat);
    mark('build', String(d.look.build ?? 1));
    mark('hairStyle', d.look.hairStyle ?? (d.look.skirt ? 'bun' : 'short'));
    for (const s of SKILLS) {
      const row = this.el.querySelector(`[data-skill="${s}"]`)!;
      row.querySelector('.val')!.textContent = String(d.skills[s]);
      (row.querySelector('.minus') as HTMLButtonElement).disabled = d.skills[s] === 0;
      (row.querySelector('.plus') as HTMLButtonElement).disabled = this.pointsLeft === 0;
    }
    const left = this.pointsLeft;
    this.el.querySelector('.points')!.textContent = left > 0 ? `${left} point${left === 1 ? '' : 's'} to place` : 'All points placed';
    const begin = this.el.querySelector('.begin') as HTMLButtonElement;
    begin.disabled = !this.valid;
    begin.textContent = !d.first || !d.last ? 'Name yourself to begin' : left > 0 ? `Place ${left} more point${left === 1 ? '' : 's'}` : 'Begin';
    this.onChange(d);
  }

  remove(): void {
    this.el.remove();
  }
}
