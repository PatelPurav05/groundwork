import type { CityData } from "../data";
import type { CheckStatus, Site, ZoneCategory } from "../types";
import type { Lens, Row, Step } from "./lenses";

/** Step source ids → ids the data pipeline wrote to sources.json (first match wins). */
const SOURCE_ALIASES: Record<string, string[]> = {
  fire: ["fire", "fire_calfire"],
  flood: ["flood"],
  "osm-worship": ["osm_worship"],
  "hcd-sla": ["hcd_sla"],
  zoning: ["zoning", "scag_zoning"],
  "scag-landuse": ["scag_landuse"],
  assessor: ["parcels"],
  footprints: ["footprints"],
  parcels: ["parcels"],
};

export function findSource(data: CityData, id: string) {
  const ids = SOURCE_ALIASES[id] ?? [id];
  return ids.map((i) => data.sourceById.get(i)).find(Boolean) ?? null;
}

export function sourceFailed(data: CityData, id: string): boolean {
  return findSource(data, id)?.status === "failed";
}

const apnIndex = new WeakMap<CityData, Map<string, number>>();
export function indexOfApn(data: CityData, apn: string): number {
  let m = apnIndex.get(data);
  if (!m) {
    m = new Map(data.parcels.columns.apn.map((a, i) => [a, i]));
    apnIndex.set(data, m);
  }
  return m.get(apn) ?? -1;
}

/** Best row for an APN: full site detail if we have it, else the parcel columns. */
export function rowForApn(data: CityData, apn: string): Row | null {
  const s = data.siteByApn.get(apn);
  if (s) return rowFromSite(s);
  const i = indexOfApn(data, apn);
  return i >= 0 ? rowFor(data, i) : null;
}

export function rowFor(data: CityData, i: number): Row {
  const c = data.parcels.columns;
  const apn = c.apn[i];
  const zi = c.zone[i];
  return {
    apn,
    lot: c.lot[i],
    zone: zi >= 0 ? (data.parcels.zoneCodes[zi] as ZoneCategory) : null,
    flags: c.flags[i],
    site: data.siteByApn.get(apn),
  };
}

export function rowFromSite(s: Site): Row {
  return { apn: s.apn, lot: s.lotSqft ?? 0, zone: s.zoning.category, flags: s.flags, site: s };
}

function runStep(data: CityData, step: Step, r: Row): CheckStatus {
  if (step.sources.some((id) => sourceFailed(data, id))) return "unknown";
  return step.test(r);
}

export interface SieveStepResult {
  step: Step;
  removed: number;
  remaining: number;
}

export interface SieveResult {
  lens: Lens;
  total: number;
  /** Steps that can remove parcels, in order. The map animates through these. */
  steps: SieveStepResult[];
  /** Tests no public data can answer. Shown dashed; they remove nobody. */
  unknowns: Step[];
  /** Per parcel: 1-based step index that removed it, or -1 for survivors. */
  failAt: Int16Array;
  survivorApns: string[];
}

export function runSieve(data: CityData, lens: Lens): SieveResult {
  const n = data.parcels.count;
  const failAt = new Int16Array(n).fill(-1);
  const active = lens.steps.filter((s) => s.kind !== "unknown" && s.kind !== "flag");
  const unknowns = lens.steps.filter((s) => s.kind === "unknown" || s.kind === "flag");
  const removed = new Array(active.length).fill(0);
  const survivorApns: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const r = rowFor(data, i);
    for (let k = 0; k < active.length; k++) {
      // "unknown" never removes a parcel on an exclusion: we only cut on evidence.
      // A pool is different: it's a positive match, so "can't tell" doesn't get you in.
      const st = runStep(data, active[k], r);
      if (st === "fail" || (st === "unknown" && active[k].kind === "pool")) {
        failAt[i] = k + 1;
        removed[k]++;
        break;
      }
    }
    if (failAt[i] === -1) {
      // Several assessor records can share one lot (same outline, different situs addresses).
      // List the lot once.
      const key = `${data.parcels.columns.lng[i]},${data.parcels.columns.lat[i]},${Math.round(r.lot)}`;
      if (!seen.has(key) && !seen.has(r.apn)) {
        seen.add(key);
        seen.add(r.apn);
        survivorApns.push(r.apn);
      }
    }
  }
  let remaining = n;
  const steps = active.map((step, k) => {
    remaining -= removed[k];
    return { step, removed: removed[k], remaining };
  });
  return { lens, total: n, steps, unknowns, failAt, survivorApns };
}

export interface CheckResult {
  step: Step;
  status: CheckStatus;
  detail: string | null;
}

export type Verdict = "likely" | "no" | "maybe";

export interface Evaluation {
  lens: Lens;
  verdict: Verdict;
  checks: CheckResult[];
  failed: CheckResult[];
  unknown: CheckResult[];
  passed: CheckResult[];
}

/** Every check for one parcel, without stopping at the first failure. */
export function evaluate(data: CityData, lens: Lens, r: Row): Evaluation {
  const checks = lens.steps.map((step) => {
    const status = runStep(data, step, r);
    return { step, status, detail: step.detail?.(r, status) ?? null };
  });
  const failed = checks.filter((c) => c.status === "fail");
  const unknown = checks.filter((c) => c.status === "unknown");
  const passed = checks.filter((c) => c.status === "pass");
  const poolFailed = failed.some((c) => c.step.kind === "pool");
  const lawFailed = failed.some((c) => c.step.kind === "law");
  // A failed "flag" (e.g. a closed response window) makes it a maybe, not a no.
  const verdict: Verdict = poolFailed || lawFailed ? "no" : failed.length ? "maybe" : "likely";
  return { lens, verdict, checks, failed, unknown, passed };
}
