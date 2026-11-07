# Groundwork — architecture

> Find the land California's new housing laws opened up, without a GIS team.
> Lane 1 "Find it", Claude Impact Lab UCI. Prototype: not legal, financial or lending advice.

## The problem we picked

A one-person acquisitions team at a small housing nonprofit (scenario F02) finds sites by luck.
The laws (SB 4, SB 9, SB 684/1123, AB 2011, Surplus Land Act) and the parcel data are public, but
answering "can we build here?" for **one** parcel means stacking 5–8 map layers, and nobody can do
that for 58,000 parcels by hand. So they wait for a phone call.

Discovery is the core job. Verification is the same engine pointed at one parcel (F01, the
congregation that already owns its lot; F03, city staff screening a list for hazards).

## The idea: the sieve

Every other tool shows you a map with layer toggles. Ours shows the **city being filtered**:

1. You open on Santa Ana drawn as ~58,000 dots, one per parcel. Nothing else.
2. You pick what you're looking for in plain words ("church land", "public land for sale",
   "underused strip malls", "big backyards"). Not statute numbers.
3. The sieve runs. Each legal and physical test applies one at a time. Dots that fail fall away
   in a wave, a counter ticks down, and a receipt line writes itself:
   `− 41,203 not zoned for homes · SCAG zoning · checked Nov 6 2026`.
4. What survives lifts off the map and becomes a ranked shortlist.

The receipt *is* the methodology. A judge, a board member or a skeptical city planner can see
exactly why 58,000 became 14, and which datasets made each cut. It also makes "unknown" honest:
tests we can't run are shown as a dashed step that doesn't remove anyone.

## Users, entry points, and what they see first

| Who | Starts from | Gets |
|---|---|---|
| F02 acquisitions lead | **Home: the city + "What are you looking for?"** | Sieve → ranked shortlist → save / pass / draft outreach |
| F01 congregation | **Search pill: "Check an address"** | The sieve run on one parcel: every pathway, test by test |
| F03 city staff | Shortlist **"Flag hazards"** lens / paste a list of APNs | Hazard checks first, with source and date |

## Screens and interactions

Desktop: full-bleed map, one floating left panel (420px) that changes mode. Mobile: the panel is
a bottom sheet with snap points.

1. **Home** — city dots breathe in. Headline + 4–5 lens cards (animated Clayzo illustrations).
   Top: search pill (`⌘K`, opens instantly, no animation: used often).
2. **Sieve** — panel becomes the receipt. Steps animate in sequence (~450ms each, skippable with
   click / `Esc`). Map dots fade + shrink per step (deck.gl attribute transitions).
3. **Shortlist** — Beli-style ranked cards: rank, score ring, address, one-line reason in plain
   English, chips (`~8 homes · assumed`, `2 unknown`). Hover card ↔ pulse dot. Tabs:
   *To review · Saved · Passed*. Keys: `S` save, `X` pass, `↑↓` move.
   Pass asks one tap "why?" (too small / hazard / won't sell / other) — re-ranks similar sites.
4. **Site** — the card expands (shared layout) into the parcel page; map flies to the parcel and
   draws its outline. Verdict line → checks grouped *Passed / Failed / Couldn't check*, each with
   dataset, link and date → *What we don't know* → *Next step* (draft letter to the owner;
   drafted by Claude, never sent).
5. **Saved** — your list, exportable as a one-page board brief (print view) and CSV.

Motion rules (Emil): UI ≤ 300ms with `cubic-bezier(0.23,1,0.32,1)`; keyboard actions never
animate; the sieve is the one long, explanatory animation and is always skippable;
`prefers-reduced-motion` turns the wave into a crossfade.

## Lenses (plain words → law)

| Lens (UI) | Law it maps to | Candidate source | Ownership |
|---|---|---|---|
| Church & college land | SB 4 (Gov Code 65913.16) | OSM `amenity=place_of_worship` joined to parcels | **Proxy — a lead, not a fact** |
| Public land for sale | Surplus Land Act (Gov Code 54220+) | HCD Notices of Availability CSV | From notice |
| Underused commercial | AB 2011 (Gov Code 65912.100+) | Commercial-zoned parcels, low improvement/land value | Unknown |
| Big single-family lots | SB 9; SB 684 / SB 1123 | Single-family zoned parcels by lot size | Unknown |
| Already planned sites | Housing Element sites inventory | SCAG HE sites (Santa Ana) — flag stale ones | Unknown |

Exact tests per lens come from `docs/rules.md` (researched from HCD fact sheets, page-cited).
A test we have no data for is `unknown`, never `pass`.

## Data pipeline (offline, run once, cached)

Scope: **Santa Ana only** (best free data: assessor parcels with land/improvement values, city
zoning, plus SCAG and county layers). Be kind to servers: every raw response is cached in
`data/raw/` and never re-fetched if present.

```
scripts/data/
  fetch-*.mjs      → data/raw/<source>/*.json      (cached, gitignored)
  build.mjs        → public/data/parcels.json      (all parcels, columnar, for the sieve)
                   → public/data/sites.json        (candidates, full detail)
                   → public/data/sources.json      (dataset registry)
```

Spatial joins are point-in-polygon on parcel centroids (stated as an assumption in the UI).

### `public/data/parcels.json` — every parcel, columnar (sieve)

```ts
{
  count: number,
  bbox: [minLng, minLat, maxLng, maxLat],
  zoneCodes: string[],          // lookup table for `zone`
  columns: {
    apn: string[],
    lng: number[], lat: number[],   // centroid, 5 decimals
    lot: number[],                  // lot area sqft from geometry, 0 = unknown
    zone: number[],                 // index into zoneCodes (ZoneCategory below), -1 unknown
    flags: number[],                // bitmask, see FLAGS
  }
}
```

`ZoneCategory`: `single_family | multi_family | mixed_use | commercial | industrial | public |
open_space | other`.

`FLAGS` (bit → meaning; a separate `known` bitmask is not needed if a layer covers the whole city;
if a layer failed to load, sources.json says so and the UI marks that test unknown):

| bit | name | source |
|---|---|---|
| 0 | `fire_vhfhsz` very high fire hazard severity zone | CAL FIRE / OC FHSZ |
| 1 | `flood_sfha` FEMA special flood hazard area (A*/V*) | OC Floodplains or FEMA NFHL |
| 2 | `liquefaction` | OC Liquefaction |
| 3 | `landslide` | CGS Landslide Zones |
| 4 | `hqta` within a high-quality transit area | Caltrans HQTA |
| 5 | `worship` OSM place of worship on parcel | OpenStreetMap |
| 6 | `surplus` Surplus Land Act notice | HCD NOA CSV |
| 7 | `he_site` Housing Element inventory site | SCAG HE sites |
| 8 | `vacant` existing land use is vacant/parking | SCAG existing land use |
| 9 | `low_cover` building footprint covers < 25% of lot | OC Building Footprints |
| 10 | `underused` improvement value < land value | Santa Ana Assessor |
| 11 | `ces_high` CalEnviroScreen percentile ≥ 75 | CalEnviroScreen 5.0 |
| 12 | `commercial_corridor` fronts a commercial corridor (if derivable) | derived |

### `public/data/sites.json` — candidates with detail

```ts
interface Site {
  apn: string
  address: string | null
  lng: number; lat: number
  outline: [number, number][]          // simplified outer ring, lng/lat
  lotSqft: number | null
  zoning: { local: string | null; category: ZoneCategory | null; generalPlan: string | null }
  existingUse: string | null
  yearBuilt: number | null
  assessed: { land: number | null; improvement: number | null }   // Santa Ana assessor
  coverage: number | null              // footprint area / lot area
  hazards: {
    fire: string | null                // zone label or null = not in a zone; "unknown" if layer failed
    flood: string | null               // FLD_ZONE
    liquefaction: boolean | null
    landslide: boolean | null
  }
  transit: { hqta: boolean | null }
  ces: { percentile: number | null; tract: string | null }
  signals: {
    worship?: { name: string | null; religion: string | null; osmId: string }
    surplus?: { agency: string | null; status: string | null; date: string | null;
                contact: string | null; acres: number | null; raw: Record<string, string> }
    heSite?: { lower: number | null; moderate: number | null; aboveModerate: number | null;
               raw: Record<string, string> }
  }
  flags: number                         // same bitmask as parcels.json
}
```

### `public/data/sources.json`

```ts
{ id: string; name: string; url: string; checked: string /* ISO date */; status: "ok" | "failed" | "partial"; note?: string; records?: number }[]
```

## App architecture

- **Next.js (App Router) + TypeScript + Tailwind v4**, static data in `public/data`, deploy on Vercel.
- **Map:** deck.gl `ScatterplotLayer` (58k dots, GPU attribute transitions for the sieve) over a
  MapLibre basemap (OpenFreeMap Positron, heavily muted) — or dots-only "paper" mode.
- **Motion:** Motion (framer-motion) for layout/shared transitions; CSS for everything simple.
  **Clayzo** for the lens illustrations and the empty/loading moments.
- **Rules engine:** `src/lib/rules/` — pure TS. Each lens = ordered `Step[]`
  `{ id, label, law, sourceId, test(parcel) → "pass" | "fail" | "unknown" }`. The same steps run
  over the columnar parcels (sieve) and over one `Site` (site page). No hidden logic.
- **Score:** transparent sum shown on the site page: pathway strength + estimated homes
  (assumption, labelled) + transit/opportunity − hazards − unknowns. Never a black box.
- **Claude:** `/api/draft` drafts the owner letter (claude-sonnet-5-5, key from env). Optional
  `/api/ask` turns "church land near a bus line, 6+ homes" into a lens + filters.
- **State:** zustand store (lens, sieve step, saved/passed with reasons) persisted to localStorage.

## Honesty rules baked into the UI

- Every check line shows dataset + date checked; every assumed number says *assumed*.
- Church/college ownership is always labelled **lead (proxy)**.
- Persistent footer: "Prototype · not legal advice · Santa Ana only · data checked Nov 2026".
- Demo script names what's mocked and where it's wrong.
