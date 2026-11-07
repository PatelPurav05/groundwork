# Groundwork data pipeline

An offline build, run once. Every raw response is cached under `data/raw/<city>/<source>/`, and nothing is fetched again while its cache file exists.

## Run

```sh
cd scripts/data && npm install         # first time only (deps live here, not in the root package.json)
cd ../..
node scripts/data/build.mjs            # fetch anything not cached, then build santa-ana
node scripts/data/build.mjs santa-ana --no-fetch   # rebuild from the cache only (~3 s)
node scripts/data/build.mjs --no-fetch --debug     # also print zoning agreement and coverage stats
```

You can run the fetchers on their own: `node scripts/data/fetch-arcgis.mjs [city]`, `fetch-sla.mjs`, `fetch-osm.mjs`.
To force one source to fetch again, delete `data/raw/<city>/<source>/`.

Deps (installed in `scripts/data/`): `@turf/turf`, `flatbush` (spatial index) and `csv-parse`.

## Outputs

| file | contents |
|---|---|
| `public/data/cities.json` | `[{slug, name, bbox, center, parcelCount, built}]` (lists built cities only) |
| `public/data/<city>/parcels.json` | every parcel in columnar form (see ARCHITECTURE.md). `zoneCodes` = the ZoneCategory list |
| `public/data/<city>/sites.json` | `Site[]` candidates (ARCHITECTURE.md interface), ordered hard signals first |
| `public/data/<city>/sources.json` | dataset registry: url, checked date, status, records, note |
| `public/data/<city>/addresses.json` | `{apn[], address[]}` in the same order as parcels.json. Site addresses only, uppercased, null if missing |
| `data/raw/<city>/_build-report.json` | counts from the last build (flags, candidates, zoning codes) |

## Configuration

`cities.mjs` holds per-city settings: parcel layer and field names, local zoning layer with its code→category map, SCAG `CITY` value, HE `Jurisdiction`, SLA city and bbox. `sources.mjs` holds the shared regional and statewide layers. `anaheim` is a stub marked `incomplete`, and the build refuses to run it until someone fills in its layers.

## Assumptions (all of them)

**Parcels**
- The parcel universe is the Santa Ana Assessor Parcels layer: 57,926 polygons, all of them kept, including the ~742 that share an APN with another parcel (stacked or condo lots). 213 have a null APN, which stays null.
- The `MailAddress` field is never requested, so it is never cached or output. No owner names are published.
- `lot` is the polygon area computed by `turf.area` (geodesic), converted to sq ft. 0 means unknown, and it never occurs.
- The centroid is `turf.centroid`. When that point falls outside the polygon (1,178 irregular lots) the build uses `turf.pointOnFeature` instead, so the point always lies on the lot.
- Coordinates are rounded to 5 decimals in parcels.json and 6 in site outlines.
- APNs are normalised for joins by stripping non-digits. The assessor uses `999-999-99` (46,144) and `999-99-999` (11,569, condo-style), and SCAG `APN24` uses `99999999`. Both reduce to 8 digits.
- `underused` means `ImprovedVal < 0.25 × LandVal`, with both values present and land > 0. Missing values give no flag (4,153 have no land value, 5,498 no improvement value). This flags 16,669 parcels (29%). The looser rule, improvement < land, flagged 70%.
- `yearBuilt` is always null because the layer has no year-built field.

**Spatial joins.** Every layer except SCAG, which joins by APN, is matched point-in-polygon on the parcel centroid. A lot partly inside a zone counts only if its centroid is in the zone.

**Zoning**
- The local code is the city `ZONECLASS` whose polygon contains the centroid. Where an overlay polygon (OZ1) overlaps a base zone, the base zone wins.
- When no local polygon contains the centroid, the code falls back to SCAG `ZN24_CITY`. The local and SCAG codes agree on 99.8% of APN-matched parcels (43,097 / 43,182).
- Category comes from `SANTA_ANA_ZONE_MAP` in `cities.mjs`. SD1–SD98 (Specific Development) zones are not mapped. For those the category falls back to SCAG `ZN24_SCAG` (skipping 7777), then to the SCAG general plan `GP24_CITY` (LR→single_family; LMR/MR/CR→multi_family; UN/DC→mixed_use; GC/PAO→commercial; IND/FLEX→industrial; INS→public; OS→open_space).
- Anything still unresolved has category −1 (unknown).
- A1 (General Agricultural) maps to `other`, although many A1 lots hold single-family homes.

**Flags (bits)**
- `fire_vhfhsz`: OC FHSZ LRA plus CAL FIRE SRA/LRA. No polygon intersects Santa Ana, so the bit is 0 everywhere. Both sources report status ok.
- `flood_sfha`: `SFHA_TF='T'` or `FLD_ZONE` starting with A or V. `hazards.flood` holds the `FLD_ZONE` of the containing polygon, with the SFHA polygon preferred.
- `liquefaction`, `landslide`: centroid inside a CGS Seismic Hazard Zone polygon. No landslide zones intersect Santa Ana.
- `hqta`: centroid in any Caltrans HQTA polygon (corridor or major stop).
- `worship`: set by either of two sources.
  - **OSM** `amenity=place_of_worship`, matched by one of these rules:
    - a node inside the parcel
    - the parcel containing a way's centroid
    - parcels whose centroid is inside the way polygon (campuses)
    - the centre of a relation's bounds
  - **SCAG existing land use** `LU24` = 1245. The label "Religious Facilities" comes from the SCAG legend as recalled; it is unverified because the service publishes no labels.

  `signals.worship.source` is `osm`, `scag-landuse` or `both`. It is a lead (proxy), not proof of ownership. Every worship parcel appears in sites.json (de-duplicated by APN).
- `surplus`: a HCD SLA notice row with `City` = Santa Ana (or Local Agency = Santa Ana with no City), matched by every APN-like token in the APN cell. When no APN matches, the notice's x/y point is used. If a parcel has several notices, the latest `Date Notice Issued` is kept. Sizes like "9,005 SF" are converted to acres; bare numbers are read as acres. Contacts are public-agency staff, as published.
- `he_site`: the SCAG HE layer has no Santa Ana records. Jurisdictions in the bbox are Garden Grove, Irvine and Fountain Valley, and no APN matches. sources.json marks it **failed**, so the UI should treat this test as unknown.
- `vacant`: SCAG `LU24` is 1900 (urban vacant), 3xxx (vacant) or 1247 (public parking facilities). Condo APNs are not in SCAG and so have no existing use.
- `low_cover`: coverage < 0.25. Coverage is the sum of OC footprint `Shape.STArea()` (ft²) for footprints whose centroid falls in the parcel, divided by the lot area.
  - This is an approximation: a footprint straddling a lot line counts fully toward one parcel, and stacked condo polygons each receive it.
  - The footprint capture date is unknown.
  - Parcels with no footprint get coverage 0.
- `ces_high`: the CalEnviroScreen 5.0 `CIscoreP` of the tract containing the centroid is ≥ 75.
- `commercial_corridor`: a proxy. The local zone is a named corridor or arterial district: C5, SP1 (Bristol St), SP2 (Harbor), or CSM. The AB 2011 street-width test is **not** applied, and sources.json says `partial`.

**Candidates (sites.json).** The rules match the app's lens survivors exactly, and there is no cap. A parcel is a candidate if any of these hold ("used" means vacant, low_cover or underused):
- worship, surplus, HE or vacant bit
- **AB 2011:** zone is commercial or mixed_use, AND used, AND lot ≥ 10,000 sq ft
- **SB 684 / 1123:** all three of these:
  - either zone is multi_family or mixed_use with lot ≤ 217,800, or zone is single_family, vacant, with lot ≤ 65,340
  - used
  - lot ≥ 6,000
- **SB 9:** zone is single_family, AND lot ≥ 9,000, AND NOT flood_sfha, AND (low_cover OR vacant)

Sites are keyed by normalised APN. When several parcels share one APN, the one with the largest lot is kept, and parcels with a null APN are kept individually. Distinct APNs that share an identical centroid and lot (condo records) are all kept, because the app dedupes by geometry. The build report counts these groups. Order: hard signals first, then lot size descending.
- The outline is the outer ring of the largest polygon, simplified with `turf.simplify` (high quality, rising tolerance) until it has ≤ 40 vertices (≤ 24 if sites.json would exceed 6 MB).
- `existingUse` is the SCAG LU24 code plus its label (from the SCAG land-use legend as recalled), and `existingUseCode` is the raw LU24 code.

**Failure handling.** A source that fails after retries is written as `status: failed` in `_meta.json` and in sources.json. Its dependent fields become `"unknown"` or null and its flag bits stay 0. The build continues.
