/**
 * How dangerous each part of Saltwharf is, by place and hour. Lamps make things safer;
 * the Gazette's warning names the night's worst street, which is doubled.
 */
export interface Zone {
  id: string;
  name: string;
  x0: number; z0: number; x1: number; z1: number;
  /** 0 safe … 1 very dangerous, at full night. */
  base: number;
}

export const ZONES: Zone[] = [
  { id: 'hollow', name: 'the mouth of Hollow Lane', x0: 31, z0: 9, x1: 43, z1: 14, base: 0.85 },
  { id: 'court', name: 'Gull Court', x0: 0, z0: 15, x1: 7, z1: 24, base: 0.8 },
  { id: 'alley', name: "the alley behind Moss's", x0: 21, z0: 16, x1: 23, z1: 24, base: 0.9 },
  { id: 'lanes', name: 'the lanes off Quay Street', x0: 0, z0: 9, x1: 31, z1: 14, base: 0.6 },
  { id: 'yard', name: 'the boxing yard', x0: 27, z0: 16, x1: 31, z1: 24, base: 0.55 },
  { id: 'quay', name: 'the quay', x0: 0, z0: 4, x1: 31, z1: 6, base: 0.45 },
  { id: 'market', name: 'the market corner', x0: 8, z0: 17, x1: 16, z1: 24, base: 0.3 },
  { id: 'street', name: 'Quay Street', x0: 0, z0: 7, x1: 43, z1: 8, base: 0.25 },
  { id: 'backlane', name: 'Back Lane', x0: 0, z0: 23, x1: 43, z1: 26, base: 0.5 },
  { id: 'churchst', name: 'Church Street', x0: 0, z0: 32, x1: 43, z1: 34, base: 0.35 },
  { id: 'rope', name: 'Rope Walk west', x0: 32, z0: 15, x1: 43, z1: 16, base: 0.4 },
];

export const HOT_ZONES = ['court', 'alley', 'lanes', 'yard', 'quay', 'backlane', 'hollow'];

export function zoneAt(x: number, z: number): Zone | null {
  return ZONES.find((zn) => x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) ?? null;
}

/** 0 by day, rising through dusk to 1 after 22:00, easing after 04:00. */
export function nightFactor(hour: number): number {
  if (hour >= 22 || hour < 4) return 1;
  if (hour >= 19) return (hour - 19) / 3;
  if (hour < 6) return 1 - (hour - 4) / 2;
  return 0;
}

export function dangerAt(x: number, z: number, hour: number, hot: string, nearLamp: boolean): number {
  const zn = zoneAt(Math.floor(x), Math.floor(z));
  if (!zn) return 0;
  let d = zn.base * nightFactor(hour);
  if (zn.id === hot) d *= 2;
  if (nearLamp) d *= 0.5;
  return Math.min(1, d);
}

/** The named villains of Saltwharf. Visible, so you can see trouble and walk the other way. */
export const NOTORIOUS = {
  id: 'tully',
  name: 'Black Jack Tully',
  where: { x: 22, z: 20 },
  /** Out from 22:00 to 04:00. */
  from: 22,
  to: 4,
};
