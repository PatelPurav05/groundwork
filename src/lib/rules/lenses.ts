import { F, has } from "../flags";
import type { CheckStatus, Site, ZoneCategory } from "../types";
import { CHECKED, type Cite } from "./cites";

export type LensId = "faith" | "public" | "commercial" | "starter" | "backyard";

/** One parcel, as the rules see it. `site` is present for candidates with detail. */
export interface Row {
  apn: string;
  lot: number; // sqft, 0 = unknown
  zone: ZoneCategory | null;
  flags: number;
  site?: Site;
}

/** pool/law/practical cut parcels; "flag" is checked per site but never cuts; "unknown" has no data. */
export type StepKind = "pool" | "law" | "practical" | "flag" | "unknown";

export interface Step {
  id: string;
  /** Check label, phrased as the thing we want to be true. */
  label: string;
  /** Receipt phrasing for parcels this step removes: "− 312 in a very high fire zone". */
  cut: string;
  kind: StepKind;
  /** Dataset ids (sources.json). If any failed to load, the step returns unknown. */
  sources: string[];
  /** Key in parcels.json `known`; if that layer didn't load, the step is unknown. */
  layer?: string;
  cite?: Cite;
  /** Practical steps are our judgement, not the law. Always shown with this text. */
  assumption?: string;
  test: (r: Row) => CheckStatus;
  /** One-line detail for the site page. */
  detail?: (r: Row, s: CheckStatus) => string | null;
}

export interface Estimate {
  units: number;
  basis: string;
  cite?: Cite;
}

export interface Lens {
  id: LensId;
  /** Plain words, what a non-lawyer would call it. */
  name: string;
  /** Card subtitle. */
  hook: string;
  law: string;
  /** One sentence, plain English. */
  plain: string;
  cite: Cite;
  steps: Step[];
  estimate: (r: Row) => Estimate;
  /** What to do next, in plain words. */
  nextStep: string;
}

/* ---------------- shared tests ---------------- */

const SQFT_PER_ACRE = 43560;
const lotKnown = (r: Row) => r.lot > 0;
const fmt = (n: number) => n.toLocaleString("en-US");

const notFireZone = (cite: Cite): Step => ({
  id: "x_vhfhsz",
  label: "Not in a very high fire hazard zone",
  cut: "in a very high fire hazard zone",
  kind: "law",
  sources: ["fire"],
  cite,
  test: (r) => (has(r.flags, F.fire) ? "fail" : "pass"),
  detail: (r, s) => (s === "fail" ? r.site?.hazards.fire ?? "Very high fire hazard severity zone" : "Outside mapped very high zones"),
});

const notFloodZone = (cite: Cite): Step => ({
  id: "x_sfha",
  label: "Not in a FEMA special flood hazard area",
  cut: "in a FEMA flood hazard area",
  kind: "law",
  sources: ["flood"],
  cite: { ...cite, caveat: "Treating FEMA A/V zones as the special flood hazard area (unverified)" },
  test: (r) => (has(r.flags, F.flood) ? "fail" : "pass"),
  detail: (r, s) => (s === "fail" ? `FEMA zone ${r.site?.hazards.flood ?? "A/V"}` : r.site?.hazards.flood ? `FEMA zone ${r.site.hazards.flood} (not A/V)` : "Not in a mapped flood zone"),
});

const cantCheck = (id: string, label: string, cite?: Cite): Step => ({
  id,
  label,
  cut: "",
  kind: "unknown",
  sources: [],
  cite,
  test: () => "unknown",
  detail: () => "No public dataset we could use. Someone has to confirm this.",
});

const redevelopable: Step = {
  id: "p_room",
  label: "Room to build: vacant, or the building is worth less than the land",
  cut: "already built out",
  kind: "practical",
  sources: ["scag-landuse", "assessor", "footprints"],
  assumption:
    "Our screening judgement, not the law: vacant land, a building covering under 25% of the lot, or improvements assessed below land value usually mean the site is underused.",
  test: (r) =>
    has(r.flags, F.vacant) || has(r.flags, F.lowCover) || has(r.flags, F.underused) ? "pass" : "fail",
  detail: (r) => {
    const s = r.site;
    if (!s) return null;
    const parts: string[] = [];
    if (has(r.flags, F.vacant)) parts.push("Mapped as vacant");
    if (s.coverage != null) parts.push(`Buildings cover ${Math.round(s.coverage * 100)}% of the lot`);
    if (s.assessed.land != null && s.assessed.improvement != null)
      parts.push(`Building $${fmt(s.assessed.improvement)} vs land $${fmt(s.assessed.land)}`);
    return parts.join(" · ") || null;
  },
};

const minLot = (sqft: number, why: string): Step => ({
  id: `p_min_${sqft}`,
  label: `At least ${fmt(sqft)} sq ft`,
  cut: `smaller than ${fmt(sqft)} sq ft`,
  kind: "practical",
  sources: ["parcels"],
  assumption: why,
  test: (r) => (!lotKnown(r) ? "unknown" : r.lot >= sqft ? "pass" : "fail"),
  detail: (r) => (lotKnown(r) ? `${fmt(Math.round(r.lot))} sq ft lot (from parcel outline)` : null),
});


/* ---------------- enrichment checks (pipeline bits 13–22) ---------------- */

/** A mapped exclusion zone: in it = fail (cuts), out of it = pass, layer missing = unknown. */
const notInLayer = (o: { id: string; label: string; cut: string; bit: number; layer: string; sources: string[]; cite: Cite; detail?: Step["detail"] }): Step => ({
  id: o.id,
  label: o.label,
  cut: o.cut,
  kind: "law",
  sources: o.sources,
  layer: o.layer,
  cite: o.cite,
  test: (r) => (has(r.flags, o.bit) ? "fail" : "pass"),
  detail: o.detail ?? ((_r, st) => (st === "fail" ? "Inside a mapped zone" : "Outside every mapped zone")),
});

const notFault = (cite: Cite) =>
  notInLayer({ id: "x_fault", label: "Not in an earthquake fault zone", cut: "in an earthquake fault zone", bit: F.faultZone, layer: "fault_zone", sources: ["ap_fault"], cite, detail: (_r, st) => (st === "fail" ? "Inside an Alquist-Priolo fault zone" : "No Alquist-Priolo fault zone touches Santa Ana") });

const notWetland = (cite: Cite) =>
  notInLayer({ id: "x_wetland", label: "Not on a mapped wetland", cut: "on a mapped wetland", bit: F.wetland, layer: "wetland", sources: ["nwi"], cite: { ...cite, caveat: "National Wetlands Inventory; includes channels and ponds" } });

const notFarmland = (cite: Cite) =>
  notInLayer({ id: "x_farmland", label: "Not on mapped farmland", cut: "on mapped farmland", bit: F.farmland, layer: "farmland", sources: ["fmmp"], cite });

const noHeavyIndustry: Step = {
  ...notInLayer({ id: "x_heavy_industry", label: "Not within 1,200 ft of heavy industry", cut: "within 1,200 ft of heavy industry", bit: F.heavyIndustry1200, layer: "heavy_industry_1200", sources: ["derived_industry", "zoning"], cite: { doc: "SB4", page: "p2", caveat: "Proxy: M2 (heavy industrial) zoning stands in for a site permitted for heavy industrial use" } }),
  detail: (r) => {
    const ft = r.site?.enrich?.nearestHeavyIndustryFt;
    return ft == null ? null : ft === 0 ? "Zoned heavy industrial itself" : `Nearest heavy-industrial zone is ${fmt(Math.round(ft))} ft away`;
  },
};

const noEasement: Step = {
  id: "x_easement",
  label: "No conservation easement",
  cut: "under a conservation easement",
  kind: "law",
  sources: ["cced"],
  cite: { doc: "SB4", page: "p2" },
  // CCED has no easements anywhere in Santa Ana, so this is a sourced pass, not an assumption.
  test: () => "pass",
  detail: () => "The California Conservation Easement Database lists none in Santa Ana",
};

const urbanEdge: Step = {
  id: "x_urban_edge",
  label: "At least 75% of the edge borders urban uses",
  cut: "less than 75% of its edge borders urban uses",
  kind: "law",
  sources: ["derived_urban_perimeter", "scag-landuse"],
  cite: { doc: "SB4", page: "p2", caveat: "Our measure: neighbors' SCAG land use sampled every 5 m along the edge, across streets" },
  test: (r) => {
    const pct = r.site?.enrich?.urbanPerimeterPct;
    return pct == null ? "unknown" : pct >= 75 ? "pass" : "fail";
  },
  detail: (r) => {
    const pct = r.site?.enrich?.urbanPerimeterPct;
    return pct == null ? null : `${Math.round(pct)}% of the edge borders developed land`;
  },
};

/** Proxies that point at an exclusion but can't prove it: shown on the lot, never cut. */
const historicFlag = (cite: Cite): Step => ({
  id: "f_historic",
  label: "Not a historic resource",
  cut: "on a historic register or in a historic district",
  kind: "flag",
  sources: ["historic_props", "historic_districts", "nrhp_points", "nrhp_polys"],
  layer: "historic",
  cite: { ...cite, caveat: "Being in a district doesn't prove the building contributes; the California Register isn't mapped" },
  test: (r) => (has(r.flags, F.historic) ? "fail" : "pass"),
  detail: (r, st) => {
    const h = r.site?.enrich?.historic;
    if (st !== "fail") return "Not on the Santa Ana or National Register, not in a historic district";
    return h ? `${h.name ?? "Listed"} · ${h.source}` : "On a historic register or inside a historic district";
  },
});

const hazwasteFlag = (cite: Cite): Step => ({
  id: "f_hazwaste",
  label: "No open contamination case on or next to the lot",
  cut: "has an open contamination case",
  kind: "flag",
  sources: ["envirostor"],
  layer: "hazwaste",
  cite: { ...cite, caveat: "DTSC EnviroStor open cases; GeoTracker isn't mapped publicly. A Phase I ESA is required anyway" },
  test: (r) => (has(r.flags, F.hazwaste) ? "fail" : "pass"),
  detail: (r, st) => {
    const h = r.site?.enrich?.hazwaste;
    return st === "fail" && h ? `${h.name ?? "EnviroStor site"} · ${h.status ?? "open"} (EnviroStor ${h.id})` : st === "pass" ? "No open EnviroStor case within 50 ft" : null;
  },
});

const industrialNeighborFlag = (cite: Cite): Step => ({
  id: "f_adj_industrial",
  label: "Not next to an industrial use",
  cut: "next to industrially zoned land",
  kind: "flag",
  sources: ["derived_industry", "zoning"],
  layer: "adj_industrial",
  cite: { ...cite, caveat: "Proxy: an M1/M2-zoned neighbor within 15 ft; the law asks about actual industrial use" },
  test: (r) => (has(r.flags, F.adjIndustrial) ? "fail" : "pass"),
  detail: (_r, st) => (st === "fail" ? "An industrially zoned parcel borders this lot" : "No industrially zoned neighbor"),
});

/* ---------------- lenses ---------------- */

const SB4: Cite = { doc: "SB4", page: "p1–3", section: "Gov Code 65913.16" };

const faith: Lens = {
  id: "faith",
  name: "Church & college land",
  hook: "Congregations can build affordable homes without a hearing",
  law: "SB 4",
  plain:
    "If a congregation or nonprofit college has owned the land since Jan 1, 2024, the city must approve nearly all-affordable housing there, in any zone, without a public hearing.",
  cite: SB4,
  nextStep: "Call the congregation's facilities or finance lead. Ask whether the institution owns the land and whether the board has talked about housing.",
  steps: [
    {
      id: "pool_worship",
      label: "A place of worship is mapped on this parcel",
      cut: "no place of worship mapped",
      kind: "pool",
      sources: ["osm-worship", "scag-landuse"],
      cite: { ...SB4, page: "p1", caveat: "Proxy: maps show use, not ownership. A lead, not a fact." },
      test: (r) => (has(r.flags, F.worship) ? "pass" : "fail"),
      detail: (r) => {
        const w = r.site?.signals.worship;
        if (!w) return null;
        const src = w.source === "scag-landuse" ? "SCAG land use: religious facility" : w.source === "both" ? "OpenStreetMap + SCAG land use" : "OpenStreetMap";
        return [w.name, w.religion, src].filter(Boolean).join(" · ");
      },
    },
    notFireZone({ doc: "SB4", page: "p2" }),
    notFloodZone({ doc: "SB4", page: "p2" }),
    notFault({ doc: "SB4", page: "p2" }),
    notWetland({ doc: "SB4", page: "p2" }),
    noHeavyIndustry,
    urbanEdge,
    noEasement,
    minLot(10000, "Our assumption: about a quarter acre is the smallest site where ~7 homes at SB 4's 30 homes/acre minimum make sense for a nonprofit."),
    hazwasteFlag({ doc: "SB4", page: "p2" }),
    industrialNeighborFlag({ doc: "SB4", page: "p2" }),
    cantCheck("sb4_owner", "Owned by the institution since Jan 1, 2024", { doc: "SB4", page: "p1" }),
    cantCheck("sb4_titlev", "Not within 1,600 ft of a Title V facility or 3,200 ft of a refinery", { doc: "SB4", page: "p2" }),
    cantCheck("sb4_habitat", "No protected-species habitat or conservation-plan land", { doc: "SB4", page: "p2" }),
  ],
  estimate: (r) => {
    const acres = r.lot / SQFT_PER_ACRE;
    const residential = r.zone === "single_family" || r.zone === "multi_family" || r.zone === "mixed_use";
    const density = residential ? 30 : 40;
    return {
      units: Math.max(0, Math.floor(acres * density)),
      basis: residential
        ? "Assumed: 30 homes/acre, SB 4's minimum in a metropolitan county. Santa Ana's classification is unverified."
        : "Assumed: 40 homes/acre, SB 4's minimum where the zone doesn't allow housing.",
      cite: { doc: "SB4", page: "p2–3" },
    };
  },
};

const SLA: Cite = { doc: "SLAG", page: "p23–28", section: "Gov Code 54220+" };

function parseUSDate(d: string | undefined | null): Date | null {
  if (!d) return null;
  const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const out = m ? new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00`) : new Date(d);
  return isNaN(+out) ? null : out;
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function surplusWindow(r: Row): { status: CheckStatus; text: string | null } {
  const n = r.site?.signals.surplus;
  if (!n) return { status: "unknown", text: null };
  // Prefer the response due date HCD publishes; else notice date + 60 days (SLA-G p24).
  const due = parseUSDate(n.raw?.["NOA Due Date"]) ?? (parseUSDate(n.date) ? new Date(+parseUSDate(n.date)! + 60 * 864e5) : null);
  const open = due ? due >= new Date(CHECKED) && !/archiv/i.test(n.status ?? "") : false;
  if (!due) return { status: "unknown", text: n.status ? `Notice status: ${n.status}` : "No due date on the notice" };
  return {
    status: open ? "pass" : "fail",
    text: `${open ? "Responses due" : "Response window closed"} ${fmtDate(due)}${n.status ? ` · HCD status: ${n.status}` : ""}`,
  };
}

const publicLand: Lens = {
  id: "public",
  name: "Public land for sale",
  hook: "Agencies must offer surplus land to affordable builders first",
  law: "Surplus Land Act",
  plain:
    "Before a city or agency sells land it no longer needs, it must offer it to affordable housing builders. You have 60 days to raise your hand, then they must negotiate for 90.",
  cite: SLA,
  nextStep: "If the window is open, reply to the agency in writing before it closes; proposals with at least 25% affordable homes get first priority. If it closed, ask the agency whether negotiations produced a deal. If not, the land may come back.",
  steps: [
    {
      id: "pool_noa",
      label: "A Notice of Availability was filed",
      cut: "no surplus land notice",
      kind: "pool",
      sources: ["hcd-sla"],
      cite: { doc: "SLAG", page: "p23" },
      test: (r) => (has(r.flags, F.surplus) ? "pass" : "fail"),
      detail: (r) => {
        const n = r.site?.signals.surplus;
        return n ? [n.agency, n.acres != null ? `${n.acres} acres on notice` : null].filter(Boolean).join(" · ") || "HCD notice on file" : null;
      },
    },
    {
      id: "sla_window",
      label: "The 60-day response window is still open",
      cut: "response window already closed",
      // Every Santa Ana notice is archived today. A closed window doesn't make the land unusable,
      // so we show it on each site instead of cutting: ask the agency whether a deal closed.
      kind: "flag",
      sources: ["hcd-sla"],
      cite: { doc: "SLAG", page: "p24" },
      test: (r) => surplusWindow(r).status,
      detail: (r) => surplusWindow(r).text,
    },
    hazwasteFlag({ doc: "SLAG", page: "p23" }),
    cantCheck("sla_exempt", "Declared surplus, not exempt surplus", { doc: "SLAG", page: "p23" }),
  ],
  estimate: (r) => ({
    units: Math.max(0, Math.floor((r.lot / SQFT_PER_ACRE) * 30)),
    basis: "Assumed: 30 homes/acre placeholder. The notice doesn't set density; local zoning does. A 25%-affordable proposal gets priority.",
    cite: { doc: "SLAG", page: "p28" },
  }),
};

const FS_AB2011: Cite = { doc: "FS", page: "p5–6, p53", section: "Gov Code 65912.100+" };

const commercial: Lens = {
  id: "commercial",
  name: "Underused commercial lots",
  hook: "Strip malls and parking lots can become homes by right",
  law: "AB 2011",
  plain:
    "Where office, retail or parking is allowed, affordable or mixed-income housing can be approved without a hearing, if it pays prevailing wages and the site passes environmental tests.",
  cite: FS_AB2011,
  nextStep: "Look up the owner at the County Assessor counter. Ask the city whether this parcel is on its AB 2011 exemption list before you call.",
  steps: [
    {
      id: "pool_commercial",
      label: "Zoned for office, retail or parking",
      cut: "not zoned commercial or mixed-use",
      kind: "pool",
      sources: ["zoning"],
      cite: { doc: "FS", page: "p5, p53" },
      test: (r) => (r.zone === "commercial" || r.zone === "mixed_use" ? "pass" : r.zone == null ? "unknown" : "fail"),
      detail: (r) => (r.site?.zoning.local ? `Zoned ${r.site.zoning.local}` : null),
    },
    redevelopable,
    minLot(10000, "Our assumption: under ~10,000 sq ft rarely pencils for a prevailing-wage project."),
    {
      id: "f_ab2011_env",
      label: "No mapped wetland, fault zone or open contamination case",
      cut: "on a wetland, fault zone or open contamination case",
      kind: "flag",
      sources: ["nwi", "ap_fault", "envirostor"],
      cite: { doc: "FS", page: "p5", caveat: "AB 2011's full environmental list isn't in HCD's sheet; these are the ones we can map" },
      test: (r) => (has(r.flags, F.wetland) || has(r.flags, F.faultZone) || has(r.flags, F.hazwaste) ? "fail" : "pass"),
      detail: (r, st) =>
        st === "pass"
          ? "None mapped on this lot"
          : [has(r.flags, F.wetland) && "mapped wetland", has(r.flags, F.faultZone) && "fault zone", has(r.flags, F.hazwaste) && (r.site?.enrich?.hazwaste?.name ?? "open EnviroStor case")].filter(Boolean).join(" · "),
    },
    industrialNeighborFlag({ doc: "FS", page: "p53" }),
    historicFlag({ doc: "FS", caveat: "AB 2011's historic exclusion is unverified (from memory)" }),
    cantCheck("ab2011_exempt", "Not exempted by Santa Ana's AB 2011 ordinance", { doc: "FS", page: "p6" }),
  ],
  estimate: (r) => ({
    units: Math.max(0, Math.floor((r.lot / SQFT_PER_ACRE) * 30)),
    basis: "Placeholder: 30 homes/acre. HCD's fact sheet doesn't state AB 2011 densities; check the statute.",
    cite: { doc: "FS", page: "p5" },
  }),
};

const SHRA: Cite = { doc: "FS", page: "p67–68", section: "Gov Code 66499.41" };

const starter: Lens = {
  id: "starter",
  name: "Room for 10 starter homes",
  hook: "Small lots can split into up to 10 homes in 60 days",
  law: "SB 684 / SB 1123",
  plain:
    "On a multifamily lot under 5 acres, or a vacant single-family lot under 1.5 acres, the city must approve up to 10 small homes on 10 lots within 60 days, without a hearing.",
  cite: SHRA,
  nextStep: "Confirm nobody has rented a home on the lot in the last 5 years, then ask the owner whether they'd sell.",
  steps: [
    {
      id: "pool_shra",
      label: "Zoned multifamily, or a vacant single-family lot",
      cut: "not multifamily, and not a vacant single-family lot",
      kind: "pool",
      sources: ["zoning", "scag-landuse"],
      cite: { doc: "FS", page: "p67–68" },
      test: (r) =>
        r.zone === "multi_family" || r.zone === "mixed_use" || (r.zone === "single_family" && has(r.flags, F.vacant))
          ? "pass"
          : r.zone == null
            ? "unknown"
            : "fail",
      detail: (r) => (r.zone === "single_family" ? "Vacant single-family lot (SB 1123)" : r.site?.zoning.local ? `Zoned ${r.site.zoning.local} (SB 684)` : null),
    },
    {
      id: "shra_size",
      label: "Under the size cap (5 acres; 1.5 acres for single-family)",
      cut: "over the lot-size cap",
      kind: "law",
      sources: ["parcels"],
      cite: { doc: "FS", page: "p67–68", caveat: "1.5-acre figure from CalMatters SB 1123 page only" },
      test: (r) => (!lotKnown(r) ? "unknown" : r.lot <= (r.zone === "single_family" ? 65340 : 217800) ? "pass" : "fail"),
      detail: (r) => (lotKnown(r) ? `${(r.lot / SQFT_PER_ACRE).toFixed(2)} acres` : null),
    },
    notFireZone({ doc: "FS", page: "p67" }),
    notFault({ doc: "DD684", caveat: "Secondary source" }),
    notWetland({ doc: "FS", page: "p67" }),
    notFarmland({ doc: "FS", page: "p67" }),
    redevelopable,
    minLot(6000, "Our assumption: ~6,000 sq ft fits 10 parcels at the 600 sq ft minimum (CalMatters SB 684), before streets and setbacks."),
    {
      ...urbanEdge,
      id: "f_shra_surrounded",
      label: "Substantially surrounded by urban uses",
      cut: "less than 75% surrounded by urban uses",
      kind: "flag",
      cite: { doc: "DD684", caveat: "The law doesn't define \"substantially\"; we flag below 75%, same measure as SB 4" },
    },
    cantCheck("shra_tenant", "No tenants in the last 5 years", { doc: "DD684", caveat: "Secondary source" }),
  ],
  estimate: (r) => {
    const per = r.zone === "single_family" ? 1200 : 600;
    return {
      units: Math.min(10, Math.floor(r.lot / per)),
      basis: `Assumed: one home per ${fmt(per)} sq ft minimum parcel, capped at 10. Ignores streets and setbacks, so small lots are overstated.`,
      cite: { doc: r.zone === "single_family" ? "DD1123" : "DD684" },
    };
  },
};

const SB9: Cite = { doc: "SB9FS", page: "p2–7", section: "Gov Code 65852.21, 66411.7" };

const backyard: Lens = {
  id: "backyard",
  name: "Big backyards",
  hook: "Single-family lots can split into up to 4 homes",
  law: "SB 9",
  plain:
    "In a single-family zone, the city must approve a lot split and up to two homes per lot without a hearing, unless the home is historic or was rented in the last 3 years.",
  cite: SB9,
  nextStep: "Ask the owner whether the house was rented in the last 3 years. If it was, SB 9 is off the table.",
  steps: [
    {
      id: "pool_sf",
      label: "In a single-family zone",
      cut: "not in a single-family zone",
      kind: "pool",
      sources: ["zoning"],
      cite: { doc: "SB9FS", page: "p2" },
      test: (r) => (r.zone === "single_family" ? "pass" : r.zone == null ? "unknown" : "fail"),
      detail: (r) => (r.site?.zoning.local ? `Zoned ${r.site.zoning.local}` : null),
    },
    {
      id: "sb9_split",
      label: "Big enough to split into two 1,200 sq ft lots",
      cut: "too small to split",
      kind: "law",
      sources: ["parcels"],
      cite: { doc: "FS", page: "p48" },
      test: (r) => (!lotKnown(r) ? "unknown" : r.lot >= 2400 ? "pass" : "fail"),
      detail: (r) => (lotKnown(r) ? `${fmt(Math.round(r.lot))} sq ft lot` : null),
    },
    notFireZone({ doc: "SB9FS", page: "p5" }),
    notFloodZone({ doc: "SB9FS", page: "p5" }),
    minLot(9000, "Our assumption: lots of 9,000+ sq ft leave room for 4 homes after setbacks."),
    {
      ...redevelopable,
      label: "Mostly open lot: buildings cover under 25%",
      cut: "lot already mostly built",
      test: (r) => (has(r.flags, F.lowCover) || has(r.flags, F.vacant) ? "pass" : "fail"),
    },
    notFault({ doc: "SB9FS", page: "p5" }),
    notWetland({ doc: "SB9FS", page: "p5" }),
    historicFlag({ doc: "FS", page: "p50" }),
    cantCheck("sb9_tenant", "Not rented in the last 3 years", { doc: "FS", page: "p50" }),
    cantCheck("sb9_rent", "Not rent-controlled or covenant-restricted", { doc: "FS", page: "p49" }),
  ],
  estimate: () => ({
    units: 4,
    basis: "SB 9 caps at 4 homes per original lot (2 per lot after a split).",
    cite: { doc: "SB9FS", page: "p7" },
  }),
};

export const LENSES: Lens[] = [faith, publicLand, commercial, starter, backyard];
export const LENS_BY_ID = Object.fromEntries(LENSES.map((l) => [l.id, l])) as Record<LensId, Lens>;
