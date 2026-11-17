import { addNeed } from './needs';
import type { GameState, NeedId } from './state';

export interface ItemDef {
  id: string;
  name: string;
  /** Shop price in pounds. */
  price: number;
  /** Effects when used. */
  use?: Partial<Record<NeedId, number>>;
  verb?: string;
  blurb: string;
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
  rope: { id: 'rope', name: 'Coil of rope', price: 0.05, blurb: 'Hemp, tarred. Useful for something.' },
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
  hester: { name: "Pell's Chandlery", keeper: 'Mrs. Pell', stock: ['candle', 'bandage', 'tonic', 'rope'], buys: 0 },
  pawnbroker: { name: 'Moss the Pawnbroker', keeper: 'Moss', stock: [], buys: 0.4 },
};

/** Item slots: Strength makes for a bigger load. */
export const slots = (s: GameState) => 6 + Math.floor(s.character.skills.strength / 2);
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

export function buy(s: GameState, id: string): 'ok' | 'money' | 'full' {
  const def = ITEMS[id];
  if (s.money + 1e-9 < def.price) return 'money';
  if (!canCarry(s, id)) return 'full';
  s.money = Math.round((s.money - def.price) * 100) / 100;
  addItem(s, id);
  return 'ok';
}

export function sellPrice(shop: Shop, id: string): number {
  return Math.max(0.01, Math.floor(ITEMS[id].price * shop.buys * 100) / 100);
}

export function sell(s: GameState, shop: Shop, id: string): number {
  if (!removeItem(s, id)) return 0;
  const p = sellPrice(shop, id);
  s.money = Math.round((s.money + p) * 100) / 100;
  return p;
}
