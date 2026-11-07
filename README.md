<p align="center">
  <img src="docs/media/hero.svg" alt="Groundwork: find the land California's new housing laws opened" width="100%">
</p>

<p align="center">
  <b>Find the land California's new housing laws opened, without a GIS team.</b><br>
  Every parcel in Santa Ana, sifted one legal test at a time. Every cut cites its data.
</p>

<p align="center">
  <a href="#run-it">Run it</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#data">Data</a> ·
  <a href="#what-to-trust">What to trust</a>
</p>

---

## The problem

Small housing nonprofits find land by luck: a city calls about surplus land, or a church offers its parking lot. Meanwhile California has passed laws that open land that used to be off-limits: church and college land (SB 4), lot splits (SB 9), small-lot subdivisions (SB 684 / SB 1123), commercial corridors (AB 2011), and public land that agencies must offer to affordable builders first (Surplus Land Act).

The laws are public. The parcel data is public. But answering "can we build here?" for one parcel means stacking five to eight map layers, and nobody can do that for 58,000 parcels by hand.

Groundwork does it for the whole city, shows its work, and ends every screen in something a one-person acquisitions team can do today.

> Built for Lane 1, **Find it**, at the Claude Impact Lab (UC Irvine, Nov 2026). A prototype for screening, not legal, financial or lending advice.

## How it works

<p align="center">
  <img src="docs/media/sieve.svg" alt="The sieve: 57,926 parcels filtered test by test down to 90 lots worth a call" width="100%">
</p>

**1. Say what you're looking for, in plain words.** Pick a lens like *Church & college land*, or type "that dead Kmart on 17th with the giant empty lot". Claude reads the request into a lens and filters, and you see what it understood (and how many lots match) before you press Enter.

**2. Watch the city get sifted.** All 57,926 parcels start on the map. Each legal or physical test runs in turn; parcels that fail fall away in a wave, and a receipt writes itself: how many each test removed, under which statute page, from which dataset. Tests no public data can answer never remove anything. They stay on every lot as an open question.

**3. Work the shortlist.** Survivors are ranked by a transparent score (every point is listed on the site page). Save, pass with a reason, or filter by transit, open land and minimum homes. Print a one-page board brief of your saved lots.

**4. Open a lot.** A verdict in plain words, an estimate of homes (labeled as an assumption), every check grouped into *didn't pass*, *passed* and *no public data can answer these yet*, each with its dataset, link and date. Then a next step and a first letter to the owner, drafted by Claude and never sent.

**Already have a lot in mind?** Search any address or APN and see how all five laws apply to it.

### The five lenses

| Lens, in plain words | Law | What we check | What stays a question |
|---|---|---|---|
| Church & college land | SB 4 · Gov Code 65913.16 | Place of worship mapped (OpenStreetMap + SCAG land use 1245), fire zone, FEMA flood zone | Ownership since Jan 1, 2024; fault zone; 75% urban edge; heavy industry within 1,200 ft |
| Public land for sale | Surplus Land Act · Gov Code 54220+ | Notice of Availability on file, response window | Surplus vs. exempt surplus |
| Underused commercial lots | AB 2011 · Gov Code 65912.100+ | Office/retail/parking zoning, room to build, size | Environmental criteria, industrial neighbors, city exemptions, historic status |
| Room for 10 starter homes | SB 684 / SB 1123 · Gov Code 66499.41 | Multifamily or vacant single-family zoning, lot-size cap, fire zone | Tenants in the last 5 years, urban surroundings |
| Big backyards | SB 9 · Gov Code 65852.21, 66411.7 | Single-family zoning, splittable lot, fire and flood zones | Rented in the last 3 years, historic, rent control |

Every rule, threshold and page citation is in [`docs/rules.md`](docs/rules.md), researched from HCD's fact sheets (April 2026) and marked where a source was secondary or a fact unverified.

## Architecture

<p align="center">
  <img src="docs/media/architecture.svg" alt="Public data flows through a cached pipeline into a page-cited rules engine and the app" width="100%">
</p>

```
public sources ──▶ scripts/data (cached, run once) ──▶ public/data/santa-ana/*.json
                                                            │
                                     src/lib/rules  ◀───────┘   lenses: pool → law → practical → unknown
                                            │
                    src/components (Next.js app) ──▶ deck.gl map · sheet · search · site page
                                            │
                              /api/ask · /api/draft  ──▶  Claude
```

- **Pipeline** (`scripts/data/`): fetches 16 public sources once, caches every response under `data/raw/`, and builds a columnar file of every parcel (centroid, lot area, zone category, a 13-bit flag mask) plus detail records for 5,645 candidate sites. Spatial joins are point-in-polygon on parcel centroids.
- **Rules engine** (`src/lib/rules/`): each lens is an ordered list of steps (`pool`, `law`, `practical`, `flag`, `unknown`), each with its citation and source. The same steps run over 57,926 parcels for the sieve and over one parcel for the site page. No hidden logic.
- **App** (`src/components/`): Next.js 16 and React 19. The map is deck.gl over a muted MapLibre basemap, painted by a small controller outside React that animates 58k points on the GPU only while something moves.
- **Claude** (`src/app/api/`): `claude-opus-5-5` turns plain-language search into a lens and filters (structured output), and drafts owner letters from facts the app supplies (streamed). Without an API key, both fall back to keyword matching and a template.
- **Design** (`DESIGN.md`): two inks on white stock, Bricolage Grotesque, Inter Tight and Geist Mono. The README animations are authored with Clayzo from the same tokens (`clayzo/readme/`).

```
src/
  app/            page, API routes (ask, draft), error page, /brand design board
  components/     App shell, CityMap, Home, Sieve, Shortlist, SiteDetail, Search, LogoMark, LensIcon
  lib/
    rules/        lenses.ts (the five pathways), engine.ts (sieve + evaluate), cites.ts
    data.ts       loading + normalization        query.ts   plain-language reading
    score.ts      transparent ranking            mapController.ts   per-frame map painting
scripts/
  data/           the pipeline (own package.json)
  check/          render-all.tsx, renders every screen for every lot
docs/rules.md     the law, page by page
```

## Data

Sixteen public sources, each fetched once on Nov 7, 2026 and cached. Each check in the app links to its source and shows the date.

| Source | Used for | Records |
|---|---|---|
| [Santa Ana Assessor Parcels](https://gis.santa-ana.org/server/rest/services/Public/GIS_AssessorParcels/MapServer/0) | Parcel universe, addresses, land and building values | 57,926 |
| [Santa Ana Zoning](https://gis.santa-ana.org/server/rest/services/Public/PBA_ZoningClassifications/FeatureServer/0) | Local zoning per parcel | 3,192 |
| [SCAG Zoning, Existing Land Use, General Plan](https://maps.scag.ca.gov/scaggis/rest/services/LDX) | Zone category fallback, vacancy, religious facilities | 42,896 each |
| [HCD Surplus Land Act notices](https://data.ca.gov/dataset/surplus-land-act-notices-of-availability-received) | Public land offered to affordable builders | 91 in Santa Ana |
| [OpenStreetMap places of worship](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dplace_of_worship) | Church and college land (proxy) | 85 |
| [OC Floodplains (FEMA DFIRM)](https://www.ocgis.com/arcpub/rest/services/Map_Layers/Floodplains/MapServer/0) | Special flood hazard areas | 58 |
| [OC and CAL FIRE hazard severity zones](https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer) | Very high fire zones (none in Santa Ana) | 0 |
| [CGS liquefaction and landslide zones](https://www.ocgis.com/arcpub/rest/services/Map_Layers/Liquefaction/MapServer/0) | Ground risk, as context | 5 / 0 |
| [Caltrans High Quality Transit Areas](https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHrailroad/CA_HQ_Transit_Areas/FeatureServer/0) | Parking waivers (proxy) | 239 |
| [CalEnviroScreen 5.0](https://services1.arcgis.com/PCHfdHz4GlDNAhBb/arcgis/rest/services/calenviroscreen50results_F_070126_gdb/FeatureServer/2) | Pollution burden, as context | 95 tracts |
| [OC Building Footprints](https://www.ocgis.com/arcpub/rest/services/Map_Layers/Building_Footprints/MapServer/0) | How much of each lot is built | 82,550 |

The SCAG housing-element sites layer had no Santa Ana records, so that source is marked failed and nothing depends on it. Full notes, field mappings and every assumption: [`scripts/data/README.md`](scripts/data/README.md).

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL); basemap by [OpenFreeMap](https://openfreemap.org).

## What to trust

Groundwork follows the event's ground rules: no invented facts, every assumption labeled, unknown is an answer.

**Real:** every parcel, zone, hazard and notice comes from the public sources above. Every legal threshold comes from HCD fact sheets with page numbers.

**Assumed, and labeled as assumed in the app:**
- Home counts use density minimums from the fact sheets (SB 4's 30 homes per acre assumes Santa Ana is in a metropolitan county, which is unverified).
- "Practical" filters (minimum lot size, room to build) are our judgment, tagged *our call*.
- The ranking score's weights are ours, and every point is itemized.

**Where it's wrong, or can't know:**
- **Ownership.** No free data says who owns a parcel. A mapped church is a lead, not proof the congregation owns the land.
- **Tenancy, historic status, rent control.** These kill many SB 9 sites and no public layer covers them. They stay as questions.
- **Spatial joins** use parcel centroids, so a lot straddling a flood line can land on either side.
- **Surplus notices.** Every Santa Ana notice is archived as of the data date; the app shows the closed window instead of hiding the lot.
- **Santa Ana only.** The pipeline takes a city config; other cities need their layers wired up.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The parcel data is already built and committed in `public/data/`.

For plain-language search and letter drafts, add a key (optional; without it the app uses keyword matching and a template):

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
```

Check that every screen renders for every lot under every law (about 29,000 views, ~15 s):

```bash
npm run check
```

Rebuild the data from cache, or fetch it fresh:

```bash
cd scripts/data && npm install && cd ../.. && node scripts/data/build.mjs santa-ana --no-fetch
```

## Built with

Next.js 16 · React 19 · deck.gl · MapLibre · Motion · Zustand · Tailwind CSS 4 · Claude (`claude-opus-5-5`) · Clayzo for the README animations.

---

<p align="center"><sub>Prototype. Not legal, financial or lending advice. Nothing here files an application, emails a city, or contacts an owner.</sub></p>
