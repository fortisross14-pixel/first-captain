# The Pale Lamps — Game Dev Playbook

The principles this game is built and audited against. Each one ends in checks a build can pass or fail.
Use it at the end of every milestone: run the checks, record results in an audit (see `docs/AUDIT_*.md`), fix what fails.

Sources this draws on: The Sims / The Urbz design (needs, autonomy, social), Stardew Valley (daily loop, progression, gentle failure), Self-Determination Theory (autonomy, competence, relatedness), Sid Meier's "interesting decisions", Nielsen's usability heuristics adapted for games, Kevin Lynch's *The Image of the City* (wayfinding), the Game Accessibility Guidelines, Apple/Google touch guidelines, and common mobile WebGL performance practice.

---

## A. Functionality

**A1. The core loop never dead-ends.** From any state the player can recover: no money, no home, no job, no health. Fail forward, never game over (except old age).
- [ ] Every failure state has at least one way out the player can find without outside help.
- [ ] No soft locks: no modal that cannot be closed, no input state where taps are ignored for good.

**A2. Time is fair.** The clock pauses whenever the player is reading or deciding (dialogue, menus, minigames, fights). Penalties tied to time are announced before they bite.
- [ ] Clock paused under every overlay.
- [ ] Anything that can be missed (shifts, rent) is warned about in advance.

**A3. Saving is invisible and safe.** Autosave at natural break points and on backgrounding; a crash or a closed tab loses minutes, not hours.
- [ ] Autosave on location change, sleep, shift end, app hidden.
- [ ] Saves carry a version, so later builds can upgrade them (before public release).

**A4. Systems agree with each other.** Days, shifts, rent months and schedules use one clock and one definition of "a day".
- [ ] Events spanning midnight are attributed to the right day.
- [ ] Simulated time skips (sleep, shifts, hospital) run the same rules as real time (needs, rent, attendance).

**A5. Determinism where it matters, randomness where it's fun.** Outcomes the player plans around (pay, rent, schedules) are predictable; surprises (robberies, moods) are random but bounded.
- [ ] Random events have caps (once per night) and visible causes (carrying money, location, time).

**A6. Performance budget (mid-range phone, 2022).** 30 fps minimum, 60 target; under ~250 draw calls per frame; under ~150k triangles; at most ~6 real-time lights; texture memory under ~100 MB.
- [ ] Draw calls in the busiest view are within budget.
- [ ] A low-quality mode exists and is picked automatically on weak hardware.

---

## B. Mechanics and fun

**B1. Clear loops at every timescale.** Moment (tap, walk, talk), day (work, eat, sleep), week (rent, promotion), month (rent day, relationships), life (career, marriage, family). Each loop has a goal, an action, feedback and a reward.
- [ ] The player can always name their next short-term goal and one long-term goal.

**B2. Interesting decisions (Sid Meier).** A good choice has trade-offs, no option dominates, and the player understands the consequences well enough to choose.
- [ ] Each core choice (which job, rest vs. money, fight vs. pay, who to befriend) has a real cost on every side.
- [ ] No exploit makes other options pointless (e.g. one great shift then autopilot forever).

**B3. Needs create decisions, not chores (The Sims).** Needs pressure the schedule, and fixing them should be quick and sometimes combined with other goals. Late-game, money and skill should automate the drudgery (better beds, a stove, servants).
- [ ] Satisfying a need takes one or two taps.
- [ ] There is at least one way to satisfy two needs at once (e.g. a pint at the tavern: Social + Hunger).
- [ ] Progression reduces need maintenance over time.

**B4. An economy with sources and sinks.** Money must have things worth wanting at every stage: the next room, a better bed, clothes that unlock society, tools that improve a job, a business.
- [ ] At every money level there is a desirable purchase within one to two weeks of play.
- [ ] Items in shops have a use (no decorative dead stock without purpose).

**B5. Competence: mastery and visible growth.** Skill and practice both matter. Minigames are learnable in 5 seconds, master-able over weeks, and get harder as you rise. The player sees their skills making things easier.
- [ ] Each minigame explains itself in one screen and lasts 30–60 seconds.
- [ ] The effect of a skill is shown, not just applied ("Strength 5: the crane is slower").
- [ ] Score feedback during play (combo, popups, sound) so success feels good.

**B6. Relatedness: people who notice you.** NPCs have agency and memory: they greet friends, avoid rivals, ask for things, give gifts, have moments. Relationships unlock things.
- [ ] Every relationship tier changes something (dialogue, discounts, help, quests, romance).
- [ ] NPCs sometimes start interactions.
- [ ] Personality is readable before it's revealed (hints in how they look, act, talk).

**B7. Risk and consequence in proportion.** Danger is telegraphed (fog, dark streets, a lone figure), the player can avoid or prepare for it, and consequences hurt without ruining a week of play.
- [ ] Every attack has a tell or a cause the player could learn.
- [ ] Combat has trade-offs between actions (no option is always best).

**B8. Autonomy: many ways to live.** Any skill set can earn a living; social, work and combat routes all progress.
- [ ] A character built entirely on any one skill can pay rent by week three.

**B9. Pacing and "one more day".** Every day ends with something to look forward to tomorrow (a shift with a promotion close, a friend's birthday, rent day, a new shop item).
- [ ] At sleep, the player is reminded of tomorrow's hook.

**B10. Onboarding teaches by doing.** One concept at a time, first in a safe space, with the reason before the rule.
- [ ] Each system is introduced the first time it matters, by a character, with a task.

---

## C. Navigation and GUI

**C1. Visibility of status (Nielsen 1).** Money, time, needs, next obligation are always readable at a glance, but take minimal space.
- [ ] HUD covers under 15% of a portrait phone screen during free play.
- [ ] The next obligation (shift, rent) is visible without opening a menu.

**C2. Recognition over recall (Nielsen 6).** Interactable things look interactable; names are shown where needed.
- [ ] Every tappable object has a cue (sign, highlight on tap, outline, name label).
- [ ] Places that do nothing are either removed, labelled or given a purpose.

**C3. Wayfinding (Lynch: paths, edges, districts, nodes, landmarks).** The player builds a mental map: distinct landmarks, readable streets, a map screen as the city grows.
- [ ] Each district has a landmark visible from most of it.
- [ ] A map (or a list of places with "go there") exists once there are more than ~8 destinations.
- [ ] Camera orientation is stable and matches any map shown (north up or consistently rotated).

**C4. Touch first.** Targets of at least 44×44 pt, generous hit areas around small things (people), primary actions in the thumb zone (bottom half), no reliance on precision or hover.
- [ ] People and small props can be tapped reliably at default zoom (hit area ≥ 44 pt).
- [ ] Primary actions sit in the lower half of the screen.

**C5. User control and freedom (Nielsen 3).** Every panel closes with one tap, anywhere outside it closes it, actions can be cancelled, and nothing irreversible happens without confirmation.
- [ ] Tapping outside a sheet closes it.
- [ ] Dialogue advances on a tap anywhere, not only on the box.

**C6. Consistency (Nielsen 4).** One visual language for panels, buttons, primary actions; the same gesture does the same thing everywhere.
- [ ] One panel style, one primary-button style, one close pattern.

**C7. Feedback for every action.** Every tap gets a response within 100 ms (marker, sound, highlight); long actions show progress.
- [ ] Tapping something unreachable says so.
- [ ] Money and need changes animate or show a delta.

**C8. Error prevention and recovery (Nielsen 5, 9).** Warn before missing shifts or rent; explain failures in plain words with what to do next.
- [ ] Each failure message includes the way out.

**C9. Accessibility (Game Accessibility Guidelines, basic tier).** Readable text, no colour-only information, adjustable speed and difficulty, sound has text equivalents, no required fast reflexes without an alternative.
- [ ] Body text ≥ 16 px on phones; contrast ≥ 4.5:1.
- [ ] Status never shown by colour alone.
- [ ] Minigames have an assist or easier mode for players who need it.

**C10. Mobile session fit.** Playable in 5–15 minute sessions, safe to interrupt at any time, portrait-first, battery-aware.
- [ ] A meaningful thing can be done in five minutes.
- [ ] Backgrounding pauses the game.
