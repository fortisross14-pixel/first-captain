export interface Line {
  speaker: string;
  text: string;
}

/** Bottom-of-screen conversation box. Tap to advance; optional choices. */
export class Dialogue {
  private readonly el: HTMLElement;
  private readonly speakerEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly choicesEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private advance: (() => void) | null = null;
  /** Portrait for a speaker's name: an image URL, or null for a monogram. */
  portraitFor: ((speaker: string) => string | null) | null = null;
  private readonly cameo: HTMLElement;
  private readonly catcher: HTMLElement;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="dialogue-catch" hidden></div>
      <div class="dialogue" hidden>
        <div class="cameo" aria-hidden="true"><img alt=""><span class="mono"></span></div>
        <div class="speaker"></div>
        <div class="text"></div>
        <div class="choices"></div>
        <div class="hint">Tap to continue</div>
      </div>`,
    );
    this.el = root.querySelector('.dialogue') as HTMLElement;
    this.speakerEl = this.el.querySelector('.speaker') as HTMLElement;
    this.textEl = this.el.querySelector('.text') as HTMLElement;
    this.choicesEl = this.el.querySelector('.choices') as HTMLElement;
    this.hintEl = this.el.querySelector('.hint') as HTMLElement;
    this.cameo = this.el.querySelector('.cameo') as HTMLElement;
    // Tap the box, or anywhere else on screen, to continue.
    this.catcher = root.querySelector('.dialogue-catch') as HTMLElement;
    const next = () => {
      const a = this.advance;
      if (a) {
        this.advance = null;
        a();
      }
    };
    this.el.addEventListener('click', next);
    this.catcher.addEventListener('click', next);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  private show(line: Line): void {
    this.el.hidden = false;
    this.catcher.hidden = false;
    this.speakerEl.textContent = line.speaker;
    // A cameo of whoever speaks; narration has none.
    const narr = !line.speaker;
    this.el.classList.toggle('narration', narr);
    this.cameo.hidden = narr;
    if (!narr) {
      const url = this.portraitFor?.(line.speaker) ?? null;
      const img = this.cameo.querySelector('img') as HTMLImageElement;
      img.hidden = !url;
      if (url && img.src !== url) img.src = url;
      const mono = this.cameo.querySelector('.mono') as HTMLElement;
      mono.hidden = !!url;
      mono.textContent = line.speaker.replace(/^(The|A|An|Mr\.|Mrs\.|Dr\.|Father|Old|Foreman) /, '').charAt(0).toUpperCase();
    }
    this.textEl.textContent = line.text;
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
  }

  /** Shows lines one after another; resolves when the last is dismissed. */
  async say(...lines: Line[]): Promise<void> {
    for (const line of lines) {
      this.show(line);
      this.choicesEl.replaceChildren();
      this.hintEl.hidden = false;
      await new Promise<void>((res) => (this.advance = res));
    }
    this.close();
  }

  /** Shows a line with choices; resolves with the chosen index. */
  ask(line: Line, options: string[]): Promise<number> {
    this.show(line);
    this.hintEl.hidden = true;
    this.advance = null;
    return new Promise<number>((res) => {
      this.choicesEl.replaceChildren(
        ...options.map((label, i) => {
          const b = document.createElement('button');
          b.textContent = label;
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
            res(i);
          });
          return b;
        }),
      );
    });
  }

  close(): void {
    this.el.hidden = true;
    this.catcher.hidden = true;
    this.choicesEl.replaceChildren();
  }
}
