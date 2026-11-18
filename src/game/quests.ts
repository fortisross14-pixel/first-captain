import type { GameState } from './state';

/**
 * Neighbours come to you: small favours that build friendships, in each person's voice.
 * fetch: bring them something. lost: find what they dropped, somewhere in a street.
 * invite: meet them at a place and hour. read: read a letter for them (Study).
 */
export type QuestKind = 'fetch' | 'lost' | 'invite' | 'read' | 'sick';

export interface Quest {
  id: number;
  kind: QuestKind;
  who: string;
  /** fetch/sick: item ids that satisfy it; lost: what it is. */
  item?: string[];
  thing?: string;
  /** lost: where it lies. invite: where to meet. */
  at?: { x: number; z: number };
  place?: string;
  /** invite: game-minute window. */
  from?: number;
  to?: number;
  /** lost: picked up. */
  found?: boolean;
  /** Last day it can be done. */
  until: number;
  text: string;
  done?: boolean;
}

interface Ask {
  kind: QuestKind;
  item?: string[];
  thing?: string;
  zone?: string;
  place?: string;
  hour?: number;
  line: string;
}

/** What each person might ask. `{me}` is your first name. */
export const ASKS: Record<string, Ask[]> = {
  mag: [
    { kind: 'fetch', item: ['bread'], line: 'A loaf, {me}. Not for me. For the birds. All right, for me.' },
    { kind: 'lost', thing: 'her lucky gull feather', zone: 'court', line: 'My feather\'s gone. The grey one. Somewhere in the Court. The dead will be cross if it\'s lost.' },
  ],
  jem: [
    { kind: 'lost', thing: 'his purse', zone: 'market', line: 'Lost me purse, haven\'t I! Somewhere round the market. Find it and there\'s a pie in it, swear on me barrow.' },
    { kind: 'invite', place: 'coppercup', hour: 20, line: 'Copper Cup, eight o\'clock tonight. I\'m buying. Once. Don\'t tell anyone.' },
  ],
  tom: [
    { kind: 'fetch', item: ['apple'], line: 'Could you... would you get me an apple? I\'m not hungry. It\'s for someone. Don\'t ask.' },
    { kind: 'read', line: 'There\'s a letter came. From my mam\'s people in Kent. I can\'t... I never learned my letters right. Would you read it?' },
  ],
  hannah: [
    { kind: 'fetch', item: ['coal'], line: 'The copper\'s gone cold and the coal man\'s not been. A scuttle of coal and I\'ll owe you.' },
    { kind: 'read', line: 'A letter from the parish about my brother\'s rates. Read it for me. Rudd won\'t, he\'s too proud to say he can\'t either.' },
  ],
  lizzie: [
    { kind: 'fetch', item: ['candle', 'candle2'], line: 'I\'ve a wedding dress to finish by morning and no light to finish it by. A candle, if you can?' },
    { kind: 'invite', place: 'boxing', hour: 20, line: 'Will you walk with me to the yard tonight, eight o\'clock? I don\'t like the lanes alone after dark.' },
  ],
  pell: [
    { kind: 'fetch', item: ['bandage'], line: 'My hands are cracked raw from the lye. A clean bandage from my own shelf, which I can\'t spare to use. I know. I know.' },
    { kind: 'read', line: 'My eyes are not what they were. This letter from the wholesaler, read it to me slowly.' },
  ],
  nell: [
    { kind: 'fetch', item: ['meatpie', 'eelpie'], line: 'Fight Saturday and I\'m half-starved. A pie, any pie. Meat, eel, I\'m not proud.' },
    { kind: 'invite', place: 'boxing', hour: 15, line: 'Yard at three. Bring your fists. I want to see what you\'ve got.' },
  ],
  ruby: [
    { kind: 'lost', thing: 'her mother\'s ring', zone: 'lanes', line: 'My mother\'s ring. I took it off for a... it doesn\'t matter. It\'s in the lanes somewhere. Please.' },
    { kind: 'invite', place: 'coppercup', hour: 21, line: 'Buy me a drink at the Cup, nine tonight. I\'ll tell you who\'s been asking about you.' },
  ],
  quill: [
    { kind: 'fetch', item: ['tonic', 'broth'], line: 'A tonic, or broth if you can make it. For a patient who can\'t pay. They never can.' },
  ],
  hale: [
    { kind: 'fetch', item: ['bread', 'potato'], line: 'The soup pot is short. Bread or potatoes, for the poor box. You\'ll be thanked in heaven, if nowhere else.' },
  ],
  bessa: [
    { kind: 'lost', thing: 'the cellar key', zone: 'street', line: 'Some fool\'s dropped my cellar key on Quay Street. If it was me, I\'ll deny it. Find it, love.' },
  ],
  rudd: [
    { kind: 'lost', thing: 'his tally book', zone: 'quay', line: 'My tally book. Dropped on the quay. Every man\'s hours are in it. Find it before the river does.' },
  ],
  moss: [
    { kind: 'fetch', item: ['trinket'], line: 'A carved trinket. One of yours. A customer asked. I said I knew the maker.' },
  ],
  silas: [
    { kind: 'lost', thing: 'a little parcel', zone: 'alley', line: 'A parcel. Brown paper. In the alley behind Moss\'s. Don\'t open it. Don\'t ask. Bring it.' },
  ],
};

/** Zone rectangles where lost things fall (match danger.ts zones). */
export const LOST_ZONES: Record<string, { x0: number; z0: number; x1: number; z1: number }> = {
  court: { x0: 1, z0: 15, x1: 7, z1: 16 },
  market: { x0: 8, z0: 17, x1: 16, z1: 23 },
  lanes: { x0: 8, z0: 9, x1: 22, z1: 14 },
  street: { x0: 1, z0: 7, x1: 30, z1: 8 },
  quay: { x0: 1, z0: 4, x1: 30, z1: 6 },
  alley: { x0: 22, z0: 16, x1: 22, z1: 24 },
};

export const PLACE_NAMES: Record<string, string> = { coppercup: 'the Copper Cup', boxing: 'the boxing yard', market: 'the market' };

/** Letters read aloud: a glimpse of someone's life. */
export const READ_LETTERS: Record<string, string[]> = {
  tom: ['"Dear Thomas, your mam is poorly but asks for you. The hop-picking was bad. Your sister is to be married to the Kentish boy with the one ear. Come home for Christmas if you can. Your loving aunt."', 'Tom is quiet for a long time. "One ear," he says at last, and laughs, and wipes his eyes.'],
  hannah: ['"Mr. J. Rudd is hereby notified that the poor rate on the premises at Gull Court is three quarters in arrears..." It goes on. It is not good.', 'Hannah folds it very small. "He sends half his wage to our mother," she says. "He\'d rather die than tell you that."'],
  pell: ['"Madam, we regret the price of tallow must rise again owing to the demand of the Vane Lighting Company, which has bought up the London supply..."', 'Mrs. Pell takes off her spectacles. "Bought up the tallow," she says. "So nobody can make candles but them. Clever. Wicked, but clever."'],
};

export const questDay = (s: GameState) => Math.floor((s.minutes + 420) / 1440);
