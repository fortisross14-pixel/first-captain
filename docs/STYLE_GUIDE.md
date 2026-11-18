# The Pale Lamps — Style Guide: "Gilt & Cameo, by night"

The Victorian parlour after dark: midnight-blue leather, double gilt rules with flourished corners, ivory pages with engraved hatching, cameo portraits, copperplate names, and gilt hexagon medallions. Chosen on 18 Nov 2026 from three Victorian proposals (Penny Dreadful, Gilt & Cameo, Silhouette & Lantern). It takes Gilt & Cameo's fonts, frames and shapes, swaps its oxblood leather for the midnight blues, and borrows the hexagon dock and the single candle amber from Silhouette & Lantern. It replaces the earlier "Ghost Story" style.

All tokens live at the top of `src/style.css`; the theme itself is the "Gilt & Cameo, by night" block at the end of the file.

## Colour

| Token | Value | Use |
|---|---|---|
| `--night` | #060A14 | Background, the world's edge |
| `--sheet-hi` → `--sheet` → `--sheet-lo` | #17264A → #0F1A33 → #0A1226 | Midnight leather: panels, plaques, frames |
| `--gilt-hi` / `--gilt` / `--gilt-lo` | #F0D78A / #C9A24A / #7A5A1E | Rules, corners, titles, numbers, icons, the brass primary button |
| `--ivory` | #EFE6D2 | Pages: dialogue, the journal, goals, speech bubbles |
| `--ink` | #1B1A24 | Text on ivory |
| `--pale` / `--mist` | #ECE3CC / #A9B3C6 | Text on leather; secondary text |
| `--ember` | #E7B45A | Candle amber: danger, low needs, unread letters. Use sparingly |
| wax red | #D84A3A → #8A1A14 | Seals and stamps only |

## Type

- **IM Fell English** for names of places, numbers, buttons and body headings; **IM Fell English SC** for titles, tabs and labels.
- **Pinyon Script** for people's names (dialogue, bubbles, the journal title). Never for anything longer than a name.
- **EB Garamond** for anything longer than a line, 15–18 px.

## Shapes

- **Panels** (`.gs`): leather with a fine gilt hatch, a gilt border, an inner gilt rule, and four flourished gilt corners (`--corners`).
- **Pages**: ivory with an ink hatch, framed in navy and a gilt rule (dialogue, journal, goals, bubbles).
- **Buttons**: navy leather plaques with a gilt edge; the primary choice is brass with navy text; disabled is hatched.
- **The dock**: four gilt hexagon medallions (Journal, Bag, People, the pocket watch) that turn a sixth when tapped; counts sit in a small gilt badge.
- **Tabs**: ribbon tabs; the active one is brass.
- **Cameo**: an oval portrait in a triple gilt and navy ring, rendered from the speaker's own 3D model (`src/ui/Portraits.ts`). Narration has no cameo. Unknown speakers show a script monogram.
- **The interaction pie**: the person's cameo at the centre; navy medallion bubbles for groups, ivory pill bubbles for actions, brass for what matters now (a favour you can finish). At most about eight bubbles in a ring; groups open a second ring and the centre turns into a back button. A name card (script name, relationship, role and what they're doing) sits below, or to the left in landscape.
- **Ways out**: a small gilt hexagon with a door and arrow (or a house, for home) floats over every exit (`src/world/doorIcon.ts`).

## Motion

- Panels and pages ease up into place (`paste`, 0.35–0.5 s).
- Dock medallions turn 60° on tap; the watch hands follow the clock.
- Celebrations: gilt titles, wax seals pressed on, gilt motes rising.
- Reduced-motion settings switch all of this off.

## Layout

- **Phone, portrait**: top bar, goals label, dock along the bottom, sheets centred.
- **Landscape and tablets** (aspect ratio above 5:4): the dock stands on the right edge; the top bar stops short of it; dialogue and place panels sit low on the left; the journal, bag and lists open as a sheet on the right, so the street stays visible. Very short landscape screens hide dock labels and shrink the cameo.
- **Large screens** (≥ 1000 × 700): interface pieces are scaled up 1.28×.

## Rules

1. Gilt is for edges, titles and things you can press; never fill large areas with it.
2. Ivory is for what people say and write; leather is for the game talking to you.
3. One warm accent (amber) for danger and attention; wax red only for seals.
4. HUD coverage stays near 17% on a phone in portrait.
5. Touch targets ≥ 44 px; body text ≥ 15 px; labels ≥ 12 px.
