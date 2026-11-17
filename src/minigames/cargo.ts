import { sfx } from '../engine/sfx';
import type { MinigameParams, MinigameResult } from './types';

interface Crate {
  weight: number;
  fragile: boolean;
  broken: boolean;
}

const W = 360;
const H = 560;
const COLS = 6;
const COL_W = 46;
const DECK_X = (W - COLS * COL_W) / 2;
const DECK_Y = 440;
const CRATE_H = 34;
const MAX_STACK = 5;
const HOOK_Y = 96;
const DEFAULT_SECONDS = 40;

/**
 * Cargo Stacking: a crane swings a crate over a barge; tap to drop it.
 * Load as much weight as you can in 40 seconds while keeping the barge level.
 * Rank 2 adds fragile crates (nothing may land on them); rank 3 adds wind and a touchier barge.
 */
export function playCargo(root: HTMLElement, p: MinigameParams): Promise<MinigameResult> {
  const tuning = [
    { speed: 1.5, limit: 7, fragile: 0, wind: 0, target: 110 },
    { speed: 1.9, limit: 6, fragile: 0.25, wind: 0, target: 140 },
    { speed: 2.3, limit: 5, fragile: 0.3, wind: 1, target: 170 },
  ][Math.min(p.rank, 2)];
  const DURATION = p.seconds ?? DEFAULT_SECONDS;
  const speed = Math.max(0.9, tuning.speed - p.main * 0.04);
  const limit = tuning.limit + p.main * 0.15 + p.second * 0.05;

  const el = document.createElement('div');
  el.className = 'minigame';
  el.innerHTML = `
    <div class="mg-head"><span class="mg-title"></span><span class="mg-time"></span><span class="mg-score"></span></div>
    <canvas width="${W}" height="${H}"></canvas>
    <div class="mg-intro">
      <h2></h2>
      <p>The crane swings a crate over the barge. <b>Tap</b> to drop it.</p>
      <p>Heavier crates are darker and score more. Keep the barge level: lean too far and crates go in the river.</p>
      ${tuning.fragile ? '<p><b>Fragile</b> crates (red) break if anything lands on them.</p>' : ''}
      ${tuning.wind ? '<p>The <b>wind</b> pushes the hook about.</p>' : ''}
      <button class="primary mg-start">Start shift</button>
    </div>`;
  root.appendChild(el);
  el.querySelector('.mg-title')!.textContent = p.title;
  el.querySelector('.mg-intro h2')!.textContent = p.title;
  const canvas = el.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const timeEl = el.querySelector('.mg-time') as HTMLElement;
  const scoreEl = el.querySelector('.mg-score') as HTMLElement;

  const stacks: Crate[][] = Array.from({ length: COLS }, () => []);
  let next = newCrate();
  let falling: { crate: Crate; x: number; y: number; vy: number; col: number } | null = null;
  let t = 0;
  let windOffset = 0;
  let score = 0;
  let loadedWeight = 0;
  let lost = 0;
  let broken = 0;
  let running = false;
  let tilt = 0;
  const splashes: { x: number; t: number }[] = [];

  function newCrate(): Crate {
    const r = Math.random();
    return { weight: r < 0.45 ? 1 : r < 0.8 ? 2 : 3, fragile: Math.random() < tuning.fragile, broken: false };
  }

  const colCenter = (c: number) => DECK_X + c * COL_W + COL_W / 2;
  const hookX = () => {
    const swing = (Math.sin(t * speed) + 1) / 2;
    return DECK_X + 6 + swing * (COLS * COL_W - 12) + windOffset;
  };
  const torque = () => {
    let sum = 0;
    stacks.forEach((s, c) => s.forEach((cr) => (sum += (cr.broken ? 0 : cr.weight) * (c - (COLS - 1) / 2))));
    return sum;
  };

  function drop(): void {
    if (!running || falling) return;
    const x = hookX();
    const col = Math.floor((x - DECK_X) / COL_W);
    falling = { crate: next, x, y: HOOK_Y + 20, vy: 0, col };
    next = newCrate();
  }

  function land(): void {
    const f = falling!;
    falling = null;
    if (f.col < 0 || f.col >= COLS || stacks[f.col].length >= MAX_STACK) {
      lost++;
      score -= 5;
      splashes.push({ x: f.x, t: 0 });
      sfx('splash');
      return;
    }
    const stack = stacks[f.col];
    const below = stack[stack.length - 1];
    if (below && below.fragile && !below.broken) {
      below.broken = true;
      broken++;
      score -= 20;
    }
    stack.push(f.crate);
    sfx('drop');
    score += f.crate.weight * 10;
    loadedWeight += f.crate.weight;
    // Too much lean: the top crate on the heavy side slides into the river.
    let tq = torque();
    while (Math.abs(tq) > limit) {
      const side = tq > 0 ? 1 : -1;
      const cols = side > 0 ? [5, 4, 3] : [0, 1, 2];
      const c = cols.find((i) => stacks[i].length > 0);
      if (c === undefined) break;
      const fell = stacks[c].pop()!;
      lost++;
      score -= 15 + fell.weight * 10;
      loadedWeight -= fell.weight;
      splashes.push({ x: colCenter(c) + side * 40, t: 0 });
      sfx('splash');
      tq = torque();
    }
  }

  function drawCrate(x: number, y: number, c: Crate): void {
    const shade = [0, '#b08a5a', '#8a6236', '#5e3e1e'][c.weight] as string;
    ctx.fillStyle = c.broken ? '#4a3a30' : shade;
    ctx.fillRect(x - COL_W / 2 + 3, y - CRATE_H, COL_W - 6, CRATE_H - 2);
    ctx.strokeStyle = c.fragile ? '#c0392b' : '#2a1a0e';
    ctx.lineWidth = c.fragile ? 3 : 2;
    ctx.strokeRect(x - COL_W / 2 + 3, y - CRATE_H, COL_W - 6, CRATE_H - 2);
    ctx.fillStyle = '#f1e6c8';
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(c.broken ? 'x' : `${c.weight}t`, x, y - CRATE_H / 2 + 4);
  }

  function draw(): void {
    ctx.fillStyle = '#1b2228';
    ctx.fillRect(0, 0, W, H);
    // Crane
    ctx.fillStyle = '#2a2c30';
    ctx.fillRect(0, 40, W, 10);
    const hx = hookX();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, 50);
    ctx.lineTo(hx, HOOK_Y);
    ctx.stroke();
    if (running && !falling) drawCrate(hx, HOOK_Y + CRATE_H + 4, next);
    // Guide line
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(214,180,110,.35)';
    ctx.beginPath();
    ctx.moveTo(hx, HOOK_Y + CRATE_H + 8);
    ctx.lineTo(hx, DECK_Y - 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Barge, tilted by the load
    ctx.save();
    ctx.translate(W / 2, DECK_Y);
    ctx.rotate(tilt);
    ctx.translate(-W / 2, -DECK_Y);
    ctx.fillStyle = '#3a2a1e';
    ctx.beginPath();
    ctx.moveTo(DECK_X - 14, DECK_Y);
    ctx.lineTo(DECK_X + COLS * COL_W + 14, DECK_Y);
    ctx.lineTo(DECK_X + COLS * COL_W - 6, DECK_Y + 40);
    ctx.lineTo(DECK_X + 6, DECK_Y + 40);
    ctx.closePath();
    ctx.fill();
    stacks.forEach((s, c) => s.forEach((cr, i) => drawCrate(colCenter(c), DECK_Y - i * CRATE_H, cr)));
    ctx.restore();
    if (falling) drawCrate(falling.x, falling.y + CRATE_H, falling.crate);

    // Water
    ctx.fillStyle = 'rgba(35, 52, 58, .9)';
    ctx.fillRect(0, DECK_Y + 22 + Math.sin(t * 2) * 2, W, H);
    for (const sp of splashes) {
      ctx.strokeStyle = `rgba(200,220,230,${1 - sp.t})`;
      ctx.beginPath();
      ctx.arc(sp.x, DECK_Y + 26, 6 + sp.t * 30, Math.PI, 0);
      ctx.stroke();
    }

    // Balance meter
    const tq = torque();
    const mx = 40;
    const mw = W - 80;
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(mx, 16, mw, 8);
    const frac = Math.max(-1, Math.min(1, tq / limit));
    ctx.fillStyle = Math.abs(frac) > 0.75 ? '#c0503a' : '#d6b46e';
    ctx.fillRect(mx + mw / 2, 16, (frac * mw) / 2, 8);
    ctx.fillStyle = '#f1e6c8';
    ctx.fillRect(mx + mw / 2 - 1, 12, 2, 16);
  }

  return new Promise((resolve) => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (running) {
        t += dt;
        if (tuning.wind) windOffset = Math.sin(t * 0.7) * 18 + Math.sin(t * 2.3) * 8;
        if (falling) {
          falling.vy += 1400 * dt;
          falling.y += falling.vy * dt;
          const top = DECK_Y - stacks[Math.max(0, Math.min(COLS - 1, falling.col))].length * CRATE_H - CRATE_H;
          const offDeck = falling.col < 0 || falling.col >= COLS;
          if (falling.y >= (offDeck ? DECK_Y : top)) land();
        }
        const remaining = Math.max(0, DURATION - t);
        timeEl.textContent = `${Math.ceil(remaining)}s`;
        scoreEl.textContent = `${loadedWeight} tons`;
        if (remaining <= 0 && !falling) {
          running = false;
          finish();
          return;
        }
      }
      tilt += (Math.max(-1, Math.min(1, torque() / limit)) * 0.12 - tilt) * Math.min(1, dt * 6);
      splashes.forEach((s) => (s.t += dt * 1.5));
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drop();
    });
    el.querySelector('.mg-start')!.addEventListener('click', () => {
      (el.querySelector('.mg-intro') as HTMLElement).hidden = true;
      running = true;
    });

    function finish(): void {
      cancelAnimationFrame(raf);
      const tq = Math.abs(torque());
      const balanceBonus = Math.round((1 - Math.min(1, tq / limit)) * 20);
      const total = Math.max(0, score + balanceBonus);
      el.remove();
      resolve({
        percent: total / tuning.target,
        lines: [
          `${loadedWeight} tons loaded`,
          `${lost} crate${lost === 1 ? '' : 's'} lost to the river`,
          ...(tuning.fragile ? [`${broken} fragile crate${broken === 1 ? '' : 's'} broken`] : []),
          `Balance bonus ${balanceBonus}`,
        ],
      });
    }
  });
}
