/**
 * What each resident sounds like, and what being their friend gets you.
 * `hint` is what you notice on first meeting: a clue to their traits.
 */
export interface Voice {
  hint: string;
  friend: string[];
  rival: string[];
  chat: string;
  perk: string;
}

export const VOICES: Record<string, Voice> = {
  nell: {
    hint: 'Split knuckles, a grin with a tooth missing. She looks you up and down like a sparring partner.',
    friend: ['Oi! Still standing, then?', 'Come to the yard at dawn. I\'ll knock the soft out of you.'],
    rival: ['Walk on, before I make you.'],
    chat: 'Nell tells you about a bout in Hollow Lane she won with a cracked rib. She laughs the whole way through.',
    perk: 'Friend: Nell has your back. In a night fight she arrives and lands the first blow.',
  },
  bessa: {
    hint: 'Talks to everyone at once and counts the coins while she does it.',
    friend: ['There\'s my favourite! Sit, sit.', 'You look half-starved, love.'],
    rival: ['Money first, then talk.'],
    chat: 'Bessa tells you who owes her, who owes who, and who is never coming back.',
    perk: 'Friend: a free pint at the Copper Cup once a day.',
  },
  rudd: {
    hint: 'He does not smile. He looks at the river the way other men look at a clock.',
    friend: ['Morning. Tide\'s good today.', 'You\'re steadier than most.'],
    rival: ['Don\'t be late. Don\'t be anything.'],
    chat: 'Rudd talks about cargo weights for ten minutes. It is, for him, a heart-to-heart.',
    perk: 'Friend: Rudd slips you a £0.02 tip after every dock shift.',
  },
  moss: {
    hint: 'Weighs you up like a pocket watch: what are you worth, and what will you fetch?',
    friend: ['Anything for me today?', 'A pleasure, as ever.'],
    rival: ['Prices have gone up. For you.'],
    chat: 'Moss tells you the life story of a silver spoon. It is more interesting than it should be.',
    perk: 'Friend: Moss pays 60% of an item\'s price instead of 40%.',
  },
  pell: {
    hint: 'Hymnbook in her apron pocket, mouth set in a line that has disapproved of better people than you.',
    friend: ['Good day to you. Mind the stairs.', 'You\'re keeping regular hours, I see. Good.'],
    rival: ['Hmph.'],
    chat: 'Mrs. Pell tells you about your aunt Hester, carefully, as if every word might break.',
    perk: 'Friend: 20% off everything at Pell\'s Chandlery.',
  },
  grubb: {
    hint: 'Waistcoat buttons under strain. He calls you by your room, not your name.',
    friend: ['Ah, top floor. Paying prompt, I trust?', 'Good tenant, you. Rare.'],
    rival: ['Rent. Sunday. Don\'t make me climb.'],
    chat: 'Grubb tells you about his properties as if they were his children. He likes them better.',
    perk: 'Friend: two weeks\' grace on late rent instead of one.',
  },
  tom: {
    hint: 'Blushes when you look at him. His hands are raw from rope.',
    friend: ['H-hello! Fine day. Isn\'t it? It is.', 'I saved you a heel of bread. If you want it.'],
    rival: ['…'],
    chat: 'Tom tells you he wants to go to sea. He has never been past Gravesend.',
    perk: 'Friend: Tom shows you the dockers\' tricks: +1 promotion point on every played dock shift.',
  },
  ruby: {
    hint: 'Flowers in her basket, and eyes that have already noted where your money is.',
    friend: ['Watch yourself tonight, sweetheart. There\'s a new face about.', 'Buy a flower? No? Suit yourself.'],
    rival: ['Not you again.'],
    chat: 'Ruby tells you which streets to keep off after dark, and which constables to keep off always.',
    perk: 'Friend: Ruby warns you who is out at night. Robberies happen half as often.',
  },
  hale: {
    hint: 'A curate\'s collar and a Greek book under his arm, which he is clearly longing to discuss.',
    friend: ['Bless you. Have you eaten?', 'I found a passage in Marcus Aurelius I think you\'d like.'],
    rival: ['I shall pray for you. Separately.'],
    chat: 'Father Hale talks about the soul and the sewers, and somehow they turn out to be the same subject.',
    perk: 'Friend: soup at the church door once a day (+35 Hunger).',
  },
  quill: {
    hint: 'Inky cuffs, a doctor\'s bag, and the restless look of a man thinking about three things at once.',
    friend: ['Let me look at you. Hm. Eat more.', 'Have you noticed the fog has a smell lately?'],
    rival: ['I have patients.'],
    chat: 'Dr. Quill tells you about a patient who forgot his own wife after walking home in the fog.',
    perk: 'Friend: a free check-up once a day (+20 Health).',
  },
  mag: {
    hint: 'Talks to the pigeons, and the pigeons seem to answer. She knows your name before you say it.',
    friend: ['There\'s my duck. The shadows were asking after you.', 'Sit with old Mag a while.'],
    rival: ['Mag sees you. Mag remembers.'],
    chat: 'Old Mag tells you what the river said last night. Some of it is about you.',
    perk: 'Friend: Mag keeps watch when you sleep rough.',
  },
  silas: {
    hint: 'Good boots, a ruined coat, and a smile that costs you something.',
    friend: ['Friend. Anything need a new home?', 'Hollow Lane sends its regards.'],
    rival: ['Careful. The fog has ears.'],
    chat: 'Silas tells you a story about a duchess\'s necklace. You suspect the ending was different.',
    perk: 'Friend: Silas buys anything at 70% of its price, no questions.',
  },
  lizzie: {
    hint: 'Pins in her mouth, a tape measure round her neck. She looks at your seams before your face.',
    friend: ['Oh! That collar wants turning. Bring it in.', 'Hello again.'],
    rival: ['We\'re closing.'],
    chat: 'Lizzie tells you she wants to dress a duchess one day. Her eyes go very far away.',
    perk: 'Friend: 20% off everything at Rag & Bone.',
  },
  jem: {
    hint: 'A barrow, a bellow and a joke for everyone who walks past, whether they like it or not.',
    friend: ['Apples! Pies! And for you, a discount!', 'Here, have a laugh on me.'],
    rival: ['Full price, mate.'],
    chat: 'Jem tells you a joke about a bishop and an eel. It is filthy and very funny.',
    perk: 'Friend: 20% off everything at the market.',
  },
  hannah: {
    hint: 'Red forearms from the washtub. She stands like her brother: square, and not to be moved.',
    friend: ['Bring me that shirt. It\'s a disgrace.', 'You\'re all right, you are.'],
    rival: ['I\'ve nothing to say to you.'],
    chat: 'Hannah tells you what the laundry says about the neighbours. Laundry knows everything.',
    perk: 'Friend: Hannah keeps your clothes clean, so people warm to you a little more.',
  },
  ashby: {
    hint: 'Black crape, good gloves gone shiny at the fingertips. She watches the river as if it owes her an answer.',
    friend: ['You again. Good. I need someone sane to talk to.', 'Any news? No. There never is.'],
    rival: ['I have nothing to say to you.'],
    chat: 'Mrs. Ashby tells you about her husband, a clerk who walked home through the fog from Greymourne in August and never arrived. "They say widow. I say missing."',
    perk: 'Friend: Mrs. Ashby shares what she has learned about the fog and the people it takes.',
  },
};

/** Which shopkeeper's friendship gives a discount at which shop. */
export const SHOP_KEEPERS: Record<string, string> = { market: 'jem', hester: 'pell', clothier: 'lizzie', pawnbroker: 'moss' };
