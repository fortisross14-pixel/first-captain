import type { Enemy } from '../minigames/fight';

/** Saturday Fight Night at the boxing yard: a ladder of named opponents. */
export interface Bout {
  enemy: Enemy;
  purse: number;
  intro: string;
}

export const FIGHT_NIGHT = { day: 6, from: 20, to: 23, entry: 0.01 };

export const LADDER: Bout[] = [
  { enemy: { name: 'Wiry Ted Blunt', hp: 20, dmg: [3, 6], hit: 0.6, nerve: 60 }, purse: 0.08, intro: 'Wiry Ted Blunt bounces on his toes and grins. He has three teeth and uses all of them.' },
  { enemy: { name: 'Big Mo the Coalheaver', hp: 34, dmg: [5, 9], hit: 0.55, nerve: 90 }, purse: 0.15, intro: 'Big Mo cracks his neck. The crowd starts chanting his name before you have your fists up.' },
  { enemy: { name: 'Kitty Doyle', hp: 28, dmg: [5, 10], hit: 0.7, nerve: 80 }, purse: 0.22, intro: 'Kitty Doyle, Old Mag\'s niece, ties back her hair. "Nothing personal, duck."' },
  { enemy: { name: 'The Gentleman', hp: 36, dmg: [6, 11], hit: 0.72, nerve: 100 }, purse: 0.35, intro: 'A disgraced cavalry captain in shirtsleeves, called only The Gentleman. He bows. Then he does not stop hitting.' },
  { enemy: { name: 'Iron Nell Hartigan', hp: 46, dmg: [7, 12], hit: 0.74, nerve: 120 }, purse: 0.6, intro: 'The champion steps through the ropes. Nell Hartigan rolls her shoulders. "Don\'t hold back. I won\'t."' },
];

export const CHAMPION_TITLE = 'the Saltwharf Terror';
