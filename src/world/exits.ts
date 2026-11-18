/** The roads out of Saltwharf. Each leads toward a district on the London map; walk there to travel. */
export interface DistrictExit {
  id: string;
  /** The London map district this road leads toward. */
  to: string;
  title: string;
  description: string;
  /** Where you stand to take the road. */
  door: { x: number; z: number };
}

export const EXITS: DistrictExit[] = [
  {
    id: 'market', to: 'market', title: 'The road to Lantern Market',
    description: 'Back Lane runs west out of Saltwharf, past the last gas lamp, to Lantern Market and the omnibus depot. Mayfield lies beyond it.',
    door: { x: 43, z: 24 },
  },
  {
    id: 'hollow', to: 'hollow', title: 'The Hollow Lane arch',
    description: 'A dark arch at the west end of the waterfront. Past it, Hollow Lane: the rookery, where the lamps are fewer and the doors have no numbers.',
    door: { x: 43, z: 12 },
  },
  {
    id: 'north', to: 'inkwell', title: 'Gravel Lane, going north',
    description: 'The alley off Church Street climbs north, out of the fog, to the presses of Inkwell Row and the hill of Greymourne.',
    door: { x: 37, z: 39 },
  },
  {
    id: 'wherry', to: 'ironmonger', title: 'The Wherry Stairs',
    description: 'Slimy steps down to the water, where the watermen will row you across the Thames to Ironmonger\'s Cross for a penny.',
    door: { x: 36, z: 4 },
  },
];

/** Which road leads toward each district on the London map. */
export const ROUTE_TO: Record<string, string> = {
  market: 'market', mayfield: 'market', hollow: 'hollow', inkwell: 'north', greymourne: 'north', ironmonger: 'wherry',
};
