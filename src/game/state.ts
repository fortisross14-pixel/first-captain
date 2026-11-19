import type { MissionState } from './missions';
import type { Look } from '../actors/characterModel';
import type { Employment } from './jobs';
import type { Relation } from './social';
import type { Outfit } from './items';
import type { Letter } from './letters';
import type { Fact, Pending } from './world';
import type { Quest } from './quests';
import type { Weather } from './calendar';
import type { Parish } from './parish';

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
  /** Day of birth, in game days (a year is 24 days). */
  birth?: number;
}

export interface Needs {
  hunger: number;
  rest: number;
  social: number;
  health: number;
}
export type NeedId = keyof Needs;
export const NEED_NAMES: Record<NeedId, string> = { hunger: 'Hunger', rest: 'Rest', social: 'Social', health: 'Health' };

export type LocationId = 'saltwharf' | 'hesterRoom' | `int:${string}`;
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
    /** What Grubb wants to let you back in after an eviction. */
    arrears: number;
  };
  /** False once Grubb has thrown you out. */
  housed: boolean;
  larderBread: number;
  tutorial: { step: TutorialStep; askedDocks: boolean; askedCup: boolean; slept: boolean };
  lastChatMinute: number;
  /** Up to two jobs. */
  jobs: Employment[];
  inventory: { id: string; qty: number }[];
  /** Upgrades bought for good. */
  owned: string[];
  /** Money when you last woke, for the day's summary. */
  dayStartMoney: number;
  /** Per-day flags for perks used ("bessa:12" = Bessa's free pint on day 12). */
  used: Record<string, number>;
  relations: Record<string, Relation>;
  /** Fights won or faced down; robbers think twice. */
  notoriety: number;
  lastRobberyDay: number;
  lastWitnessDay: number;
  /** Owed to the hospital; taken from your next money. */
  debt: number;
  outfit: Outfit;
  facts: Fact[];
  pending: Pending[];
  letters: Letter[];
  /** Fight Night: bouts won, and whether you hold the title. */
  ladder: number;
  champion: boolean;
  /** The street the Gazette warns about today. */
  hotZone: string;
  hesterLetters: number;
  /** Progress toward the next level of each skill. */
  skillXp: Record<SkillId, number>;
  /** Employer id → first day they will hire you again. */
  bans: Record<string, number>;
  // --- Saltwharf lives (M8 leftovers and M9) ---
  /** Favours neighbours have asked of you. */
  quests: Quest[];
  /** Today's weather, chosen overnight; tomorrow's for the Gazette's forecast. */
  weather: Weather;
  tomorrow: Weather;
  /** Everyone in London: hand-written residents and the generated population. */
  people: import('./population').PersonRec[];
  /** What you have learned about each person's life. */
  known: Record<string, { home?: boolean; work?: boolean; haunt?: boolean }>;
  /** Your own family: a spouse, children, an engagement, and those who came before. */
  family: {
    spouse?: string;
    engaged?: { with: string; day: number };
    children: string[];
    /** Trying for a baby; the day one is due. */
    trying?: boolean;
    due?: number;
    lastEvening?: number;
    /** Marital strain from neglect; at 12 with little love left, they leave. */
    strain: number;
    /** What you've taught each child: skill points they will inherit if they carry on. */
    taught: Record<string, Partial<Record<SkillId, number>>>;
    ancestors: { name: string; born: number; died: number; summary: string }[];
  };
  /** Hester's room: where every piece of furniture stands, and the colours. */
  home?: import('../world/furniture').HomeLayout;
  /** The main story and the Fog Clock. */
  story: import('./story').StoryState;
  /** Factions: deeds, membership, duty. */
  factions: import('./factions').FactionState;
  /** Weddings and funerals to come: who, and the day (at 11:00). */
  ceremonies: { kind: 'wedding' | 'funeral'; ids: string[]; names: string; day: number; attended?: boolean }[];
  /** A word put in for you with an employer: who, and when. */
  recommend: Record<string, { by: string; day: number }>;
  /** What you wear in each slot besides clothes: item ids. */
  equip: Partial<Record<'hat' | 'cloak' | 'neck' | 'wrist' | 'weapon', string>>;
  /** Condition of each outfit, 0–100. */
  wear: Record<Outfit, number>;
  /** Standing in the parish: the Vestry ladder. */
  parish: Parish;
  /** A dock strike, if one is on: the day it started and which side you took. */
  strike: { day: number; until: number; side: '' | 'picket' | 'scab'; won?: boolean } | null;
  /** Where you live: Hester's room, Gull Court or over the Copper Cup. */
  residence?: 'hester' | 'court' | 'cup';
  /** Tips already shown, by key. */
  tips?: Record<string, boolean>;
  /** Act I chapters and side stories, by mission id. */
  missions: Record<string, MissionState>;
  /** Permanent raise at the docks after a strike won. */
  dockRaise: number;
  /** Changes in the neighbourhood: who is sick, who is missing, until which day. */
  life: { sick: Record<string, number>; missing: Record<string, number>; confused: Record<string, number> };
}

const zeroSkills = (): Record<SkillId, number> => ({ study: 0, strength: 0, arts: 0, charisma: 0, cunning: 0, occult: 0 });

/** Fills in fields added after a save was written. */
function upgrade(s: GameState): GameState {
  const old = s as GameState & { job?: Employment | null; attendanceDay?: number };
  if (!s.jobs) {
    s.jobs = old.job ? [{ ...old.job, checkedDay: old.attendanceDay ?? old.job.hiredDay }] : [];
    delete old.job;
    delete old.attendanceDay;
  }
  s.inventory ??= [];
  s.skillXp ??= zeroSkills();
  s.bans ??= {};
  fillLives(s);
  return s;
}

/** Defaults for the fields added for a living Saltwharf. */
function fillLives(s: GameState): void {
  s.quests ??= [];
  s.people ??= [];
  s.known ??= {};
  s.recommend ??= {};
  s.ceremonies ??= [];
  s.story ??= { clock: 8, urgent: 0, trunk: false, name: false, medal: false, act1: 'locked', pages: 0 };
  s.factions ??= { deeds: {}, member: null, since: -1, dutyDue: -1, dutyDone: false, expelled: {} };
  s.family ??= { children: [], strain: 0, taught: {}, ancestors: [] };
  s.character.birth ??= -21 * 28;
  s.equip ??= {};
  s.weather ??= 'clear';
  s.tomorrow ??= 'clear';
  s.wear ??= { plain: 100, work: 100, sunday: 100, coat: 100 };
  s.parish ??= { rank: 0, standing: null, pledges: [], crowd: 0, lastSpeech: -1 };
  s.strike ??= null;
  s.missions ??= {};
  s.dockRaise ??= 0;
  s.life ??= { sick: {}, missing: {}, confused: {} };
}

const KEY = 'pale-lamps-save-v1';

export function newGame(character: Character): GameState {
  const s = {
    version: 1,
    character,
    money: 1.0,
    needs: { hunger: 60, rest: 85, social: 40, health: 90 },
    minutes: 0,
    location: 'hesterRoom',
    pos: { x: 1.5, z: 3.5 },
    rent: { amount: 0.3, dueMonth: 0, graceUntil: null, arrears: 0 },
    housed: true,
    larderBread: 3,
    tutorial: { step: 'intro', askedDocks: false, askedCup: false, slept: false },
    lastChatMinute: -9999,
    jobs: [],
    inventory: [],
    owned: [],
    dayStartMoney: 1.0,
    used: {},
    relations: {},
    notoriety: 0,
    lastRobberyDay: -1,
    lastWitnessDay: -1,
    debt: 0,
    outfit: 'plain',
    facts: [],
    pending: [],
    letters: [],
    ladder: 0,
    champion: false,
    hotZone: 'court',
    hesterLetters: 0,
    skillXp: zeroSkills(),
    bans: {},
  } as unknown as GameState;
  fillLives(s);
  return s;
}

/** Three save slots. The slot in play is remembered; old single saves move into slot 1. */
export const SLOTS = [1, 2, 3] as const;
const slotKey = (n: number) => `${KEY}-slot${n}`;
let slot = 1;
try {
  const old = localStorage.getItem(KEY);
  if (old && !localStorage.getItem(slotKey(1))) localStorage.setItem(slotKey(1), old);
  if (old) localStorage.removeItem(KEY);
  slot = Number(localStorage.getItem('pale-lamps-slot')) || 1;
} catch {
  /* storage unavailable */
}

export const currentSlot = () => slot;
export function useSlot(n: number): void {
  slot = n;
  try {
    localStorage.setItem('pale-lamps-slot', String(n));
  } catch {
    /* storage unavailable */
  }
}

export function saveGame(state: GameState, n = slot): boolean {
  try {
    (state as GameState & { savedAt?: number }).savedAt = Date.now();
    localStorage.setItem(slotKey(n), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(n = slot): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s && s.version === 1 && s.character ? upgrade(s) : null;
  } catch {
    return null;
  }
}

export function deleteSave(n = slot): void {
  try {
    localStorage.removeItem(slotKey(n));
  } catch {
    /* storage unavailable */
  }
}

/** What's in each slot, for the title screen. */
export function slotInfo(): ({ slot: number; name: string; day: number; money: number; savedAt: number; age: number } | null)[] {
  return SLOTS.map((n) => {
    const s = loadGame(n) as (GameState & { savedAt?: number }) | null;
    if (!s) return null;
    const day = Math.floor((s.minutes + 420) / 1440);
    return { slot: n, name: `${s.character.first} ${s.character.last}`, day, money: s.money, savedAt: s.savedAt ?? 0, age: Math.floor((day - (s.character.birth ?? -588)) / 28) };
  });
}

/** The slot saved most recently, for Continue. */
export function latestSlot(): number | null {
  const all = slotInfo().filter(Boolean) as NonNullable<ReturnType<typeof slotInfo>[number]>[];
  return all.length ? all.sort((a, b) => b.savedAt - a.savedAt)[0].slot : null;
}

export function fullName(c: Character): string {
  return `${c.first} ${c.last}`;
}
