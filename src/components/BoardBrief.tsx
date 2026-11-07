"use client";

import { useStore } from "@/lib/store";
import { evaluate, rowFromSite } from "@/lib/rules/engine";
import { LENSES } from "@/lib/rules/lenses";
import { acres, displayApn, n, shortDate, siteTitle } from "@/lib/format";
import { CHECKED } from "@/lib/rules/cites";

/** Print-only one-pager of saved sites, for a nonprofit's board or acquisitions meeting. */
export function BoardBrief() {
  const data = useStore((s) => s.data)!;
  const saved = useStore((s) => s.saved);
  const sites = Object.keys(saved)
    .map((a) => data.siteByApn.get(a))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="hidden print:block print:p-10 text-ink">
      <h1 className="serif text-[30px]">Sites worth a call · {data.city.name}</h1>
      <p className="mb-6 text-[11px] text-muted">
        Prepared with Groundwork on {shortDate(new Date().toISOString())}. Rules and data checked {shortDate(CHECKED)}. Screening only. Not legal advice.
        Every &ldquo;?&rdquo; must be confirmed before any commitment.
      </p>
      {sites.length === 0 && <p>No saved sites yet. Save sites from the shortlist, then print.</p>}
      {sites.map((s) => {
        const row = rowFromSite(s);
        const evs = LENSES.map((l) => evaluate(data, l, row)).filter((e) => e.verdict !== "no");
        return (
          <section key={s.apn} className="mb-5 break-inside-avoid border-t border-hairline pt-3">
            <h2 className="text-[15px] font-semibold">{siteTitle(s)}</h2>
            <p className="text-[11px] text-muted">
              APN {displayApn(s.apn)} · {acres(s.lotSqft)} · {s.zoning.local ?? "zoning unknown"}
            </p>
            {evs.map((e) => (
              <p key={e.lens.id} className="mt-1 text-[12px]">
                <strong>{e.lens.law}</strong>: {e.verdict === "likely" ? "likely" : "possible"} · ~{n(e.lens.estimate(row).units)} homes (assumed) · to confirm:{" "}
                {e.unknown.map((u) => u.step.label.toLowerCase()).join("; ") || "nothing listed"}
              </p>
            ))}
          </section>
        );
      })}
    </div>
  );
}
