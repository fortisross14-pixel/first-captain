import type { GameState } from './state';

/**
 * The world's memory. Things you do become facts; residents who saw them know them;
 * every night, gossip carries them through each resident's circles. What people know
 * changes how they treat you and sets off events.
 */
export type FactKind =
  | 'courting' // you are courting `about`
  | 'wronged' // you wronged `about` (insult, cheating, walking away)
  | 'helped' // you helped `about`
  | 'promoted' // a promotion; `note` is the new title
  | 'champion' // you won a Fight Night bout; `note` is the opponent
  | 'evicted'
  | 'scab' // you crossed the dockers' picket
  | 'elected'; // you won a seat; `note` is the office

export interface Fact {
  id: number;
  kind: FactKind;
  about?: string;
  note?: string;
  day: number;
  /** Residents who know. */
  knowers: string[];
}

/** Who talks to whom. A resident can be in several circles. */
export const CIRCLES: Record<string, string[]> = {
  docks: ['nell', 'rudd', 'tom', 'hannah'],
  cup: ['bessa', 'nell', 'jem', 'ruby', 'silas'],
  church: ['hale', 'pell', 'quill', 'hannah'],
  street: ['mag', 'ruby', 'jem', 'lizzie', 'moss', 'grubb', 'ashby'],
  kin: ['silas', 'ruby', 'moss'],
};

/** How readily each resident passes things on (0–1). */
export const GOSSIP: Record<string, number> = {
  ruby: 0.9, mag: 0.85, jem: 0.75, bessa: 0.65, lizzie: 0.5, grubb: 0.45, tom: 0.4, nell: 0.35,
  hannah: 0.35, pell: 0.3, moss: 0.3, hale: 0.15, quill: 0.15, silas: 0.25, rudd: 0.1, ashby: 0.2,
};

/** Residents whose wrongs the Hollow Lane Kin avenge. */
export const KIN_PROTECTED = ['silas', 'ruby'];

export interface Pending {
  kind: 'jealousy' | 'revenge' | 'congrats';
  who: string;
  about?: string;
  note?: string;
  day: number;
}

export function addFact(s: GameState, kind: FactKind, witnesses: string[], about?: string, note?: string): Fact {
  const day = Math.floor((s.minutes + 420) / 1440);
  // One fact per kind and subject: refresh it rather than pile up copies.
  let f = s.facts.find((x) => x.kind === kind && x.about === about && (kind !== 'promoted' || x.note === note));
  if (!f) {
    f = { id: (s.facts.at(-1)?.id ?? 0) + 1, kind, about, note, day, knowers: [] };
    s.facts.push(f);
  }
  f.day = day;
  for (const w of witnesses) if (!f.knowers.includes(w)) f.knowers.push(w);
  if (about && !f.knowers.includes(about) && kind !== 'courting') f.knowers.push(about);
  return f;
}

export const knows = (f: Fact, who: string) => f.knowers.includes(who);

const circlesOf = (who: string) => Object.values(CIRCLES).filter((c) => c.includes(who));

/** One night of gossip. Returns the residents who learned something, for events to check. */
export function spreadGossip(s: GameState, rand = Math.random): { fact: Fact; learner: string }[] {
  const learned: { fact: Fact; learner: string }[] = [];
  for (const f of s.facts) {
    for (const k of [...f.knowers]) {
      for (const circle of circlesOf(k)) {
        for (const other of circle) {
          if (other === k || f.knowers.includes(other)) continue;
          if (rand() < (GOSSIP[k] ?? 0.3) * 0.5) {
            f.knowers.push(other);
            learned.push({ fact: f, learner: other });
          }
        }
      }
    }
  }
  return learned;
}

/**
 * Consequences of what people learned overnight.
 * - Someone you are courting learns you court another: jealousy.
 * - Friends of someone you wronged cool on you; if the Kin protect them, revenge.
 * - Friends learn of a promotion: a letter of congratulations.
 */
export function reactions(s: GameState, learned: { fact: Fact; learner: string }[]): Pending[] {
  const day = Math.floor((s.minutes + 420) / 1440);
  const out: Pending[] = [];
  const rel = (id: string) => s.relations?.[id];
  for (const { fact, learner } of learned) {
    const r = rel(learner);
    if (fact.kind === 'courting' && fact.about && fact.about !== learner && r && r.romance >= 30) {
      if (!s.pending.some((p) => p.kind === 'jealousy' && p.who === learner)) out.push({ kind: 'jealousy', who: learner, about: fact.about, day });
    }
    if (fact.kind === 'wronged' && fact.about && fact.about !== learner && r) {
      // People side with their friends.
      r.friendship = Math.max(0, r.friendship - 5);
      r.rivalry = Math.min(100, r.rivalry + 3);
    }
    if (fact.kind === 'promoted' && r && r.friendship >= 30 && !s.pending.some((p) => p.kind === 'congrats' && p.who === learner && p.note === fact.note)) {
      out.push({ kind: 'congrats', who: learner, note: fact.note, day });
    }
  }
  // The Kin take note when someone they protect is wronged.
  for (const f of s.facts) {
    if (f.kind !== 'wronged' || !f.about) continue;
    if (KIN_PROTECTED.includes(f.about) && f.knowers.includes('silas') && f.day >= day - 3 && !s.pending.some((p) => p.kind === 'revenge' && p.about === f.about) && !s.used[`revenge:${f.about}:${f.day}`]) {
      s.used[`revenge:${f.about}:${f.day}`] = day;
      out.push({ kind: 'revenge', who: 'silas', about: f.about, day });
    }
  }
  s.pending.push(...out);
  return out;
}

/** What a resident knows about you, in words, for the People screen. */
export function knowledgeOf(s: GameState, who: string, nameOf: (id: string) => string): string[] {
  const out: string[] = [];
  for (const f of s.facts) {
    if (!knows(f, who)) continue;
    if (f.kind === 'courting' && f.about && f.about !== who) out.push(`knows you're courting ${nameOf(f.about)}`);
    if (f.kind === 'wronged' && f.about && f.about !== who) out.push(`heard how you treated ${nameOf(f.about)}`);
    if (f.kind === 'helped' && f.about && f.about !== who) out.push(`heard you helped ${nameOf(f.about)}`);
    if (f.kind === 'promoted') out.push(`heard you're ${f.note} now`);
    if (f.kind === 'champion') out.push(`saw you beat ${f.note}`);
    if (f.kind === 'evicted') out.push('knows Grubb threw you out');
    if (f.kind === 'scab') out.push('knows you crossed the picket');
    if (f.kind === 'elected') out.push(`voted you ${f.note}, or knows who did`);
  }
  return [...new Set(out)];
}
