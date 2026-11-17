import { sfx } from '../engine/sfx';
import type { MinigameParams, MinigameResult } from './types';

interface Patron {
  order: string;
  drunk: boolean;
  patience: number;
  max: number;
  fight: number | null;
}

const DRINKS = ['Ale', 'Gin', 'Cider', 'Porter'];
const SEATS = 4;
const DEFAULT_SECONDS = 45;

/**
 * Order Juggling at the Copper Cup: pick a drink, then tap the patron who ordered it.
 * Rank 2 adds drunks you must cut off; rank 3 adds fights you must break up quickly.
 * Charisma makes patrons more patient; Strength gives you longer to stop a fight.
 */
export function playBar(root: HTMLElement, p: MinigameParams): Promise<MinigameResult> {
  const tuning = [
    { drinks: 2, spawn: 2.4, drunk: 0, fight: 0, target: 100 },
    { drinks: 3, spawn: 2.0, drunk: 0.22, fight: 0, target: 130 },
    { drinks: 4, spawn: 1.7, drunk: 0.25, fight: 0.12, target: 160 },
  ][Math.min(p.rank, 2)];
  const duration = p.seconds ?? DEFAULT_SECONDS;
  const patience = 7 + p.main * 0.35;
  const fightTime = 2.4 + p.second * 0.12;
  const drinks = DRINKS.slice(0, tuning.drinks);

  const el = document.createElement('div');
  el.className = 'minigame bar-game';
  el.innerHTML = `
    <div class="mg-head"><span class="mg-title"></span><span class="mg-time"></span><span class="mg-score"></span></div>
    <div class="bar-seats">${Array.from({ length: SEATS }, (_, i) => `<button class="seat" data-seat="${i}"></button>`).join('')}</div>
    <div class="bar-counter">
      ${drinks.map((d) => `<button class="pour" data-drink="${d}">${d}</button>`).join('')}
      ${tuning.drunk ? '<button class="pour cut" data-drink="cut">Cut off</button>' : ''}
    </div>
    <div class="mg-intro">
      <h2></h2>
      <p>Patrons sit and call for a drink. <b>Tap a drink</b> at the counter, then <b>tap the patron</b> who wants it.</p>
      <p>Be quick: patrons who wait too long leave without paying.</p>
      ${tuning.drunk ? '<p>Patrons marked <b>drunk</b> must be <b>cut off</b>, not served.</p>' : ''}
      ${tuning.fight ? '<p>When a <b>fight</b> breaks out, tap that seat at once to break it up.</p>' : ''}
      <button class="primary mg-start">Start shift</button>
    </div>`;
  root.appendChild(el);
  el.querySelector('.mg-title')!.textContent = p.title;
  el.querySelector('.mg-intro h2')!.textContent = p.title;
  const timeEl = el.querySelector('.mg-time') as HTMLElement;
  const scoreEl = el.querySelector('.mg-score') as HTMLElement;
  const seatEls = [...el.querySelectorAll<HTMLButtonElement>('.seat')];
  const pourEls = [...el.querySelectorAll<HTMLButtonElement>('.pour')];

  const seats: (Patron | null)[] = Array(SEATS).fill(null);
  let held: string | null = null;
  let score = 0;
  let served = 0;
  let walked = 0;
  let mistakes = 0;
  let fightsStopped = 0;
  let fightsLost = 0;
  let t = 0;
  let nextSpawn = 0.5;
  let running = false;

  const flash = (i: number, cls: string) => {
    sfx(cls === 'good' ? 'pour' : 'bad');
    seatEls[i].classList.add(cls);
    setTimeout(() => seatEls[i].classList.remove(cls), 350);
  };

  function render(): void {
    seats.forEach((pt, i) => {
      const b = seatEls[i];
      if (!pt) {
        b.className = 'seat empty';
        b.innerHTML = '<span class="who">Empty stool</span>';
        return;
      }
      b.className = `seat${pt.fight !== null ? ' fight' : ''}${pt.drunk ? ' drunk' : ''}`;
      const frac = pt.fight !== null ? pt.fight / fightTime : pt.patience / pt.max;
      b.innerHTML = `<span class="who">${pt.fight !== null ? 'FIGHT!' : pt.drunk ? 'Drunk' : 'Patron'}</span>
        <span class="order">${pt.fight !== null ? 'Break it up!' : pt.order}</span>
        <span class="patience"><i style="width:${Math.max(0, frac * 100)}%"></i></span>`;
    });
    pourEls.forEach((b) => b.classList.toggle('held', b.dataset.drink === held));
    scoreEl.textContent = `${served} served`;
    timeEl.textContent = `${Math.ceil(Math.max(0, duration - t))}s`;
  }

  function tapSeat(i: number): void {
    const pt = seats[i];
    if (!running || !pt) return;
    if (pt.fight !== null) {
      seats[i] = null;
      fightsStopped++;
      score += 10;
      flash(i, 'good');
      return;
    }
    if (!held) return;
    if (held === 'cut') {
      if (pt.drunk) {
        score += 8;
        flash(i, 'good');
      } else {
        score -= 6;
        mistakes++;
        flash(i, 'bad');
      }
      seats[i] = null;
    } else if (pt.drunk) {
      score -= 15;
      mistakes++;
      seats[i] = null;
      flash(i, 'bad');
    } else if (held === pt.order) {
      served++;
      score += 10 + Math.round((pt.patience / pt.max) * 5);
      seats[i] = null;
      flash(i, 'good');
    } else {
      score -= 5;
      mistakes++;
      flash(i, 'bad');
    }
    held = null;
  }

  return new Promise((resolve) => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (running) {
        t += dt;
        nextSpawn -= dt;
        if (nextSpawn <= 0) {
          nextSpawn = tuning.spawn * (0.7 + Math.random() * 0.6);
          const free = seats.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
          if (free.length) {
            const i = free[Math.floor(Math.random() * free.length)];
            seats[i] = { order: drinks[Math.floor(Math.random() * drinks.length)], drunk: Math.random() < tuning.drunk, patience: patience, max: patience, fight: null };
          }
        }
        seats.forEach((pt, i) => {
          if (!pt) return;
          if (pt.fight !== null) {
            pt.fight -= dt;
            if (pt.fight <= 0) {
              fightsLost++;
              score -= 20;
              seats[i] = null;
              flash(i, 'bad');
            }
            return;
          }
          pt.patience -= dt;
          if (tuning.fight && Math.random() < tuning.fight * dt * 0.5) pt.fight = fightTime;
          else if (pt.patience <= 0) {
            walked++;
            score -= pt.drunk ? 0 : 8;
            seats[i] = null;
          }
        });
        if (t >= duration) {
          running = false;
          cancelAnimationFrame(raf);
          el.remove();
          const total = Math.max(0, score);
          resolve({
            percent: total / tuning.target,
            lines: [
              `${served} drinks served`,
              `${walked} patron${walked === 1 ? '' : 's'} walked out`,
              `${mistakes} mistake${mistakes === 1 ? '' : 's'}`,
              ...(tuning.fight ? [`${fightsStopped} fights stopped, ${fightsLost} got out of hand`] : []),
            ],
          });
          return;
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    seatEls.forEach((b, i) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); tapSeat(i); }));
    pourEls.forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (running) held = held === b.dataset.drink ? null : b.dataset.drink!;
    }));
    el.querySelector('.mg-start')!.addEventListener('click', () => {
      (el.querySelector('.mg-intro') as HTMLElement).hidden = true;
      running = true;
    });
  });
}
