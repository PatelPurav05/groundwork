/**
 * Renders every screen for every lot under every law, server-side, and fails on anything that
 * throws or prints an error. Run: npm run check
 */
import fs from "node:fs";
import { renderToString } from "react-dom/server";
import { buildCityData } from "@/lib/data";
import { useStore } from "@/lib/store";
import { LENSES } from "@/lib/rules/lenses";
import { getSieve } from "@/lib/useSieve";
import { scoreSite } from "@/lib/score";
import { Home } from "@/components/Home";
import { SieveScreen } from "@/components/Sieve";
import { Shortlist } from "@/components/Shortlist";
import { SiteDetail } from "@/components/SiteDetail";
import { BoardBrief } from "@/components/BoardBrief";
import { SearchPalette } from "@/components/Search";
import { parseLocal } from "@/lib/query";

const slug = process.argv[2] ?? "santa-ana";
const base = `public/data/${slug}`;
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const city = read("public/data/cities.json").find((c: { slug: string }) => c.slug === slug);
const data = buildCityData(city, read(`${base}/parcels.json`), read(`${base}/sites.json`), read(`${base}/sources.json`));

const failures: string[] = [];
const consoleErrors: string[] = [];
const origError = console.error;
console.error = (...a: unknown[]) => consoleErrors.push(a.map(String).join(" ").slice(0, 300));

let renders = 0;
function attempt(label: string, el: () => React.ReactElement) {
  consoleErrors.length = 0;
  try {
    renderToString(el());
    renders++;
  } catch (e) {
    failures.push(`${label}: ${(e as Error).message}`);
    return;
  }
  if (consoleErrors.length) failures.push(`${label}: console.error → ${consoleErrors[0]}`);
}

// Server rendering reads zustand's *initial* state object; mirror each test state into it.
const set = (s: Partial<ReturnType<typeof useStore.getState>>) => {
  useStore.setState({ ...s });
  Object.assign(useStore.getInitialState(), useStore.getState());
};
set({ data, saved: {}, passed: {} });
attempt("home", () => <Home onSearch={() => {}} />);

for (const lens of LENSES) {
  const sieve = getSieve(data, lens.id)!;
  set({ lensId: lens.id, mode: "sieve", sieveProgress: 0, sieveDone: false });
  attempt(`${lens.id}/sieve@0`, () => <SieveScreen />);
  set({ sieveProgress: sieve.steps.length / 2 });
  attempt(`${lens.id}/sieve@mid`, () => <SieveScreen />);
  set({ mode: "list", sieveDone: true, sieveProgress: sieve.steps.length });
  for (const tab of ["review", "saved", "passed"] as const) {
    set({ listTab: tab });
    attempt(`${lens.id}/list/${tab}`, () => <Shortlist onPrint={() => {}} />);
  }
  // Every site under this lens (survivor or not), as if opened from the list.
  for (const s of data.sites) {
    scoreSite(s, lens.id);
    set({ mode: "site", selectedApn: s.apn, probeApn: null });
    attempt(`${lens.id}/site/${s.apn}`, () => <SiteDetail address={null} />);
  }
}

// Address checks: every parcel without a detail record, including the ones with no APN.
set({ lensId: null, sieveDone: false });
const probes = data.parcels.columns.apn.filter((a) => !data.siteByApn.has(a));
const sample = [...probes.filter((a) => a.startsWith("noapn:")), ...probes.filter((_, i) => i % 97 === 0)];
for (const apn of sample) {
  set({ mode: "site", selectedApn: apn, probeApn: apn });
  attempt(`probe/${apn}`, () => <SiteDetail address={null} />);
}

// A lot with stored web-research findings (every answer kind, with and without sources).
{
  const lot = getSieve(data, "faith")!.survivorApns[0];
  set({
    lensId: "faith",
    mode: "site",
    selectedApn: lot,
    probeApn: null,
    research: {
      [lot]: {
        at: 0,
        law: "SB 4",
        findings: [
          { id: "sb4_owner", answer: "yes", summary: "Test.", sources: [{ title: "t", url: "https://example.org/a" }], confidence: "high" },
          { id: "sb4_fault", answer: "no", summary: "Test.", sources: [{ title: "", url: "https://example.org/b" }], confidence: "low" },
          { id: "sb4_perimeter", answer: "unclear", summary: "Test.", sources: [], confidence: "low" },
        ],
      },
    },
  });
  attempt("site with research findings", () => <SiteDetail address={null} />);
  set({ research: {} });
}

// Screens mid-exit: the state they read has already been cleared (AnimatePresence keeps them mounted).
set({ mode: "list", lensId: null, selectedApn: null, probeApn: null });
attempt("exiting/list(no lens)", () => <Shortlist onPrint={() => {}} />);
attempt("exiting/sieve(no lens)", () => <SieveScreen />);
attempt("exiting/site(no apn)", () => <SiteDetail address={null} />);
set({ selectedApn: "does-not-exist" });
attempt("site(unknown apn)", () => <SiteDetail address={null} />);

// Search palette, and the local reader on the examples it suggests.
attempt("search", () => <SearchPalette onClose={() => {}} />);
const expect: [string, string | null][] = [
  ["Church land near transit", "faith"],
  ["Empty lots for 10 starter homes", "starter"],
  ["Vacant lots for 10+ homes", null],
  ["Strip malls near a bus line", "commercial"],
  ["Public land for sale", "public"],
  ["split my backyard", "backyard"],
  ["starter homes on a small lot", "starter"],
];
for (const [q, lens] of expect) {
  const p = parseLocal(q);
  if (p.lens !== lens) failures.push(`parseLocal("${q}") → ${p.lens}, expected ${lens}`);
}
if (parseLocal("Vacant lots for 10+ homes").filters.minHomes !== 10) failures.push("parseLocal minHomes");

// Board brief with every site saved.
set({ saved: Object.fromEntries(data.sites.map((s) => [s.apn, { at: 0 }])) });
attempt("board-brief(all saved)", () => <BoardBrief />);

console.error = origError;
const uniq = [...new Set(failures.map((f) => f.replace(/\/site\/[^:]+|\/probe\/[^:]+/, "/…")))];
console.log(`rendered ${renders} views · ${failures.length} failures`);
for (const f of uniq.slice(0, 20)) console.log("  ✗", f);
if (failures.length) {
  console.log("  first:", failures.slice(0, 5).join("\n         "));
  process.exit(1);
}
