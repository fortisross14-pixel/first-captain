# The First Captain — v2 Foundation

This replaces the old DOM-heavy prototype with a Phaser 3 + TypeScript game foundation.

## Included in this step

- Isometric 22×22 town rendered in Phaser.
- Mouse click-to-move.
- Grid pathfinding around obstacles.
- Buildings, trees, fences, water, lamps, crates and NPCs block movement.
- Depth sorting so the captain passes behind tall scenery correctly.
- Four enterable interiors: home, tavern, sheriff and blacksmith.
- Clickable buildings and NPCs.
- Keyboard interaction (`E`) and exit (`Esc`).
- Procedural placeholder pixel textures, isolated behind asset keys so authored sprites can replace them later.

This is an engine/level foundation. It intentionally does not yet re-add the entire Phase 2 combat and company systems; those should be ported onto this architecture rather than patched into the old React implementation.

## Run

```bash
npm install
npm run dev
```

If npm still points to an internal registry:

```bash
npm config set registry https://registry.npmjs.org/
```

## Build

```bash
npm run build
```

## GitHub

Copy these files into the repository root and commit them on a `v2-phaser` branch:

```bash
git checkout -b v2-phaser
git add .
git commit -m "Build Phaser isometric collision foundation"
git push -u origin v2-phaser
```
