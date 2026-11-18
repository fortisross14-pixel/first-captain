import { addNeed } from './needs';
import type { GameState, NeedId } from './state';

export type Outfit = 'plain' | 'work' | 'sunday' | 'coat';
export const OUTFIT_NAMES: Record<Outfit, string> = { plain: 'Your travelling clothes', work: "Docker's jacket", sunday: 'Sunday best', coat: 'Respectable coat' };

export interface ItemDef {
  id: string;
  name: string;
  /** Shop price in pounds. */
  price: number;
  /** Effects when used. */
  use?: Partial<Record<NeedId, number>>;
  verb?: string;
  blurb: string;
  /** Bought once and kept for good, not carried in the bag. */
  upgrade?: boolean;
  /** Furniture appears in Hester's room. */
  furniture?: boolean;
  /** Clothes you can wear. */
  outfit?: Outfit;
}

export const ITEMS: Record<string, ItemDef> = {
  potato: { id: 'potato', name: 'Hot potato', price: 0.02, use: { hunger: 25 }, verb: 'Eat', blurb: 'Hot enough to warm your hands, at first.' },
  bread: { id: 'bread', name: 'Loaf of bread', price: 0.03, use: { hunger: 30 }, verb: 'Eat', blurb: "Yesterday's, but honest." },
  apple: { id: 'apple', name: 'Apple', price: 0.01, use: { hunger: 10, health: 2 }, verb: 'Eat', blurb: 'Small, sour, slightly bruised.' },
  eelpie: { id: 'eelpie', name: 'Eel pie', price: 0.06, use: { hunger: 45 }, verb: 'Eat', blurb: 'Best not to think about the eel.' },
  meatpie: { id: 'meatpie', name: 'Meat pie', price: 0.09, use: { hunger: 60, health: 3 }, verb: 'Eat', blurb: 'Real meat. Probably.' },
  candle: { id: 'candle', name: 'Tallow candle', price: 0.02, blurb: 'Smoky, but it burns.' },
  bandage: { id: 'bandage', name: 'Bandage', price: 0.04, use: { health: 10 }, verb: 'Apply', blurb: 'Clean linen, for now.' },
  tonic: { id: 'tonic', name: "Pell's tonic", price: 0.12, use: { health: 25, rest: 5 }, verb: 'Drink', blurb: 'Mostly gin, partly hope.' },
  coal: { id: 'coal', name: 'Scuttle of coal', price: 0.03, blurb: 'Lights the stove at home: cook a hot supper from bread or potatoes.' },
  candle2: { id: 'candle2', name: 'Wax candle', price: 0.05, blurb: 'Burns clean and long: two evenings of reading.' },
  // Upgrades: bought once, kept for good.
  mattress: { id: 'mattress', name: 'Feather mattress', price: 0.8, upgrade: true, blurb: 'Sleep in your bed restores Rest half as fast again.' },
  chest: { id: 'chest', name: 'Sea chest', price: 0.5, upgrade: true, blurb: 'Four more bag slots.' },
  gloves: { id: 'gloves', name: 'Dock gloves', price: 0.35, upgrade: true, blurb: 'Cargo Stacking plays as if your Strength were 3 higher.' },
  apron: { id: 'apron', name: "Barman's apron", price: 0.3, upgrade: true, blurb: 'Order Juggling plays as if your Charisma were 3 higher.' },
  coat: { id: 'coat', name: 'Respectable coat', price: 1.2, upgrade: true, outfit: 'coat', blurb: 'Wear it and people take you seriously: better odds in conversation. Robbers notice it too.' },
  work: { id: 'work', name: "Docker's jacket", price: 0.3, upgrade: true, outfit: 'work', blurb: 'Dockers trust you in it; Cargo Stacking plays as if Strength were 1 higher.' },
  sunday: { id: 'sunday', name: 'Sunday best', price: 0.8, upgrade: true, outfit: 'sunday', blurb: 'Respectable folk warm to you; the market mocks you; robbers think you are rich.' },
  trinket: { id: 'trinket', name: 'Carved trinket', price: 0.12, blurb: 'A little ship carved from driftwood. Moss will buy it.' },
  // Second-hand furniture from Moss, for Hester's room.
  rug: { id: 'rug', name: 'Turkey rug', price: 0.4, upgrade: true, furniture: true, blurb: 'Comfort: the room tops up Social while you are home.' },
  curtains: { id: 'curtains', name: 'Velvet curtains', price: 0.35, upgrade: true, furniture: true, blurb: 'Comfort; and darker nights mean deeper sleep.' },
  bookshelf: { id: 'bookshelf', name: 'Bookshelf of old books', price: 0.7, upgrade: true, furniture: true, blurb: 'Read from it any time: half as much Study practice again.' },
  mirror: { id: 'mirror', name: 'Looking-glass', price: 0.45, upgrade: true, furniture: true, blurb: 'Tidy yourself each morning: better first impressions all day.' },
  workbench: { id: 'workbench', name: 'Workbench', price: 0.9, upgrade: true, furniture: true, blurb: 'Carve trinkets to sell: Arts & Crafts practice.' },
  scarf: { id: 'scarf', name: 'Wool scarf', price: 0.25, upgrade: true, blurb: 'Sleeping rough costs no Health and rests a little better.' },
  boots: { id: 'boots', name: 'Good boots', price: 0.6, upgrade: true, blurb: 'You walk a quarter faster.' },
};

export interface Shop {
  name: string;
  keeper: string;
  stock: string[];
  /** Share of the price paid when you sell to this shop; 0 means it does not buy. */
  buys: number;
}

export const SHOPS: Record<string, Shop> = {
  market: { name: 'Saltwharf Market', keeper: 'the stallholders', stock: ['potato', 'apple', 'bread', 'eelpie', 'meatpie'], buys: 0 },
  hester: { name: "Pell's Chandlery", keeper: 'Mrs. Pell', stock: ['candle', 'candle2', 'coal', 'bandage', 'tonic', 'mattress', 'chest'], buys: 0 },
  clothier: { name: 'Rag & Bone Clothiers', keeper: 'Lizzie Barlow', stock: ['work', 'sunday', 'coat', 'scarf', 'gloves', 'apron', 'boots'], buys: 0 },
  pawnbroker: { name: 'Moss the Pawnbroker', keeper: 'Moss', stock: ['rug', 'curtains', 'mirror', 'bookshelf', 'workbench'], buys: 0.4 },
};

/** Item slots: Strength makes for a bigger load. */
export const slots = (s: GameState) => 6 + Math.floor(s.character.skills.strength / 2) + (owns(s, 'chest') ? 4 : 0);

export const owns = (s: GameState, id: string) => s.owned.includes(id);
export const STACK = 5;

export function usedSlots(s: GameState): number {
  return s.inventory.reduce((n, i) => n + Math.ceil(i.qty / STACK), 0);
}

export function canCarry(s: GameState, id: string): boolean {
  const have = s.inventory.find((i) => i.id === id);
  if (have && have.qty % STACK !== 0) return true;
  return usedSlots(s) < slots(s);
}

export function addItem(s: GameState, id: string, qty = 1): void {
  const have = s.inventory.find((i) => i.id === id);
  if (have) have.qty += qty;
  else s.inventory.push({ id, qty });
}

export function removeItem(s: GameState, id: string, qty = 1): boolean {
  const have = s.inventory.find((i) => i.id === id);
  if (!have || have.qty < qty) return false;
  have.qty -= qty;
  if (have.qty === 0) s.inventory = s.inventory.filter((i) => i !== have);
  return true;
}

export function useItem(s: GameState, id: string): string | null {
  const def = ITEMS[id];
  if (!def.use || !removeItem(s, id)) return null;
  for (const [k, v] of Object.entries(def.use)) addNeed(s.needs, k as NeedId, v);
  return `${def.verb ?? 'Use'}: ${def.name}.`;
}

export function buy(s: GameState, id: string, price = ITEMS[id].price): 'ok' | 'money' | 'full' | 'owned' {
  const def = ITEMS[id];
  if (def.upgrade && owns(s, id)) return 'owned';
  if (s.money + 1e-9 < price) return 'money';
  if (!def.upgrade && !canCarry(s, id)) return 'full';
  s.money = Math.round((s.money - price) * 100) / 100;
  if (def.upgrade) s.owned.push(id);
  else addItem(s, id);
  return 'ok';
}

export function sellPrice(shop: Shop, id: string, rate = shop.buys): number {
  return Math.max(0.01, Math.floor(ITEMS[id].price * rate * 100) / 100);
}

export function sell(s: GameState, shop: Shop, id: string, rate = shop.buys): number {
  if (!removeItem(s, id)) return 0;
  const p = sellPrice(shop, id, rate);
  s.money = Math.round((s.money + p) * 100) / 100;
  return p;
}
