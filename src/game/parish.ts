import type { GameState } from './state';
import type { Resident } from './residents';

/**
 * Parish politics: the first rungs toward running London. Ratepayers elect the Vestry of
 * St. Botolph-by-the-River; a vestryman can rise to churchwarden. Beyond that (the Board of
 * Works, Parliament, Mayor) lies outside Saltwharf, for later districts.
 */
export interface Office {
  name: string;
  /** Requirements to stand. */
  study: number;
  friends: number;
  deposit: number;
  /** Who stands against you, and the votes they start with. */
  rival: string;
  rivalVotes: number;
  text: string;
}

export const OFFICES: Office[] = [
  { name: 'Vestryman', study: 3, friends: 3, deposit: 0.2, rival: 'grubb', rivalVotes: 5, text: 'A seat on the Vestry: drains, lamps, the poor rate, and Mr. Grubb\'s face across the table.' },
  { name: 'Churchwarden', study: 6, friends: 6, deposit: 0.5, rival: 'moss', rivalVotes: 8, text: 'Keeper of the parish purse. Landlords and pawnbrokers start being polite.' },
];

export const FUTURE_OFFICES = ['Guardian of the Poor', 'Member of the Board of Works', 'Alderman', 'Lord Mayor'];

export interface Parish {
  /** Offices held: 0 none, 1 vestry, 2 churchwarden. */
  rank: number;
  /** An election underway: the day it is held. */
  standing: number | null;
  /** Residents who promised their vote. */
  pledges: string[];
  /** Undecided voters won by speeches. */
  crowd: number;
  lastSpeech: number;
}

export const officeTitle = (s: GameState, woman: boolean) => {
  if (s.parish.rank === 0) return '';
  const t = OFFICES[s.parish.rank - 1].name;
  return woman && t === 'Vestryman' ? 'Vestrywoman' : t;
};

/** Who can vote: everyone with a roof (so not Old Mag). */
export const voters = (all: Resident[]) => all.filter((r) => r.id !== 'mag');

/** Chance a resident pledges their vote when asked. */
export function pledgeChance(s: GameState, r: Resident, friendship: number, rivalry: number, dress: number): number {
  if (rivalry >= 25) return 0;
  const study = s.character.skills.study * 0.025;
  const charm = s.character.skills.charisma * 0.025;
  const cls = r.cls === 'middle' ? study * 1.5 : charm * 1.5;
  return Math.max(0.05, Math.min(0.95, 0.15 + friendship / 100 + cls + dress));
}

/** The count: pledges (most keep their word), the crowd, and the rival's own people. */
export function count(s: GameState, office: Office, rand = Math.random): { mine: number; theirs: number } {
  let mine = s.parish.crowd;
  for (const _ of s.parish.pledges) if (rand() < 0.85) mine++;
  const theirs = office.rivalVotes + Math.round(rand() * 3);
  return { mine, theirs };
}
