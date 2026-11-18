import type { GameState } from './state';
import type { Fact } from './world';

export interface Letter {
  id: number;
  from: string;
  subject: string;
  body: string;
  day: number;
  read: boolean;
}

export function sendLetter(s: GameState, from: string, subject: string, body: string): void {
  const day = Math.floor((s.minutes + 420) / 1440);
  s.letters.push({ id: (s.letters.at(-1)?.id ?? 0) + 1, from, subject, body, day, read: false });
}

/** Congratulations from a friend, in their own voice. */
export const CONGRATS: Record<string, (rank: string, me: string) => string> = {
  nell: (r, me) => `${me},\n\nRudd says you're ${r} now. About time. Come to the yard and I'll put you on your back to celebrate.\n\nN.H.`,
  bessa: (r, me) => `Dear ${me},\n\nWord at the bar is you've gone up in the world: ${r}! First pint's on me, second's on you.\n\nBessa`,
  rudd: (r) => `${r}. You earned it. Don't let it go to your head.\n\nRudd`,
  moss: (r, me) => `My dear ${me},\n\nI hear you are ${r} now. A rising tide floats all purses. Do remember your friends when you have things to sell.\n\nMoss`,
  pell: (r, me) => `Dear ${me},\n\nI was glad to hear you are ${r} now. Your aunt would have been proud. Mind you keep regular hours.\n\nAgnes Pell`,
  grubb: (r) => `${r}, is it? Then I trust the rent will never again be a difficulty.\n\nJ. Grubb, Landlord`,
  tom: (r, me) => `Dear ${me},\n\nCongratulations on ${r}! I told everyone. Well, I told Lizzie. Well, I nearly did.\n\nYour friend,\nTom`,
  ruby: (r, me) => `${me} love,\n\n${r}! Fancy. Buy a girl a flower some time.\n\nR.`,
  hale: (r, me) => `My dear ${me},\n\n"Seest thou a man diligent in his business? He shall stand before kings." Proverbs 22:29. ${r} is a fine start.\n\nA. Hale`,
  quill: (r, me) => `${me},\n\nCongratulations on becoming ${r}. Eat properly, now you can afford it. Doctor's orders.\n\nE.Q.`,
  mag: (r) => `the river told me. ${r}. the river is pleased. so is mag.`,
  silas: (r, me) => `${me},\n\n${r}. Doors open for people going up. Some of them are mine.\n\nS.C.`,
  lizzie: (r, me) => `Dear ${me},\n\n${r}! You'll want something better to wear now. Come and see me.\n\nLizzie`,
  jem: (r, me) => `OI ${me.toUpperCase()}!\n\n${r}!! Pies on me!! (one pie)\n\nJem`,
  hannah: (r, me) => `${me},\n\nMy brother says you're ${r} now and that you work hard. From him that's a sonnet.\n\nHannah`,
};

/** Letters from Hester, found by Mrs. Pell among the chandlery's papers: story breadcrumbs, one a week. */
export const HESTER_LETTERS: string[] = [
  'My dear,\n\nIf you are reading this, I am gone and the room is yours. Pembleton will be insufferable. Let him. He is kinder than he sounds.\n\nDo not open the trunk until you are ready. You will know.\n\nH.',
  'Mr. Vane came to the shop today with his white lamps and his pleasant smile. He asked whether this building had "a history". I told him every building in Saltwharf has a history, and most of it is damp.\n\nH.',
  'The fog has a smell this autumn. Not the river. Something older, like a church after the candles are out. The ones who walk home through it forget small things first. Names. Then the way home.\n\nH.',
  'There were Wardens in London once. Not many. Now there is me, and I am tired. If the bindings fail, the trunk will tell you what to do. Trust Mag. Do not trust anyone who offers you light for nothing.\n\nH.',
];

/** Today's Gazette: world news, local news drawn from what's happened, and a warning that matches real danger. */
export function gazette(s: GameState, day: number, hot: string, recent: Fact[], name: string): string[] {
  const pick = <T,>(a: T[]) => a[(day * 7 + a.length) % a.length];
  const world = [
    'VANE LAMPS TO LIGHT ALL OF QUAY STREET BY CHRISTMAS, SAYS COMPANY',
    'FOG THICKER THAN ANY AUTUMN IN LIVING MEMORY, CLAIMS OLDEST DOCKER',
    'DOCKERS GRUMBLE AT PENNY CUT IN DAILY RATE; STRIKE TALK IN THE PUBS',
    'COAL UP A FARTHING THE SCUTTLE AS WINTER NEARS',
    'MISSING: LAMPLIGHTER LAST SEEN NEAR GREYMOURNE; FAMILY OFFERS REWARD',
    'METROPOLITAN BOARD PRAISES NEW SEWER WORKS; WORKMEN REPORT "ODD ECHOES"',
  ];
  const local: string[] = [];
  for (const f of recent) {
    if (f.kind === 'promoted') local.push(`LOCAL ${f.note?.toUpperCase()} RISES: ${name.toUpperCase()} PROMOTED AT THE DOCKS`);
    if (f.kind === 'champion') local.push(`FIGHT NIGHT SENSATION: ${name.toUpperCase()} FELLS ${f.note?.toUpperCase()} AT THE BOXING YARD`);
    if (f.kind === 'evicted') local.push(`ANOTHER TENANT TURNED OUT IN SALTWHARF; LANDLORDS UNREPENTANT`);
  }
  if (s.notoriety >= 2) local.push(`FOOTPADS ROUTED ON QUAY STREET: "A LOCAL WITH FISTS LIKE MALLETS"`);
  const warning = `CONSTABLES WARN OF A GANG WORKING ${hot.toUpperCase()} AFTER DARK`;
  return [pick(world), local[0] ?? pick(['SATURDAY FIGHT NIGHT AT THE BOXING YARD: ENTRY A PENNY, PURSES PROMISED', 'COPPER CUP\'S BESSA HARTIGAN DENIES WATERING THE GIN', 'MARKET PRICES STEADY; EELS "PLENTIFUL AND LIVELY"']), warning];
}
