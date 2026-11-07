import { F, has } from "./flags";
import { rowFromSite } from "./rules/engine";
import { LENS_BY_ID, type LensId } from "./rules/lenses";
import type { Site } from "./types";

export interface ScorePart {
  label: string;
  delta: number;
}
export interface Score {
  score: number; // 0–10, one decimal
  units: number;
  parts: ScorePart[];
}

/**
 * A transparent screening score, not a valuation. Every point is listed on the site page.
 * Sites only get here after passing the lens's legal tests, so this ranks *how promising*,
 * not *whether legal*.
 */
const cache = new Map<string, Score>();

export function scoreSite(site: Site, lensId: LensId | null): Score {
  const key = `${lensId}:${site.apn}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const parts: ScorePart[] = [{ label: "Passes every legal test we can check", delta: 5 }];
  let units = 0;
  if (lensId) {
    const est = LENS_BY_ID[lensId].estimate(rowFromSite(site));
    units = est.units;
    if (units > 0) parts.push({ label: `~${units} homes (assumed estimate)`, delta: round(Math.min(2.2, Math.log2(1 + units) / 2.6)) });
  }
  const f = site.flags;
  if (has(f, F.hqta)) parts.push({ label: "Near frequent transit: likely no parking minimum", delta: 1 });
  if (has(f, F.vacant)) parts.push({ label: "Vacant: no one to relocate", delta: 0.8 });
  else if (has(f, F.underused) || has(f, F.lowCover)) parts.push({ label: "Underused: building worth less than land, or lot mostly open", delta: 0.6 });
  if (has(f, F.surplus)) parts.push({ label: "Agency declared it surplus (notice on file)", delta: 0.8 });
  if (has(f, F.heSite)) parts.push({ label: "Already in the city's housing plan", delta: 0.4 });
  if (has(f, F.liquefaction)) parts.push({ label: "Liquefaction zone: deeper foundations cost more", delta: -0.5 });
  if (has(f, F.landslide)) parts.push({ label: "Landslide zone: geotechnical study needed", delta: -0.8 });
  const raw = parts.reduce((a, p) => a + p.delta, 0);
  const s: Score = { score: Math.max(0, Math.min(10, round(raw))), units, parts };
  cache.set(key, s);
  return s;
}

const round = (x: number) => Math.round(x * 10) / 10;

export function scoreTone(score: number): "high" | "mid" | "low" {
  return score >= 7.5 ? "high" : score >= 6 ? "mid" : "low";
}
