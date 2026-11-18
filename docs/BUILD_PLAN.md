# The Pale Lamps — Build Plan

The design lives in the Story Bible (Claude Docs). This file tracks how we build it.

**Target:** phone and tablet first, touch only (tap to move, tap to interact), in the browser.
**Tech:** TypeScript + Vite + Three.js. Low-poly models are built in code for now, behind factory functions, so authored models can replace them later.
**Camera:** angled top-down, following the player.
**First goal:** a vertical slice of **Saltwharf Docks**, the starting district. You stay there for a long while before the open world unlocks.

## Vertical slice: what it contains

- Character creation, Hester's room and Mr. Pembleton's tutorial
- Four needs (Hunger, Rest, Social, Health), money, rent due at the end of the month
- Two careers: **Docks** (Strength) and **The Copper Cup** (Charisma, moved to Saltwharf for the slice), ranks 1–3 each
- About 15 residents with schedules, class, traits and relationships
- Food stalls, a small shop, inventory
- One turn-based fight: a night robbery, with pay / fight / talk options, and the hospital
- Eviction and sleeping rough
- Saving and loading

## Milestones

| # | Milestone | Contents | Done when |
|---|---|---|---|
| M1 ✅ | **Saltwharf you can walk** | Three.js setup, angled camera, Saltwharf blockout (river, quay, streets, buildings, props), low-poly player, tap-to-move with pathfinding, tap a building to walk to its door, day/night clock with gaslight and fog, basic HUD, mobile layout | You can walk around Saltwharf on a phone through a full day and night |
| M2 ✅ | **A life begins** | Character creator (name, surname, gender, attraction, look, 5 skill points), Hester's room interior, Mr. Pembleton and the tutorial, needs that drain and restore, sleeping, money, rent and the end-of-month deadline, save/load | You can create a character, live a few days and save |
| M3 ✅ | **First job: the Docks** | Job framework (shifts, grades, pay, promotion points, firing, skipping), job board, Cargo Stacking minigame, ranks 1–3, skills gaining from work | You can get hired, play and skip shifts, and get promoted |
| M4 ✅ | **The Copper Cup and shopping** | Order Juggling minigame, ranks 1–3, food stalls and a shop, inventory and items, eating, second job with the Rest trade-off | Two jobs work and you can feed yourself |
| M5 ✅ | **The people of Saltwharf** | About 15 residents with schedules, class, traits and attraction; interaction menu; friendship, romance, rivalry and business meters; contact list | You can befriend, offend and start romancing residents |
| M6 ✅ | **Night in Saltwharf** | Turn-based combat, night robberies, stepping into street fights, pay / fight / talk options by skill and job, hospital and its bill | You can be robbed, fight back or talk your way out |
| M7 ✅ | **Falling and rising** | Eviction, sleeping rough, theft while asleep, balancing pass on money and needs, audio, polish, performance on low-end phones | The slice plays end to end for a full in-game month |

After the slice: more districts, factions, the main story and the Fog Clock, businesses, marriage, children and aging.

## M1 checklist

- [x] Replace the old Phaser code with a Three.js + Vite + TypeScript setup
- [x] Angled top-down camera that follows the player, pinch / wheel zoom
- [x] Saltwharf blockout: the Thames, the quay with a barge, Quay Street, Hester's building, the Copper Cup, the dock hiring office, warehouse, tenements, market corner with food stalls, pawnbroker, secondhand clothes, boxing yard
- [x] Low-poly player with a walk animation
- [x] Tap-to-move with A* pathfinding and path smoothing
- [x] Tap a building to walk to its door and see what it is
- [x] Day/night clock starting 1 October 1871, gaslight lamps at night, fog
- [x] HUD: date, time, money, rent due; time speed toggle for testing
- [x] Works on phone screens (touch, safe areas, pixel ratio capped)

## M2 checklist

- [x] Title screen over the night-time docks: Continue / Begin a new life
- [x] Character creator: first name, surname, gender, attracted to, skin, hair, coat, trousers or skirt, hat, build, and 5 skill points across the six skills, with a turning 3D preview
- [x] Hester's room: bed, Hester's locked trunk, washbasin, cold stove, larder with three loaves of stale bread, table and candle, the stairs down
- [x] Mr. Pembleton, a translucent Georgian ghost: intro conversation with a choice, tutorial objectives, a first-morning scene, and chats for Social (every two game hours)
- [x] Needs: Hunger, Rest, Social, Health drain while awake; sleep restores Rest and some Health; empty Hunger or Rest hurts Health
- [x] Collapse: Rest at zero knocks you out for six hours; Health at zero gets you carried home (the hospital comes in M6)
- [x] Food: stale bread at home, hot potatoes and eel pies at the market
- [x] Sleep until 06:00 or nap two hours
- [x] Rent: £0.60 collected by Mr. Grubb at the turn of the month; if you can't pay, seven days' grace (eviction comes in M7)
- [x] Journal: skills, needs, purse; save, and save & quit
- [x] Autosave every game hour, on changing location, after sleeping and when the app goes to the background
- [x] Testing aid: `?debug` exposes `window.game`

## M3 checklist

- [x] Job framework (`src/game/jobs.ts`, `src/game/work.ts`): ranks, base pay, shift hours and days, grades, pay multipliers, promotion points, missed shifts, firing and a 28-day rehire ban
- [x] Foreman Rudd hires you at the Dock Hiring Office; Docks shifts run 06:00–14:00, Monday to Saturday; you can turn up from 05:30 until 07:00
- [x] Cargo Stacking minigame (`src/minigames/cargo.ts`): tap to drop crates from a swinging crane; heavier crates score more; lean too far and crates slide into the river
  - Rank 1 Mudlark: the basics · Rank 2 Dockhand: fragile crates, faster crane · Rank 3 Stevedore: wind and a touchier barge
  - Strength slows the crane and steadies the barge; Charisma helps a little
- [x] Grades from score: Excellent (150% pay, +3), Good (120%, +2), Fair (100%, +1), Poor (60%, −2)
- [x] Autopilot: skip the minigame for the pay of your last played grade and no points
- [x] Missing a shift costs 3 points; at −6 you are fired
- [x] Promotion when points and skills allow (Dockhand: 10 points, Strength 3; Stevedore: 15 points, Strength 5, Charisma 2)
- [x] Played shifts train the main and second skill; levels go up on their own
- [x] A shift jumps the clock to its end and drains Hunger and Rest harder than idle hours
- [x] HUD shows your rank and next shift; the journal shows promotion progress
- [x] Testing aid: `?mgseconds=6` shortens minigames
- Pay, XP and difficulty numbers are placeholders for the final balancing pass

## M4 checklist

- [x] Up to two jobs at once, as long as their shifts don't overlap; saves from M3 are upgraded automatically
- [x] The Copper Cup (Bessa Hartigan): 18:00–24:00, every night but Monday; Charisma main, Strength second; Pot Washer → Potboy / Barmaid → Barkeep
- [x] Order Juggling minigame (`src/minigames/bar.ts`): tap a drink, then the patron who ordered it, before they walk out
  - Rank 2 adds drunks you must cut off · Rank 3 adds fights you must break up in time
  - Charisma makes patrons more patient; Strength gives you longer to stop a fight
- [x] Working both jobs (06:00–14:00 and 18:00–24:00) leaves six hours' sleep: Rest is the price
- [x] Bar shifts give Social; a pint at the Copper Cup (£0.02) gives Social too
- [x] Items and inventory (`src/game/items.ts`): food, candles, bandages, tonic, rope; stacks of 5; 6 slots plus one per 2 Strength
- [x] Shops: Saltwharf Market (food: buy, or buy & eat), Pell's Chandlery under Hester's room (supplies), Moss the Pawnbroker (buys anything at 40%)
- [x] Bag: use or drop items
- [x] Fixed: a shift ending at midnight is recorded on the day it started

## M5 checklist

- [x] 15 residents (`src/game/residents.ts`), each with gender, attraction, class, one or two traits, a role, a look, a home door and a daily routine; they walk between stops and go home at night
  - Nell Hartigan, Bessa Hartigan, Foreman Rudd, Moss, Mrs. Agnes Pell, Mr. Grubb, Tom Fairley, Ruby Kettle, Father Ambrose Hale, Dr. Ezra Quill, Old Mag Doyle, Silas Crane, Lizzie Barlow, Jem Cotter, Hannah Rudd
- [x] Tap a resident: you walk up, they stop and wait, and a conversation menu opens
- [x] Eleven interactions (`src/game/social.ts`): chat, joke, compliment, gossip, debate, brag, confide, flirt, propose business, give a gift, insult
  - Success depends on the matching skill, the resident's traits (likes and dislikes from the Story Bible), class, the day's mood and your friendship
  - Flirting needs mutual attraction and some friendship; business needs friendship 25; debate needs some Study
  - Results move four meters: friendship, romance, rivalry, business; you get told when they liked or disliked something
- [x] Five interactions per person per day; every conversation feeds Social and trains the skill used
- [x] Traits are revealed as you get closer (first at friendship 10, second at 30)
- [x] People screen (contact list): everyone you've met, with their label (Acquaintance, Friend, Courting, Rival, Business partner…), known traits and meters
- [x] The three standing extras from M1 are replaced by the residents

## M6 checklist

- [x] Turn-based fights (`src/minigames/fight.ts`): Health is your life bar; Strike (Strength), Guard, Fight dirty (Cunning, can daze), Talk them down (Charisma, breaks their nerve), Use item (bandage or tonic), Run (Cunning)
  - Enemies: Footpad, Dock bruiser, Man with a knife; each has health, damage, accuracy and nerve, and runs when their nerve breaks
- [x] Night robberies: between 21:00 and 05:00 in the street, at most once a night, likelier with more money on you and less likely once you're known to fight back
  - Hand over half your money (or an item if you're broke), Fight, Talk your way out (Intimidate with Strength plus your dock rank and fights won, Persuade with Charisma, Bluff with Cunning), or Run
  - A failed talk or run means they hit first
- [x] Street violence: in the evenings, a resident is set upon. Step in (a fight; win and they're your friend for it), shout for a constable (coin toss), or walk away (they remember)
- [x] Winning earns notoriety (fewer robberies, better intimidation), a little loot and skill XP
- [x] Losing, or Health hitting zero any other way: twelve hours in the London Hospital, a £0.15 bill, and if you were robbed they take 60% of your money and an item. Unpaid bills become debt, taken from your next money

## M7 checklist

- [x] Eviction: if the seven days' grace run out, Grubb changes the lock. Hester's door shows what he wants to let you back in; pay it and the room is yours again
- [x] Sleeping rough: "Sleep rough in the archway" at Gull Court, any night; poor rest, a little Health lost
- [x] Theft while asleep outdoors (also after collapsing in the street): Cunning lowers the odds and can wake you in time; if Old Mag Doyle is your friend (30+) she keeps watch
- [x] Sleeping in your bed puts you in it, and you wake there
- [x] Sound, all synthesised in the browser: river and wind that change with the hour and muffle indoors; clicks, coins, crates, splashes, pours and punches. On/off in the journal
- [x] Graphics: Low (no shadows, 1× pixel ratio, no antialiasing) is picked automatically on modest phones; switch in the journal (applies after reload)
- [x] Balancing pass: conversations give about 40% less, night robberies are a third rarer. A full pass on pay, prices and needs comes once the slice has been played on real phones
- [x] Deploy workflow now names the `github-pages` environment, so the live link shows on the repository page and in each run

## Audit fixes (after M7)

The P1 list from `docs/AUDIT_2026-11-18.md`, done: money sinks and upgrades, relationship rewards and resident voices, goals and the morning summary, the autopilot rule, shift reminders, the slim HUD, touch fixes, and merged geometry (541 → 91 draw calls). Next: the visual and style pass.

## Visual pass: Ghost Story

The style chosen from four proposals is in `docs/STYLE_GUIDE.md`: torn midnight-paper panels, ticket buttons, a diary, flipping coins and Hester's pocket watch in the dock, celebrations for promotions, goals, skills and friends, floating money and need deltas, fight shake, drifting fog over the world, and the title screen condensing out of the fog.

## M8 ✅ A living world

- [x] **Memory and gossip** (`src/game/world.ts`): what you do becomes facts (courting, wronging, helping, promotions, Fight Night wins, eviction) known to whoever saw it. Every night gossip spreads through five circles (docks, the Copper Cup, the church, the street, the Kin), fastest through Ruby, Old Mag and Jem, barely at all through Rudd. The People screen shows what each person has heard.
- [x] **Consequences:**
  - courting two people: when one hears, they confront you next time you meet (apologise, lie, choose them, or brazen it out); avoid them for two days and they write instead;
  - wronging someone the Kin protect (Silas, Ruby): an unsigned warning letter, then two of the Kin wait for you that night;
  - friends of someone you wronged cool on you;
  - friends hear of your promotion and write to congratulate you.
- [x] **Letters** (`src/game/letters.ts`): read them at Hester's door; a lilac badge on the diary counts unread. Congratulations in each friend's voice, love notes, threats from rivals, hospital reminders, and Hester's own letters (story breadcrumbs, one a week via Mrs. Pell).
- [x] **The Saltwharf Gazette** (£0.01 at the market): world news, local news drawn from what you've done, and a warning that names the night's most dangerous street, which really is doubled.
- [x] **Readable danger** (`src/game/danger.ts`): seven zones with their own danger by hour; lamps halve it. Entering a dangerous street warns you and the screen's edges darken. Robberies are telegraphed: a figure follows you, and reaching a lamp or a door makes it turn away.
- [x] **Black Jack Tully**, a named villain in the alley behind Moss's from 22:00: pay his toll, fight him (hard), or back away.
- [x] **Fight Night** (`src/game/fightnight.ts`), Saturdays 20:00–23:00 at the boxing yard: five named opponents ending with Iron Nell Hartigan, purses, the crowd, the Gazette, and the title *the Saltwharf Terror*, which people greet you by.
- [x] **Furniture** from Moss (rug, curtains, bookshelf, looking-glass, workbench) appears in Hester's room. Comfort tops up Social at home; the bookshelf boosts Study, the glass first impressions, the workbench makes trinkets for Arts & Crafts. A stray cat moves into a comfortable room. Pembleton comments on everything.
- [x] **Outfits** from Rag & Bone (docker's jacket, Sunday best, respectable coat) change your 3D model, your odds with each class, and how likely you are to be robbed. Everyone you know reacts the first time they see you in new clothes; Lizzie recognises her own stitching.

## M8 leftovers ✅ The rest of the living world

What the M8 brainstorm promised and M8 didn't build:

- [x] **Food and recipes** (`src/game/food.ts`): onions, eels and mutton at the market; six recipes at Hester's stove (hash, stewed eels, baked apples, mutton stew, sick-room broth). Arts & Crafts makes food go further (+4% a level) and unlocks harder dishes; stew and broth are carried as gifts and remedies.
- [x] **Skill mentors and perks** (`src/game/skills.ts`): a mentor for each skill (Hale, Nell, Lizzie, Bessa, Silas, Mag); lessons once a day, paid for acquaintances, free for friends. Perks at 3, 6 and 10 in every skill (eighteen in all: weather forecasts, cheaper prices, mending, the sight, sleeping rough unrobbed...). The diary lists them and the next one.
- [x] **Boss moods and workplace events** (`src/game/calendar.ts`): Rudd and Bessa have tempers that change pay by 15% either way. A dock strike once in the second or third week: picket with the dockers or cross the line for double pay; the outcome sets a permanent raise, or a grudge.
- [x] **Calendar**: All Hallows' Eve (the dead visible to all), Bonfire Night (a bonfire, a Guy, a crowd, safer streets), Martinmas (good bosses, a free goose), and Sunday services at the market cross.
- [x] **Clothes condition**: work, fights, rain and rough sleep wear clothes down; shabby and ragged clothes lose their bonus and draw comments. Lizzie mends them (free for a friend), or mend them yourself at Arts & Crafts 6.
- [x] **Parish politics** (`src/game/parish.ts`): stand for the Vestry with Father Hale (Study, friends, a roof, a deposit), canvass for pledges, speak at the market, and win the count against Mr. Grubb; then Churchwarden against Moss. Offices change greetings, rent grace and the parish purse. Beyond: Guardian, Board of Works, Alderman, Lord Mayor, in later districts.

## M9 ✅ Saltwharf lives

The Animal Crossing feeling, darker: residents have their own lives and you walk through them.

- [x] **Activities**: every routine stop has something to do, with a pose and a prop: Jem crying his wares with a basket, Nell shadow-boxing, dockers hauling crates up and down the quay, Hannah at the washtub, Hale preaching, Mag feeding the pigeons, Bessa sweeping then counting, Silas smoking in the alley. Passers-by mutter and shout their trade.
- [x] **Neighbours talk to each other**: pairs stop and chat in bubbles about you (drawn from what they know, which really spreads), the missing, the sick, the strike, the Vane lamps, the weather. Close by, you overhear.
- [x] **Residents come to you** (`src/game/quests.ts`): friends walk up with favours: fetch something, find something lost (it glints in the gutter), meet them somewhere at an hour, read a letter for them (Study). Done favours pay in friendship and reputation; ignored ones go sour, or arrive as "You never came" letters.
- [x] **Town rhythm** (`src/engine/Life.ts`): church bells on the hour, the crier at 08:00 calling the day's headlines, the lamplighter on his round at dusk, drunks singing home from the Copper Cup, a constable with a lantern on Quay Street (safer near him).
- [x] **Creatures and weather**: gulls on the quay that scatter as you pass, crows, Mag's pigeons, stray cats, rats at night. Rain (streaks, sound, emptier streets, soaked clothes) and fog banks (closed-in light, more danger, and people go missing), chosen each night.
- [x] **Life changes**: fevers (bring broth), missing persons who come back from the fog days later with no memory, old Sam Pike's funeral, the Okafors evicted onto a cart, and Mrs. Constance Ashby moving into their room, looking for a husband the fog took.
- [x] **The darker layer**: Vane's men install a white lamp on the quay and want to put one on your stair; with Occult 3 you see the dead at night, and at Occult 6 they talk.
- [x] Performance: creatures are merged into one or two meshes each; Quay Street by day is 118 draw calls (budget 250, was 91 before M9).

## Visual pass 2 ✅ Gilt & Cameo, by night

- [x] New style (see `docs/STYLE_GUIDE.md`): midnight-blue leather, gilt frames with flourished corners, ivory pages, IM Fell, Pinyon Script and EB Garamond, a hexagon dock.
- [x] Dialogue with a cameo portrait of whoever speaks, rendered from their own 3D model; names in copperplate.
- [x] Journal in three pages: Skills (levels, progress, next perk, mentor, needs), Missions (story, favours, goals, work, purse, standing, days ahead) and Options (sound, graphics, save, quit).
- [x] Bag in three tabs. Equipment has slots for hat, cloak, clothes, necklace, wristband and weapon, with 14 new things to wear (caps, bowlers, top hats, bonnets, oilskin and wool cloaks, a mourning locket, a St. Christopher, a cuff, a bracelet, a blackthorn stick, a cudgel, a clasp knife and brass knuckles), each with real effects in fights, conversations, rain, robbery and the sight. Food and Other tabs; mission objects appear in Other.
- [x] Talking to people is a Sims-style pie: their cameo in the middle, a ring of bubbles around them (favours first, then Talk, Kind, Romance, Business, Mean and Ask), each group opening its own ring; the middle goes back. A name card underneath says who they are and what they're doing.
- [x] Exits are marked: a gilt door icon over the stairs in Hester's room, a house over her door in the street.
- [x] Landscape and tablets: the dock moves to the right edge, dialogue and panels to the lower left, sheets open on the right; larger screens scale the interface up.
- [x] Characters rebuilt with more detail: bigger heads with eyes, brows, nose, cheeks and mouth; hair styles (short, long, bun, curls, bald, Georgian wig); beards; collars and cravats, lapels, waistcoats, aprons, belts, pleated skirts, thumbs and soled boots; caps, bowlers, top hats and ribboned bonnets; cloaks, and weapons in hand. Still a few merged meshes each.

## M10 ✅ A city of lives

`src/game/population.ts`. Decided: a year passes every 24 days for ageing, while the calendar keeps its days for rent, shifts and feast days (a literal two-days-a-month calendar would make rent fall due every other day). Saltwharf holds about 48 people; London about 240.

- [x] **Everyone is a person**: the 16 written residents plus about 220 generated people, each with a name, age, class, two traits, a home, a job and a haunt, a spouse, parents and children. About 32 generated people live in Saltwharf (families in Gull Court, Rope Walk and Back Lane; children; widows; old men on the quay steps); the rest live in Greymourne, Hollow Lane, St. Giles, Ashcombe Square, Bow Common and Limehouse Reach and are simulated as records until those districts exist.
- [x] **Routines from jobs**: dockers and lightermen on the quay, laundresses in Gull Court, costers at the market, sweepers and match-sellers on Quay Street, barmaids and clerks indoors or away, children playing, the old on the quay steps; evenings at their haunt, but not every evening.
- [x] **Finding people**: tap someone, Talk, "About their life": they tell you where they work, live and spend their evenings, and it goes on their card. The People screen shows age, work, home, haunt, family, where they probably are right now, and a warning when a friendship is fading. Friends among the generated people (and Mag and Ruby) can tell you where everyone is.
- [x] **Lives, each night**: courtships, engagements and weddings (at the market cross at eleven, with Father Hale and the couple's circles; a supper outside the Copper Cup), births, children starting work at twelve, the old dying in their sleep (story-critical residents are spared for now), widows, and newlyweds moving away when Saltwharf is full. Hand-written residents marry and die too.
- [x] **You are part of it**: friends send wedding invitations, birth announcements and funeral letters; go to the market cross for the wedding (bring a gift) or join the funeral on Quay Street. Someone you were courting marrying another stings.
- [x] **Friendships fade**: after three days without seeing someone, friendship, romance, business and rivalry slowly fall; friends who drop below Friend write to ask where you've been.
- [x] **Recommendations**: a friend who works somewhere puts in a word (Ask in the pie); ask for work within five days and you start at the second rank. Get fired within ten days and they lose face, and patience with you.
- [x] **Your age**: you start at 21; the journal shows your age and your year in Saltwharf.
- [x] Performance: coat tails and cloaks now merge with the body (six draw calls a person); only people near you cast shadows. The busiest morning view is about 200 draw calls.

## After the slice

More districts, factions, the main story and the Fog Clock, businesses, marriage, children and aging.
