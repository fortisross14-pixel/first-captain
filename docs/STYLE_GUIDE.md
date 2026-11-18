# The Pale Lamps — Style Guide: "Ghost Story"

A Victorian ghost-story pamphlet printed in moonlight. Penny Dreadful's personality (torn handbills, pasted labels, ticket buttons, stamps, seals, headline moments) in Spectral Fog's palette and type. Chosen on 18 Nov 2026 from four proposals.

All tokens live at the top of `src/style.css`.

## Colour

| Token | Value | Use |
|---|---|---|
| `--night` | #0A0F17 | Background, the world's edge |
| `--sheet-hi` → `--sheet` | #18233A → #111926 | Midnight paper: every panel |
| `--pale` | #DCEFFF | Body ink, labels, the goals label |
| `--vane` | #F4FBFF | Titles, numbers, primary buttons; always with a soft glow |
| `--mist` | #9FB6CC | Secondary text |
| `--lilac` / `--lilac-deep` | #9B8FD0 / #463C7A | Speaker names, section heads, seals, the diary cover |
| `--ember` / `--ember-deep` | #E3A35A / #B5652A | Danger and low needs only; the diary ribbon |

Ember is the only warm colour in the interface; the warmth belongs to the gaslight in the world.

## Type

- **Cormorant Garamond** (500/600, italic) for names, titles, numbers, buttons and stamps; small caps with letter-spacing for labels.
- **Spectral** (300/400) for anything longer than a line.
- Italic display type never below 13.5 px; body text 15–17 px.

## Shapes

- **Panels** are torn sheets (`.gs`, the `--torn` clip path) with grain, faint lilac foxing and a pale ruled line inside the edge (`.ruled`).
- **Buttons** are notched tickets (`--notch` mask). Primary: Vane-white. Secondary: ruled pale outline. Disabled: hatched.
- **Labels** (goals, speech bubbles) are pale paper pasted on at a slight angle with a hard shadow.
- **Stamps** (grades, PROMOTED) are double-ruled, crooked and glowing.
- **The dock** is objects, not boxes: a lilac diary that opens, two engraved coins that flip to show a count, and Hester's pocket watch, whose hands follow the game clock.

## Motion

- Panels *paste* in (rise, settle, un-blur, 0.3–0.5 s). Text *condenses* out of blur.
- The four big moments, queued so they never overlap, tap to skip:
  - **Promotion:** a moonlit broadsheet slams in and a PROMOTED stamp lands.
  - **Goal complete:** a lilac seal presses onto a handbill as a wisp of fog crosses it (rent paid, upgrades bought, the room regained, the first day).
  - **Skill up:** a sigil draws itself in light around the new level.
  - **New friend / courting:** a calling card turns over to show the reward.
- Money and need changes float up from the top bar (pale for gains, ember for losses).
- Fights shake on every blow, with a pale flash for yours and an ember flash for theirs.
- Fog drifts and a vignette sits over the 3D world (compositor-only transforms).
- `prefers-reduced-motion` cuts every animation to an instant.

## Rules

1. Opaque sheets only; no backdrop blur (it costs frames over WebGL on older phones).
2. One glow per element; glow means "Vane-lit", so use it for titles, numbers and primary actions only.
3. Ember means danger or loss. Never decorative.
4. New screens reuse `.gs`, `.ruled`, the ticket buttons and the paste/condense motions; no new frame styles without updating this guide.
5. HUD budget: top bar + goals + dock tokens ≈ 17% of a portrait phone (measured with `scripts/audit-metrics.cjs`). The dock tokens are deliberately larger than the 44 px minimum; that is the 2-point overshoot of the 15% target.
