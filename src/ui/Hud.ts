import type { Place } from '../world/saltwharf';

/** DOM overlay: clock, money, rent, speed toggle, place panel and toasts. */
export class Hud {
  private readonly dateEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly moneyEl: HTMLElement;
  private readonly rentEl: HTMLElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly toastEl: HTMLElement;
  private toastTimer = 0;

  constructor(root: HTMLElement, onSpeed: () => number) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud">
        <div class="card clock">
          <div class="district">Saltwharf Docks</div>
          <div class="date"></div>
          <div class="time"></div>
        </div>
        <div class="card purse">
          <div class="money"></div>
          <div class="rent"></div>
        </div>
        <button class="speed" aria-label="Change time speed">1×</button>
        <div class="toast" role="status"></div>
        <div class="panel" hidden>
          <h2></h2>
          <p></p>
          <div class="actions">
            <button class="enter" disabled>Enter · coming soon</button>
            <button class="close">Close</button>
          </div>
        </div>
      </div>`,
    );
    const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
    this.dateEl = q('.date');
    this.timeEl = q('.time');
    this.moneyEl = q('.money');
    this.rentEl = q('.rent');
    this.speedBtn = q<HTMLButtonElement>('.speed');
    this.panel = q('.panel');
    this.toastEl = q('.toast');
    this.speedBtn.addEventListener('click', () => {
      this.speedBtn.textContent = `${onSpeed()}×`;
    });
    q('.panel .close').addEventListener('click', () => this.hidePlace());
  }

  setClock(date: string, time: string): void {
    if (this.dateEl.textContent !== date) this.dateEl.textContent = date;
    if (this.timeEl.textContent !== time) this.timeEl.textContent = time;
  }

  setPurse(money: number, rentDue: string): void {
    this.moneyEl.textContent = `£${money.toFixed(2)}`;
    this.rentEl.textContent = `Rent due ${rentDue}`;
  }

  showPlace(place: Place): void {
    this.panel.querySelector('h2')!.textContent = place.name;
    this.panel.querySelector('p')!.textContent = place.description;
    this.panel.hidden = false;
  }

  hidePlace(): void {
    this.panel.hidden = true;
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }
}
