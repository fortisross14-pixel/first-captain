import type { Character } from '../game/state';
import { sfx } from '../engine/sfx';

/**
 * The opening, before you ever see Saltwharf: a letter in Kent, the train into the fog,
 * and the quay with one white lamp. Engraved scenes, a page at a time; tap to go on.
 */
interface Page {
  scene: string;
  kicker?: string;
  text: string;
  letter?: boolean;
}

const STROKE = 'fill="none" stroke="#c9a24a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

const SCENES = {
  window: `<svg viewBox="0 0 300 200" aria-hidden="true">
    <rect x="70" y="30" width="160" height="130" ${STROKE}/><path d="M150 30 V160 M70 95 H230" ${STROKE}/>
    <path d="M78 150 q22 -30 40 -8 q16 -34 34 -4 q18 -26 36 0 q14 -20 34 8" ${STROKE} opacity=".5"/>
    <circle cx="198" cy="58" r="10" ${STROKE} opacity=".7"/>
    <path d="M40 170 H260" ${STROKE}/><rect x="132" y="146" width="16" height="24" ${STROKE}/>
    <path d="M140 146 q-6 -10 0 -18 q6 8 0 18" fill="#f0d78a" class="flame"/>
    <circle cx="140" cy="132" r="26" fill="url(#pg-glow)"/>
    <rect x="168" y="160" width="40" height="10" ${STROKE} transform="rotate(-8 188 165)"/>
  </svg>`,
  letter: `<svg viewBox="0 0 300 200" aria-hidden="true">
    <path d="M70 40 L230 32 L236 172 L74 178 Z" fill="#efe6d2" opacity=".08" ${STROKE}/>
    ${[56, 72, 88, 104, 120, 136].map((y, i) => `<path d="M${90 + (i % 2) * 4} ${y} q30 -4 60 0 t${50 - i * 4} 0" ${STROKE} opacity=".55"/>`).join('')}
    <path d="M150 156 q12 -12 30 -4 q-10 10 -30 4" ${STROKE}/><circle cx="104" cy="160" r="9" fill="#7a2018" stroke="#c9a24a"/>
  </svg>`,
  train: `<svg viewBox="0 0 300 200" aria-hidden="true">
    <path d="M10 160 H290 M10 168 H290" ${STROKE}/>${[20, 50, 80, 110, 140, 170, 200, 230, 260].map((x) => `<path d="M${x} 160 v8" ${STROKE}/>`).join('')}
    <path d="M60 150 V108 H150 V150 M150 120 H200 L214 136 V150 H60" ${STROKE}/><rect x="74" y="116" width="18" height="14" ${STROKE}/><rect x="104" y="116" width="18" height="14" ${STROKE}/>
    <path d="M176 120 V96 h14 v24" ${STROKE}/><circle cx="84" cy="152" r="9" ${STROKE}/><circle cx="130" cy="152" r="9" ${STROKE}/><circle cx="190" cy="152" r="9" ${STROKE}/>
    <path d="M183 92 q-20 -20 0 -34 q-30 -6 -20 -26 q-40 0 -40 -18" ${STROKE} opacity=".45"/>
    <circle cx="212" cy="138" r="18" fill="url(#pg-glow)"/>
  </svg>`,
  quay: `<svg viewBox="0 0 300 200" aria-hidden="true">
    <path d="M0 150 H300" ${STROKE}/><path d="M0 162 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 M0 176 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0" ${STROKE} opacity=".4"/>
    <path d="M10 150 V96 h40 v54 M60 150 V80 h50 v70 M190 150 V88 h44 v62 M244 150 V100 h46 v50" ${STROKE} opacity=".6"/>
    ${[40, 120, 200].map((x) => `<path d="M${x} 150 V102 M${x - 6} 102 h12 l-3 -12 h-6 z" ${STROKE}/><circle cx="${x}" cy="96" r="16" fill="url(#pg-glow)"/>`).join('')}
    <path d="M160 150 V96 M154 96 h12 l-3 -12 h-6 z" fill="none" stroke="#dff0ff" stroke-width="1.6"/><circle cx="160" cy="90" r="22" fill="url(#pg-vane)"/>
  </svg>`,
};

export class Prologue {
  private readonly el: HTMLElement;
  private i = 0;
  private resolve!: () => void;
  readonly done: Promise<void>;
  private readonly pages: Page[];

  constructor(root: HTMLElement, c: Character) {
    const kin = c.gender === 'man' ? 'nephew' : 'niece';
    this.pages = [
      { scene: 'window', kicker: 'Kent · September 1871', text: `The letter came on a Tuesday, in a slanting hand you had not seen since you were small. Your aunt Hester, who went to London before you were born and never came home. You had thought, vaguely, that she was already dead.` },
      { scene: 'letter', letter: true, text: `My dear ${c.first},\n\nIf this has reached you, I am gone, and you are the last of the ${c.last}s. I leave you my room above Pell's Chandlery in Saltwharf, by the river: one bed, one stove, a month's rent paid, and a trunk. Do not open the trunk until you are ready. You will know.\n\nThere is honest work on the docks for a strong back, and at the Copper Cup for a quick tongue. There is something else in Saltwharf that I cannot put in a letter. Come anyway. London needs people who notice things.\n\nYour loving aunt,\nHester ${c.last}` },
      { scene: 'train', kicker: 'The London train', text: `You sold what you could not carry and kept her letter and a little over a pound. The train ran three hours late through the fog, and when you stepped down at London Bridge the fog was waiting on the platform, as if it had come to meet Hester's ${kin}.` },
      { scene: 'quay', kicker: 'Saltwharf Docks · Michaelmas, 1 October 1871', text: 'Down by the river the gas lamps along the quay were already lit, yellow, the way gas lamps are. All but one. One of them burned white.' },
    ];
    root.insertAdjacentHTML('beforeend', `<div class="prologue" role="dialog" aria-label="Prologue">
      <svg width="0" height="0" style="position:absolute"><defs>
        <radialGradient id="pg-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
        <radialGradient id="pg-vane"><stop offset="0" stop-color="#eaf6ff" stop-opacity=".9"/><stop offset="1" stop-color="#eaf6ff" stop-opacity="0"/></radialGradient>
      </defs></svg>
      <div class="pg-fog" aria-hidden="true"></div>
      <div class="pg-inner"><div class="pg-scene"></div><div class="pg-kicker"></div><div class="pg-text"></div><div class="pg-tap">Tap to continue</div></div>
      <button class="pg-skip">Skip</button>
    </div>`);
    this.el = root.querySelector('.prologue') as HTMLElement;
    this.done = new Promise((r) => (this.resolve = r));
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.pg-skip')) return this.finish();
      this.next();
    });
    this.show();
  }

  private show(): void {
    const p = this.pages[this.i];
    const inner = this.el.querySelector('.pg-inner') as HTMLElement;
    inner.classList.remove('in');
    void inner.offsetWidth;
    inner.classList.add('in');
    inner.classList.toggle('is-letter', !!p.letter);
    (this.el.querySelector('.pg-scene') as HTMLElement).innerHTML = SCENES[p.scene as keyof typeof SCENES];
    (this.el.querySelector('.pg-kicker') as HTMLElement).textContent = p.kicker ?? '';
    const t = this.el.querySelector('.pg-text') as HTMLElement;
    t.innerHTML = p.text.split('\n').map((l) => (l ? `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>` : '')).join('');
    (this.el.querySelector('.pg-tap') as HTMLElement).textContent = this.i === this.pages.length - 1 ? 'Tap to begin' : 'Tap to continue';
    sfx('page');
  }

  private next(): void {
    if (this.i >= this.pages.length - 1) return this.finish();
    this.i++;
    this.show();
  }

  private finish(): void {
    this.el.classList.add('out');
    window.setTimeout(() => {
      this.el.remove();
      this.resolve();
    }, 600);
  }
}
