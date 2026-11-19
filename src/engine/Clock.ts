const START = new Date(1871, 9, 1, 7, 0); // Sunday, the first day of autumn 1871, 07:00
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SEASONS = ['Autumn', 'Winter', 'Spring', 'Summer'] as const;

/**
 * Saltwharf's year: 28 days, a week for each season, starting with autumn.
 * Day 0 is a Sunday. Rent falls due every Sunday.
 */
export const dayOfMinutes = (minutes: number) => Math.floor((minutes + 7 * 60) / 1440);
export const seasonOf = (day: number) => SEASONS[Math.floor(day / 7) % 4];
export const yearOf = (day: number) => 1871 + Math.floor((day + 14) / 28);
export const weekdayName = (day: number) => DAYS[((day % 7) + 7) % 7];
/** "Tue · Winter 1871" */
export const formatDay = (day: number, withYear = true) => `${weekdayName(day)} · ${seasonOf(day)}${withYear ? ` ${yearOf(day)}` : ''}`;

/** In-game clock. At 1× speed one real second is one game minute, so a day lasts 24 minutes. */
export class Clock {
  static readonly SPEEDS = [1, 10, 60];
  /** Game minutes elapsed since the start. */
  minutes = 0;
  speedIndex = 0;

  get speed(): number {
    return Clock.SPEEDS[this.speedIndex];
  }

  cycleSpeed(): number {
    this.speedIndex = (this.speedIndex + 1) % Clock.SPEEDS.length;
    return this.speed;
  }

  tick(realSeconds: number): void {
    this.minutes += realSeconds * this.speed;
  }

  get date(): Date {
    return new Date(START.getTime() + this.minutes * 60_000);
  }

  /** Hour of day as a fraction, 0–24. */
  get hour(): number {
    const d = this.date;
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  get day(): number {
    return dayOfMinutes(this.minutes);
  }

  /** The next Sunday, when rent is collected (as a day index). */
  get rentDueDay(): number {
    return (Math.floor(this.day / 7) + 1) * 7;
  }

  formatDate(day = this.day): string {
    return formatDay(day);
  }

  /** A day index, short: "Tue · Winter". */
  formatShortDate(day: number): string {
    return formatDay(day, false);
  }

  formatTime(): string {
    const d = this.date;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
