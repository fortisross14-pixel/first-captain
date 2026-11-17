# The Pale Lamps

A dark gothic life-sim RPG set in a fictional Victorian London (1871): work, rent, needs, relationships, factions and the fog. Low-poly 3D, angled top-down camera, built for phones and tablets.

- Build plan and milestones: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- Story and world design: the *Pale Lamps Story Bible* (Claude Docs)

## Current state: M4, The Copper Cup and shopping

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

Pushing to `main` deploys to GitHub Pages.
