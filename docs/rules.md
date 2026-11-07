# Pathway site-eligibility rules (Santa Ana parcel screener)

**Date checked:** 2026-11-07. Not legal advice; the HCD fact sheets themselves say they "do not constitute legal advice."

## Sources read

| Key | Document | URL |
|---|---|---|
| **FS** | HCD *Housing Law Fact Sheets*, combined, "April 2026" footer, 71 pp | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/housing-law-fact-sheets.pdf |
| **SB9-L** | HCD *Duplexes and Lot Splits (SB 9)* (April 2026; same text as FS pp. 48–51) | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/lot-splits-and-duplexes-sb-9.pdf |
| **SB9-FS** | HCD *SB 9 Fact Sheet* (Sept 2024, 9 pp) | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf |
| **SB4** | HCD *Affordable Housing on Faith & Higher Education Lands Act* (April 2026; same text as FS pp. 7–10) | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/aff-hsg-faith-higher-ed-sb-4.pdf |
| **SLA-G** | HCD *Updated Surplus Land Act Guidelines* (2024) | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/final-updated-surplus-land-act-guidelines-2024.pdf |
| **2097** | HCD *AB 2097 Technical Advisory* (Jan 2025, 11 pp) | https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ab-2097-ta.pdf |
| **DD-684** | CalMatters Digital Democracy, SB 684 (2023) bill page. **Secondary source**: the page mixes several bill versions and was read through a summarizing fetch, so check against the chaptered text | https://calmatters.digitaldemocracy.org/bills/ca_202320240sb684 |
| **DD-1123** | CalMatters Digital Democracy, SB 1123 (2024) bill page. **Secondary source**, same caveat | https://calmatters.digitaldemocracy.org/bills/ca_202320240sb1123 |
| (tried) | CalMatters AB 2011 page: the part read had only the digest, no site criteria | https://calmatters.digitaldemocracy.org/bills/ca_202120220ab2011 |

How to read the citations:
- **Page numbers are PDF page numbers.** FS also prints "x of N" inside each sheet; SLA-G, SB9-FS and 2097 print page numbers that match the PDF page.
- **leginfo.legislature.ca.gov was not consulted.** It blocks automated fetch.
- **Verification labels.** Anything marked **unverified (from memory)** must be checked before the demo. "Not stated in source" means none of the documents above say it.

## How to read the check tables

- **Result values.** Each check returns `pass`, `fail` or `unknown`. For an exclusion (a condition that disqualifies the site), "pass" means the condition is absent.
- **Proxy.** A field that only approximates the legal test. A proxy should return `unknown` rather than `pass` when the evidence is weak, and may return `fail` only where noted.
- **Our data fields:** `zone_category`, `zoning_code`, `lot_area_sqft`, `existing_land_use`, `year_built`, `assessed_land_value`, `assessed_improvement_value`, `building_coverage_ratio`, `fire_hazard_zone`, `fema_flood_zone`, `liquefaction_zone`, `landslide_zone`, `in_hqta`, `calenviroscreen_pct`, `pow_proxy_osm`, `surplus_notice`, `housing_element_site`.

---

## 1. SB 4: Affordable Housing on Faith & Higher Education Lands Act (Gov. Code § 65913.16)

**Plain English:** If a congregation or an independent nonprofit college has owned the land since at least Jan 1, 2024, the city must approve a nearly all-affordable housing project there without a public hearing or CEQA review, in any zone. The parcel must be in an urban area, mostly surrounded by urban development, and clear of listed hazards and nearby heavy industry.

| id | label | exact rule (as source states) | citation | data |
|---|---|---|---|---|
| sb4_owner | Owned by a faith or higher-ed institution | "owned by a religious institution or independent higher education institution (including through an affiliated nonprofit) as of January 1, 2024" | SB4 p1; FS p7 | `pow_proxy_osm` (proxy only: OSM shows current use, not ownership or the date). Without the proxy → unknown. Even with it, ownership as of 1/1/2024 is unknown. |
| sb4_any_zone | Any zone allowed | "permitted in all zones, including single-family and non-residential zones" | SB4 p1; FS p7 | Always pass. Use `zone_category` only to pick the density rule (see below). |
| sb4_urbanized | Urbanized area / urban cluster | Legal parcel in "a city where the city boundaries include some portion of an urbanized area or urban cluster as designated by the United States Census Bureau" | SB4 pp1–2; FS pp7–8 | No field. Santa Ana is a city inside a Census urbanized area: **unverified (from memory)**; treat as pass with a note. |
| sb4_urban_perimeter | ≥75% of perimeter is urban | "At least 75 percent of the perimeter of the site adjoins parcels that are developed with urban uses" | SB4 p2; FS p8 | No data → unknown. Possible proxy: `existing_land_use` of neighboring parcels, which needs a spatial join. |
| sb4_tenant_replacement | Demolished housing must be replaced | If the project demolishes housing, or housing was demolished in the last 5 years, it must meet Housing Crisis Act replacement rules | SB4 p2; FS p8 | This is a condition, not a hard exclusion. `existing_land_use` (residential) → flag "replacement required". |
| sb4_x_farmland | Excl.: farmland / agricultural protection | "farmland, land zoned or designated for agricultural protection" | SB4 p2; FS p8 | No data → unknown. Likely pass in urban Santa Ana (assumption). |
| sb4_x_wetlands | Excl.: wetlands | "wetlands" | SB4 p2; FS p8 | No data → unknown |
| sb4_x_vhfhsz | Excl.: very high fire hazard severity zone | "very high fire hazard severity zone" | SB4 p2; FS p8 | `fire_hazard_zone` == Very High → fail |
| sb4_x_hazwaste | Excl.: hazardous waste site | "hazardous waste" | SB4 p2; FS p8 | No data → unknown. A Phase I environmental site assessment (ESA) is required anyway (SB4 p3). |
| sb4_x_fault | Excl.: earthquake fault zone | "earthquake fault zone" | SB4 p2; FS p8 | No data → unknown. **`liquefaction_zone` and `landslide_zone` are not fault zones. Do not use them for this check.** |
| sb4_x_sfha | Excl.: special flood hazard area | "special flood hazard area" | SB4 p2; FS p8 | `fema_flood_zone` in an SFHA (A*/V* zones) → fail. The A/V mapping is **unverified (from memory)**. |
| sb4_x_floodway | Excl.: regulatory floodway | "regulatory floodway" | SB4 p2; FS p8 | `fema_flood_zone` with a floodway designation → fail. Otherwise unknown. |
| sb4_x_nccp | Excl.: conservation-plan land | "lands identified for conservation in an adopted natural community conservation plan" | SB4 p2; FS p8 | No data → unknown |
| sb4_x_habitat | Excl.: protected-species habitat | "habitat for protected species" | SB4 p2; FS p8 | No data → unknown |
| sb4_x_easement | Excl.: conservation easement | "lands under a conservation easement" | SB4 p2; FS p8 | No data → unknown |
| sb4_x_light_ind | Excl.: next to a light-industrial site | "Adjacent to a site where more than one-third of the square footage is dedicated to light industrial use" | SB4 p2; FS p8 | Proxy: a neighbor with `zone_category`=industrial → unknown ("check"). Not an automatic fail. |
| sb4_x_heavy_ind | Excl.: near heavy industry | "Within 1,200 feet of a site permitted for heavy industrial use" | SB4 p2; FS p8 | Proxy: industrial-zoned parcel within 1,200 ft → unknown ("check"). Our data does not separate heavy from light industrial. |
| sb4_x_titlev | Excl.: near a Title V facility | "Within 1,600 feet of a site permitted for Title V industrial use" | SB4 p2; FS p8 | No data → unknown |
| sb4_x_refinery | Excl.: near a refinery | "Within 3,200 feet of an oil or natural gas refinery" | SB4 p2; FS p8 | No data → unknown. Likely pass in Santa Ana (assumption). |
| sb4_x_tribal | Excl.: tribal cultural resources | "Vacant sites that contain tribal cultural resources that could be affected … and whose effects cannot be mitigated" | SB4 p2; FS p8 | No data → unknown (applies to vacant parcels only) |

**Affordability and units**
- 100% of units (excluding managers' units) for lower-income households, except up to 20% may be moderate-income and up to 5% may house staff of the institution. Deed restriction is 55 years for rental and 45 years for ownership (SB4 p1; FS p7).
- No inclusionary requirement may be added solely because a project uses SB 4 (SB4 p4).

**Density and height** (SB4 pp2–3; FS pp8–9):
- **Zone allows residential:** minimum density 15 du/ac (incorporated city, nonmetropolitan county), 10 (unincorporated, nonmetropolitan county), 20 (suburban jurisdiction), or 30 (metropolitan county). Height is one story above the local limit, and a greater local or adjoining-parcel density or height applies if allowed.
- **Zone does not allow residential:** minimum 40 du/ac, plus one story above the local height limit. The density bonus cannot be used to go higher than that.
- Santa Ana's classification (metropolitan, 30 du/ac): **unverified (from memory)**. HCD publishes the jurisdiction list (FS p42 references it).

**Parking:** 1 space per unit, but none within 0.5-mile walking distance of a high-quality transit corridor or major transit stop, or within 1 block of a car share vehicle (SB4 p3). Map this to `in_hqta` as a proxy.

**Labor:** prevailing wage applies. At 50+ units, health care and apprenticeship requirements also apply (SB4 p3).

**Dates:** effective July 2, 2024 through January 1, 2036 (SB4 p1; FS p7).

**Review clock:** 60 days to identify conflicts for ≤150 units, 90 days for >150. Otherwise the project is deemed to comply (SB4 p4).

---

## 2. SB 9: Duplexes and urban lot splits (Gov. Code §§ 65852.21, 66411.7)

**Plain English:** If your lot is in a single-family zone, the city must approve, without a hearing, up to two homes on it or a split into two lots (or both). The site must not be historic, environmentally excluded, or housing that has recently been rented or is rent-restricted.

| id | label | exact rule | citation | data |
|---|---|---|---|---|
| sb9_sf_zone | Single-family residential zone | Parcel "must be located in a single-family residential zone." Multifamily, commercial, agricultural and mixed-use zones are "not subject to SB 9 … even if they allow single-family residential uses" | SB9-FS p2 (§§ 65852.21(a), 66411.7(a)(3)(A)) | `zone_category`=single_family → pass. Any other category → fail. Confirm against `zoning_code`. |
| sb9_urbanized | In an urbanized area | "A lot zoned for single-family residential within an urbanized area" | FS p48; SB9-L p1 | Same as sb4_urbanized (assume pass, **unverified**) |
| sb9_x_affordable_covenant | Excl.: rent-restricted housing | Demolishes or alters housing "subject to a recorded covenant, ordinance, or law that restricts rents" to moderate, low or very low income levels | FS p49; SB9-FS pp5–6 (§ 65852.21(a)(3); 66411.7(a)(3)(D)) | No data → unknown |
| sb9_x_rent_control | Excl.: rent- or price-controlled housing | Housing "subject to any form of rent or price control" | FS p49; SB9-FS p6 | No data → unknown. Santa Ana has a local rent stabilization ordinance (**unverified (from memory)**). Its coverage of older single-family homes needs checking. |
| sb9_x_tenant_3yr | Excl.: rented in the last 3 years | Housing "occupied by a tenant in the last three years" | FS p50; SB9-FS p6 | No data → unknown. This commonly kills sites. |
| sb9_x_ellis_15yr | Excl.: Ellis Act withdrawal | "A parcel where units were withdrawn from the rental market pursuant to the Ellis Act in the last 15 years" | FS p50 | No data → unknown |
| sb9_x_historic | Excl.: historic district or landmark | Contributing structure in a historic district, or a historical resource on the State Historic Resource Inventory, or a local historic property, district or landmark | FS p50; SB9-FS p5; AB 1061 (2025) clarified this (FS p51) | No data → unknown. This commonly kills sites; Santa Ana has historic districts (**unverified (from memory)**). |
| sb9_x_env | Excl.: environmental site constraints | Sites listed in Gov. Code § 65913.4(a)(6)(B)–(K) "as that subdivision read on September 16, 2021." Examples: "farmland, wetlands, fire hazard areas, earthquake hazard areas, flood risk areas, conservation areas, wildlife habitat areas, or conservation easements" | FS p50; SB9-FS p5 | `fire_hazard_zone` (Very High) → fail. `fema_flood_zone` SFHA → fail, subject to SFHA exceptions (**unverified**). The rest → unknown. The exact text of (B)–(K) is **not stated in source**. |
| sb9_x_prior_split | Excl.: already split under SB 9 | "Parcels previously created under SB 9 lot split provisions are not eligible for further lot splits" | FS p50; SB9-FS p6 | No data → unknown (lot-split check only) |
| sb9_x_adjacent_split | Excl.: neighbor split by same owner | Lot adjacent to an SB 9 split "by the same owner or someone working in concert with the owner" | FS p50; SB9-FS p6 | No data → unknown |
| sb9_split_min_lot | Split must yield two ≥1,200 sq ft lots | Standards "cannot preclude the creation of two 1,200 square-foot lots." Split "into two lots of roughly equal size" | FS p48 | `lot_area_sqft` ≥ 2,400 → pass, else fail. The exact equal-size ratio is **not stated in source**; it is a 60/40 rule per **unverified (from memory)**. |
| sb9_unit_800 | Room for 800 sq ft units | Standards cannot preclude "one or two units of at least 800 square feet each" | FS p48; SB9-FS p3 | Informational only. No hard lot minimum is stated. |
| sb9_owner_affidavit | Owner-occupancy affidavit (split only) | Applicant must sign an affidavit to live in one unit for "at least three years" (exception: community land trust or nonprofit) | FS p49 | Not a site test. Show as a requirement. |

**Units:**
- Without a split: up to 2 primary units, plus ADUs/JADUs under ADU law.
- With a split: up to 2 units per resulting lot, and ADUs/JADUs count toward that limit.
- "In no case does SB 9 require … more than four units on a single lot" (SB9-FS p7; FS p49).

**Other requirements:**
- Rentals must be >30 days (FS p49).
- Parking: up to 1 space per unit, but none within 0.5-mile walking distance of a high-quality transit corridor or major transit stop, or within one block of car share (FS p48).
- Side and rear setbacks may be no more than 4 ft (FS p48; SB9-FS p4).
- Decision within 60 days of a complete application (FS p49).

**Affordability:** none required (not stated in source).

**Dates:** the source gives none. It says only that HCD has had enforcement authority since Jan 1, 2024 (SB9-FS p2). No sunset is stated.

---

## 3. SB 684 / SB 1123: Starter Home Revitalization Act (Gov. Code §§ 65852.28, 65913.4.5, 66499.41)

**Plain English:**
- **Multifamily-zoned lots (SB 684):** if a small urban lot is zoned for multifamily, the city must approve, within 60 days and without a hearing, a subdivision of up to 10 starter homes on up to 10 lots.
- **Single-family lots (SB 1123):** extends the same deal to vacant single-family lots.

| id | label | exact rule | citation | data |
|---|---|---|---|---|
| shra_zone_mf | Zoned for multifamily (SB 684) | "zoned for multifamily residential use." The Hayward TA letter says this covers "any zoning district allowing multifamily housing, including high-intensity mixed-use zones" | FS p67 | `zone_category` in {multi_family, mixed_use} → pass (mixed_use only if it allows multifamily) |
| shra_zone_sf_vacant | Vacant single-family lot (SB 1123) | FS: SB 1123 "enabl[es] property owners in single-family zones to utilize the same streamlined, ministerial approval process" (title: "Vacant Single-Family Lots"). DD-1123: "A vacant lot zoned for single-family residential development is no larger than one and one-half acres"; "vacant means having no permanent structure, unless the permanent structure is abandoned and uninhabitable" (§ 66499.41(a)(2)(B)(ii), (a)(2)(A)(ii)) | FS p68; DD-1123 | `zone_category`=single_family AND vacant. Treat as vacant if `existing_land_use` is vacant or `assessed_improvement_value`==0 (proxy) → pass. An existing structure → fail. |
| shra_lot_size | Lot-size cap | See §3a below. Multifamily: ≤5 acres (217,800 sq ft). Single-family vacant: ≤1.5 acres (65,340 sq ft; DD-1123 only) | FS p67–68; DD-684; DD-1123 | `lot_area_sqft` |
| shra_urban | Urban location | FS: "located in incorporated cities or large urban counties." DD-684: "An incorporated city, the boundaries of which include some portion of an urbanized area" (§ 66499.41(a)(2)(C)(i)) | FS p67; DD-684 | Assume pass for Santa Ana (**unverified**) |
| shra_surrounded | Surrounded by urban uses | DD-684: "substantially surrounded by qualified urban uses" (§ 66499.41(a)(2)(B)). The definition of "substantially" is **not stated in source** | DD-684 | No data → unknown |
| shra_not_prior | Not created by SB 684 / SB 9 | DD-684: "The lot was not established pursuant to this section or Section 66411.7" (§ 66499.41(a)(2)(D)) | DD-684 | No data → unknown |
| shra_x_tenant | Excl.: tenant-occupied / rent-controlled housing | FS: prohibits redevelopment "that displaces rent-controlled or tenant-occupied housing." DD-684: "Housing occupied by tenants within the five years preceding the date of the application" (§ 66499.41(a)(8)(C)) | FS p67; DD-684 | No data → unknown. If `existing_land_use` is vacant → pass. |
| shra_x_env | Excl.: environmentally sensitive land | FS: "farmland, wetlands, and fire hazard zones." DD-684 lists the exclusions in (a)(9), e.g., "(C) Within a very high fire hazard severity zone," "(E) Within a delineated earthquake fault zone as determined by the State Geologist." The full list was **not read** | FS p67; DD-684 | `fire_hazard_zone`=Very High → fail. The rest → unknown. |
| shra_x_horse | Excl.: horsekeeping zones | DD-684 mentions a "(h)(2)" horsekeeping-zone exemption. Its text was **not read** | DD-684 | No data → unknown |

**Units and size**
- ≤10 units and ≤10 lots (FS p67–68).
- SB 1123 caps at "up to 10 units, excluding ADUs" (FS p68). DD-1123 says ADUs/JADUs, if the city permits them, "shall not count as residential units" (§ 66499.41(g)).
- Minimum new parcel size: 600 sq ft (DD-684 § 66499.41(a)(3)(A)). For single-family zones: "no smaller than 1,200 square feet" (DD-1123 § 66499.41(a)(3)(B)).
- Average unit size ≤1,750 net habitable sq ft (DD-684 § 66499.41(a)(6)).

**Affordability:** must comply with local inclusionary requirements. No state affordability percentage is stated (FS p67).

**Review and other rules:**
- 60-day ministerial approval, deemed approved if the city does not act. CEQA-exempt (FS p67).
- Limits on setbacks, parking and FAR (floor-area ratio) (FS p67).

**Dates:**
- **SB 684:** FS does not state a date. DD-684 says operative July 1, 2024 (§ 66499.41(j); § 65852.28(f)).
- **SB 1123:** "took effect on July 1, 2025" (FS p68). DD-1123 says the amendments are operative July 1, 2025.
- No sunset is stated in either source.

### 3a. Lot-size discrepancy (quoted)

| Document | What it says |
|---|---|
| FS p67, SHRA intro | "ten or fewer units on urban lots **under five acres** zoned for multifamily residential use"; "applies to urban lots **under five acres**" |
| FS p68, SB 684 highlight | "projects with 10 or fewer residential units on urban lots of **5 acres or less**" |
| DD-684, § 66499.41(a)(2)(B) | "The lot is **no larger than five acres** …" |
| DD-1123 summary | existing law: "is **no larger than 5 acres**, as specified" |
| DD-1123, § 66499.41(a)(2)(B)(ii) | "A vacant lot zoned for single-family residential development is **no larger than one and one-half acres**" |
| FS p68, SB 1123 highlight | Gives no acreage for single-family lots (not stated in source) |

**Encode:**
- Multifamily: `lot_area_sqft <= 217800` → pass. Exactly 5.00 acres follows the statute-text reading "no larger than." HCD's own sheet says both "under" and "or less," so flag that edge case.
- Single-family vacant: `lot_area_sqft <= 65340` → pass. The source is the secondary DD-1123 page only.

---

## 4. AB 2011: Affordable Housing & High Road Jobs Act (Gov. Code §§ 65912.100–65912.140)

**Plain English:** If your parcel is in a zone where office, retail or parking is allowed, a developer can get housing approved by right, with no hearing and no CEQA review, if it is all-affordable or meets mixed-income affordability, pays prevailing wages, and the site passes a list of environmental and location tests.

**Source limitation:** the HCD fact sheet (FS pp5–6) does **not** list AB 2011's site criteria, densities or affordability percentages. It names only their categories ("environmental criteria, replacement housing, limitations for vacant sites, and specified densities"). Items marked unverified below must be checked against the statute.

| id | label | exact rule | citation | data |
|---|---|---|---|---|
| ab2011_commercial_use | Office, retail or parking allowed | Sites "that allow commercial uses (office, retail, and parking)" (FS p5). The SB 6 comparison says both laws require that "the site must allow office, retail, or parking use" (FS p53). CalMatters digest: "office, retail, or parking are a principally permitted use" | FS p5, p53 | `zone_category` in {commercial, mixed_use} → pass. industrial/public/open_space → fail. Others → unknown. |
| ab2011_x_industrial | Excl.: on or next to industrial use | "cannot be located on or adjacent to an industrial use" (stated for both SB 6 and AB 2011) | FS p53 | `zone_category`=industrial → fail. An adjacent industrial parcel → unknown ("check"). |
| ab2011_x_env | Excl.: environmental criteria | "environmental criteria" (no list given) | FS p5 | The list is **not stated in source**. **Unverified (from memory):** it cross-references the § 65913.4(a)(6) list (VHFHSZ, SFHA, fault zone, wetlands, etc.). For now, use `fire_hazard_zone` and `fema_flood_zone` as warn-only checks. |
| ab2011_x_vacant | Limits for vacant sites | "limitations for vacant sites" | FS p5 | Details **not stated in source**. A vacant parcel → unknown. |
| ab2011_replacement | Replacement housing | "replacement housing" | FS p5 | Details **not stated in source**. `existing_land_use` residential → flag. |
| ab2011_freeway | Freeway proximity | AB 2243 "extends eligibility to projects within 500 feet of a freeway" (with "specified building features", FS p6) | FS p53, p6 | No freeway layer → unknown |
| ab2011_mall | Regional malls | AB 2243 allows "mixed-income projects on regional mall sites under 100 acres" | FS p53 | No data → unknown (bonus flag) |
| ab2011_corridor | Commercial corridor (mixed-income path) | "narrower commercial corridors" (AB 2243) | FS p53 | Width threshold **not stated in source**. **Unverified (from memory):** 70–150 ft right-of-way. No street-width data → unknown. |
| ab2011_site_max | Maximum site size | not stated in source. **Unverified (from memory):** ≤20 acres | — | `lot_area_sqft`, but do not encode until verified |
| ab2011_urban_perimeter | Urban-use perimeter | not stated in source. **Unverified (from memory):** ≥75% of perimeter adjoins urban uses | — | unknown |
| ab2011_x_historic | Excl.: historic | not stated in source. **Unverified (from memory):** historic-resource exclusion exists | — | unknown |
| ab2011_city_exempt | City exempted this parcel | Cities may "exempt parcels … and replace them with other parcels" with no-net-loss findings. HCD's Santa Ana TA letter (Dec 10, 2024): exemptions are valid only with written no-net-loss findings, AFFH-compliant replacement sites, and adoption "through an ordinance" | FS pp5–6 | `housing_element_site` may hint at replacement sites. Santa Ana's exemption ordinance status is **unknown**. |

**Affordability:** two pathways, "One hundred percent affordable lower income developments" and "Mixed-income developments meeting specified affordability levels" (FS p5).
- Percentages: **not stated in source**. **Unverified (from memory):** mixed-income rental 15% lower income, or 8% very-low plus 5% extremely-low; ownership 30% moderate or 15% lower.
- Local inclusionary rules interact with mixed-income projects per AB 2243 (FS p6).

**Labor:** prevailing wage. At 50+ units, apprenticeship and health care requirements (FS p5).

**Density:** **not stated in source** (do not invent). Use local zoning or an SB 4-style assumption only if it is clearly labelled.

**Dates:** "took effect on July 1, 2023, and remains in effect until January 1, 2033 unless otherwise extended" (FS p5).
- AB 2243 (2024) and AB 893 (2025) amended it. AB 893 says a "site" is only the area "being physically disturbed by construction" (FS p6).

---

## 5. Surplus Land Act notices (Gov. Code §§ 54220–54234)

**Plain English:** When a city, county or other local agency wants to get rid of land it no longer needs, it must first send a Notice of Availability offering the land to affordable housing developers and public entities. They have 60 days to say they are interested, and the agency must then negotiate in good faith for at least 90 days with those proposing at least 25% affordable homes.

| id | label | exact rule | citation | data |
|---|---|---|---|---|
| sla_noa_exists | Notice of Availability (NOA) issued | Before disposing of or negotiating to dispose of surplus land, an agency "shall send a written Notice of Availability (NOA)," and it may not accept offers until it has sent one and finished negotiations with responders | SLA-G p23 (§ 200(a), § 201) | `surplus_notice` present → pass, else fail (or unknown if notice coverage is incomplete) |
| sla_not_exempt | Land declared "surplus," not "exempt surplus" | Land must be declared "surplus land" or "exempt surplus land" with written findings. Exempt land skips the NOA process | SLA-G p23 (§ 200(a)); FS p69 | `surplus_notice` record type if available, else unknown |
| sla_window_open | 60-day response window still open | Interested entity "must notify in writing … within 60 days after the agency's NOA is sent" | SLA-G p24 (§ 202(a)(1)(A)); FS p69 | `surplus_notice.sent_date + 60 days >= today` → pass. Closed → fail ("window closed"). |
| sla_recipients | Who receives / may respond | NOA goes to HCD, local public entities in the jurisdiction, and housing sponsors on HCD's interest list. "An entity not on HCD's list may also respond" | SLA-G pp23–24 (§ 201(a)) | Informational |

**Affordability:**
- First priority goes to proposals with "Not less than 25 percent of the total number of units developed (which number includes density bonus units)" affordable. Ties go first to the most affordable units, then to the deepest average affordability (SLA-G p28; § 54222.5 cited). FS p69 says the same.
- If no deal is reached, a covenant still applies: "if 10 or more residential units are developed … not less than 15 percent" affordable (SLA-G p28; FS p70).

**Timing:**
- The 90-day good-faith negotiation starts the day after the 60-day window ends (SLA-G p25).
- No RFP (request for proposals) may be issued less than 60 days after the NOA (SLA-G p25).
- A disposition summary goes to HCD at least 30 days before disposition (FS p69).

**Notices list:** HCD keeps the statewide list of NOAs on its website (SLA-G p23).

**Dates / sunset:** not stated in source.

---

## 6. AB 2097: parking modifier (Gov. Code § 65863.2)

**What "near transit" removes:**
- "A public agency shall not impose or enforce any minimum automobile parking requirement on eligible residential, commercial, or other development projects located within one-half mile of public transit" (2097 p3, § 65863.2(a)).
- It removes **minimum parking mandates only**; voluntary parking is still allowed.

**Definitions:**
- **Public transit:** "Public transit" = "major transit stop" (PRC § 21155 / § 21064.3).
- **Major transit stop:** an existing rail or bus rapid transit (BRT) station, a ferry terminal served by bus or rail, or the "intersection of two or more major bus routes with a frequency of service interval of 20 minutes or less during the morning and afternoon peak commute periods" (2097 p3). AB 2553 set the 20 minutes, effective Jan 1, 2025 (2097 p2).
- **"Within one-half mile":** a project counts if no parcel has more than 25% of its area beyond 0.5 mile, and no more than 10% of units (or 100 units, whichever is less) are beyond 0.5 mile. Stops in the regional transportation plan (RTP) also qualify (2097 p3).

**Which projects qualify:**
- **Always applies:** projects with <20 units, or ≥20% affordable/senior/student/disabled units (2097 p4).
- **Never applies:** event centers and hotels (2097 p4).
- **Others:** the city may impose minimums only with written findings within 30 days (2097 p4).

**Dates:** effective Jan 1, 2023 (2097 p2).

| id | label | rule | citation | data |
|---|---|---|---|---|
| ab2097_no_min_parking | No parking minimums | Within 0.5 mi of a major transit stop | 2097 p3 | `in_hqta` = **proxy**. The HQTA definition (it also includes high-quality transit corridors) is **not stated in source**, so HQTA may over-include. Label "likely". |

Pathway-specific parking waivers (separate from AB 2097) use a broader test: "high-quality transit corridor or major transit stop" within 0.5-mile walking distance, or car share. These apply to SB 4 (p3) and SB 9 (FS p48), so `in_hqta` is a closer proxy for them. Density bonus parking also references § 65863.2 (FS p24).

---

## 7. Exclusions that commonly kill sites but that we cannot check → `unknown`

| Exclusion | Applies to | Source |
|---|---|---|
| Historic district / landmark / State Historic Resources Inventory | SB 9 (explicit). AB 2011 (unverified) | FS p50; SB9-FS p5 |
| Tenant-occupied in the last 3 yrs (SB 9) or 5 yrs (SB 684); rent control; affordability covenant; Ellis Act (15 yrs) | SB 9, SHRA | FS pp49–50, p67; DD-684 |
| Wetlands, habitat, conservation easement or plan, farmland | SB 4, SB 9, SHRA | SB4 p2; SB9-FS p5; FS p67 |
| Earthquake fault zone (do **not** substitute liquefaction or landslide) | SB 4, SB 9, SHRA | SB4 p2; SB9-FS p5; DD-684 |
| Hazardous waste site | SB 4 (and SB 9 via § 65913.4(a)(6), **unverified**) | SB4 p2 |
| Industrial adjacency / distance (1,200 / 1,600 / 3,200 ft) | SB 4; AB 2011 (on or adjacent) | SB4 p2; FS p53 |
| ≥75% urban perimeter / "substantially surrounded" | SB 4; SHRA | SB4 p2; DD-684 |
| Prior SB 9 / SB 684 split; same-owner adjacent split | SB 9, SHRA | FS p50; DD-684 |
| Ownership by a faith or higher-ed institution as of 1/1/2024 | SB 4 | SB4 p1 |
| Tribal cultural resources (vacant sites) | SB 4 | SB4 p2 |
| City AB 2011 parcel exemption ordinance | AB 2011 | FS p6 |

Checks we **can** run: very high fire hazard severity zone (`fire_hazard_zone`), FEMA SFHA/floodway (`fema_flood_zone`), zoning category, lot area, vacancy (proxy), transit (proxy), and surplus notice.

`calenviroscreen_pct`, `liquefaction_zone` and `landslide_zone` are **not** eligibility tests in any of the sources read. Use them only as context or risk flags.

---

## 8. Scoring hints

**Factors the sources tie to stronger sites:**
1. **Transit proximity (`in_hqta`).** It removes parking minimums (AB 2097, 2097 p3) and waives parking for SB 4 and SB 9 (SB4 p3; FS p48). This cuts cost and frees land.
2. **Commercial or non-residential zoning on SB 4 land.** It gets the higher 40 du/ac minimum and one extra story (SB4 p3).
3. **Lot size.**
   - SB 9 splits need ≥2,400 sq ft (two lots of 1,200, FS p48).
   - SHRA allows up to 10 units, so lots of about 6,000 sq ft or more can reach the cap at 600 sq ft parcels (DD-684). That figure is an assumption.
   - Larger SB 4 and AB 2011 parcels yield more units.
4. **Vacancy.** It avoids the tenant and replacement exclusions (SB 9, SHRA) and is required for SB 1123 single-family lots. It is a negative for AB 2011, which limits vacant sites (FS p5).
5. **Prevailing-wage triggers at 50+ units** (SB 4, AB 2011). Note it as a cost step, not a score penalty.
6. **SLA priority** goes to the most affordable units, then the deepest affordability (SLA-G p28). An open 60-day window is time-critical.
7. **No hard-fail hazard flags** (very high fire hazard zone, SFHA).

**Unit estimate.** ASSUMPTION: a screening heuristic, not an entitlement. `acres = lot_area_sqft / 43560`.

| Pathway | Estimate | Basis |
|---|---|---|
| SB 4, residential zone | `floor(acres * 30)` | 30 du/ac "metropolitan county" minimum (SB4 p3). That Santa Ana counts as metropolitan is **unverified (from memory)**. If not, use 20 (suburban, SB4 p2). The minimum is a floor; local density can be higher. |
| SB 4, non-residential zone | `floor(acres * 40)` | 40 du/ac minimum (SB4 p3) |
| SB 9 | `4` if `lot_area_sqft >= 2400`, else `2` | Max 4 via split, 2 per lot (SB9-FS p7; FS p48–49). 2 primary units without a split. |
| SHRA, multifamily | `min(10, floor(lot_area_sqft / 600))` | ≤10 units (FS p67); 600 sq ft minimum parcel (DD-684). This ignores setbacks and streets, so it overstates small lots. |
| SHRA, single-family vacant | `min(10, floor(lot_area_sqft / 1200))` | 1,200 sq ft minimum (DD-1123) |
| AB 2011 | Use the parcel's local zoning max density if known, else `floor(acres * 30)` labelled "placeholder – AB 2011 density not stated in source" | No density in the HCD sheet (FS p5) |
| SLA | Same as the zoning-based estimate. Affordable units: `ceil(0.25 * units)` | 25% priority threshold (SLA-G p28) |

Show "minimum by-right estimate," never "allowed units," and always attach the citation and the assumption label to the number.
