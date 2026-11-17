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
export const REHIRE_BAN_DAYS = 28;

export function gradeFor(percent: number): Grade {
  if (percent >= 0.9) return 'excellent';
  if (percent >= 0.65) return 'good';
  if (percent >= 0.4) return 'fair';
  return 'poor';
}

export interface Rank {
  title: string;
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
  /** Extra drain on top of normal waking hours, over the whole shift. */
  strain: { hunger: number; rest: number };
  ranks: Rank[];
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
    strain: { hunger: -12, rest: -14 },
    ranks: [
      { title: 'Mudlark', pay: 0.08, points: 0, needMain: 0, needSecond: 0 },
      { title: 'Dockhand', pay: 0.15, points: 10, needMain: 3, needSecond: 0 },
      { title: 'Stevedore', pay: 0.25, points: 15, needMain: 5, needSecond: 2 },
    ],
  },
};

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
