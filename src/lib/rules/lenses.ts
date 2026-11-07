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
    minLot(10000, "Our assumption: about a quarter acre is the smallest site where ~7 homes at SB 4's 30 homes/acre minimum make sense for a nonprofit."),
    cantCheck("sb4_owner", "Owned by the institution since Jan 1, 2024", { doc: "SB4", page: "p1" }),
    cantCheck("sb4_fault", "Not in an earthquake fault zone", { doc: "SB4", page: "p2" }),
    cantCheck("sb4_perimeter", "At least 75% of the edge borders urban uses", { doc: "SB4", page: "p2" }),
    cantCheck("sb4_industry", "Not within 1,200 ft of heavy industry", { doc: "SB4", page: "p2" }),
    cantCheck("sb4_env", "No wetlands, habitat or hazardous waste", { doc: "SB4", page: "p2" }),
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
    cantCheck("ab2011_env", "Passes AB 2011's environmental criteria", { doc: "FS", page: "p5", caveat: "List not in HCD's sheet" }),
    cantCheck("ab2011_industrial", "Not next to an industrial use", { doc: "FS", page: "p53" }),
    cantCheck("ab2011_exempt", "Not exempted by Santa Ana's AB 2011 ordinance", { doc: "FS", page: "p6" }),
    cantCheck("ab2011_historic", "Not a historic resource", { doc: "FS", caveat: "Unverified" }),
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
    redevelopable,
    minLot(6000, "Our assumption: ~6,000 sq ft fits 10 parcels at the 600 sq ft minimum (CalMatters SB 684), before streets and setbacks."),
    cantCheck("shra_tenant", "No tenants in the last 5 years", { doc: "DD684", caveat: "Secondary source" }),
    cantCheck("shra_surrounded", "Substantially surrounded by urban uses", { doc: "DD684" }),
    cantCheck("shra_env", "No wetlands, farmland or fault zone", { doc: "FS", page: "p67" }),
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
    cantCheck("sb9_tenant", "Not rented in the last 3 years", { doc: "FS", page: "p50" }),
    cantCheck("sb9_historic", "Not historic", { doc: "FS", page: "p50" }),
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
