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

## After the slice

More districts, factions, the main story and the Fog Clock, businesses, marriage, children and aging.
