# The Pale Lamps

A dark gothic life-sim RPG set in a fictional Victorian London (1871): work, rent, needs, relationships, factions and the fog. Low-poly 3D, angled top-down camera, built for phones and tablets.

- Build plan and milestones: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- Game dev playbook (principles and checks): [docs/GAME_DEV_PLAYBOOK.md](docs/GAME_DEV_PLAYBOOK.md)
- Style guide: [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)
- Latest audit: [docs/AUDIT_2026-11-18.md](docs/AUDIT_2026-11-18.md) · repeat it with `node scripts/audit-metrics.cjs` and the `game-audit` skill
- Story and world design: the *Pale Lamps Story Bible* (Claude Docs)

## Current state: M11, a family of your own

Propose, marry at the market cross, bring your spouse home to Hester's room, have or take in children, grow old and die in your sleep; then carry on as your grown child.

### Earlier: M10, a city of lives

About 48 people in Saltwharf and 240 in London, each with a home, a job, a haunt and a family; they age a year every 24 days, court, marry, have children and die, and you're invited. Ask people about their lives to learn where to find them; friendships fade if you stay away; friends can get you hired a rung up. Also: the Gilt & Cameo style, cameo portraits, the Sims-style interaction pie, a tabbed journal and bag with equipment, and landscape and tablet layouts.

### Earlier: M9, Saltwharf lives

Neighbours with their own days: working at their stops, talking to each other (and about you), walking up to ask favours. Bells, the crier, the lamplighter, drunks and a constable; gulls, cats and rats; rain and fog banks; fevers, the missing, a funeral, an eviction and a newcomer; Vane's white lamp and the dead. Plus the rest of M8's list: recipes, mentors and perks, boss moods and a dock strike, feast days, clothes that wear out, and the Vestry election.

### Earlier: M8, a living world

Gossip, jealousy and revenge; letters and the Gazette; readable danger, Black Jack Tully and Fight Night; furniture and outfits people react to.

### Earlier: M7, the Saltwharf vertical slice

**Play it:** https://fortisross14-pixel.github.io/first-captain/

- Eviction, sleeping rough and theft in the night; synthesised sound; a low-graphics mode for older phones

### From M6

- Turn-based fights; robberies at night (pay, fight, talk or run); stepping in when a resident is attacked; the London Hospital and its bill

### From M5

- 15 residents with routines, traits and attraction; tap them to chat, joke, flirt, debate, insult and more; the People screen tracks friendship, romance, rivalry and business

### From M4

- Second job: evenings at the Copper Cup with the Order Juggling minigame; hold two jobs if the hours allow
- Bag and items; the market, Pell's Chandlery and Moss the Pawnbroker

### From M3

- Get hired by Foreman Rudd, work 06:00–14:00 shifts by playing Cargo Stacking, or autopilot at your last grade
- Grades, pay, promotion points, missed shifts, firing; Mudlark → Dockhand → Stevedore; skills grow from work

### From M2

- Title screen, character creator (name, gender, attraction, look, 5 skill points)
- Hester's room and Mr. Pembleton's tutorial; Hunger, Rest, Social and Health; sleep, food, rent at the end of the month
- Journal, autosave and Continue

### From M1

- Saltwharf Docks: the Thames, the quay and barges, Quay Street, Hester's building, the Copper Cup, the dock hiring office, a warehouse, tenements, the market corner, a pawnbroker, a clothier and the boxing yard
- Tap the street to walk (A* pathfinding), tap a building or stall to walk to it and read about it
- Pinch or mouse wheel to zoom
- Day/night clock from 1 October 1871, gaslight at night, fog, one cold white Vane Lamp
- Buildings between the camera and you fade out
- The speed button cycles time 1× / 10× / 60×; `?debug` exposes `window.game` and `?mgseconds=6` shortens minigames, for testing

## Run

```bash
npm install
npm run dev
```

Open the printed URL on your phone (same Wi-Fi) with `npm run dev -- --host`.

## Build

```bash
npm run build
```

Pushing to `main` deploys to GitHub Pages (Settings → Pages → Source must be **GitHub Actions**). The live link appears under **Deployments → github-pages** on the repository page.
