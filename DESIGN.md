---
name: Groundwork
world: Riso housing poster
colors:
  stock: "#FBFBF8"
  stock-2: "#F2F3EF"
  ink: "#141B3C"
  blue: "#1D3BA8"
  blue-ink: "#16308E"
  blue-tint: "#E4E8F6"
  coral: "#FF5A4E"
  coral-ink: "#C9372D"
  coral-tint: "#FFE6E2"
  muted: "#5A6178"
  hairline: "rgba(20,27,60,0.12)"
typography:
  display: Bricolage Grotesque (700-800, opsz auto, tracking -0.03em)
  ui: Inter Tight (400-600, 13-16px)
  data: Geist Mono (APNs, acreage, counts in tables only)
radius: { control: 999px, card: 14px, sheet: 0 }
---

# Groundwork design system

## The world
A two-ink risograph poster from a housing-justice campaign, printed on white stock. Two inks only:
**federal blue** and **fluorescent coral**. Everything else is a tint of those inks or the stock.
Where inks overlap they multiply (overprint), and registration is slightly off. That's the
signature, used on purpose in three places only: the logo, the sieve counter, and illustrations.

The parcel map is printed in blue ink as halftone dots. Sites that survive the sieve are
over-printed in coral. Nothing else on the map competes.

## Color roles
| Role | Token | Use |
|---|---|---|
| Stock | `--stock` | Page and sheet ground |
| Stock 2 | `--stock-2` | Pressed / hover ground, inset rows |
| Ink | `--ink` | Body text (blue-black, 16.2:1 on stock) |
| Blue | `--blue` | Display numbers, primary buttons, pass marks, links, map dots (9.0:1) |
| Coral | `--coral` | The found thing: survivors on the map, the top stamp, fail marks, selection. Fills only (2.97:1 on stock); text on coral is ink (5.45:1) |
| Coral ink | `--coral-ink` | Coral as text: cut counts, warnings (4.98:1) |
| Muted | `--muted` | Secondary text (5.93:1) |
| Tints | `--blue-tint`, `--coral-tint` | Badges, verdict grounds |

Pass = blue. Fail = coral. Unknown = no ink: a dotted halftone ring in muted. No green, no amber,
no third hue. No violet as a token (overprint appears only inside illustrations, via multiply).

## Type
- **Display: Bricolage Grotesque**, 700-800. Big, tight, poster-like. Poster numbers 80-88 in
  blue; headings 17 / 21 / 27 / 32-34 in ink.
- **UI: Inter Tight**, 400-600 at 13-16px. Sentence case everywhere. No uppercase eyebrows.
- **Data: Geist Mono**, only for APNs, acreage and counts that sit in lists. Not as decoration.
- Numerals tabular wherever they change or align.

## Surfaces
- The panel is a **printed sheet** docked to the left edge, full height, square corners, a
  hairline edge. Not a floating rounded card with a soft shadow.
- Cards inside the sheet are rows on the stock, separated by hairlines; a selected or hovered
  row gets `--stock-2`. One level deep, never nested.
- Elevation is reserved for floating things (search palette, menus): one shadow,
  `0 18px 50px -18px rgba(20,27,60,.35)`.
- Halftone texture (radial-gradient dots in a blue tint) is allowed on verdict blocks and
  illustrations only, never as a page background.

## Components
- **Score stamp:** a filled blue disc with the score in stock-white Bricolage; a coral disc
  printed ~1.5px out of register behind it. Top-ranked lot: coral disc, ink numeral, blue behind.
- **Check row:** mark + label + detail; source and date on expand. Pass mark: stock check on a solid
  blue disc. Fail: ink cross on a solid coral disc. Unknown: dotted muted ring with "?".
- **Buttons:** primary = blue fill, stock text, pill; secondary = stock-2 fill, ink text; ghost =
  text only. Press scales to .97 in 140ms.
- **Tags:** small pills in tints; "assumed" and "our call" in a dotted outline (no ink).

## Motion
- Ease `cubic-bezier(.23,1,.32,1)`; UI 140-260ms; keyboard actions never animate.
- One authored moment: the sieve. Dots fall away in a wave; the counter's two ink layers slide
  into register as it lands.
- Lens icons: coral homes rise from the ground line on hover; reduced motion shows them still.

## Logo
"Foundation": a blue house standing on a coral foundation slab that runs past its walls and rises
through the doorway as one shape, so the opening into the home is the ground it stands on.
`src/components/LogoMark.tsx`, 32 grid; holds at 16px; a one-colour `mono` version for blue or ink
grounds. Lockup: mark + "Groundwork" in Bricolage Grotesque 800, tracking -0.035em, ink.

## Lens icons
One pictogram system (`src/components/LensIcon.tsx`, 64 grid): front elevations on a shared ink
ground line. Blue = what stands today, coral = the homes the law makes possible. On hover the coral
homes sink below the ground line and rise back (clipped at the ground, ~0.9s, ease-out), so they
emerge rather than slide. Shown on a stock-2 tile, 76px on home, 60px on the verdict.

## Changelog
- 2026-11-07: Replaced the beige / serif first pass with the riso world (user's choice).
- 2026-11-07: Replaced the halftone-dot logo and art direction with the solid "Foundation" mark
  and the ground-line pictogram set (user found the dots off for a premium product).
- 2026-11-07: Map survivor stamps scale with list size (2.6–6.5px) so large lists stay readable.
