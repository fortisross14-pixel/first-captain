import type { Needs } from './state';

/** Change per game hour. */
const RATES = {
  awake: { hunger: -4.5, rest: -4, social: -3 },
  asleep: { hunger: -2, rest: 13, social: -1 },
  roughSleep: { hunger: -2, rest: 6, social: -1 },
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Advances needs by `hours` of game time. */
export function simulateNeeds(n: Needs, hours: number, mode: 'awake' | 'asleep' | 'roughSleep'): void {
  const r = RATES[mode];
  n.hunger = clamp(n.hunger + r.hunger * hours);
  n.rest = clamp(n.rest + r.rest * hours);
  n.social = clamp(n.social + r.social * hours);
  let health = 0;
  if (n.hunger <= 0) health -= 3;
  if (n.rest <= 0) health -= 3;
  if (mode === 'asleep' && n.hunger > 25) health += 1.5;
  n.health = clamp(n.health + health * hours);
}

export function addNeed(n: Needs, key: keyof Needs, amount: number): void {
  n[key] = clamp(n[key] + amount);
}
