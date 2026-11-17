import {
  FIRED_AT, GRADE_INFO, JOBS, MISSED_POINTS, REHIRE_BAN_DAYS, dayIndex, formatMinutes, minuteOfDay, rankTitle,
  shiftsOverlap, weekday, xpToNext, type Employment, type Grade, type JobDef,
} from './jobs';
import { MAX_SKILL, SKILL_INFO, type GameState, type SkillId } from './state';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** How early you may turn up, and how late before you count as absent. */
const EARLY = 30;
const LATE = 60;
export const MAX_JOBS = 2;

export const dayStart = (day: number) => day * 1440 - 7 * 60;

export function employment(s: GameState, jobId: string): Employment | null {
  return s.jobs.find((j) => j.jobId === jobId) ?? null;
}

export function title(s: GameState, e: Employment): string {
  return rankTitle(JOBS[e.jobId], e.rank, s.character.gender);
}

/** Whether a shift of this job can start now. */
export function canStartShift(s: GameState, jobId: string): boolean {
  const job = JOBS[jobId];
  const e = employment(s, jobId);
  if (!e) return false;
  const day = dayIndex(s.minutes);
  const m = minuteOfDay(s.minutes);
  return job.days.includes(weekday(day)) && e.lastWorkedDay !== day && m >= job.start - EARLY && m <= job.start + LATE;
}

export function nextShiftText(s: GameState, jobId: string): string {
  const job = JOBS[jobId];
  const e = employment(s, jobId);
  if (!e) return '';
  if (canStartShift(s, jobId)) return 'shift starts now';
  const today = dayIndex(s.minutes);
  const m = minuteOfDay(s.minutes);
  for (let d = today; d < today + 8; d++) {
    if (!job.days.includes(weekday(d))) continue;
    if (d === today && (m > job.start + LATE || e.lastWorkedDay === today)) continue;
    return `next shift ${d === today ? 'today' : d === today + 1 ? 'tomorrow' : DAY_NAMES[weekday(d)]} ${formatMinutes(job.start)}`;
  }
  return '';
}

/** Why you can't take this job, or null if you can. */
export function hireBlocker(s: GameState, jobId: string): string | null {
  if (employment(s, jobId)) return 'already';
  if (isBanned(s, jobId) !== null) return 'banned';
  if (s.jobs.length >= MAX_JOBS) return 'full';
  if (s.jobs.some((e) => shiftsOverlap(JOBS[e.jobId], JOBS[jobId]))) return 'clash';
  return null;
}

export function hire(s: GameState, jobId: string): void {
  const day = dayIndex(s.minutes);
  s.jobs.push({ jobId, rank: 0, points: 0, lastGrade: null, hiredDay: day, lastWorkedDay: -1, shifts: 0, checkedDay: day });
}

export function isBanned(s: GameState, jobId: string): number | null {
  const until = s.bans[jobId];
  return until !== undefined && dayIndex(s.minutes) < until ? until : null;
}

export function leave(s: GameState, jobId: string, fired: boolean): void {
  if (fired) s.bans[jobId] = dayIndex(s.minutes) + REHIRE_BAN_DAYS;
  s.jobs = s.jobs.filter((j) => j.jobId !== jobId);
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
/** `day` is the day the shift started; a shift ending at midnight still belongs to it. */
export function completeShift(s: GameState, jobId: string, grade: Grade, played: boolean, day: number): ShiftReport {
  const job = JOBS[jobId];
  const e = employment(s, jobId)!;
  const info = GRADE_INFO[grade];
  const pay = Math.round(job.ranks[e.rank].pay * info.payMult * 100) / 100;
  const points = played ? info.points : 0;
  s.money = Math.round((s.money + pay) * 100) / 100;
  e.points += points;
  e.shifts++;
  e.lastWorkedDay = day;
  if (played) e.lastGrade = grade;
  const xp = played ? info.xp : 6;
  const levelUps = [...gainXp(s, job.main, xp), ...gainXp(s, job.second, Math.round(xp / 2))];
  let promotedTo: string | null = null;
  const next = job.ranks[e.rank + 1];
  if (next && e.points >= next.points && s.character.skills[job.main] >= next.needMain && s.character.skills[job.second] >= next.needSecond) {
    e.rank++;
    e.points = 0;
    e.lastGrade = null;
    promotedTo = title(s, e);
  }
  const fired = e.points <= FIRED_AT;
  if (fired) leave(s, jobId, true);
  return { pay, points, levelUps, promotedTo, fired };
}

/** Penalises shifts missed since the last check, for every job. */
export function checkAttendance(s: GameState): { job: JobDef; missed: number; fired: boolean }[] {
  const now = dayIndex(s.minutes);
  const out: { job: JobDef; missed: number; fired: boolean }[] = [];
  for (const e of [...s.jobs]) {
    const job = JOBS[e.jobId];
    const lastClosed = minuteOfDay(s.minutes) > job.start + LATE ? now : now - 1;
    let missed = 0;
    for (let d = e.checkedDay + 1; d <= lastClosed; d++) {
      if (d <= e.hiredDay || !job.days.includes(weekday(d)) || e.lastWorkedDay === d) continue;
      missed++;
      e.points += MISSED_POINTS;
    }
    e.checkedDay = Math.max(e.checkedDay, lastClosed);
    if (missed === 0) continue;
    const fired = e.points <= FIRED_AT;
    if (fired) leave(s, e.jobId, true);
    out.push({ job, missed, fired });
  }
  return out;
}

/** What the next promotion needs, for the journal. */
export function promotionText(s: GameState, jobId: string): string {
  const job = JOBS[jobId];
  const e = employment(s, jobId);
  if (!e) return '';
  const next = job.ranks[e.rank + 1];
  if (!next) return 'Top rank for now.';
  const parts = [`${e.points} / ${next.points} points`];
  if (next.needMain) parts.push(`${SKILL_INFO[job.main].name} ${s.character.skills[job.main]} / ${next.needMain}`);
  if (next.needSecond) parts.push(`${SKILL_INFO[job.second].name} ${s.character.skills[job.second]} / ${next.needSecond}`);
  return `Next: ${rankTitle(job, e.rank + 1, s.character.gender)} (${parts.join(', ')})`;
}
