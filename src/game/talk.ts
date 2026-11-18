import type { Activity } from './residents';
import type { Weather } from './calendar';
import type { GameState } from './state';
import type { Fact } from './world';

/**
 * What Saltwharf says when it isn't talking to you: street cries, muttering at work,
 * and neighbours talking to each other, which is how news moves and how you overhear it.
 */
export const ACTIVITY_TEXT: Record<Activity, string> = {
  sell: 'crying their wares',
  box: 'shadow-boxing',
  read: 'reading',
  sweep: 'sweeping the step',
  mend: 'mending',
  drink: 'nursing a drink',
  haul: 'hauling cargo',
  wash: 'scrubbing laundry',
  feed: 'feeding the pigeons',
  count: 'counting coins',
  preach: 'preaching',
  watch: 'watching the street',
  flowers: 'selling flowers',
  smoke: 'smoking a pipe',
  sick: 'wrapped in a blanket, coughing',
  confused: 'staring at nothing',
  lean: 'leaning in a doorway',
  play: 'playing in the street',
};

/** Ambient lines, by person then activity; `*` is any activity. */
export const AMBIENT: Record<string, Partial<Record<Activity | '*', string[]>>> = {
  jem: { sell: ['Eels! Live eels!', 'Taters, hot taters!', 'Apples, a penny the three, and that\'s robbery, that\'s robbery of ME!', 'Fresh as the morning, near enough!'] },
  ruby: { flowers: ['Violets, sweet violets!', 'A flower for your lady, sir?', 'Buy a bunch, love, it\'s cold out.'], '*': ['Got a light?'] },
  nell: { box: ['Hup! Hup!', 'Jab, jab, cross...', 'Come on then!'], haul: ['Heave!', 'Mind your feet!'] },
  tom: { haul: ['Heave... ho.', 'Sorry. Sorry, sir.'], mend: ['Over, under, through...'] },
  rudd: { watch: ['Tide\'s turning.', 'You there! Move it!', 'Six minutes late, that ship.'] },
  hale: { preach: ['"Consider the lilies of the field..."', '"The river gives, and the river takes away."', 'Blessed are the poor. Which is all of us, I suppose.'], read: ['Hm. Hm.'] },
  mag: { feed: ['There, my lovelies, there.', 'Not you. You know what you did.', 'The gulls are quiet. Bad sign.'], '*': ['They\'re under the cobbles, you know.'] },
  bessa: { count: ['Four, five... who\'s had my sixpence?', 'Owes me, owes me, owes me...'], sweep: ['Out, out, the lot of you!'] },
  hannah: { wash: ['Blood out of linen. Always blood.', 'My hands. My poor hands.'] },
  pell: { sweep: ['Mud. Always mud.'], count: ['Tallow up again. Again!'] },
  moss: { count: ['Paste. Paste. Ah, real.', 'Three shillings, not a farthing more.'], lean: ['Everything has a price.'] },
  lizzie: { mend: ['Ow. Ow. Needle.', 'Hem, hem, hem...'] },
  quill: { read: ['Fascinating. Horrifying. Fascinating.'], '*': ['Cough into your sleeve!'] },
  silas: { lean: ['Lovely evening for it.', 'Nothing to see here.'], smoke: ['Mm.'] },
  grubb: { watch: ['Rent day\'s coming. Rent day\'s always coming.', 'Damp? That\'s character, that is.'] },
  ashby: { watch: ['Have you seen him? Tall. Grey coat.', 'The fog took him. I know it did.'] },
};

/** What anyone says while doing something, when they have no lines of their own. */
export const GENERIC: Partial<Record<Activity, string[]>> = {
  play: ['Tag! You\'re it!', 'Can\'t catch me!', 'One, two, three...', 'Mam says come in!'],
  haul: ['Heave!', 'Mind your backs!', 'Easy... easy...'],
  sell: ['Fresh today!', 'Ha\'penny a bunch!'],
  wash: ['My poor hands.', 'Another tub, another penny.'],
  sweep: ['Sweep your crossing, sir? A farthing!'],
  flowers: ['Matches! Lucifers, a ha\'penny!', 'Buy a box, mister?'],
  drink: ['Your health!', 'Another, Bessa!'],
  watch: ['Mornin\'.', 'Cold, ain\'t it.', 'Fog\'s coming.'],
  lean: ['Evenin\'.', 'Heard the news?'],
  mend: ['Over, under, through...'],
  smoke: ['Sailed from Calcutta, I did.'],
  read: ['Hm.'],
  box: ['Hup!'],
};

export const SICK_LINES = ['*cough*', 'Don\'t come close, love.', 'It\'s nothing. *cough* Nothing.'];
export const CONFUSED_LINES = ['What day is it?', 'I was walking home. I was walking home and then...', 'Do I know you?', 'The light. There was a white light.'];

type Pair = [string, string][];

/** A conversation between two residents; [speaker, line] pairs. `you` is the player's first name. */
export function conversation(
  _s: GameState, a: string, b: string, you: string, name: (id: string) => string,
  ctx: { weather: Weather; sick: string[]; missing: string[]; strike: boolean; holiday: string | null; vane: boolean; fact: Fact | null },
  rand = Math.random,
): { lines: Pair; spreads: Fact | null } {
  const A = (t: string): [string, string] => [a, t];
  const B = (t: string): [string, string] => [b, t];
  const pick = <T,>(x: T[]) => x[Math.floor(rand() * x.length)];
  const f = ctx.fact;
  // Gossip about you, most of all: this is how news moves.
  if (f && rand() < 0.7) {
    const about = f.about ? name(f.about).split(' ')[0] : '';
    const lines: Record<string, Pair> = {
      courting: [A(`Have you heard? ${you}'s courting ${about}.`), B(pick([`No! ${about}? Well I never.`, `Again? Who isn't ${you} courting?`, 'Good luck to them.']))],
      wronged: [A(`You know what ${you} did to ${about}?`), B(pick(['I heard. Shameful.', 'Some people.', `${about} had it coming, if you ask me.`]))],
      helped: [A(`${you} helped ${about}, you know. Didn't have to.`), B(pick(['There\'s some good left, then.', 'Wants something, I expect.', 'That\'s decent.']))],
      promoted: [A(`${you}'s ${f.note} now.`), B(pick(['Getting above themselves.', 'Good for them.', 'Next they\'ll want a carriage.']))],
      champion: [A(`Did you see ${you} put down ${f.note}?`), B(pick(['Like a sack of flour!', 'I had money on the other one.', 'Remind me never to cross them.']))],
      evicted: [A(`Grubb put ${you} out on the street.`), B(pick(['Grubb would evict his own mother.', 'Poor soul.', 'Rent\'s rent.']))],
    };
    const l = lines[f.kind];
    if (l) return { lines: l, spreads: f };
  }
  const topics: Pair[] = [];
  if (ctx.missing.length) {
    const m = name(ctx.missing[0]).split(' ')[0];
    topics.push([A(`Any word of ${m}?`), B('Nothing. Went into the fog and never came out.'), A('Like the lamplighter. Like the Ashby man.')]);
  }
  if (ctx.sick.length) {
    const m = name(ctx.sick[0]).split(' ')[0];
    topics.push([A(`${m}'s took bad, I hear.`), B('Fever. Quill\'s been. Shook his head.'), A('He always shakes his head.')]);
  }
  if (ctx.strike) topics.push([A('Are you out with the dockers?'), B('Out till they pay us right.'), A('Rudd says there\'s men in Wapping would work for half.')]);
  if (ctx.holiday === 'bonfire') topics.push([A('Coming to the fire tonight?'), B('Wouldn\'t miss it. Jem\'s made the Guy look like Grubb.')]);
  if (ctx.holiday === 'hallows') topics.push([A('Put a lantern out tonight.'), B('I\'ve put three. And salt on the step.')]);
  if (ctx.vane) topics.push([A('Seen the white lamps going up?'), B(pick(['Lovely and bright.', 'Gives me the shivers.', 'Mag won\'t walk under them.'])), A('Nothing comes for free. Not light, neither.')]);
  if (ctx.weather === 'rain') topics.push([A('Wet enough for you?'), B('My roof\'s leaking in three places. Grubb says that\'s ventilation.')]);
  if (ctx.weather === 'fog') topics.push([A('Smell that fog?'), B('Like a church with the candles out.'), A('Get home before dark tonight.')]);
  topics.push(
    [A('Price of coal!'), B('Price of everything.')],
    [A('Did you sleep?'), B('Not a wink. Them on the stairs again.'), A('Them who?'), B('Exactly.')],
    [A('Bessa\'s watering the gin again.'), B('She\'s watering the water.')],
    [A('Rudd\'s hiring Thursday.'), B('Rudd\'s always hiring. Nobody lasts.')],
    [A('Heard a voice in the river last night.'), B('That\'ll be the drink.'), A('I hadn\'t had any.'), B('Then that\'s worse.')],
    [A('Mr. Vane\'s men were asking about Hester\'s building.'), B('What do they want with that old place?')],
  );
  return { lines: pick(topics), spreads: null };
}
