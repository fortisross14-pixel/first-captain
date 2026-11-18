import { ITEMS, gear, removeItem } from '../game/items';
import { sfx } from '../engine/sfx';
import { addNeed } from '../game/needs';
import type { GameState } from '../game/state';

export interface Enemy {
  name: string;
  hp: number;
  dmg: [number, number];
  hit: number;
  /** Lower means they lose their nerve sooner. */
  nerve: number;
}

export const ENEMIES: Record<string, Enemy> = {
  footpad: { name: 'Footpad', hp: 22, dmg: [3, 7], hit: 0.65, nerve: 70 },
  bruiser: { name: 'Dock bruiser', hp: 34, dmg: [5, 9], hit: 0.62, nerve: 100 },
  knife: { name: 'Man with a knife', hp: 18, dmg: [6, 11], hit: 0.6, nerve: 60 },
};

export type FightOutcome = 'won' | 'lost' | 'fled' | 'talked';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Turn-based street fight. Your Health is your life bar; it is changed directly.
 * You attack, guard, fight dirty (Cunning), talk them down (Charisma), use an item, or run (Cunning).
 */
export function runFight(root: HTMLElement, s: GameState, base: Enemy, intro: string, firstStrike = false): Promise<{ outcome: FightOutcome; xp: { strength: number; cunning: number; charisma: number } }> {
  const enemy = { ...base, maxHp: base.hp, morale: base.nerve, stunned: false };
  const sk = s.character.skills;
  const xp = { strength: 0, cunning: 0, charisma: 0 };
  let guarding = false;
  let over = false;

  const el = document.createElement('div');
  el.className = 'minigame fight';
  el.innerHTML = `
    <div class="fight-card enemy"><div class="fc-name"></div><div class="fc-bar"><i></i></div><div class="fc-sub"></div></div>
    <div class="fight-log"></div>
    <div class="fight-card you"><div class="fc-name">You</div><div class="fc-bar"><i></i></div><div class="fc-sub"></div></div>
    <div class="fight-actions">
      <button data-a="attack" class="primary">Strike</button>
      <button data-a="guard">Guard</button>
      <button data-a="dirty">Fight dirty</button>
      <button data-a="talk">Talk them down</button>
      <button data-a="item">Use item</button>
      <button data-a="flee">Run</button>
    </div>`;
  root.appendChild(el);
  const logEl = el.querySelector('.fight-log') as HTMLElement;
  /** Screen shake and a flash of light (your blow) or ember (theirs). */
  const jolt = (flash: 'flash-hit' | 'flash-hurt') => {
    el.classList.remove('shake', 'flash-hit', 'flash-hurt');
    void el.offsetWidth;
    el.classList.add('shake', flash);
  };
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('.fight-actions button')];

  const log = (text: string, cls = '') => {
    const p = document.createElement('p');
    p.textContent = text;
    if (cls) p.className = cls;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  };
  const render = () => {
    (el.querySelector('.enemy .fc-name') as HTMLElement).textContent = enemy.name;
    (el.querySelector('.enemy .fc-bar i') as HTMLElement).style.width = `${(Math.max(0, enemy.hp) / enemy.maxHp) * 100}%`;
    (el.querySelector('.enemy .fc-sub') as HTMLElement).textContent = enemy.morale < 35 ? 'Wavering' : enemy.stunned ? 'Dazed' : 'Spoiling for it';
    (el.querySelector('.you .fc-bar i') as HTMLElement).style.width = `${s.needs.health}%`;
    (el.querySelector('.you .fc-sub') as HTMLElement).textContent = `Health ${Math.round(s.needs.health)}`;
    const healing = s.inventory.some((i) => ITEMS[i.id].use?.health);
    for (const b of buttons) b.disabled = over || (b.dataset.a === 'item' && !healing);
  };

  return new Promise((resolve) => {
    const finish = (outcome: FightOutcome) => {
      over = true;
      render();
      const msg = { won: 'They stagger off into the fog.', lost: 'The cobbles come up to meet you.', fled: 'You run, and you do not look back.', talked: 'They spit, and let you be.' }[outcome];
      log(msg, 'big');
      const done = document.createElement('button');
      done.className = 'primary fight-done';
      done.textContent = 'Continue';
      done.addEventListener('click', () => {
        el.remove();
        resolve({ outcome, xp });
      });
      el.querySelector('.fight-actions')!.replaceChildren(done);
    };

    const enemyTurn = () => {
      if (over) return;
      if (enemy.hp <= enemy.maxHp * 0.4) enemy.morale -= 25;
      if (enemy.morale <= 0) return finish('won');
      if (enemy.stunned) {
        enemy.stunned = false;
        log(`${enemy.name} shakes their head, dazed.`);
        return render();
      }
      if (Math.random() < enemy.hit) {
        let d = rnd(enemy.dmg[0], enemy.dmg[1]);
        if (guarding) d *= 0.35;
        d = Math.round(d);
        addNeed(s.needs, 'health', -d);
        log(`${enemy.name} hits you. −${d} health.`, 'hurt');
        sfx('hurt');
        jolt('flash-hurt');
      } else log(`${enemy.name} swings and misses.`);
      guarding = false;
      if (s.needs.health <= 0) return finish('lost');
      render();
    };

    const act = (a: string) => {
      if (over) return;
      if (a === 'attack') {
        xp.strength += 6;
        if (Math.random() < 0.72 + sk.strength * 0.012) {
          const d = Math.round(rnd(4, 8) + sk.strength * 1.1 + gear(s).fight);
          enemy.hp -= d;
          enemy.morale -= 5;
          log(`You hit ${enemy.name}. −${d}.`, 'good');
          sfx('hit');
          jolt('flash-hit');
        } else log('You swing wide.');
      } else if (a === 'guard') {
        guarding = true;
        enemy.morale -= 4;
        log('You raise your fists and wait.');
      } else if (a === 'dirty') {
        xp.cunning += 6;
        if (Math.random() < 0.35 + sk.cunning * 0.045) {
          enemy.stunned = true;
          enemy.hp -= 4;
          log('A knee, an elbow, a fistful of grit in the eyes. They reel.', 'good');
        } else log('They see it coming.');
      } else if (a === 'talk') {
        xp.charisma += 6;
        const drop = Math.round(rnd(10, 22) + sk.charisma * 3);
        if (Math.random() < 0.55 + sk.charisma * 0.03) {
          enemy.morale -= drop;
          log('"Is this worth hanging for?" They hesitate.', 'good');
          if (enemy.morale <= 0) return finish('talked');
        } else log('They are past listening.');
      } else if (a === 'item') {
        const it = s.inventory.find((i) => ITEMS[i.id].use?.health);
        if (it) {
          const def = ITEMS[it.id];
          removeItem(s, it.id);
          addNeed(s.needs, 'health', def.use!.health!);
          log(`You use a ${def.name.toLowerCase()}. +${def.use!.health} health.`, 'good');
        }
      } else if (a === 'flee') {
        xp.cunning += 4;
        if (Math.random() < 0.35 + sk.cunning * 0.04 + sk.strength * 0.01) return finish('fled');
        log('They grab your collar as you turn.');
      }
      if (enemy.hp <= 0) return finish('won');
      enemyTurn();
    };

    buttons.forEach((b) => b.addEventListener('click', () => act(b.dataset.a!)));
    log(intro, 'big');
    if (firstStrike) enemyTurn();
    render();
  });
}
