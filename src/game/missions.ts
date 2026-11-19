import type { GameState, SkillId } from './state';
import { SKILL_INFO } from './state';
import { isFood } from './items';

/**
 * Story missions: Act I's five chapters, and the side stories of Saltwharf.
 * Each stage says what to do and the ways to do it. Most have two or more: talk or fight,
 * friendship or skill, money or nerve. The journal shows them all, ticked when you qualify.
 * What happens is played out in Game; this file is the script and the bookkeeping.
 */

export type Req =
  | { skill: SkillId; level: number }
  | { friend: string; level: number }
  | { money: number }
  | { note: string; ok?: (s: GameState) => boolean };

export interface Way {
  text: string;
  /** Any one of these qualifies. None: anyone can. */
  any?: Req[];
  /** Ticked off (for "two of three" stages). */
  done?: (m: MissionState) => boolean;
}

export interface Stage {
  objective: string | ((m: MissionState, s: GameState) => string);
  ways?: Way[];
}

export interface MissionDef {
  id: string;
  kind: 'main' | 'side';
  title: string;
  /** Who it comes from (resident id), shown in the journal. */
  giver: string;
  blurb: string;
  /** Side stories: what must be true before it is offered. All of these. */
  opens?: Req[];
  /** Side stories: also needs this (a chapter done, a strike on). */
  when?: (s: GameState) => boolean;
  /** The rumour you hear before you qualify. */
  rumour?: string;
  /** Opened by events, not offered by the giver. */
  auto?: boolean;
  stages: Stage[];
}

export interface MissionState {
  stage: number;
  started: number;
  done?: boolean;
  /** How it ended: 'word', 'steel', 'coin', 'failed', ... */
  outcome?: string;
  flags: Record<string, number>;
}

const sk = (skill: SkillId, level: number): Req => ({ skill, level });
const fr = (friend: string, level: number): Req => ({ friend, level });

export const MISSIONS: MissionDef[] = [
  // --- Act I, "The Fog" ---------------------------------------------------------
  {
    id: 'a1c1', kind: 'main', title: 'I. Hester\'s Room', giver: 'pembleton',
    blurb: 'Your aunt left you a room, a ghost, and a trunk that will not open.',
    stages: [{
      objective: 'Open Hester\'s trunk, in your room.',
      ways: [
        { text: 'The lock wants the sight', any: [sk('occult', 2)] },
        { text: 'Or wait: Pembleton says the fog will open it for you', any: [{ note: 'Fog Clock 25, someone missing, or Hester\'s third letter', ok: (s) => s.hesterLetters >= 3 || s.story.clock >= 25 || Object.keys(s.life.missing).length > 0 }] },
      ],
    }],
  },
  {
    id: 'a1c2', kind: 'main', title: 'II. The First to Vanish', giver: 'lizzie',
    blurb: 'Tom Fairley walked home through the fog and never arrived.',
    stages: [
      { objective: (m) => (m.flags.vanish ? 'Tom didn\'t come home last night. Lizzie at Rag & Bone is asking everyone. Talk to her.' : 'Read Hester\'s journal, keep her watch close, and get some sleep. Something will happen tonight.') },
      {
        objective: 'Find whoever saw Tom last. Lizzie thinks Ruby, who sells flowers on Rope Walk.',
        ways: [
          { text: 'Charm it out of her', any: [sk('charisma', 3)] },
          { text: 'Ask her as a friend', any: [fr('ruby', 15)] },
          { text: 'Lean on her (she won\'t like it)', any: [sk('strength', 3)] },
        ],
      },
      {
        objective: 'Ruby saw Tom follow a white light along the quay. After 22:00, find the drowned man there: Hester\'s watch will point the way, if you can read it.',
        ways: [
          { text: 'Read the watch yourself', any: [sk('occult', 2)] },
          { text: 'Ask Old Mag to read it with you', any: [fr('mag', 10)], done: (m) => !!m.flags.mag },
        ],
      },
    ],
  },
  {
    id: 'a1c3', kind: 'main', title: 'III. A Name for the Drowned', giver: 'tom',
    blurb: 'The thing on the quay kept saying a ship\'s name: Kittiwake.',
    stages: [{
      objective: (m) => `Find who drowned off the Kittiwake. Any two of three records will do (${['mag', 'rudd', 'hale'].filter((k) => m.flags[k]).length} of 2).`,
      ways: [
        { text: 'Old Mag\'s memory: be her friend, or bring her something to eat', any: [fr('mag', 10), { note: 'food in your bag', ok: (s) => s.inventory.some((i) => isFood(i.id)) }], done: (m) => !!m.flags.mag },
        { text: 'Rudd\'s tally book at the Hiring Office: his trust, or read it upside down across the desk', any: [fr('rudd', 15), sk('cunning', 3)], done: (m) => !!m.flags.rudd },
        { text: 'The burial register at St. Botolph\'s: read the old hand, or have Father Hale read it to you', any: [sk('study', 2), fr('hale', 15)], done: (m) => !!m.flags.hale },
      ],
    }],
  },
  {
    id: 'a1c4', kind: 'main', title: 'IV. The Gallantry Medal', giver: 'moss',
    blurb: 'Jack Merrow\'s widow pawned his medal to pay for an empty coffin.',
    stages: [
      { objective: 'Ask Moss the pawnbroker about Jack Merrow\'s medal.' },
      {
        objective: 'Moss sold it on to Silas Crane, who deals in what the dead leave behind. Silas keeps to the Hollow Lane end of Saltwharf. Get it from him.',
        ways: [
          { text: 'Buy it: £0.80 (£0.30 to the Kin\'s own)', any: [{ money: 0.3 }] },
          { text: 'Talk him round', any: [sk('charisma', 3)] },
          { text: 'Take it from him (the Kin will remember)', any: [sk('strength', 4)] },
        ],
      },
    ],
  },
  {
    id: 'a1c5', kind: 'main', title: 'V. The Quay at Night', giver: 'pembleton',
    blurb: 'The first of the new dead, and the strongest. End it, one way or another.',
    stages: [{
      objective: 'Face Jack Merrow on the quay after 22:00, and put him to rest.',
      ways: [
        { text: 'Give him back his name and his medal (sure with either; a gamble without)', any: [sk('occult', 3), sk('charisma', 3)] },
        { text: 'Put him down with iron and fists (the Lamplighters help their own)', any: [sk('strength', 4)] },
        { text: 'Pay Silas and the Kin to take him away: £1.50', any: [{ money: 1.5 }] },
      ],
    }],
  },

  // --- Side stories -----------------------------------------------------------
  {
    id: 'letters', kind: 'side', title: 'Letters for Lizzie', giver: 'tom',
    blurb: 'Tom has loved Lizzie Barlow since he was nine. He has never managed to say so, and Lizzie has a secret of her own.',
    opens: [{ note: 'Study 2 or Arts & Crafts 2', ok: (s) => s.character.skills.study >= 2 || s.character.skills.arts >= 2 }],
    when: (s) => !!s.missions.a1c2?.done,
    rumour: 'Tom wants something written, or made, for Lizzie. Needs Study 2 or Arts & Crafts 2.',
    stages: [
      {
        objective: 'Make Tom\'s love token at Hester\'s table at home (1 hour).',
        ways: [
          { text: 'Write the letter he can\'t', any: [sk('study', 2)] },
          { text: 'Press a flower card instead', any: [sk('arts', 2)] },
        ],
      },
      { objective: 'Give it to Lizzie at Rag & Bone, and watch her face.' },
      { objective: 'Tell Tom what Lizzie said.' },
    ],
  },
  {
    id: 'ruby', kind: 'side', title: 'Ruby\'s Debt', giver: 'ruby',
    blurb: 'A pound borrowed from the Kin is never a pound for long.',
    opens: [fr('ruby', 10)],
    rumour: 'Ruby looks frightened whenever the Kin go by. Needs Friendship 10 with Ruby.',
    stages: [{
      objective: 'Ruby owes the Kin £1.00, and Skint Joe collects after dark. Settle it.',
      ways: [
        { text: 'Pay Silas the £1.00 yourself', any: [{ money: 1 }] },
        { text: 'Talk Silas into writing it off', any: [sk('charisma', 3)] },
        { text: 'Wait with Ruby on Rope Walk after 21:00 and see Skint Joe off', any: [sk('strength', 3)] },
      ],
    }],
  },
  {
    id: 'bruiser', kind: 'side', title: 'The Hollow Lane Bruiser', giver: 'nell',
    blurb: 'Big Dan Sallow wants the yard\'s belt, and he doesn\'t fight clean.',
    opens: [sk('strength', 4)],
    rumour: 'Nell needs a sparring partner who can take a punch. Needs Strength 4.',
    stages: [
      { objective: (m) => `Spar with Nell at the boxing yard, from dawn until ten (${m.flags.spar ?? 0} of 3 sessions, one a day).` },
      {
        objective: 'Dan Sallow fights Nell on Saturday\'s fight night (from 20:00). Make it a fair fight.',
        ways: [
          { text: 'Search Dan\'s kit at the Copper Cup some evening, for loaded gloves', any: [sk('cunning', 3)], done: (m) => !!m.flags.gloves },
          { text: 'Stand in Nell\'s corner and deal with his seconds', any: [sk('strength', 4)] },
        ],
      },
    ],
  },
  {
    id: 'strike', kind: 'side', title: 'Out on the Stones', giver: 'nell', auto: true,
    blurb: 'The dockers are out. The owners have sent for men from Wapping.',
    when: (s) => !!s.strike && s.strike.won === undefined,
    stages: [{
      objective: 'Win the strike before the three days are out, or don\'t.',
      ways: [
        { text: 'Speak for the men to the owners\' agent at the Hiring Office', any: [sk('charisma', 3)] },
        { text: 'Hold the gate against the Wapping men at dawn', any: [sk('strength', 3)] },
        { text: 'Stand on the picket and hope (or cross it, for double pay)' },
      ],
    }],
  },
  {
    id: 'pump', kind: 'side', title: 'The Back Lane Pump', giver: 'quill',
    blurb: 'A fever is going through Back Lane, one house at a time.',
    opens: [sk('study', 2)],
    rumour: 'Dr. Quill needs a helper who can read and keep records. Needs Study 2.',
    stages: [
      { objective: (m) => `Bring Dr. Quill remedies for the sick: bandages, tonic or broth (${m.flags.given ?? 0} of 2).` },
      {
        objective: 'Find where the fever comes from.',
        ways: [
          { text: 'Map the cases at Hester\'s table at home (1 hour)', any: [sk('study', 3)] },
          { text: 'Or knock on Back Lane doors and ask (3 houses)', done: (m) => (m.flags.knocks ?? 0) >= 3 },
        ],
      },
      {
        objective: 'It\'s the Back Lane pump. Stop people drinking from it.',
        ways: [
          { text: 'Persuade Father Hale to have the vestry chain it', any: [sk('charisma', 3)] },
          { text: 'Wrench the handle off yourself, after dark', any: [sk('strength', 3)] },
        ],
      },
    ],
  },
  {
    id: 'cellar', kind: 'side', title: 'Bessa\'s Cellar', giver: 'bessa',
    blurb: 'The Copper Cup\'s brandy has never seen a customs house.',
    opens: [fr('bessa', 10), { note: 'Strength 3 or Charisma 3', ok: (s) => s.character.skills.strength >= 3 || s.character.skills.charisma >= 3 }],
    rumour: 'Bessa needs help with a delivery, the quiet kind. Needs Friendship 10 with Bessa, and Strength 3 or Charisma 3.',
    stages: [{
      objective: (m) => `Run Kin brandy from the Wherry Stairs to the Copper Cup's cellar, after 22:00 (${m.flags.runs ?? 0} of 3 runs, one a night).`,
      ways: [
        { text: 'Carry two kegs at a time and outpace the constable', any: [sk('strength', 3)] },
        { text: 'Keep the constable talking while the boat unloads', any: [sk('charisma', 3)] },
      ],
    }],
  },
];

export const MISSION = (id: string) => MISSIONS.find((m) => m.id === id)!;
export const MAIN_IDS = MISSIONS.filter((m) => m.kind === 'main').map((m) => m.id);

export function reqMet(s: GameState, r: Req): boolean {
  if ('skill' in r) return s.character.skills[r.skill] >= r.level;
  if ('friend' in r) return (s.relations[r.friend]?.friendship ?? 0) >= r.level;
  if ('money' in r) return s.money + 1e-9 >= r.money;
  return r.ok ? r.ok(s) : false;
}

export function reqText(s: GameState, r: Req, name: (id: string) => string): string {
  if ('skill' in r) return `${SKILL_INFO[r.skill].name} ${r.level} (you ${s.character.skills[r.skill]})`;
  if ('friend' in r) return `Friendship ${r.level} with ${name(r.friend)} (${Math.round(s.relations[r.friend]?.friendship ?? 0)})`;
  if ('money' in r) return `£${r.money.toFixed(2)}`;
  return r.note;
}

/** The chapter of Act I you are on, or null when the act is done. */
export function currentChapter(s: GameState): MissionDef | null {
  return MISSIONS.find((m) => m.kind === 'main' && !s.missions[m.id]?.done) ?? null;
}

export function sideStatus(s: GameState, def: MissionDef): 'active' | 'offered' | 'rumour' | 'hidden' | 'done' {
  const m = s.missions[def.id];
  if (m?.done) return 'done';
  if (m) return 'active';
  if (def.when && !def.when(s)) return 'hidden';
  if (def.auto) return 'hidden';
  return (def.opens ?? []).every((r) => reqMet(s, r)) ? 'offered' : 'rumour';
}

export function objectiveOf(s: GameState, def: MissionDef): string {
  const m = s.missions[def.id] ?? { stage: 0, started: 0, flags: {} };
  const st = def.stages[Math.min(m.stage, def.stages.length - 1)];
  return typeof st.objective === 'function' ? st.objective(m, s) : st.objective;
}
