import {
  FIRED_AT, GRADE_INFO, JOBS, MISSED_POINTS, REHIRE_BAN_DAYS, dayIndex, formatMinutes, minuteOfDay, weekday, xpToNext,
  type Grade, type JobDef,
} from './jobs';
import { MAX_SKILL, SKILL_INFO, type GameState, type SkillId } from './state';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** How early you may turn up, and how late before you count as absent. */
const EARLY = 30;
const LATE = 60;

export const dayStart = (day: number) => day * 1440 - 7 * 60;

export function currentJob(s: GameState): JobDef | null {
  return s.job ? JOBS[s.job.jobId] : null;
}

/** Whether a shift can start now. */
export function canStartShift(s: GameState): boolean {
  const job = currentJob(s);
  if (!job || !s.job) return false;
  const day = dayIndex(s.minutes);
  const m = minuteOfDay(s.minutes);
  return job.days.includes(weekday(day)) && s.job.lastWorkedDay !== day && m >= job.start - EARLY && m <= job.start + LATE;
}

export function nextShiftText(s: GameState): string {
  const job = currentJob(s);
  if (!job || !s.job) return '';
  if (canStartShift(s)) return 'Shift starts now';
  const today = dayIndex(s.minutes);
  const m = minuteOfDay(s.minutes);
  for (let d = today; d < today + 8; d++) {
    if (!job.days.includes(weekday(d))) continue;
    if (d === today && (m > job.start + LATE || s.job.lastWorkedDay === today)) continue;
    return `Next shift ${d === today ? 'today' : d === today + 1 ? 'tomorrow' : DAY_NAMES[weekday(d)]} ${formatMinutes(job.start)}`;
  }
  return '';
}

export function hire(s: GameState, jobId: string): void {
  const day = dayIndex(s.minutes);
  s.job = { jobId, rank: 0, points: 0, lastGrade: null, hiredDay: day, lastWorkedDay: -1, shifts: 0 };
  s.attendanceDay = Math.max(s.attendanceDay, day);
}

export function isBanned(s: GameState, jobId: string): number | null {
  const until = s.bans[jobId];
  return until !== undefined && dayIndex(s.minutes) < until ? until : null;
}

export function fire(s: GameState): void {
  if (!s.job) return;
  s.bans[s.job.jobId] = dayIndex(s.minutes) + REHIRE_BAN_DAYS;
  s.job = null;
}

/** Adds skill experience; returns messages for any levels gained. */
export function gainXp(s: GameState, skill: SkillId, xp: number): string[] {
  const out: string[] = [];
  s.skillXp[skill] += xp;
  while (s.character.skills[skill] < MAX_SKILL && s.skillXp[skill] >= xpToNext(s.character.skills[skill])) {
    s.skillXp[skill] -= xpToNext(s.character.skills[skill]);
    s.character.skills[skill]++;
    out.push(`${SKILL_INFO[skill].name} rose to ${s.character.skills[skill]}!`);
  }
  return out;
}

export interface ShiftReport {
  pay: number;
  points: number;
  levelUps: string[];
  promotedTo: string | null;
  fired: boolean;
}

/** Applies a finished shift: played with a grade, or skipped at the last grade. */
export function completeShift(s: GameState, grade: Grade, played: boolean): ShiftReport {
  const job = currentJob(s)!;
  const e = s.job!;
  const info = GRADE_INFO[grade];
  const rank = job.ranks[e.rank];
  const pay = Math.round(rank.pay * info.payMult * 100) / 100;
  const points = played ? info.points : 0;
  s.money = Math.round((s.money + pay) * 100) / 100;
  e.points += points;
  e.shifts++;
  e.lastWorkedDay = dayIndex(s.minutes);
  if (played) e.lastGrade = grade;
  const levelUps = [
    ...gainXp(s, job.main, played ? info.xp : 6),
    ...gainXp(s, job.second, Math.round((played ? info.xp : 6) / 2)),
  ];
  let promotedTo: string | null = null;
  const next = job.ranks[e.rank + 1];
  if (next && e.points >= next.points && s.character.skills[job.main] >= next.needMain && s.character.skills[job.second] >= next.needSecond) {
    e.rank++;
    e.points = 0;
    e.lastGrade = null;
    promotedTo = next.title;
  }
  const fired = e.points <= FIRED_AT;
  if (fired) fire(s);
  return { pay, points, levelUps, promotedTo, fired };
}

/** Counts shifts missed since the last check. Returns the number missed and whether you were fired. */
export function checkAttendance(s: GameState): { missed: number; fired: boolean } {
  const job = currentJob(s);
  const now = dayIndex(s.minutes);
  const lastClosed = minuteOfDay(s.minutes) > (job ? job.start + LATE : 0) ? now : now - 1;
  let missed = 0;
  if (job && s.job) {
    for (let d = s.attendanceDay + 1; d <= lastClosed; d++) {
      if (d <= s.job.hiredDay || !job.days.includes(weekday(d)) || s.job.lastWorkedDay === d) continue;
      missed++;
      s.job.points += MISSED_POINTS;
    }
  }
  s.attendanceDay = Math.max(s.attendanceDay, lastClosed);
  const fired = !!s.job && s.job.points <= FIRED_AT;
  if (fired) fire(s);
  return { missed, fired };
}

/** What the next promotion needs, for the journal. */
export function promotionText(s: GameState): string {
  const job = currentJob(s);
  if (!job || !s.job) return '';
  const next = job.ranks[s.job.rank + 1];
  if (!next) return 'Top rank in this slice.';
  const parts = [`${s.job.points} / ${next.points} points`];
  if (next.needMain) parts.push(`${SKILL_INFO[job.main].name} ${s.character.skills[job.main]} / ${next.needMain}`);
  if (next.needSecond) parts.push(`${SKILL_INFO[job.second].name} ${s.character.skills[job.second]} / ${next.needSecond}`);
  return `Next: ${next.title} (${parts.join(', ')})`;
}
