import type { CityData } from "./data";
import type { Filters } from "./store";
import type { LensId } from "./rules/lenses";
import { getSieve } from "./useSieve";
import { scoreSite } from "./score";
import { F, has } from "./flags";

export interface ParsedQuery {
  lens: LensId | null;
  filters: Filters;
  /** Short phrases for what was understood, shown as chips. */
  understood: string[];
  explanation?: string;
  source: "keywords" | "claude";
}

const LENS_WORDS: [LensId, RegExp][] = [
  ["faith", /\b(church|churches|congregation|faith|temple|mosque|synagogue|religio\w*|parish|chapel|college|seminary|university)\b/],
  ["public", /\b(surplus|public land|city[- ]owned|city land|county land|school district|agency|government|caltrans)\b/],
  ["commercial", /\b(strip ?malls?|malls?|retail|commercial|parking lots?|offices?|shopping|corridors?|storefronts?|ab ?2011)\b/],
  ["starter", /\b(starter|small[- ]lots?|subdivi\w*|ten homes|10 homes|sb ?684|sb ?1123|townhomes?|small homes)\b/],
  ["backyard", /\b(backyards?|lot splits?|split|duplex\w*|single[- ]family|adu|sb ?9)\b/],
];

/** Instant, local reading of a plain-language request. Claude refines it when available. */
export function parseLocal(q: string): ParsedQuery {
  const s = q.toLowerCase();
  const lens = LENS_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;
  const transit = /\b(transit|bus|buses|train|rail|metro|station|stop)\b/.test(s);
  const vacant = /\b(vacant|empty|open land|undeveloped|unbuilt|open lots?)\b/.test(s);
  const m = s.match(/(\d{1,3})\s*\+?\s*(?:or more\s*)?(homes|units|houses|apartments)/) ?? s.match(/at least (\d{1,3})/);
  const minHomes = m ? Math.min(500, Number(m[1])) : null;
  const understood = [transit && "Near transit", vacant && "Open land", minHomes && `${minHomes}+ homes`].filter(Boolean) as string[];
  return { lens, filters: { transit, vacant, minHomes }, understood, source: "keywords" };
}

/** How many lots a lens + filters would return, without leaving the search box. */
export function countMatches(data: CityData, lens: LensId, f: Filters): number {
  const sieve = getSieve(data, lens);
  if (!sieve) return 0;
  let n = 0;
  for (const apn of sieve.survivorApns) {
    const s = data.siteByApn.get(apn);
    if (!s) continue;
    if (f.transit && !has(s.flags, F.hqta)) continue;
    if (f.vacant && !(has(s.flags, F.vacant) || has(s.flags, F.lowCover))) continue;
    if (f.minHomes && scoreSite(s, lens).units < f.minHomes) continue;
    n++;
  }
  return n;
}

/** Ask Claude to read the request; resolves null on any failure so callers fall back to keywords. */
export async function parseWithClaude(q: string, signal?: AbortSignal): Promise<ParsedQuery | null> {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q }),
      signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { lens: LensId | "none"; nearTransit: boolean; openLand: boolean; minHomes: number | null; explanation: string };
    const filters = { transit: !!j.nearTransit, vacant: !!j.openLand, minHomes: j.minHomes ?? null };
    const understood = [filters.transit && "Near transit", filters.vacant && "Open land", filters.minHomes && `${filters.minHomes}+ homes`].filter(Boolean) as string[];
    return { lens: j.lens === "none" ? null : j.lens, filters, understood, explanation: j.explanation, source: "claude" };
  } catch {
    return null;
  }
}
