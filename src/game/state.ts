import type { Look } from '../actors/characterModel';

export const SKILLS = ['study', 'strength', 'arts', 'charisma', 'cunning', 'occult'] as const;
export type SkillId = (typeof SKILLS)[number];

export const SKILL_INFO: Record<SkillId, { name: string; blurb: string }> = {
  study: { name: 'Study', blurb: 'Educated speech, contracts, clerk and press work' },
  strength: { name: 'Strength', blurb: 'Heavy labour, fights, a bigger load' },
  arts: { name: 'Arts & Crafts', blurb: 'Making, mending, music and painting' },
  charisma: { name: 'Charisma', blurb: 'Friends, romance, haggling, persuasion' },
  cunning: { name: 'Cunning', blurb: 'Stealth, lies, locks and street sense' },
  occult: { name: 'Occult', blurb: 'Sensing the dead, wards and rituals' },
};

export const START_SKILL_POINTS = 5;
export const MAX_SKILL = 20;

export type Gender = 'man' | 'woman';
export type Attraction = 'men' | 'women' | 'both';

export interface Character {
  first: string;
  last: string;
  gender: Gender;
  attraction: Attraction;
  look: Look;
  skills: Record<SkillId, number>;
}

export interface Needs {
  hunger: number;
  rest: number;
  social: number;
  health: number;
}
export type NeedId = keyof Needs;
export const NEED_NAMES: Record<NeedId, string> = { hunger: 'Hunger', rest: 'Rest', social: 'Social', health: 'Health' };

export type LocationId = 'saltwharf' | 'hesterRoom';
export type TutorialStep = 'intro' | 'explore' | 'done';

export interface GameState {
  version: 1;
  character: Character;
  money: number;
  needs: Needs;
  /** Game minutes since 1 Oct 1871 07:00. */
  minutes: number;
  location: LocationId;
  pos: { x: number; z: number };
  rent: {
    /** Monthly rent in pounds. */
    amount: number;
    /** Months since October 1871 that are paid for; rent for this month index is next due. */
    dueMonth: number;
    /** Game minute when the grace period ends, if rent is overdue. */
    graceUntil: number | null;
  };
  larderBread: number;
  tutorial: { step: TutorialStep; askedDocks: boolean; askedCup: boolean; slept: boolean };
  lastChatMinute: number;
}

const KEY = 'pale-lamps-save-v1';

export function newGame(character: Character): GameState {
  return {
    version: 1,
    character,
    money: 1.0,
    needs: { hunger: 60, rest: 85, social: 40, health: 90 },
    minutes: 0,
    location: 'hesterRoom',
    pos: { x: 1.5, z: 3.5 },
    rent: { amount: 0.6, dueMonth: 0, graceUntil: null },
    larderBread: 3,
    tutorial: { step: 'intro', askedDocks: false, askedCup: false, slept: false },
    lastChatMinute: -9999,
  };
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s && s.version === 1 && s.character ? s : null;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function fullName(c: Character): string {
  return `${c.first} ${c.last}`;
}
