# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: a one-person acquisitions lead at a small affordable-housing nonprofit with no GIS team, who needs a short list of sites worth calling this month and why each one qualifies (event scenario F02). Also served by the same engine: a congregation's facilities chair checking whether its own lot could hold housing (F01), and city housing staff screening candidate sites for hazards (F03). All three are made-up personas from the event brief.

## Product Purpose
Groundwork finds the land in a city that California's newer housing laws opened up (SB 4, SB 9, SB 684 / SB 1123, AB 2011, Surplus Land Act notices), so a small nonprofit finds sites on purpose instead of by luck. Success: a nonprofit leaves with a ranked, explainable shortlist, and every site says which law opens it, which tests passed, which failed, and which no public data can answer.

## Positioning
The sieve: the whole city's parcels are filtered one legal or physical test at a time, on screen, and each cut names its dataset and date. The method is the interface, so the result can be trusted, explained to a board, and checked.

## Operating Context
Built at the Claude Impact Lab UCI hackathon, Lane 1 "Find it" (Nov 7, 2026). Live demo to judges. Santa Ana only, from public data cached in `public/data/santa-ana/`. Outputs people actually use: a shortlist, a site page with checks and sources, a printed board brief, and a drafted first letter to an owner (drafted only, never sent).

## Capabilities and Constraints
- Five lenses in plain words mapped to laws; rules and page cites in `docs/rules.md`; data pipeline in `scripts/data/`.
- "Unknown" never removes a site; practical filters are labelled as our assumption; every estimated home count is labelled assumed.
- Church and college ownership is a proxy (OpenStreetMap + SCAG land use 1245), always shown as a lead, not a fact.
- No owner names or personal information. Not legal, financial or lending advice, said on screen.
- Every Santa Ana surplus-land notice is archived as of the data date; the response window is shown per site, never hidden.
- Claude drafts the owner letter and parses plain-language search; both fall back to templates and keyword matching without an API key.

## Brand Commitments
Name: Groundwork. Visual world chosen by the user: riso housing poster (two-ink risograph, halftone). The parcel dot map is the hero and stays.

## Evidence on Hand
Real public data only (see `public/data/santa-ana/sources.json`). No testimonials, customers, partners or usage figures exist; none may be invented.

## Product Principles
1. Show the method: every cut and every check names its source and date.
2. Unknown is a first-class answer, never a pass.
3. Plain words first, statute second.
4. Every screen ends in a next action a small team can take today.
5. Draft, never send.
