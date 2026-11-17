const START = new Date(1871, 9, 1, 7, 0); // 1 October 1871, 07:00
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  /** End of the current month, when rent is due. */
  get rentDue(): Date {
    const d = this.date;
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  formatDate(d = this.date): string {
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  formatShortDate(d: Date): string {
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  formatTime(): string {
    const d = this.date;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
