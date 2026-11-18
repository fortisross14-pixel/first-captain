import type { GameState, SkillId } from './state';

/**
 * How you get better: practice (reading, the bag, the workbench, talking, work), and
 * lessons from someone who knows. Each skill has a mentor in Saltwharf, and milestones
 * at 3, 6 and 10 that change how the world treats you.
 */
export interface Mentor {
  who: string;
  label: string;
  /** Hours of the day the lesson can be had (from their routine). */
  text: string;
  /** Price for acquaintances; friends teach for nothing. */
  fee: number;
}

export const MENTORS: Record<SkillId, Mentor> = {
  study: { who: 'hale', label: 'Ask Father Hale for a lesson in letters', text: 'Latin roots, a page of Gibbon, and a lecture on the semicolon.', fee: 0.03 },
  strength: { who: 'nell', label: 'Spar with Nell', text: 'Nell knocks you down eleven times. The twelfth time you nearly see it coming.', fee: 0.02 },
  arts: { who: 'lizzie', label: 'Learn a stitch from Lizzie', text: 'A running stitch, a slip stitch, and a needle through your thumb. She is patient. You are not.', fee: 0.03 },
  charisma: { who: 'bessa', label: 'Watch Bessa work the room', text: 'Bessa shows you how to remember a name, how to laugh at a bad joke, and how to make a man pay for his own flattery.', fee: 0.03 },
  cunning: { who: 'silas', label: 'Let Silas show you the trade', text: 'How to read a pocket from across the street, how to lie with your hands, how to look at nothing.', fee: 0.05 },
  occult: { who: 'mag', label: 'Sit with Mag and listen', text: 'Mag tells you which corners the dead like, why the gulls go quiet, and what the fog smells of when it is hungry.', fee: 0.01 },
};

/** Lesson practice: about three hours of reading's worth. */
export const LESSON_XP = 34;

export interface Perk {
  skill: SkillId;
  level: number;
  name: string;
  text: string;
}

export const PERKS: Perk[] = [
  { skill: 'study', level: 3, name: 'Weather eye', text: 'The Gazette\'s small print: you read tomorrow\'s weather in it.' },
  { skill: 'study', level: 6, name: 'Quick study', text: 'Reading and lessons teach you a quarter more.' },
  { skill: 'study', level: 10, name: 'A voice for the Vestry', text: 'Speeches at the market win twice the crowd.' },
  { skill: 'strength', level: 3, name: 'Thick hide', text: 'Training on the bag tires you less.' },
  { skill: 'strength', level: 6, name: 'Hard to rob', text: 'Footpads look at your shoulders and choose someone else (a third less often).' },
  { skill: 'strength', level: 10, name: 'Saltwharf oak', text: 'You can work a dock shift in the rain without it costing Health.' },
  { skill: 'arts', level: 3, name: 'A cook\'s hand', text: 'Mutton stew: a pot to carry, the best gift there is.' },
  { skill: 'arts', level: 6, name: 'Needle and thread', text: 'Mend your own clothes at the basin, for nothing.' },
  { skill: 'arts', level: 10, name: 'Master carver', text: 'Your trinkets sell for twice as much.' },
  { skill: 'charisma', level: 3, name: 'Friendly face', text: 'Shopkeepers knock a little off: 5% everywhere.' },
  { skill: 'charisma', level: 6, name: 'Good company', text: 'People will talk with you twice more each day.' },
  { skill: 'charisma', level: 10, name: 'Beloved', text: 'Neighbours bring you favours twice as often, and gifts with them.' },
  { skill: 'cunning', level: 3, name: 'Eyes in your back', text: 'You notice a follower sooner: the warning comes at once.' },
  { skill: 'cunning', level: 6, name: 'Street sense', text: 'You read danger before you walk into it: dangerous streets are a quarter safer for you.' },
  { skill: 'cunning', level: 10, name: 'Nobody\'s mark', text: 'You can sleep rough without being robbed.' },
  { skill: 'occult', level: 3, name: 'The sight', text: 'At night you see the dead who walk Saltwharf.' },
  { skill: 'occult', level: 6, name: 'They speak to you', text: 'The dead will answer if you go to them.' },
  { skill: 'occult', level: 10, name: 'Fog-sense', text: 'You feel the fog coming: the night before, you know.' },
];

export const hasPerk = (s: GameState, skill: SkillId, level: number) => s.character.skills[skill] >= level;

/** The perk reached at exactly this level, for the celebration. */
export const perkAt = (skill: SkillId, level: number) => PERKS.find((p) => p.skill === skill && p.level === level) ?? null;

/** The next perk in a skill, for the diary. */
export const nextPerk = (s: GameState, skill: SkillId) => PERKS.find((p) => p.skill === skill && s.character.skills[skill] < p.level) ?? null;
