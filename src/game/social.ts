import type { Gender, Attraction, GameState, SkillId } from './state';

export const TRAITS = ['open', 'shy', 'eccentric', 'serious', 'intellectual', 'romantic', 'jovial', 'proud', 'pious', 'cynical', 'greedy', 'brave'] as const;
export type Trait = (typeof TRAITS)[number];
export type SocialClass = 'lower' | 'middle' | 'upper';

export type InteractionId = 'chat' | 'joke' | 'compliment' | 'flirt' | 'gossip' | 'debate' | 'brag' | 'confide' | 'insult' | 'gift' | 'business' | 'help' | 'treat';
export type Meter = 'friendship' | 'romance' | 'rivalry' | 'business';

export interface Relation {
  friendship: number;
  romance: number;
  rivalry: number;
  business: number;
  met: boolean;
  /** Interactions today, and which day that was. */
  today: number;
  day: number;
  /** Last day you spent time with them; friendships fade without it. */
  seen?: number;
  /** What you've found they like and dislike (interaction ids). */
  likes?: string[];
  dislikes?: string[];
}

export const newRelation = (): Relation => ({ friendship: 0, romance: 0, rivalry: 0, business: 0, met: false, today: 0, day: -1 });

export interface Interaction {
  id: InteractionId;
  label: string;
  skill: SkillId;
  meter: Meter;
  gain: number;
  /** Subtracted from the success chance. */
  difficulty: number;
}

export const INTERACTIONS: Interaction[] = [
  { id: 'chat', label: 'Chat', skill: 'charisma', meter: 'friendship', gain: 3, difficulty: -0.1 },
  { id: 'joke', label: 'Joke', skill: 'charisma', meter: 'friendship', gain: 4, difficulty: 0.05 },
  { id: 'compliment', label: 'Compliment', skill: 'charisma', meter: 'friendship', gain: 4, difficulty: 0 },
  { id: 'gossip', label: 'Gossip', skill: 'cunning', meter: 'friendship', gain: 4, difficulty: 0.05 },
  { id: 'debate', label: 'Debate', skill: 'study', meter: 'friendship', gain: 5, difficulty: 0.15 },
  { id: 'brag', label: 'Brag', skill: 'strength', meter: 'friendship', gain: 4, difficulty: 0.1 },
  { id: 'confide', label: 'Confide', skill: 'charisma', meter: 'friendship', gain: 6, difficulty: 0.15 },
  { id: 'flirt', label: 'Flirt', skill: 'charisma', meter: 'romance', gain: 5, difficulty: 0.1 },
  { id: 'business', label: 'Propose business', skill: 'cunning', meter: 'business', gain: 6, difficulty: 0.15 },
  { id: 'gift', label: 'Give a gift', skill: 'charisma', meter: 'friendship', gain: 5, difficulty: -0.3 },
  { id: 'help', label: 'Lend a hand', skill: 'strength', meter: 'friendship', gain: 7, difficulty: -0.3 },
  { id: 'treat', label: 'Treat them', skill: 'charisma', meter: 'friendship', gain: 6, difficulty: -0.35 },
  { id: 'insult', label: 'Insult', skill: 'strength', meter: 'rivalry', gain: 10, difficulty: 0 },
];

/** What each personality warms to and what turns them off (Story Bible, Relationships). */
export const TRAIT_PREFS: Record<Trait, { likes: InteractionId[]; dislikes: InteractionId[]; name: string }> = {
  open: { name: 'Open', likes: ['chat', 'gossip', 'joke', 'confide'], dislikes: ['insult'] },
  shy: { name: 'Shy', likes: ['chat', 'compliment', 'gift', 'help'], dislikes: ['joke', 'brag'] },
  eccentric: { name: 'Eccentric', likes: ['confide', 'debate', 'joke'], dislikes: ['chat'] },
  serious: { name: 'Serious', likes: ['chat', 'confide', 'business', 'help'], dislikes: ['joke', 'flirt'] },
  intellectual: { name: 'Intellectual', likes: ['debate', 'confide'], dislikes: ['gossip', 'brag'] },
  romantic: { name: 'Romantic', likes: ['compliment', 'flirt', 'gift'], dislikes: ['insult', 'business'] },
  jovial: { name: 'Jovial', likes: ['joke', 'gossip', 'brag', 'treat'], dislikes: ['debate'] },
  proud: { name: 'Proud', likes: ['compliment', 'treat'], dislikes: ['insult', 'brag', 'debate', 'help'] },
  pious: { name: 'Pious', likes: ['chat', 'confide', 'gift', 'help'], dislikes: ['insult', 'gossip', 'flirt'] },
  cynical: { name: 'Cynical', likes: ['joke', 'gossip', 'business'], dislikes: ['compliment', 'confide'] },
  greedy: { name: 'Greedy', likes: ['business', 'gift', 'treat'], dislikes: ['confide'] },
  brave: { name: 'Brave', likes: ['brag', 'joke'], dislikes: ['gossip'] },
};

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  attraction: Attraction;
  cls: SocialClass;
  traits: Trait[];
  role: string;
}

export const DAILY_LIMIT = 5;

export function attracted(a: Attraction, g: Gender): boolean {
  return a === 'both' || (a === 'men' && g === 'man') || (a === 'women' && g === 'woman');
}

export function canRomance(s: GameState, p: Person): boolean {
  return attracted(s.character.attraction, p.gender) && attracted(p.attraction, s.character.gender);
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export interface Outcome {
  success: boolean;
  liked: boolean;
  disliked: boolean;
  text: string;
  /** Meter changes, for the feedback line. */
  changes: Partial<Record<Meter, number>>;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const LINES: Partial<Record<InteractionId, { ok: string[]; bad: string[] }>> = {
  chat: { ok: ['You talk about the weather, the river and the price of bread. It is pleasant.'], bad: ['The conversation dies in the fog between you.'] },
  joke: { ok: ['They laugh, properly, from the belly.'], bad: ['Your joke lands like a dropped crate.'] },
  compliment: { ok: ['They try not to look pleased, and fail.'], bad: ['They narrow their eyes. "What do you want?"'] },
  gossip: { ok: ['You trade a rumour about the Vane Lamps for one about the landlord. A fair swap.'], bad: ['"I don\'t hold with tittle-tattle."'] },
  debate: { ok: ['You argue about Darwin and the Poor Law until you both forget whose side you were on.'], bad: ['You lose the thread, and then the argument.'] },
  brag: { ok: ['"Is that so?" They are impressed despite themselves.'], bad: ['"Big talk," they say, and turn away.'] },
  confide: { ok: ['You tell them something true. They tell you something truer.'], bad: ['They shift uncomfortably. Too much, too soon.'] },
  flirt: { ok: ['A look held a second too long. They don\'t look away.'], bad: ['They laugh, but not in the way you hoped.'] },
  business: { ok: ['"Now you\'re talking sense." You shake on the idea of something.'], bad: ['"Come back when you\'ve got capital and a plan."'] },
  gift: { ok: ['They take it with real thanks.'], bad: ['They take it, but it doesn\'t seem to mean much.'] },
  help: { ok: ['Half an hour of carrying, holding and fetching. They thank you twice, the second time as if they mean it.', 'You lend a hand without being asked. They notice.'], bad: ['You get in the way more than you help. They are polite about it.'] },
  treat: { ok: ['A pie and a pint, on you. They tuck in, and talk.', 'You stand them a hot potato from the barrow. Small things are remembered here.'], bad: ['They take it, a little stiffly. Nobody likes owing.'] },
};

/** Resolves one interaction and updates the relation. */
export function interact(s: GameState, p: Person, r: Relation, i: Interaction, mood: number): Outcome {
  const liked = p.traits.some((t) => TRAIT_PREFS[t].likes.includes(i.id));
  const disliked = p.traits.some((t) => TRAIT_PREFS[t].dislikes.includes(i.id));
  const changes: Partial<Record<Meter, number>> = {};
  const add = (m: Meter, v: number) => {
    const before = r[m];
    r[m] = clamp(r[m] + v);
    changes[m] = (changes[m] ?? 0) + (r[m] - before);
  };

  if (i.id === 'insult') {
    const laughs = p.traits.some((t) => t === 'cynical' || t === 'brave') && Math.random() < 0.3;
    if (laughs) {
      add('friendship', 3);
      return { success: true, liked: true, disliked: false, text: 'They bark a laugh. "You\'ve got some nerve. I like that."', changes };
    }
    add('friendship', -12);
    add('rivalry', 10);
    add('romance', -10);
    return { success: false, liked: false, disliked: true, text: 'Their face hardens. You have made an enemy, or started to.', changes };
  }

  if (i.id === 'flirt' && (!canRomance(s, p) || r.friendship < 15)) {
    add('friendship', -4);
    const text = canRomance(s, p) ? 'Too soon. They step back, flustered.' : 'They look at you oddly. That is not what they are after.';
    return { success: false, liked: false, disliked: true, text, changes };
  }
  if (i.id === 'business' && r.friendship < 25) {
    return { success: false, liked: false, disliked: false, text: '"I don\'t do business with strangers."', changes };
  }

  const skill = i.id === 'business' ? Math.max(s.character.skills.cunning, s.character.skills.charisma) : s.character.skills[i.skill];
  const classMod = (p.cls !== 'lower' && (i.id === 'debate' || i.id === 'business')) || (p.cls === 'lower' && (i.id === 'joke' || i.id === 'brag')) ? 0.1 : 0;
  const studyGate = i.id === 'debate' && s.character.skills.study < 2 ? -0.4 : 0;
  const chance = Math.max(0.05, Math.min(0.95,
    0.55 + skill * 0.025 + (liked ? 0.25 : 0) - (disliked ? 0.35 : 0) + r.friendship * 0.002 + mood + classMod + studyGate - i.difficulty));
  const success = Math.random() < chance;
  const lines = LINES[i.id]!;
  if (success) {
    const g = i.gain * (liked ? 1.5 : 1);
    add(i.meter, g);
    if (i.meter !== 'friendship') add('friendship', 2);
    if (i.id === 'compliment' && canRomance(s, p) && r.romance > 0) add('romance', 3);
    add('rivalry', -2);
  } else {
    add('friendship', -Math.round(i.gain * (disliked ? 0.9 : 0.5)));
    if (disliked) add('rivalry', 3);
  }
  return { success, liked, disliked, text: pick(success ? lines.ok : lines.bad), changes };
}

export function relationLabel(r: Relation): string {
  const parts: string[] = [];
  if (r.romance >= 60) parts.push('Sweetheart');
  else if (r.romance >= 30) parts.push('Courting');
  if (r.rivalry >= 50) parts.push('Enemy');
  else if (r.rivalry >= 25) parts.push('Rival');
  if (r.friendship >= 60) parts.push('Close friend');
  else if (r.friendship >= 30) parts.push('Friend');
  else if (r.friendship >= 10) parts.push('Acquaintance');
  if (r.business >= 30) parts.push('Business partner');
  return parts.length ? parts.join(' · ') : r.met ? 'Stranger' : 'Unknown';
}

/** Traits you have learned: the first at friendship 10, the second at 30. */
export function knownTraits(p: Person, r: Relation): string[] {
  return p.traits.filter((_, i) => r.friendship >= (i === 0 ? 10 : 30)).map((t) => TRAIT_PREFS[t].name);
}
