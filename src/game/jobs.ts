import type { SkillId } from './state';

export type Grade = 'excellent' | 'good' | 'fair' | 'poor';

export const GRADE_INFO: Record<Grade, { name: string; payMult: number; points: number; xp: number }> = {
  excellent: { name: 'Excellent', payMult: 1.5, points: 3, xp: 40 },
  good: { name: 'Good', payMult: 1.2, points: 2, xp: 30 },
  fair: { name: 'Fair', payMult: 1.0, points: 1, xp: 20 },
  poor: { name: 'Poor', payMult: 0.6, points: -2, xp: 10 },
};

export const MISSED_POINTS = -3;
export const FIRED_AT = -6;
/** Days before an employer will take you back after firing you. */
export const REHIRE_BAN_DAYS = 7;

/** Autopilot pays one grade below the last played shift, and never above Good. */
export function autopilotGrade(last: Grade): Grade {
  const order: Grade[] = ['excellent', 'good', 'fair', 'poor'];
  return order[Math.min(order.length - 1, Math.max(1, order.indexOf(last) + 1))];
}

export function gradeFor(percent: number): Grade {
  if (percent >= 0.9) return 'excellent';
  if (percent >= 0.65) return 'good';
  if (percent >= 0.4) return 'fair';
  return 'poor';
}

export interface Rank {
  title: string;
  /** Title used for women where the period used a different word. */
  titleWoman?: string;
  /** Base pay per shift in pounds. */
  pay: number;
  /** Promotion points needed to reach this rank from the one below. */
  points: number;
  needMain: number;
  needSecond: number;
}

export interface JobDef {
  id: string;
  career: string;
  employer: string;
  boss: string;
  placeId: string;
  main: SkillId;
  second: SkillId;
  /** Shift start and end in minutes after midnight. */
  start: number;
  end: number;
  /** Days of the week the shift runs (0 = Sunday). */
  days: number[];
  /** Extra change on top of normal waking hours, over the whole shift. */
  strain: { hunger: number; rest: number; social: number };
  ranks: Rank[];
  /** What the boss says. */
  lines: { offer: string; hired: string[]; promoted: string; fired: string; absentFired: string; banned: string; quit: string };
  minigame: 'cargo' | 'bar';
}

/** Ranks follow the Story Bible's promotion table (rank 2: 10 pts, main 3; rank 3: 15 pts, main 5, second 2). */
export const JOBS: Record<string, JobDef> = {
  docks: {
    id: 'docks',
    career: 'Docks',
    employer: 'Dock Hiring Office',
    boss: 'Foreman Rudd',
    placeId: 'dockoffice',
    main: 'strength',
    second: 'charisma',
    start: 6 * 60,
    end: 14 * 60,
    days: [1, 2, 3, 4, 5, 6],
    strain: { hunger: -12, rest: -14, social: 6 },
    ranks: [
      { title: 'Mudlark', pay: 0.08, points: 0, needMain: 0, needSecond: 0 },
      { title: 'Dockhand', pay: 0.15, points: 10, needMain: 3, needSecond: 0 },
      { title: 'Stevedore', pay: 0.25, points: 15, needMain: 5, needSecond: 2 },
    ],
    minigame: 'cargo',
    lines: {
      offer: "Work? I need a mudlark: fetching, carrying, stacking what the real men won't. Six till two, Monday to Saturday. Eight pence a shift.",
      hired: [
        'Be here at six. Late is the same as absent, and absent twice is gone.',
        'Load the barge level. A barge that lists drops my cargo in the Thames, and then I drop you in after it.',
      ],
      promoted: "You've a back on you after all. From tomorrow you're {rank}. More pay, heavier crates, same river.",
      fired: "That's enough. Collect your pennies and don't come back this week.",
      absentFired: "You didn't turn up. Again. You're finished here. Don't come back this week.",
      banned: "You? After last time? Come back next week, if you've learned to set an alarm.",
      quit: "Suit yourself. There's ten behind you for every one that walks.",
    },
  },
  coppercup: {
    id: 'coppercup',
    career: 'The Copper Cup',
    employer: 'Copper Cup',
    boss: 'Bessa Hartigan',
    placeId: 'coppercup',
    main: 'charisma',
    second: 'strength',
    start: 18 * 60,
    end: 24 * 60,
    days: [0, 2, 3, 4, 5, 6],
    strain: { hunger: -6, rest: -10, social: 18 },
    ranks: [
      { title: 'Pot Washer', pay: 0.06, points: 0, needMain: 0, needSecond: 0 },
      { title: 'Potboy', titleWoman: 'Barmaid', pay: 0.1, points: 10, needMain: 3, needSecond: 0 },
      { title: 'Barkeep', pay: 0.18, points: 15, needMain: 5, needSecond: 2 },
    ],
    minigame: 'bar',
    lines: {
      offer: 'Short of hands? Always. I can start you washing pots. Six in the evening till midnight, every night but Monday. Sixpence a night, and you keep what the drunks drop.',
      hired: [
        "Smile at the regulars, water the gin for the strangers, and don't serve anyone who can't stand up.",
        "If a fight starts, you shout for me. If I'm busy, you finish it.",
      ],
      promoted: "The regulars like you, God knows why. You're {rank} from tomorrow night.",
      fired: "I can't keep you, love. You're costing me more than you earn.",
      absentFired: "You left me alone with a full house. Twice. Don't bother coming back this week.",
      banned: 'Not after what happened. Come back when the regulars have forgotten your face.',
      quit: "Fine. There's always some other poor soul wants the pots.",
    },
  },
};

export function rankTitle(job: JobDef, rank: number, gender: 'man' | 'woman'): string {
  const r = job.ranks[rank];
  return gender === 'woman' && r.titleWoman ? r.titleWoman : r.title;
}

/** True if two jobs' shifts overlap on any shared day. */
export function shiftsOverlap(a: JobDef, b: JobDef): boolean {
  const shared = a.days.some((d) => b.days.includes(d));
  return shared && a.start < b.end && b.start < a.end;
}

export interface Employment {
  jobId: string;
  /** Index into ranks. */
  rank: number;
  points: number;
  /** Last grade played at the current rank; skipping pays at this grade. */
  lastGrade: Grade | null;
  hiredDay: number;
  lastWorkedDay: number;
  shifts: number;
  /** Last day whose attendance has been checked. */
  checkedDay: number;
  /** Who recommended you, if anyone: their standing suffers if you're fired early. */
  recommendedBy?: string;
}

/** Game minute 0 is 07:00 on Sunday 1 October 1871 (day 0). */
export const dayIndex = (minutes: number) => Math.floor((minutes + 7 * 60) / (24 * 60));
export const minuteOfDay = (minutes: number) => (((minutes + 7 * 60) % 1440) + 1440) % 1440;
export const weekday = (day: number) => day % 7;

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => 60 + level * 25;

export function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
