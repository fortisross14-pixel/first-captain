import type { GameState } from './state';

/** Saltwharf's days: weather, feast days, the bosses' tempers and the strike. */
export type Weather = 'clear' | 'rain' | 'fog';

export const WEATHER_TEXT: Record<Weather, string> = {
  clear: 'Grey and dry, which in Saltwharf counts as fine.',
  rain: 'Rain off the estuary all day. Streets empty, gutters full.',
  fog: 'A fog bank on the river. Keep to the lamps; people go missing in fog.',
};

/** Fog grows likelier as autumn closes in. */
export function rollWeather(day: number, rand = Math.random): Weather {
  const r = rand();
  const fog = 0.14 + Math.min(0.14, day * 0.004);
  if (r < fog) return 'fog';
  if (r < fog + 0.26) return 'rain';
  return 'clear';
}

/** Day index (0 = 1 Oct 1871) to a calendar date. */
export const dateOf = (day: number) => new Date(1871, 9, 1 + day);

export interface Holiday {
  id: string;
  name: string;
  month: number;
  date: number;
  text: string;
}

export const HOLIDAYS: Holiday[] = [
  { id: 'hallows', name: 'All Hallows\' Eve', month: 9, date: 31, text: 'All Hallows\' Eve: turnip lanterns in the windows, and the dead walk where anyone can see them.' },
  { id: 'bonfire', name: 'Bonfire Night', month: 10, date: 5, text: 'Bonfire Night: a fire at the market from six, the Guy on top, potatoes in the ashes.' },
  { id: 'martinmas', name: 'Martinmas', month: 10, date: 11, text: 'Martinmas: hiring day. Bosses are generous, and the Copper Cup roasts a goose.' },
];

export function holidayOn(day: number): Holiday | null {
  const d = dateOf(day);
  return HOLIDAYS.find((h) => h.month === d.getMonth() && h.date === d.getDate()) ?? null;
}

/** Sunday: the open-air service at the market cross with Father Hale, 9:00–12:00. */
export const isSunday = (day: number) => dateOf(day).getDay() === 0;

/** A boss's temper today: the same all day, different each day. */
export type Mood = 'foul' | 'fair' | 'good';
export function bossMood(jobId: string, day: number, s: GameState): Mood {
  if (holidayOn(day)?.id === 'martinmas') return 'good';
  if (jobId === 'docks' && s.strike && day >= s.strike.day && day <= s.strike.until) return 'foul';
  const x = Math.sin((day + 3) * 91.17 + jobId.length * 13.7) * 43758.5453;
  const r = x - Math.floor(x);
  return r < 0.22 ? 'foul' : r > 0.78 ? 'good' : 'fair';
}

export const MOOD_PAY: Record<Mood, number> = { foul: 0.85, fair: 1, good: 1.15 };

export const MOOD_TEXT: Record<string, Record<Mood, string>> = {
  docks: {
    foul: 'Rudd is in a foul temper: the owners docked the gang. Pay is short today.',
    fair: 'Rudd is Rudd today.',
    good: 'Rudd is nearly cheerful: a fast ship and a fat bonus. Pay is up today.',
  },
  coppercup: {
    foul: 'Bessa is furious about the brewer\'s bill. She is watching the till.',
    fair: 'Bessa is in her usual voice: loud.',
    good: 'Bessa won at cards last night and is generous with it.',
  },
};

/** The dock strike: once, in the second or third week, for three days. */
export function strikeStarts(s: GameState, day: number, rand = Math.random): boolean {
  return !s.strike && day >= 9 && day <= 24 && rand() < 0.22;
}
