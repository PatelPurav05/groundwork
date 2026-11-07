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
| Ink | `--ink` | Body text (blue-black, 15.9:1 on stock) |
| Blue | `--blue` | Headings, primary buttons, pass marks, map dots |
| Coral | `--coral` | The found thing: survivors, the score of the top site, the sieve's cut numbers, selection. Fills and large type only (3:1 on stock) |
| Coral ink | `--coral-ink` | Coral when it must be small text (4.6:1) |
| Muted | `--muted` | Secondary text (6.0:1) |
| Tints | `--blue-tint`, `--coral-tint` | Badges, verdict grounds |

Pass = blue. Fail = coral. Unknown = no ink: a dotted halftone ring in muted. No green, no amber,
no third hue. No violet as a token (overprint appears only inside illustrations, via multiply).

## Type
- **Display: Bricolage Grotesque**, 700-800. Big, tight, poster-like. Sizes 28 / 40 / 64 / 88.
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
- **Score stamp:** a filled blue circle with the score in stock-white Bricolage; a coral ring
  printed 1.5px out of register behind it. Top-ranked site: coral fill.
- **Check row:** mark + label + detail; source and date on expand. Pass mark: blue check in a blue
  tint disc. Fail: coral cross in a coral tint disc. Unknown: dotted ring with "?".
- **Buttons:** primary = blue fill, stock text, pill; secondary = stock-2 fill, ink text; ghost =
  text only. Press scales to .97 in 140ms.
- **Tags:** small pills in tints; "assumed" and "our call" in a dotted outline (no ink).

## Motion
- Ease `cubic-bezier(.23,1,.32,1)`; UI 140-260ms; keyboard actions never animate.
- One authored moment: the sieve. Dots fall away in a wave; the counter's two ink layers slide
  into register as it lands.
- Clayzo illustrations (lens art, logo mark, loading) play on hover or once on arrival; reduced
  motion shows the resting frame.

## Logo
A house built from halftone dots: blue layer and coral layer, the coral printed slightly out of
register. Wordmark "Groundwork" in Bricolage Grotesque 800, tracking -0.03em, blue.

## Changelog
- 2026-11-07: Replaced the beige / serif first pass with the riso world (user's choice).
