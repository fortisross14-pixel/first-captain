import { addNeed } from './needs';
import type { GameState, NeedId } from './state';

export type Outfit = 'plain' | 'work' | 'sunday' | 'coat';
/** Where something is worn. Clothes are the outfit; the rest are kept in `equip`. */
export type Slot = 'hat' | 'cloak' | 'clothes' | 'neck' | 'wrist' | 'weapon';
export const SLOT_NAMES: Record<Slot, string> = { hat: 'Hat', cloak: 'Cloak', clothes: 'Clothes', neck: 'Necklace', wrist: 'Wristband', weapon: 'Weapon' };

/** What worn things do. */
export interface Gear {
  /** Extra damage per blow in fights. */
  fight?: number;
  /** First impressions, all classes (negative for menacing things with respectable folk). */
  dress?: number;
  /** Multiplies the chance of being robbed. */
  robbery?: number;
  /** Rain costs no Health. */
  rain?: boolean;
  /** Counts as Occult for seeing the dead. */
  occult?: number;
  /** Sleeping rough rests better. */
  warm?: boolean;
  /** Look: hat kind and colour, cloak colour, weapon in hand. */
  hat?: 'cap' | 'top' | 'bonnet' | 'bowler';
  color?: number;
  weapon?: 'stick' | 'cudgel' | 'knife' | 'knuckles';
}
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
  /** Equipment: the slot it goes in and what it does. */
  slot?: Slot;
  gear?: Gear;
  /** Something found in the rubbish: worth a little to Moss, more to Lizzie at Rag & Bone. */
  junk?: boolean;
}

export const ITEMS: Record<string, ItemDef> = {
  potato: { id: 'potato', name: 'Hot potato', price: 0.02, use: { hunger: 25 }, verb: 'Eat', blurb: 'Hot enough to warm your hands, at first.' },
  bread: { id: 'bread', name: 'Loaf of bread', price: 0.03, use: { hunger: 30 }, verb: 'Eat', blurb: "Yesterday's, but honest." },
  apple: { id: 'apple', name: 'Apple', price: 0.01, use: { hunger: 10, health: 2 }, verb: 'Eat', blurb: 'Small, sour, slightly bruised.' },
  eelpie: { id: 'eelpie', name: 'Eel pie', price: 0.06, use: { hunger: 45 }, verb: 'Eat', blurb: 'Best not to think about the eel.' },
  meatpie: { id: 'meatpie', name: 'Meat pie', price: 0.09, use: { hunger: 60, health: 3 }, verb: 'Eat', blurb: 'Real meat. Probably.' },
  onion: { id: 'onion', name: 'Onion', price: 0.01, blurb: 'For the pot. Eating it raw is a cry for help.' },
  eel: { id: 'eel', name: 'Live eel', price: 0.03, blurb: 'Still wriggling in its paper. For the stove.' },
  mutton: { id: 'mutton', name: 'Scrag of mutton', price: 0.05, blurb: 'Bone, gristle and hope: a stew or a broth.' },
  stew: { id: 'stew', name: 'Pot of mutton stew', price: 0.18, use: { hunger: 75, health: 10 }, verb: 'Eat', blurb: 'Home-cooked. The best gift in Saltwharf.' },
  broth: { id: 'broth', name: 'Jar of broth', price: 0.12, use: { hunger: 30, health: 15 }, verb: 'Drink', blurb: 'For the sick. Quill swears by it.' },
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
  // Equipment: bought once, worn in a slot.
  flatcap: { id: 'flatcap', name: 'Tweed flat cap', price: 0.08, upgrade: true, slot: 'hat', gear: { hat: 'cap', color: 0x4a4236, dress: 0.01 }, blurb: 'Every docker in London owns one. Blend in.' },
  bowler: { id: 'bowler', name: 'Bowler hat', price: 0.35, upgrade: true, slot: 'hat', gear: { hat: 'bowler', color: 0x1a1a1e, dress: 0.04 }, blurb: 'Clerks and foremen wear them. People assume you can read.' },
  tophat: { id: 'tophat', name: 'Silk top hat', price: 0.7, upgrade: true, slot: 'hat', gear: { hat: 'top', color: 0x121216, dress: 0.06, robbery: 1.2 }, blurb: 'A gentleman\'s hat. Footpads think so too.' },
  bonnet: { id: 'bonnet', name: 'Straw bonnet', price: 0.25, upgrade: true, slot: 'hat', gear: { hat: 'bonnet', color: 0xc8b088, dress: 0.04 }, blurb: 'Ribboned and respectable.' },
  oilskin: { id: 'oilskin', name: 'Oilskin cape', price: 0.4, upgrade: true, slot: 'cloak', gear: { color: 0x3a3a2a, rain: true }, blurb: 'Rain runs off it: no Health lost to the wet.' },
  woolcloak: { id: 'woolcloak', name: 'Heavy wool cloak', price: 0.5, upgrade: true, slot: 'cloak', gear: { color: 0x2a2a3a, warm: true, dress: 0.02 }, blurb: 'Sleep rough without the cold getting in.' },
  locket: { id: 'locket', name: 'Mourning locket', price: 0.3, upgrade: true, slot: 'neck', gear: { occult: 2 }, blurb: 'A curl of someone\'s hair under glass. The dead notice it (+2 Occult for seeing them).' },
  medal: { id: 'medal', name: 'St. Christopher medal', price: 0.2, upgrade: true, slot: 'neck', gear: { robbery: 0.8 }, blurb: 'For travellers. Footpads are superstitious (a fifth less likely to rob you).' },
  cuff: { id: 'cuff', name: 'Leather wrist cuff', price: 0.15, upgrade: true, slot: 'wrist', gear: { fight: 1 }, blurb: 'Steadies the wrist: +1 damage a blow.' },
  bracelet: { id: 'bracelet', name: 'Copper bracelet', price: 0.12, upgrade: true, slot: 'wrist', gear: { dress: 0.03 }, blurb: 'Polished bright. A small vanity people like.' },
  stick: { id: 'stick', name: 'Blackthorn stick', price: 0.2, upgrade: true, slot: 'weapon', gear: { fight: 2, weapon: 'stick' }, blurb: 'A walking stick until it isn\'t: +2 damage a blow.' },
  cudgel: { id: 'cudgel', name: 'Lead-weighted cudgel', price: 0.35, upgrade: true, slot: 'weapon', gear: { fight: 4, weapon: 'cudgel', dress: -0.04, robbery: 0.75 }, blurb: '+4 damage a blow; robbers think twice; respectable people cross the street.' },
  knife: { id: 'knife', name: 'Clasp knife', price: 0.3, upgrade: true, slot: 'weapon', gear: { fight: 3, weapon: 'knife', dress: -0.03 }, blurb: '+3 damage a blow. Constables frown at it.' },
  knuckles: { id: 'knuckles', name: 'Brass knuckles', price: 0.25, upgrade: true, slot: 'weapon', gear: { fight: 3, weapon: 'knuckles' }, blurb: '+3 damage a blow, and they fit in a pocket.' },
  hjournal: { id: 'hjournal', name: 'Hester\'s journal', price: 0, verb: 'Read', blurb: 'Her small, slanting hand. Some pages are water-stained; some are torn out.' },
  hwatch: { id: 'hwatch', name: 'Hester\'s pocket watch', price: 0, blurb: 'Silver, dented, keeps poor time. It stops ticking near anything unnatural.' },
  jmedal: { id: 'jmedal', name: 'A seaman\'s medal', price: 0.3, blurb: 'Engraved: "J. MERROW, BRIG KITTIWAKE, FOR GALLANTRY". Pawned in 1869 by a widow.' },
  dreadful: { id: 'dreadful', name: 'Penny dreadful', price: 0.01, use: { social: 5 }, verb: 'Read', blurb: '"Varney the Vampyre, part XLI." Lurid, cheap, impossible to put down.' },
  armchair: { id: 'armchair', name: 'Button-back armchair', price: 0.6, upgrade: true, furniture: true, blurb: 'Comfort; sit an hour for Rest and a little Social.' },
  wardrobe: { id: 'wardrobe', name: 'Wardrobe', price: 0.8, upgrade: true, furniture: true, blurb: 'Comfort; your clothes wear out more slowly.' },
  plant: { id: 'plant', name: 'Aspidistra in a pot', price: 0.1, upgrade: true, furniture: true, blurb: 'Comfort, for a penny or two. Unkillable.' },
  painting: { id: 'painting', name: 'Seascape in a frame', price: 0.35, upgrade: true, furniture: true, blurb: 'Comfort; it makes the room feel bigger.' },
  clock: { id: 'clock', name: 'Wall clock', price: 0.5, upgrade: true, furniture: true, blurb: 'Comfort, and you wake on time.' },
  lamp: { id: 'lamp', name: 'Oil lamp', price: 0.4, upgrade: true, furniture: true, blurb: 'Read after dark without candles.' },
  cradle: { id: 'cradle', name: 'Cradle', price: 0.5, upgrade: true, furniture: true, blurb: 'For a baby; comfort for everyone else.' },
  // Second-hand furniture from Moss, for Hester's room.
  rug: { id: 'rug', name: 'Turkey rug', price: 0.4, upgrade: true, furniture: true, blurb: 'Comfort: the room tops up Social while you are home.' },
  curtains: { id: 'curtains', name: 'Velvet curtains', price: 0.35, upgrade: true, furniture: true, blurb: 'Comfort; and darker nights mean deeper sleep.' },
  bookshelf: { id: 'bookshelf', name: 'Bookshelf of old books', price: 0.7, upgrade: true, furniture: true, blurb: 'Read from it any time: half as much Study practice again.' },
  mirror: { id: 'mirror', name: 'Looking-glass', price: 0.45, upgrade: true, furniture: true, blurb: 'Tidy yourself each morning: better first impressions all day.' },
  workbench: { id: 'workbench', name: 'Workbench', price: 0.9, upgrade: true, furniture: true, blurb: 'Carve trinkets to sell: Arts & Crafts practice.' },
  scarf: { id: 'scarf', name: 'Wool scarf', price: 0.25, upgrade: true, blurb: 'Sleeping rough costs no Health and rests a little better.' },
  lovetoken: { id: 'lovetoken', name: 'Tom\'s love token', price: 0.01, blurb: 'For Lizzie Barlow, from Tom Fairley, who could not say it himself.' },
  // Finds: what Saltwharf throws away, and what the river gives back.
  rags: { id: 'rags', name: 'Bundle of rags', price: 0.05, junk: true, blurb: 'Filthy, but the paper mills pay for rag. Lizzie buys them.' },
  bottle: { id: 'bottle', name: 'Empty bottle', price: 0.04, junk: true, blurb: 'Rinse it and it is worth a farthing to the brewers.' },
  bones: { id: 'bones', name: 'Clean bones', price: 0.05, junk: true, blurb: 'Mutton, you hope. The bone-boilers pay by the pound.' },
  pipe: { id: 'pipe', name: 'Clay pipe', price: 0.05, junk: true, blurb: 'Hardly smoked. The stem is only a little chewed.' },
  buttons: { id: 'buttons', name: 'Brass buttons', price: 0.08, junk: true, blurb: 'Cut off a coat that won\'t be needing them.' },
  glove: { id: 'glove', name: 'Odd kid glove', price: 0.1, junk: true, blurb: 'Good leather, a lady\'s left hand. Somebody\'s maid is in trouble.' },
  rope: { id: 'rope', name: 'Old rope', price: 0.06, junk: true, blurb: 'Tarred and frayed. Picked apart, it is oakum.' },
  copper: { id: 'copper', name: 'Scrap of copper', price: 0.15, junk: true, blurb: 'Sheathing off a hull. Green, heavy and worth having.' },
  spoon: { id: 'spoon', name: 'Bent silver spoon', price: 0.25, junk: true, blurb: 'Hallmarked. Moss will not ask; you will not tell.' },
  ring: { id: 'ring', name: 'Tarnished ring', price: 0.6, junk: true, blurb: 'Gold under the grime. Somebody dropped a promise in the mud.' },
  watch: { id: 'watch', name: 'Broken pocket watch', price: 0.9, junk: true, blurb: 'Stopped at a quarter past three. The case alone is worth something.' },
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
  market: { name: 'Saltwharf Market', keeper: 'the stallholders', stock: ['potato', 'apple', 'bread', 'onion', 'eel', 'mutton', 'eelpie', 'meatpie', 'dreadful'], buys: 0 },
  hester: { name: "Pell's Chandlery", keeper: 'Mrs. Pell', stock: ['candle', 'candle2', 'coal', 'bandage', 'tonic', 'plant', 'mattress', 'chest'], buys: 0 },
  clothier: { name: 'Rag & Bone Clothiers', keeper: 'Lizzie Barlow', stock: ['work', 'sunday', 'coat', 'flatcap', 'bowler', 'bonnet', 'tophat', 'oilskin', 'woolcloak', 'cuff', 'bracelet', 'scarf', 'gloves', 'apron', 'boots'], buys: 0 },
  pawnbroker: { name: 'Moss the Pawnbroker', keeper: 'Moss', stock: ['jmedal', 'stick', 'cudgel', 'knife', 'knuckles', 'locket', 'medal', 'rug', 'curtains', 'mirror', 'bookshelf', 'workbench', 'armchair', 'wardrobe', 'painting', 'clock', 'lamp', 'cradle'], buys: 0.4 },
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

/** Everything worn, summed. */
export function gear(s: GameState): Required<Pick<Gear, 'fight' | 'dress' | 'robbery' | 'occult'>> & { rain: boolean; warm: boolean } {
  const out = { fight: 0, dress: 0, robbery: 1, occult: 0, rain: false, warm: false };
  for (const id of Object.values(s.equip ?? {})) {
    const g = id ? ITEMS[id]?.gear : undefined;
    if (!g) continue;
    out.fight += g.fight ?? 0;
    out.dress += g.dress ?? 0;
    out.robbery *= g.robbery ?? 1;
    out.occult += g.occult ?? 0;
    out.rain ||= !!g.rain;
    out.warm ||= !!g.warm;
  }
  return out;
}

/** Food is anything you eat or cook with; the rest is "other". */
export const isJunk = (id: string) => !!ITEMS[id]?.junk;
export const isFood = (id: string) => ['potato', 'bread', 'apple', 'eelpie', 'meatpie', 'onion', 'eel', 'mutton', 'stew', 'broth'].includes(id);
