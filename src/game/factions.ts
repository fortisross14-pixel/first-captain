import type { GameState, SkillId } from './state';

/**
 * Factions: who you belong to. Two for each class. One at a time: join, rise through
 * three ranks, do the weekly duty, keep the rules. Break faith and they punish you,
 * each in their own way. Joining one cools its rivals on you.
 */
export type FactionId = 'kin' | 'court' | 'brotherhood' | 'guild' | 'lantern' | 'society';

export interface Faction {
  id: FactionId;
  name: string;
  cls: 'low' | 'middle' | 'high';
  blurb: string;
  /** Residents who belong, and who can let you in. */
  members: string[];
  ranks: [string, string, string];
  /** Standing needed for each rank (the first is to join). */
  at: [number, number, number];
  needs: { skills?: Partial<Record<SkillId, number>>; money?: number; dress?: boolean; housed?: boolean };
  rules: string[];
  perks: string[];
  duty: string;
  punishment: string;
  rivals: FactionId[];
}

export const FACTIONS: Record<FactionId, Faction> = {
  kin: {
    id: 'kin', name: 'The Hollow Lane Kin', cls: 'low', members: ['silas', 'ruby'],
    blurb: 'Thieves, fences and their friends, from the courts off Hollow Lane. They look after their own and settle debts in the dark.',
    ranks: ['Runner', 'Hand', 'Lieutenant'], at: [20, 45, 75],
    needs: { skills: { cunning: 2, strength: 1 } },
    rules: ['Never talk to the constables', 'Never marry respectable', 'Pay back what the Kin are owed'],
    perks: ['Footpads leave you alone: robberies a third as likely', 'Silas fences anything at 80%, anywhere', 'Lieutenant: a cut of the week\'s takings (£0.10 on Mondays)'],
    duty: 'Collect a debt someone owes the Kin', punishment: 'They come for you at night', rivals: ['guild', 'society'],
  },
  court: {
    id: 'court', name: 'The Courtfolk', cls: 'low', members: ['mag', 'hannah', 'jem'],
    blurb: 'The poor of Gull Court, who have nothing and share it. Nobody is turned away; nobody is informed on.',
    ranks: ['Neighbour', 'One of the Court', 'Elder of the Court'], at: [15, 40, 70],
    needs: {},
    rules: ['Share what you have', 'Never inform', 'Never side with a landlord'],
    perks: ['Sleep rough unrobbed, with someone keeping watch', 'Free bread from the Court\'s pot once a day (ask Hannah)', 'Elder: the Court\'s gossip reaches you first; Gazette warnings come early'],
    duty: 'Put something in Mag\'s poor box (a loaf or £0.03)', punishment: 'Nobody watches over you, and the Court stops talking to you', rivals: ['society'],
  },
  brotherhood: {
    id: 'brotherhood', name: 'The Dockers\' Brotherhood', cls: 'middle', members: ['nell', 'tom'],
    blurb: 'A union in all but name: dockers and lightermen who stand together against the owners, and against Rudd when they must.',
    ranks: ['Brother', 'Steward', 'Chairman of the Brotherhood'], at: [20, 45, 75],
    needs: { skills: { strength: 2 } },
    rules: ['Never cross a picket', 'Pay your dues', 'Stand with a brother in a fight'],
    perks: ['A tenth more pay at the docks', 'Brothers come to your aid in night fights', 'Chairman: strikes you lead are likelier won'],
    duty: 'The Thursday meeting at the Copper Cup, 20:00 (dues £0.02)', punishment: 'Shunned on the quay: accidents happen to scabs', rivals: ['society', 'kin'],
  },
  guild: {
    id: 'guild', name: 'The Saltwharf Tradesmen\'s Guild', cls: 'middle', members: ['pell', 'lizzie', 'bessa', 'moss', 'grubb'],
    blurb: 'Shopkeepers, publicans and landlords: the respectable spine of Saltwharf, who keep accounts, keep up appearances and keep the Kin out.',
    ranks: ['Associate', 'Freeman', 'Warden of the Guild'], at: [20, 45, 75],
    needs: { money: 1, housed: true, skills: { study: 1 } },
    rules: ['Pay your dues', 'No thieving and no fences', 'Keep up appearances'],
    perks: ['A tenth off at Pell\'s, Moss\'s and Rag & Bone', 'Grubb gives Guild members a fortnight\'s grace on rent', 'Warden: the Guild lends you money at need (£1, once)'],
    duty: 'The Friday guild supper at the Copper Cup, 19:00 (dues £0.05)', punishment: 'Guild shops charge you a third more, and Grubb stops being patient', rivals: ['kin'],
  },
  lantern: {
    id: 'lantern', name: 'The Lantern Society', cls: 'high', members: ['hale', 'quill', 'ashby'],
    blurb: 'A learned society that meets in the vestry of St. Botolph\'s: natural philosophy, local history, and lately, the fog. Some of its members have stopped laughing about the old stories.',
    ranks: ['Correspondent', 'Fellow', 'Keeper of the Lantern'], at: [20, 45, 75],
    needs: { skills: { study: 4 } },
    rules: ['Write for the Society each week', 'Share what you learn', 'Tell no one outside about the fog papers'],
    perks: ['Reading and lessons teach a quarter more', 'Borrow books: Hester\'s table counts as a bookshelf', 'Keeper: the Society\'s fog papers (the main story) open to you'],
    duty: 'Write an essay for the Society at Hester\'s table (1 hour)', punishment: 'Hale and Quill stop teaching you', rivals: [],
  },
  society: {
    id: 'society', name: 'Lady Vane\'s circle', cls: 'high', members: [],
    blurb: 'Ashcombe Square: money, manners and Mr. Vane\'s white lamps. Admission by invitation only. They do not visit Saltwharf; Saltwharf is visited upon.',
    ranks: ['Guest', 'Member', 'Patron'], at: [20, 45, 75],
    needs: { skills: { study: 6, charisma: 4 }, money: 3, dress: true, housed: true },
    rules: ['Attend Lady Vane\'s Saturdays', 'Marry well, or not at all', 'Never be seen with the Kin'],
    perks: ['The middling sort defer to you: better first impressions', 'Investments: wealthy friends pay you £0.15 on Mondays', 'Patron: the Vane Company\'s doors open (the main story)'],
    duty: 'Lady Vane\'s Saturday soirée: a carriage waits at the west end of Quay Street, 19:00', punishment: 'A letter reaches your employer, and you are let go', rivals: ['kin', 'court', 'brotherhood'],
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

export interface FactionState {
  /** Deeds: what you have done for or against each faction. */
  deeds: Partial<Record<FactionId, number>>;
  /** Your faction, if any. */
  member: FactionId | null;
  since: number;
  /** The day this week's duty is due, and whether it's done. */
  dutyDue: number;
  dutyDone: boolean;
  /** The debtor to collect from (Kin duty). */
  debtor?: string;
  /** Factions that have thrown you out, and until when they won't have you back. */
  expelled: Partial<Record<FactionId, number>>;
  /** A pending invitation letter has arrived (the society). */
  invited?: boolean;
  /** Warden's loan taken. */
  loan?: boolean;
}

export const newFactionState = (): FactionState => ({ deeds: {}, member: null, since: -1, dutyDue: -1, dutyDone: false, expelled: {} });

/** Standing: your deeds plus how the members feel about you. */
export function standing(s: GameState, f: FactionId): number {
  const def = FACTIONS[f];
  const rels = def.members.map((m) => s.relations?.[m]).filter(Boolean);
  const warmth = rels.length ? rels.reduce((a, r) => a + r!.friendship - r!.rivalry, 0) / rels.length : 0;
  return Math.round((s.factions.deeds[f] ?? 0) + warmth * 0.5);
}

export function rankIn(s: GameState, f: FactionId): number {
  const st = standing(s, f);
  const at = FACTIONS[f].at;
  return st >= at[2] ? 2 : st >= at[1] ? 1 : 0;
}

/** What still stands between you and joining. */
export function joinBlockers(s: GameState, f: FactionId, dressed: boolean): string[] {
  const def = FACTIONS[f];
  const out: string[] = [];
  const day = Math.floor((s.minutes + 420) / 1440);
  if ((s.factions.expelled[f] ?? -1) > day) out.push('they threw you out, and remember it');
  if (standing(s, f) < def.at[0]) out.push(`standing ${def.at[0]} with them (you have ${standing(s, f)})`);
  for (const [k, v] of Object.entries(def.needs.skills ?? {})) if (s.character.skills[k as SkillId] < v!) out.push(`${k[0].toUpperCase()}${k.slice(1)} ${v}`);
  if (def.needs.money && s.money < def.needs.money) out.push(`£${def.needs.money.toFixed(2)} in your purse`);
  if (def.needs.dress && !dressed) out.push('respectable clothes');
  if (def.needs.housed && !s.housed) out.push('a roof of your own');
  return out;
}

export function addDeed(s: GameState, f: FactionId, n: number): void {
  s.factions.deeds[f] = (s.factions.deeds[f] ?? 0) + n;
}

/** Which faction a resident belongs to. */
export function factionOf(id: string): FactionId | null {
  return FACTION_IDS.find((f) => FACTIONS[f].members.includes(id)) ?? null;
}
