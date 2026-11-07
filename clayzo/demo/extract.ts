/**
 * Pulls the real numbers the demo video shows out of the rules engine, so nothing on screen
 * is invented. Writes clayzo/demo/facts.json (summary) and clayzo/demo/out/map.json (dots).
 *
 *   npx tsx --tsconfig tsconfig.json clayzo/demo/extract.ts
 */
import fs from "node:fs";
import { buildCityData } from "@/lib/data";
import { LENSES, LENS_BY_ID } from "@/lib/rules/lenses";
import { runSieve, evaluate, rowFromSite } from "@/lib/rules/engine";
import { scoreSite } from "@/lib/score";

const base = "public/data/santa-ana";
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const city = read("public/data/cities.json").find((c: { slug: string }) => c.slug === "santa-ana");
const data = buildCityData(city, read(`${base}/parcels.json`), read(`${base}/sites.json`), read(`${base}/sources.json`));

const out: Record<string, unknown> = { total: data.parcels.count };
const lenses: unknown[] = [];
for (const lens of LENSES) {
  const s = runSieve(data, lens);
  const ranked = s.survivorApns
    .map((apn) => data.siteByApn.get(apn))
    .filter(Boolean)
    .map((site) => ({ site: site!, sc: scoreSite(site!, lens.id) }))
    .sort((a, b) => b.sc.score - a.sc.score);
  lenses.push({
    id: lens.id,
    name: lens.name,
    law: lens.law,
    survivors: s.survivorApns.length,
    steps: s.steps.map((x) => ({ id: x.step.id, cut: x.step.cut, kind: x.step.kind, removed: x.removed, remaining: x.remaining, cite: x.step.cite })),
    unknowns: s.unknowns.map((u) => u.label),
    top: ranked.slice(0, 6).map(({ site, sc }) => {
      const ev = evaluate(data, lens, rowFromSite(site));
      return {
        apn: site.apn,
        address: site.address,
        lot: site.lotSqft,
        use: site.existingUse,
        zone: site.zoning,
        score: sc.score,
        units: sc.units,
        parts: sc.parts,
        verdict: ev.verdict,
        passed: ev.passed.map((c) => c.step.label),
        failed: ev.failed.map((c) => c.step.label),
        unknown: ev.unknown.map((c) => c.step.label),
        lng: site.lng,
        lat: site.lat,
      };
    }),
  });
}
out.lenses = lenses;
fs.writeFileSync("clayzo/demo/facts.json", JSON.stringify(out, null, 1));

// Dots for the map: every parcel centroid, and the step of the faith (SB 4) sieve that cut it.
const faith = runSieve(data, LENS_BY_ID.faith);
const c = data.parcels.columns;
fs.mkdirSync("clayzo/demo/out", { recursive: true });
fs.writeFileSync(
  "clayzo/demo/out/map.json",
  JSON.stringify({ bbox: data.parcels.bbox, lng: Array.from(c.lng), lat: Array.from(c.lat), failAt: Array.from(faith.failAt), survivors: faith.survivorApns, apn: c.apn }),
);
console.log("ok", data.parcels.count);
