import type { Look } from '../actors/characterModel';
import type { Activity, Resident, Stop } from './residents';
import type { Gender, Attraction, GameState } from './state';
import type { SocialClass, Trait } from './social';
import type { Voice } from './voices';
import { HOME_DOORS, HOUSES } from '../world/saltwharfHomes';

/**
 * A city of lives. Everyone in London the game knows about: the residents written by
 * hand, and two hundred more generated at the start of a new life. Each has a home, a
 * job and a haunt; each ages (a year every 24 days), courts, marries, has children and
 * dies of old age. Only the people of the district you are in walk the streets; the
 * rest live on as records and are simulated each night.
 */
export const DAYS_PER_YEAR = 24;

export interface PersonRec {
  id: string;
  first: string;
  last: string;
  gender: Gender;
  attraction: Attraction;
  cls: SocialClass;
  traits: Trait[];
  district: string;
  /** Day of birth (day 0 is 1 Oct 1871); negative for people born before the game. */
  birth: number;
  home: string;
  work: string | null;
  haunt: string | null;
  spouse?: string;
  widowed?: boolean;
  parents: string[];
  children: string[];
  alive: boolean;
  died?: number;
  courting?: { with: string; since: number; wedding?: number };
  /** Generated people carry their look; hand-written residents keep theirs in code. */
  look?: Look;
  authored?: boolean;
}

/** Residents the main story depends on: they don't die of old age before it is told. */
export const STORY_PROTECTED = ['mag', 'pell', 'hale', 'quill', 'moss'];

/** Saltwharf can hold so many; beyond this, newlyweds move away. */
export const SALTWHARF_CAP = 56;

export const ageOf = (p: { birth: number }, day: number) => Math.floor((day - p.birth) / DAYS_PER_YEAR);

/** Homes in Saltwharf: the door they go in by. */
export const HOMES = HOME_DOORS;

export interface JobKind {
  name: string;
  place: string;
  from: number;
  to: number;
  /** Where they stand while working; null means indoors or away. */
  area: { x0: number; z0: number; x1: number; z1: number } | null;
  act?: Activity;
  /** Which game job they can recommend you for. */
  employer?: string;
  minAge?: number;
}

export const JOB_KINDS: Record<string, JobKind> = {
  docker: { name: 'Docker', place: 'the docks', from: 6, to: 14, area: { x0: 8, z0: 5, x1: 27, z1: 5 }, act: 'haul', employer: 'docks', minAge: 15 },
  lighterman: { name: 'Lighterman', place: 'the river stairs', from: 5, to: 13, area: { x0: 2, z0: 6, x1: 7, z1: 6 }, act: 'haul', employer: 'docks', minAge: 16 },
  netmender: { name: 'Net-mender', place: 'the quay', from: 8, to: 16, area: { x0: 3, z0: 5, x1: 7, z1: 5 }, act: 'mend' },
  laundress: { name: 'Laundress', place: 'the Gull Court washhouse', from: 7, to: 15, area: { x0: 1, z0: 15, x1: 6, z1: 16 }, act: 'wash', minAge: 13 },
  coster: { name: 'Costermonger', place: 'the market', from: 6, to: 15, area: { x0: 8, z0: 19, x1: 15, z1: 22 }, act: 'sell' },
  sweeper: { name: 'Crossing-sweeper', place: 'Quay Street', from: 7, to: 16, area: { x0: 2, z0: 7, x1: 29, z1: 8 }, act: 'sweep', minAge: 9 },
  barmaid: { name: 'Barmaid', place: 'the Copper Cup', from: 16, to: 24, area: null, employer: 'coppercup', minAge: 15 },
  potboy: { name: 'Pot-boy', place: 'the Copper Cup', from: 16, to: 23, area: null, employer: 'coppercup', minAge: 12 },
  warehouse: { name: 'Warehouseman', place: 'Bellamy & Sons', from: 6, to: 15, area: { x0: 2, z0: 8, x1: 7, z1: 8 }, act: 'haul', minAge: 15 },
  matchgirl: { name: 'Match-seller', place: 'Quay Street', from: 9, to: 18, area: { x0: 8, z0: 7, x1: 22, z1: 8 }, act: 'flowers', minAge: 8 },
  seamstress: { name: 'Seamstress', place: 'her room, by the window', from: 8, to: 18, area: null },
  clerk: { name: 'Clerk', place: 'a counting-house in the City', from: 8, to: 18, area: null },
  factory: { name: 'Match-factory hand', place: 'the match factory at Bow', from: 6, to: 18, area: null, minAge: 12 },
  sailor: { name: 'Sailor, ashore', place: 'ships in the Pool of London', from: 10, to: 16, area: { x0: 10, z0: 6, x1: 26, z1: 6 }, act: 'smoke', minAge: 16 },
  errand: { name: 'Errand boy', place: 'anywhere that pays', from: 8, to: 16, area: { x0: 8, z0: 9, x1: 22, z1: 16 }, act: 'watch', minAge: 9 },
};

export const HAUNTS: Record<string, { name: string; area: { x0: number; z0: number; x1: number; z1: number }; act: Activity; from: number; to: number }> = {
  cupfront: { name: 'the Copper Cup door', area: { x0: 16, z0: 7, x1: 21, z1: 8 }, act: 'drink', from: 18, to: 22 },
  market: { name: 'the market', area: { x0: 8, z0: 19, x1: 16, z1: 22 }, act: 'watch', from: 15, to: 19 },
  steps: { name: 'the quay steps', area: { x0: 2, z0: 6, x1: 30, z1: 6 }, act: 'watch', from: 16, to: 20 },
  courtyard: { name: 'Gull Court', area: { x0: 1, z0: 15, x1: 7, z1: 16 }, act: 'lean', from: 17, to: 21 },
  yard: { name: 'the boxing yard', area: { x0: 27, z0: 15, x1: 30, z1: 16 }, act: 'box', from: 17, to: 20 },
  church: { name: 'the church step', area: { x0: 1, z0: 11, x1: 1, z1: 13 }, act: 'read', from: 14, to: 17 },
};

/** Where the hand-written residents live, work and spend their evenings, for their cards. */
export const AUTHORED: Record<string, { age: number; home: string; work: string; haunt: string; employer?: string }> = {
  nell: { age: 26, home: 'court', work: 'the docks', haunt: 'the boxing yard', employer: 'docks' },
  bessa: { age: 44, home: 'cup', work: 'the Copper Cup', haunt: 'the Copper Cup', employer: 'coppercup' },
  rudd: { age: 48, home: 'court', work: 'the Dock Hiring Office', haunt: 'the Copper Cup', employer: 'docks' },
  moss: { age: 58, home: 'moss', work: 'his pawnshop', haunt: 'his pawnshop' },
  pell: { age: 52, home: 'hester', work: 'Pell\'s Chandlery', haunt: 'her shop door' },
  grubb: { age: 50, home: 'court', work: 'collecting rents', haunt: 'wherever rent is owed' },
  tom: { age: 19, home: 'court', work: 'the docks', haunt: 'the quay, mending nets', employer: 'docks' },
  ruby: { age: 23, home: 'court', work: 'selling flowers', haunt: 'Rope Walk, after dark' },
  hale: { age: 34, home: 'church', work: 'St. Botolph-by-the-River', haunt: 'the market cross' },
  quill: { age: 45, home: 'church', work: 'visiting the sick', haunt: 'Gull Court' },
  mag: { age: 71, home: 'arch', work: 'nothing anyone pays for', haunt: 'by Gull Court, always' },
  silas: { age: 31, home: 'hollow', work: 'his own business', haunt: 'the alley behind Moss\'s' },
  lizzie: { age: 21, home: 'rag', work: 'Rag & Bone Clothiers', haunt: 'outside the Copper Cup' },
  jem: { age: 29, home: 'court', work: 'his barrow at the market', haunt: 'the Copper Cup' },
  hannah: { age: 36, home: 'court', work: 'the washhouse', haunt: 'the back lane' },
  ashby: { age: 40, home: 'court', work: 'looking for her husband', haunt: 'the quay' },
};

// --- Names ------------------------------------------------------------------
const MEN = ['William', 'John', 'George', 'Thomas', 'James', 'Henry', 'Charles', 'Joseph', 'Frederick', 'Albert', 'Arthur', 'Alfred', 'Edward', 'Walter', 'Harry', 'Samuel', 'Daniel', 'Patrick', 'Michael', 'Isaac', 'Ezekiel', 'Silas', 'Amos', 'Edwin', 'Herbert', 'Ernest', 'Reuben', 'Abel', 'Jacob', 'Owen'];
const WOMEN = ['Mary', 'Elizabeth', 'Sarah', 'Ann', 'Jane', 'Emma', 'Alice', 'Eliza', 'Ellen', 'Martha', 'Harriet', 'Emily', 'Florence', 'Clara', 'Rose', 'Kate', 'Bridget', 'Margaret', 'Esther', 'Louisa', 'Ada', 'Fanny', 'Lydia', 'Hester', 'Maud', 'Polly', 'Nora', 'Winifred', 'Agnes', 'Susannah'];
const LAST = ['Smith', 'Jones', 'Brown', 'Taylor', 'Cooper', 'Fletcher', 'Murphy', 'Sullivan', 'O\'Brien', 'Walsh', 'Cohen', 'Levy', 'Mendoza', 'Okafor', 'Abbott', 'Baxter', 'Crabtree', 'Dawes', 'Ellery', 'Finch', 'Gunn', 'Hobbs', 'Inchley', 'Judd', 'Kemp', 'Larkin', 'Marlow', 'Nash', 'Oakes', 'Pike', 'Quinn', 'Rook', 'Sowerby', 'Thorne', 'Usher', 'Vickery', 'Wragg', 'Yeo', 'Blight', 'Coldwell', 'Dunnage', 'Grimshaw', 'Hatch', 'Muggeridge', 'Peabody', 'Scrivener', 'Tallow', 'Wick'];
const OFF_DISTRICTS = ['Lantern Market', 'Inkwell Row', 'Mayfield', 'Ironmonger\'s Cross', 'Hollow Lane', 'Greymourne'];
const TRAITS: Trait[] = ['open', 'shy', 'eccentric', 'serious', 'intellectual', 'romantic', 'jovial', 'proud', 'pious', 'cynical', 'greedy', 'brave'];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKINS = [0xf0cfb0, 0xe8c4a0, 0xe0b896, 0xd8b090, 0xc89a78, 0xb08060, 0x9a6a48, 0x7a5236];
const HAIRS = [0x15110e, 0x3a2618, 0x5a3a22, 0x6a4428, 0x8a5a30, 0x9a4a22, 0xc8a870, 0xd8c090];
const COATS: Record<SocialClass, number[]> = {
  lower: [0x4a3a2e, 0x3a3428, 0x5a4a3a, 0x4a4038, 0x3a3a44, 0x5a3a2e, 0x2e3a2e, 0x6a5a3a],
  middle: [0x2a2e34, 0x2e3a4a, 0x3a2e2a, 0x1b1f2a, 0x2e3440],
  upper: [0x15151a, 0x1b1f2a, 0x2a1a1e],
};

function makeLook(p: PersonRec, r: () => number, age: number): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const woman = p.gender === 'woman';
  const old = age >= 58;
  const hair = old ? pick([0xb0b0b0, 0xd0d0d0, 0x8a8a8a]) : pick(HAIRS);
  const look: Look = {
    skin: pick(SKINS), hair, coat: pick(COATS[p.cls]), trousers: pick([0x2e2a26, 0x3a3028, 0x2a2a2a, 0x3a2a2a, 0x2a3440, 0x4a3a2e]),
    shirt: pick([0xd0c4a8, 0xe0d6c0, 0xc8c0a8, 0xb8b0a0]), boots: pick([0x1e1a16, 0x2a2018, 0x15110e]),
    hat: 'none', skirt: woman, hairStyle: woman ? pick(['bun', 'bun', 'long', 'curls']) : pick(['short', 'short', 'curls', ...(age > 40 ? ['bald' as const] : [])]),
    eyes: pick([0x3a2a1e, 0x4a5a6a, 0x3a5a3a, 0x4a6a9a, 0x2a2a2a]),
    build: 0.92 + r() * 0.18,
  };
  if (woman) {
    if (r() < 0.6) { look.hat = 'bonnet'; look.hatColor = pick([0xd8ccb0, 0x2a2a2a, 0x5a4a3a, 0xa89880]); }
    if (['laundress', 'coster', 'barmaid'].includes(p.work ?? '') || r() < 0.3) look.apron = pick([0xd8ccb0, 0xe0d8c8, 0xc8bca0]);
    if (r() < 0.25 || old) look.cloak = pick([0x3a3430, 0x4a3a3a, 0x2a2a3a]);
  } else {
    if (r() < 0.75) { look.hat = p.cls === 'middle' ? pick(['bowler', 'top'] as const) : pick(['cap', 'cap', 'bowler'] as const); look.hatColor = pick([0x2a2620, 0x1a1a1e, 0x3a3428, 0x4a4236]); }
    if (age > 22 && r() < 0.35) look.beard = hair;
    if (r() < 0.35 || p.cls === 'middle') look.vest = pick([0x4a3a22, 0x2a2a30, 0x5a4a2a, 0x1a1214]);
    if (r() < 0.4) look.scarf = pick([0x8a2e26, 0x2e5a8a, 0x6a5a3a, 0x5a3a2e]);
  }
  if (age < 14) look.age = Math.max(0.2, age / 14);
  else if (old) look.age = 2;
  return look;
}

function newId(n: number) {
  return `p${n.toString(36)}`;
}

/** A new city: hand-written residents first, then households in Saltwharf and beyond. */
export function generatePopulation(seed: number): PersonRec[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: PersonRec[] = [];
  let n = 1;
  const person = (o: Partial<PersonRec> & Pick<PersonRec, 'gender' | 'district' | 'home'>, age: number): PersonRec => {
    const gender = o.gender;
    const p: PersonRec = {
      id: newId(n++), first: pick(gender === 'man' ? MEN : WOMEN), last: o.last ?? pick(LAST),
      attraction: r() < 0.88 ? (gender === 'man' ? 'women' : 'men') : r() < 0.5 ? 'both' : gender === 'man' ? 'men' : 'women',
      cls: o.cls ?? 'lower', traits: [pick(TRAITS)], birth: -Math.round((age + r()) * DAYS_PER_YEAR),
      work: null, haunt: null, parents: [], children: [], alive: true, ...o,
    } as PersonRec;
    let t2 = pick(TRAITS);
    while (t2 === p.traits[0]) t2 = pick(TRAITS);
    p.traits.push(t2);
    out.push(p);
    return p;
  };
  const jobFor = (age: number, gender: Gender, district: string): string | null => {
    if (age < 9) return null;
    const saltwharf = district === 'Saltwharf';
    const pool = gender === 'man'
      ? ['docker', 'docker', 'lighterman', 'warehouse', 'coster', 'sailor', 'clerk', 'netmender', ...(age < 16 ? ['errand', 'potboy', 'sweeper'] : [])]
      : ['laundress', 'laundress', 'seamstress', 'coster', 'barmaid', 'factory', 'matchgirl', ...(age < 16 ? ['matchgirl', 'sweeper'] : [])];
    const j = pick(pool.filter((k) => (JOB_KINDS[k].minAge ?? 14) <= age));
    // Away from Saltwharf, jobs are somewhere else entirely.
    return saltwharf ? j : (j === 'docker' || j === 'lighterman' ? 'factory' : j);
  };
  const hauntFor = (age: number) => (age < 14 ? pick(['courtyard', 'market', 'steps']) : age > 60 ? pick(['church', 'steps', 'courtyard']) : pick(['cupfront', 'cupfront', 'market', 'steps', 'courtyard', 'yard', 'church']));

  /** One household: a couple or a single parent, children, sometimes an old parent. */
  const household = (district: string, home: string) => {
    const last = pick(LAST);
    const kind = r();
    const adults: PersonRec[] = [];
    const ageA = 22 + Math.floor(r() * 30);
    if (kind < 0.62) {
      const man = person({ gender: 'man', last, district, home }, ageA + Math.floor(r() * 6));
      const wife = person({ gender: 'woman', last, district, home, attraction: 'men' }, ageA);
      man.attraction = 'women';
      man.spouse = wife.id;
      wife.spouse = man.id;
      adults.push(man, wife);
    } else if (kind < 0.8) {
      const w = person({ gender: 'woman', last, district, home, widowed: true }, ageA + 6);
      adults.push(w);
    } else {
      // A young single, lodging.
      adults.push(person({ gender: r() < 0.5 ? 'man' : 'woman', district, home }, 17 + Math.floor(r() * 10)));
    }
    const mother = adults.find((a) => a.gender === 'woman' && (a.spouse || a.widowed));
    if (mother) {
      const kids = Math.floor(r() * 4);
      for (let i = 0; i < kids; i++) {
        const age = Math.floor(r() * Math.max(1, Math.min(17, ageOf(mother, 0) - 17)));
        const c = person({ gender: r() < 0.5 ? 'man' : 'woman', last, district, home }, age);
        c.attraction = c.gender === 'man' ? 'women' : 'men';
        c.parents = adults.filter((a) => a.spouse || a.widowed).map((a) => a.id);
        for (const a of adults) if (c.parents.includes(a.id)) a.children.push(c.id);
      }
    }
    if (r() < 0.2) person({ gender: r() < 0.6 ? 'woman' : 'man', last, district, home, widowed: true }, 62 + Math.floor(r() * 14));
  };

  // Saltwharf: about 32 generated, alongside the 16 written by hand.
  const homes = ['court', 'court', 'hester', ...HOUSES.map((x) => x.key)];
  for (const h of homes) {
    if (out.length >= 32) break;
    household('Saltwharf', h);
  }
  while (out.length > 32) out.pop();
  for (const p of out) for (const k of ['children', 'parents'] as const) p[k] = p[k].filter((id) => out.some((q) => q.id === id));
  for (const p of out) if (p.spouse && !out.some((q) => q.id === p.spouse)) { delete p.spouse; p.widowed = true; }
  // The rest of London.
  while (out.length < 32 + 190) {
    const d = pick(OFF_DISTRICTS);
    household(d, d === 'Mayfield' ? 'square' : 'lodgings');
  }
  for (const p of out) {
    if (p.district === 'Mayfield') p.cls = r() < 0.6 ? 'upper' : 'middle';
    const age = ageOf(p, 0);
    p.work = jobFor(age, p.gender, p.district);
    if (p.cls !== 'lower' && p.work) p.work = 'clerk';
    p.haunt = hauntFor(age);
    if (p.district === 'Saltwharf') p.look = makeLook(p, r, age);
  }
  return out;
}

/** Records for the hand-written residents, so they age, marry and die like everyone else. */
export function authoredRecords(list: Resident[]): PersonRec[] {
  return list.map((res) => {
    const a = AUTHORED[res.id];
    const [first, ...rest] = res.name.replace(/^(Mr\.|Mrs\.|Dr\.|Father|Foreman|Old) /, '').split(' ');
    return {
      id: res.id, first, last: rest.join(' ') || res.name, gender: res.gender, attraction: res.attraction, cls: res.cls, traits: res.traits,
      district: 'Saltwharf', birth: -(a?.age ?? 30) * DAYS_PER_YEAR - 7, home: a?.home ?? 'court', work: null, haunt: null,
      parents: [], children: [], alive: true, authored: true,
    };
  });
}

// --- Routines for generated people --------------------------------------------
function tileIn(area: { x0: number; z0: number; x1: number; z1: number }, r: () => number) {
  return { x: area.x0 + Math.floor(r() * (area.x1 - area.x0 + 1)), z: area.z0 + Math.floor(r() * (area.z1 - area.z0 + 1)) };
}

export function scheduleFor(p: PersonRec, day: number): Stop[] {
  const r = rng(p.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const age = ageOf(p, day);
  const out: Stop[] = [];
  const job = p.work ? JOB_KINDS[p.work] : null;
  if (age < 3) return out;
  if (age < 9) {
    const play = tileIn(HAUNTS[p.haunt ?? 'courtyard'].area, r);
    out.push({ from: 9, to: 17, ...play, act: 'play' });
    return out;
  }
  if (job?.area) {
    const at = tileIn(job.area, r);
    out.push({ from: job.from, to: job.to, ...at, act: job.act });
  }
  const h = p.haunt ? HAUNTS[p.haunt] : null;
  if (h) {
    const at = tileIn(h.area, r);
    const busy = (x: number) => job && x >= job.from && x < job.to;
    const from = busy(h.from) && job ? job.to : h.from;
    if (from < h.to) out.push({ from, to: h.to, ...at, act: age < 14 ? 'play' : h.act });
  }
  if (age >= 62 && !job) {
    const at = tileIn(HAUNTS.steps.area, r);
    out.unshift({ from: 10, to: 14, ...at, act: 'watch' });
  }
  return out;
}

// --- Voices for generated people -------------------------------------------------
const HINTS: Record<Trait, string> = {
  open: 'Smiles at you before you have said a word.', shy: 'Looks at your boots rather than your face.', eccentric: 'Talks to the pigeons, and listens to their answers.',
  serious: 'Weighs every word before letting it go.', intellectual: 'A library ticket pokes out of a pocket.', romantic: 'Sighs at the river as if it were a sonnet.',
  jovial: 'Laughs at something only they heard.', proud: 'Stands as if the street belonged to them.', pious: 'A Bible thumbed soft at the corners.',
  cynical: 'One eyebrow already raised at you.', greedy: 'Eyes your purse, then your face.', brave: 'Meets your eye and holds it.',
};

export function voiceFor(p: PersonRec): Voice {
  const job = p.work ? JOB_KINDS[p.work] : null;
  return {
    hint: HINTS[p.traits[0]],
    friend: [`Hello, love.`, `There you are!`, `Mind how you go.`],
    rival: ['Oh. It\'s you.', 'Keep walking.'],
    chat: `${p.first} tells you about ${job ? `life as a ${job.name.toLowerCase()}` : 'their family'}, and the price of everything.`,
    perk: 'Friend: they\'ll tell you where anyone in Saltwharf can be found.',
  };
}

export function roleOf(p: PersonRec, day: number): string {
  const age = ageOf(p, day);
  if (age < 3) return 'A baby';
  if (age < 9) return 'A child of Saltwharf';
  const job = p.work ? JOB_KINDS[p.work] : null;
  if (!job) return age > 60 ? 'Retired, if anyone can afford to be' : 'Out of work';
  return job.name;
}

export const fullNameOf = (p: PersonRec) => `${p.first} ${p.last}`;

// --- One night of everyone's lives --------------------------------------------------
export interface LifeEvent {
  kind: 'courting' | 'engaged' | 'wedding' | 'birth' | 'death' | 'grownup';
  ids: string[];
  day: number;
}

const compatible = (a: PersonRec, b: PersonRec) => {
  const likes = (x: PersonRec, y: PersonRec) => x.attraction === 'both' || (x.attraction === 'men' ? y.gender === 'man' : y.gender === 'woman');
  return likes(a, b) && likes(b, a);
};

/** Advances every life by a night. `protectedIds` won't court (you are courting them). */
export function simulateNight(people: PersonRec[], day: number, protectedIds: Set<string>, rand = Math.random): LifeEvent[] {
  const ev: LifeEvent[] = [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const alive = people.filter((p) => p.alive);
  // Deaths of old age.
  for (const p of alive) {
    const age = ageOf(p, day);
    if (age < 58) continue;
    // The people the story still needs are spared, for now.
    if (STORY_PROTECTED.includes(p.id)) continue;
    const k = 0.0004 * Math.pow(age - 57, 1.3) * (p.authored ? 0.3 : 1);
    if (rand() < k) {
      p.alive = false;
      p.died = day;
      const sp = p.spouse ? byId.get(p.spouse) : undefined;
      if (sp) {
        delete sp.spouse;
        sp.widowed = true;
      }
      if (p.courting) {
        const o = byId.get(p.courting.with);
        if (o) delete o.courting;
        delete p.courting;
      }
      ev.push({ kind: 'death', ids: [p.id], day });
    }
  }
  // Weddings that are due, and engagements.
  for (const p of alive) {
    const c = p.courting;
    if (!p.alive || !c) continue;
    const o = byId.get(c.with);
    if (!o?.alive) {
      delete p.courting;
      continue;
    }
    if (p.id > o.id) continue;
    if (c.wedding !== undefined && day >= c.wedding) {
      p.spouse = o.id;
      o.spouse = p.id;
      delete p.widowed;
      delete o.widowed;
      delete p.courting;
      delete o.courting;
      // Set up house: in Saltwharf if either lives there; she takes his name.
      const stay = p.district === 'Saltwharf' ? p : o.district === 'Saltwharf' ? o : p;
      const move = stay === p ? o : p;
      move.district = stay.district;
      move.home = stay.home;
      // A full Saltwharf sends young couples elsewhere (never the hand-written residents).
      const crowded = alive.filter((x) => x.alive && x.district === 'Saltwharf').length > SALTWHARF_CAP;
      if (crowded && !p.authored && !o.authored && stay.district === 'Saltwharf') {
        const to = OFF_DISTRICTS[Math.floor(rand() * OFF_DISTRICTS.length)];
        for (const x of [p, o]) {
          x.district = to;
          x.home = 'lodgings';
        }
      }
      if (p.gender !== o.gender) {
        const wife = p.gender === 'woman' ? p : o;
        wife.last = (p.gender === 'man' ? p : o).last;
      }
      ev.push({ kind: 'wedding', ids: [p.id, o.id], day });
    } else if (c.wedding === undefined && day - c.since >= 8 && rand() < 0.12) {
      c.wedding = day + 4;
      if (o.courting) o.courting.wedding = c.wedding;
      ev.push({ kind: 'engaged', ids: [p.id, o.id], day });
    }
  }
  // New courtships.
  const single = (p: PersonRec) => p.alive && !p.spouse && !p.courting && !protectedIds.has(p.id) && ageOf(p, day) >= 18 && ageOf(p, day) <= 55;
  for (const p of alive) {
    if (!single(p) || rand() > 0.02) continue;
    const pool = alive.filter((q) => q !== p && single(q) && q.district === p.district && Math.abs(ageOf(q, day) - ageOf(p, day)) <= 12 && compatible(p, q)
      && !p.parents.includes(q.id) && !q.parents.includes(p.id) && !(p.parents.length && p.parents.some((x) => q.parents.includes(x))));
    if (!pool.length) continue;
    const q = pool[Math.floor(rand() * pool.length)];
    p.courting = { with: q.id, since: day };
    q.courting = { with: p.id, since: day };
    ev.push({ kind: 'courting', ids: [p.id, q.id], day });
  }
  // Births.
  for (const p of alive) {
    if (!p.alive || p.gender !== 'woman' || !p.spouse) continue;
    const age = ageOf(p, day);
    const sp = byId.get(p.spouse);
    if (!sp?.alive || sp.gender !== 'man' || age < 18 || age > 42 || p.children.length >= 4 || rand() > 0.007) continue;
    const g: Gender = rand() < 0.5 ? 'man' : 'woman';
    const id = `b${day.toString(36)}${p.id}`;
    const baby: PersonRec = {
      id, first: (g === 'man' ? MEN : WOMEN)[Math.floor(rand() * 30)], last: p.last, gender: g, attraction: g === 'man' ? 'women' : 'men', cls: p.cls,
      traits: [TRAITS[Math.floor(rand() * 12)], TRAITS[Math.floor(rand() * 12)]], district: p.district, birth: day, home: p.home, work: null,
      haunt: 'courtyard', parents: [p.id, sp.id], children: [], alive: true,
    };
    if (baby.traits[0] === baby.traits[1]) baby.traits.pop();
    if (p.district === 'Saltwharf') baby.look = makeLook(baby, rng(day * 977 + p.children.length), 0);
    people.push(baby);
    p.children.push(id);
    sp.children.push(id);
    ev.push({ kind: 'birth', ids: [id, p.id, sp.id], day });
  }
  // Children come of working age.
  for (const p of alive) {
    if (p.authored || p.work) continue;
    const age = ageOf(p, day);
    if (age >= 12 && ageOf(p, day - 1) < 12) {
      p.work = p.gender === 'man' ? (rand() < 0.5 ? 'potboy' : 'errand') : rand() < 0.5 ? 'matchgirl' : 'laundress';
      ev.push({ kind: 'grownup', ids: [p.id], day });
    }
  }
  // Looks follow age: children grow, the old go grey.
  for (const p of people) {
    if (!p.look || !p.alive) continue;
    const age = ageOf(p, day);
    if (age < 14) p.look.age = Math.max(0.2, age / 14);
    else if (age >= 58) {
      p.look.age = 2;
      if (age === 58) p.look.hair = 0xb0b0b0;
    } else delete p.look.age;
  }
  return ev;
}

export function needsPopulation(s: GameState): boolean {
  return !s.people || s.people.length === 0;
}

const FAMILY_NAMES = { man: MEN, woman: WOMEN };

/** Names to suggest for a new baby. */
export function babyNames(g: Gender, rand = Math.random): string[] {
  const pool = [...FAMILY_NAMES[g]];
  const out: string[] = [];
  while (out.length < 3) {
    const n = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    out.push(n);
  }
  return out;
}

/** A child born (or taken in) to a family in Saltwharf. */
export function childRecord(o: { first: string; last: string; gender: Gender; parents: string[]; home: string; birth: number; day: number; cls: SocialClass }): PersonRec {
  const r = rng(o.birth * 131 + o.first.length * 17 + o.parents.length);
  const p: PersonRec = {
    id: `c${o.day.toString(36)}${Math.floor(r() * 1e6).toString(36)}`, first: o.first, last: o.last, gender: o.gender,
    attraction: o.gender === 'man' ? 'women' : 'men', cls: o.cls, traits: [TRAITS[Math.floor(r() * 12)]], district: 'Saltwharf',
    birth: o.birth, home: o.home, work: null, haunt: 'courtyard', parents: o.parents, children: [], alive: true,
  };
  let t2 = TRAITS[Math.floor(r() * 12)];
  while (t2 === p.traits[0]) t2 = TRAITS[Math.floor(r() * 12)];
  p.traits.push(t2);
  p.look = makeLook(p, r, ageOf(p, o.day));
  return p;
}
