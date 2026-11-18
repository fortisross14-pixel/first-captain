import type { GameState, NeedId } from './state';

/**
 * Cooking at Hester's stove. Every recipe burns a scuttle of coal. Better cooks
 * (Arts & Crafts) get more from the same pot, and some dishes keep for later or make fine gifts.
 */
export interface Recipe {
  id: string;
  name: string;
  /** Item ids used up, besides the coal. */
  needs: string[];
  /** Arts & Crafts needed to attempt it. */
  arts: number;
  effects: Partial<Record<NeedId, number>>;
  /** Cooked into a dish you carry, instead of eaten at once. */
  dish?: string;
  blurb: string;
  eat: string;
}

export const RECIPES: Recipe[] = [
  { id: 'supper', name: 'Hot supper', needs: ['bread|potato'], arts: 0, effects: { hunger: 55, health: 5 }, blurb: 'Bread or a potato, warmed through.', eat: 'The stove ticks and warms. A hot supper, the first in this room for months.' },
  { id: 'hash', name: 'Potato and onion hash', needs: ['potato', 'onion'], arts: 1, effects: { hunger: 62, health: 6, rest: 3 }, blurb: 'Fried brown in the pan till the edges catch.', eat: 'You scrape the pan clean. The room smells like somebody lives here.' },
  { id: 'eels', name: 'Stewed eels and parsley liquor', needs: ['eel', 'onion'], arts: 2, effects: { hunger: 68, health: 9 }, blurb: 'The Saltwharf supper. The eels fight the pot.', eat: 'Green liquor, soft eels, a heel of bread to mop it. Your mother would cry.' },
  { id: 'apples', name: 'Baked apples', needs: ['apple', 'apple'], arts: 1, effects: { hunger: 22, social: 10 }, blurb: 'Soft and sweet. Tastes like being small.', eat: 'Sugar-dark skins split in the heat. For a moment you are eight years old.' },
  { id: 'stew', name: 'Mutton stew (a pot to carry)', needs: ['mutton', 'potato', 'onion'], arts: 3, effects: {}, dish: 'stew', blurb: 'A pot to take to someone: the best gift in Saltwharf.', eat: 'A proper stew, thick enough to stand a spoon in. You lid the pot to carry.' },
  { id: 'broth', name: 'Sick-room broth (a jar to carry)', needs: ['mutton', 'onion'], arts: 2, effects: {}, dish: 'broth', blurb: 'For the sick: worth more than any tonic, Quill says.', eat: 'You skim the fat and pour it hot into a jar.' },
];

const has = (s: GameState, id: string, n = 1) => (s.inventory.find((i) => i.id === id)?.qty ?? 0) >= n;

/** What you lack to cook this, or null if you can. */
export function missing(s: GameState, r: Recipe): string | null {
  if (!has(s, 'coal')) return 'needs coal';
  if (s.character.skills.arts < r.arts) return `needs Arts & Crafts ${r.arts}`;
  const counts: Record<string, number> = {};
  for (const n of r.needs) {
    if (n.includes('|')) {
      if (!n.split('|').some((x) => has(s, x))) return `needs ${n.split('|').join(' or ')}`;
      continue;
    }
    counts[n] = (counts[n] ?? 0) + 1;
  }
  for (const [id, n] of Object.entries(counts)) if (!has(s, id, n)) return `needs ${n > 1 ? `${n} × ` : ''}${id}`;
  return null;
}

/** Ingredients to use for a recipe (resolving "bread|potato"). */
export function ingredients(s: GameState, r: Recipe): string[] {
  return ['coal', ...r.needs.map((n) => (n.includes('|') ? n.split('|').find((x) => has(s, x))! : n))];
}

/** Arts & Crafts makes the same pot go further: +4% per level. */
export const cookMult = (s: GameState) => 1 + s.character.skills.arts * 0.04;
