---
name: game-audit
description: Audit The Pale Lamps against the project's game dev playbook (functionality, mechanics and fun, navigation and GUI). Use at the end of a milestone, before a release, or when asked to review the game's design, UX or performance.
---

# Game audit

1. Read `docs/GAME_DEV_PLAYBOOK.md` (the principles and their checks) and the latest `docs/AUDIT_*.md` (what failed last time).
2. Build and serve: `npm run build`, then `npx vite preview --port 4173` in the background.
3. Measure: `node scripts/audit-metrics.cjs`. Compare with the budgets in playbook A6, C1, C4 and C9.
4. Play the slice on an emulated phone (Playwright, `devices['iPhone 13']`, `?debug` exposes `window.game`; `?mgseconds=6` shortens minigames). Take screenshots of the street, a panel, a minigame and a fight.
5. For every check in the playbook, record Pass / Partial / Fail with concrete evidence (a number, a file and line, or what happened on screen) and a fix.
6. Write `docs/AUDIT_<YYYY-MM-DD>.md` in the same format as the previous audit: verdict, measurements, scorecard per section, what's working, priorities (P1–P3), how to repeat.
7. Re-check items that failed last time first, and say which are now fixed.
