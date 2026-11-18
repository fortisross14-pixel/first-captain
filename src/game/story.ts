/**
 * The main story, and the Fog Clock that drives it. The story is optional; the fog is not.
 * Every night the fog thickens a little, faster in fog and with every soul it takes.
 * At each threshold an urgent call comes. Finishing an act pushes the clock back.
 * Let it reach 100 and London falls.
 *
 * Act I, "The Fog", is told in Saltwharf: Hester's trunk, her journal and her watch,
 * and the drowned sailor who walks the quay. Acts II–IV need districts still to come;
 * until then the clock slows after Act I and cannot pass 70.
 */
export interface StoryState {
  clock: number;
  /** Highest threshold already announced (25, 50, 75). */
  urgent: number;
  trunk: boolean;
  /** Act I: learn the sailor's name; find something of his; then put him to rest, one way or another. */
  name: boolean;
  medal: boolean;
  act1: 'locked' | 'open' | 'done';
  path?: 'steel' | 'word' | 'coin';
  /** The Kin have been paid to deal with him tonight. */
  kinPaid?: number;
  /** Journal entries unlocked. */
  pages: number;
  fallen?: boolean;
  /** Pembleton has told you what Hester was. */
  told?: boolean;
}

export const newStory = (): StoryState => ({ clock: 8, urgent: 0, trunk: false, name: false, medal: false, act1: 'locked', pages: 0 });

export const SAILOR = { name: 'Jack Merrow', ship: 'the brig Kittiwake', year: 1869 };

/** Hester's journal, page by page. */
export const JOURNAL: string[] = [
  'Michaelmas, 1871. The watch stopped again on the quay tonight, by the Kittiwake\'s old mooring. He was there. The first of them, and the strongest. If I do not quiet him before winter, he will call the others up after him.',
  'He does not know his own name any more. That is what the Pale does: it eats the names first. If I can give him his name back, and something he loved, he may let go. If not, there is the old way, with iron and salt, and it will hurt us both.',
  'The Vane men came again. White gloves, white lamps. Since their lamp went up on the quay the fog comes in thicker every night. Mag says the gulls will not fly over it. Mag is right about most things.',
  'For whoever comes after me. The watch stops when the dead are near; trust it more than your eyes. Pembleton knows what I was. Make him tell you. And do not trust anyone who offers London light for nothing.',
];

/** The urgent calls, at each threshold. */
export const URGENT: Record<number, { title: string; text: string }> = {
  25: { title: 'The fog thickens', text: 'Three nights running the fog has come up from the river and not gone back. People are talking about the drowned man on the quay. Upstairs, the lid of Hester\'s trunk has come unlatched by itself.' },
  50: { title: 'The fog comes up Quay Street', text: 'The fog no longer waits for night. It stands in the lanes at noon. Someone goes missing nearly every night now, and the drowned sailor has been seen at the Copper Cup\'s door. This cannot wait.' },
  75: { title: 'Saltwharf goes dark', text: 'The gas lamps gutter and fail one by one, as if something is drinking the light. Only the white Vane lamp burns on. The streets are not safe at any hour.' },
};

export function clockWord(c: number): string {
  return c < 20 ? 'thin' : c < 40 ? 'thickening' : c < 60 ? 'heavy' : c < 80 ? 'choking' : 'swallowing the city';
}
