/** Title screen over the night-time docks. */
export class Title {
  private readonly el: HTMLElement;

  constructor(root: HTMLElement, hasSave: boolean, onContinue: () => void, onNew: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="title-screen">
        <div class="title-inner">
          <div class="kicker">London · 1871</div>
          <h1>The Pale Lamps</h1>
          <p class="sub">The city glows brighter every night, and the fog is getting worse.</p>
          <div class="title-buttons">
            ${hasSave ? '<button class="primary continue">Continue</button>' : ''}
            <button class="${hasSave ? '' : 'primary '}new">Begin a new life</button>
          </div>
          <p class="note">Your progress saves automatically on this device.</p>
        </div>
      </div>`,
    );
    this.el = root.querySelector('.title-screen') as HTMLElement;
    this.el.querySelector('.continue')?.addEventListener('click', onContinue);
    this.el.querySelector('.new')!.addEventListener('click', () => {
      if (hasSave && !confirm('Start a new life? Your current save will be replaced once you begin.')) return;
      onNew();
    });
  }

  remove(): void {
    this.el.remove();
  }
}
