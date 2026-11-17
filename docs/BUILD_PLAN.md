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
| M4 | **The Copper Cup and shopping** | Order Juggling minigame, ranks 1–3, food stalls and a shop, inventory and items, eating, second job with the Rest trade-off | Two jobs work and you can feed yourself |
| M5 | **The people of Saltwharf** | About 15 residents with schedules, class, traits and attraction; interaction menu; friendship, romance, rivalry and business meters; contact list | You can befriend, offend and start romancing residents |
| M6 | **Night in Saltwharf** | Turn-based combat, night robberies, stepping into street fights, pay / fight / talk options by skill and job, hospital and its bill | You can be robbed, fight back or talk your way out |
| M7 | **Falling and rising** | Eviction, sleeping rough, theft while asleep, balancing pass on money and needs, audio, polish, performance on low-end phones | The slice plays end to end for a full in-game month |

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
