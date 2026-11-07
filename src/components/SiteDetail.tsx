"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { useStore, type PassReason } from "@/lib/store";
import { evaluate, findSource, rowForApn, type CheckResult, type Evaluation } from "@/lib/rules/engine";
import { LENSES, LENS_BY_ID, type Lens, type Row } from "@/lib/rules/lenses";
import { DOCS, CHECKED } from "@/lib/rules/cites";
import { scoreSite } from "@/lib/score";
import { F, has } from "@/lib/flags";
import { acres, displayApn, n, shortDate, siteTitle } from "@/lib/format";
import type { CityData } from "@/lib/data";
import { AssumedTag, Button, IconBack, IconBookmark, IconBookmarkFilled, IconButton, IconChevron, IconExternal, IconX, ScoreRing, StatusMark, Tag } from "./ui";
import { DraftLetter } from "./DraftLetter";

export function SiteDetail({ address }: { address: string | null }) {
  const data = useStore((s) => s.data)!;
  const apn = useStore((s) => s.selectedApn)!;
  const lensId = useStore((s) => s.lensId);
  const probe = useStore((s) => s.probeApn === apn);
  const close = useStore((s) => s.closeSite);
  const isSaved = useStore((s) => !!s.saved[apn]);
  const toggleSave = useStore((s) => s.toggleSave);
  const pass = useStore((s) => s.pass);

  const row = useMemo(() => rowForApn(data, apn), [data, apn]);
  const evals = useMemo(() => (row ? LENSES.map((l) => evaluate(data, l, row)) : []), [data, row]);
  if (!row) return <div className="p-6 text-[14px] text-muted">We couldn&rsquo;t find APN {apn} in {data.city.name}.</div>;

  const site = row.site;
  const primary = !probe && lensId ? evals.find((e) => e.lens.id === lensId)! : bestEval(evals, row);
  const others = evals.filter((e) => e !== primary);
  const score = site && !probe && lensId ? scoreSite(site, lensId) : null;
  const est = primary.lens.estimate(row);
  const title = siteTitle(site, address, apn);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-surface/95 px-4 py-3 backdrop-blur">
        <IconButton label="Back" onClick={close}>
          <IconBack />
        </IconButton>
        <span className="text-[13px] text-ink-2">{probe || !lensId ? "Parcel check" : "Back to the shortlist"}</span>
        <span className="ml-auto flex gap-0.5">
          <IconButton label={isSaved ? "Unsave" : "Save"} onClick={() => toggleSave(apn)} className={isSaved ? "text-clay hover:text-clay" : ""}>
            {isSaved ? <IconBookmarkFilled size={17} /> : <IconBookmark size={17} />}
          </IconButton>
          <PassMenu onPass={(r) => { pass(apn, r); close(); }} />
        </span>
      </div>

      <div className="flex flex-col gap-6 px-6 pt-2 pb-8">
        <header className="flex flex-col gap-1.5">
          <h2 className="serif text-[30px] leading-[1.05] text-ink">{title}</h2>
          <p className="tnum text-[12.5px] text-muted">
            APN {displayApn(apn)} · {data.city.name}
            {row.lot ? ` · ${acres(row.lot)}` : ""}
            {site?.zoning.local ? ` · Zoned ${site.zoning.local}` : ""}
          </p>
        </header>

        <VerdictCard ev={primary} score={score?.score ?? null} />

        {primary.verdict !== "no" && est.units > 0 && (
          <section className="flex items-start gap-4 rounded-[18px] bg-surface-2 p-4">
            <div className="flex flex-col">
              <span className="serif tnum text-[40px] leading-none">~{n(est.units)}</span>
              <span className="text-[12px] text-muted">homes</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <AssumedTag />
              <p className="text-[12.5px] leading-snug text-ink-2">{est.basis}</p>
              {est.cite && <CiteLink cite={est.cite} />}
            </div>
          </section>
        )}

        <ChecksBlock ev={primary} row={row} data={data} />

        <section className="flex flex-col gap-3">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Next step</h3>
          <p className="text-[14px] leading-relaxed text-ink">{primary.lens.nextStep}</p>
          <DraftLetter lens={primary.lens} ev={primary} row={row} title={title} cityName={data.city.name} units={est.units} />
        </section>

        <GoodToKnow row={row} />

        {score && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Why {score.score.toFixed(1)}</h3>
            <ul className="flex flex-col">
              {score.parts.map((p) => (
                <li key={p.label} className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 text-[13px]">
                  <span className="text-ink-2">{p.label}</span>
                  <span className={clsx("tnum font-medium", p.delta >= 0 ? "text-pass" : "text-fail")}>
                    {p.delta >= 0 ? "+" : "−"}
                    {Math.abs(p.delta).toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-muted">A screening score for ranking, not a valuation. Weights are our assumption.</p>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Other laws on this parcel</h3>
          <ul className="flex flex-col">
            {others.map((e) => (
              <OtherLaw key={e.lens.id} ev={e} row={row} data={data} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Lead with the pathway that's open and yields the most homes. */
function bestEval(evals: Evaluation[], row: Row): Evaluation {
  const rank = { likely: 0, maybe: 1, no: 2 } as const;
  return [...evals].sort(
    (a, b) => rank[a.verdict] - rank[b.verdict] || b.lens.estimate(row).units - a.lens.estimate(row).units,
  )[0];
}

const ordinal = (x: number) => {
  const v = x % 100;
  return x + (v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][x % 10] ?? "th");
};

function verdictText(ev: Evaluation) {
  if (ev.verdict === "no") {
    const f = ev.failed.find((c) => c.step.kind === "pool" || c.step.kind === "law") ?? ev.failed[0];
    return { head: "Not under " + ev.lens.law, sub: f ? sentence(f.step.cut) : "" };
  }
  if (ev.verdict === "maybe") return { head: `Possible under ${ev.lens.law}`, sub: `Legal on the tests we can run, but ${ev.failed.map((f) => f.step.cut).join(" and ")}.` };
  const u = ev.unknown.length;
  return { head: `Likely yes under ${ev.lens.law}`, sub: u ? `If ${u} ${u === 1 ? "thing checks" : "things check"} out that no public data can answer.` : "Every test passed." };
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + ".";

function VerdictCard({ ev, score }: { ev: Evaluation; score: number | null }) {
  const v = verdictText(ev);
  return (
    <section
      className={clsx(
        "flex items-start gap-4 rounded-[20px] p-4",
        ev.verdict === "likely" && "bg-pass-soft",
        ev.verdict === "maybe" && "bg-unknown-soft",
        ev.verdict === "no" && "bg-fail-soft",
      )}
    >
      {score != null ? <ScoreRing score={score} size={52} /> : <StatusMark status={ev.verdict === "likely" ? "pass" : ev.verdict === "no" ? "fail" : "unknown"} size={28} />}
      <div className="flex flex-col gap-1">
        <p className="text-[16px] font-semibold leading-tight text-ink">{v.head}</p>
        <p className="text-[13px] leading-snug text-ink-2">{v.sub}</p>
        <p className="pt-1 text-[12.5px] leading-snug text-ink-2/80">{ev.lens.plain}</p>
      </div>
    </section>
  );
}

function ChecksBlock({ ev, row, data }: { ev: Evaluation; row: Row; data: CityData }) {
  const groups: { title: string; items: CheckResult[] }[] = [
    { title: "Failed", items: ev.failed },
    { title: "Passed", items: ev.passed },
    { title: "Nobody can check this from public data yet", items: ev.unknown },
  ];
  return (
    <section className="flex flex-col gap-5">
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">{g.title}</h3>
            <ul className="flex flex-col">
              {g.items.map((c) => (
                <CheckRow key={c.step.id} c={c} data={data} />
              ))}
            </ul>
          </div>
        ))}
      {row.site?.signals.worship && ev.lens.id === "faith" && (
        <p className="rounded-[14px] border border-dashed border-unknown/50 bg-unknown-soft/50 p-3 text-[12.5px] leading-snug text-ink-2">
          <strong className="font-semibold text-ink">This is a lead, not a fact.</strong> OpenStreetMap shows a place of worship here. It doesn&rsquo;t
          say who owns the land. Free parcel data has no owner field; confirming needs the County Assessor roll or a conversation.
        </p>
      )}
    </section>
  );
}

function CheckRow({ c, data }: { c: CheckResult; data: CityData }) {
  const [open, setOpen] = useState(false);
  const srcs = c.step.sources.map((id) => findSource(data, id)).filter((s): s is NonNullable<typeof s> => !!s);
  return (
    <li className="border-b border-hairline">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 py-2.5 text-left">
        <StatusMark status={c.status} />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] leading-snug text-ink">{c.step.label}</span>
          {c.detail && <span className="text-[12px] leading-snug text-muted">{c.detail}</span>}
        </span>
        {c.step.kind === "practical" && <Tag tone="unknown">our call</Tag>}
        <IconChevron size={14} className={clsx("mt-1 shrink-0 text-muted transition-transform duration-200", open && "rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 pb-3 pl-8 text-[12px] leading-snug text-ink-2">
              {c.step.assumption && <p>{c.step.assumption}</p>}
              {c.step.cite && <CiteLink cite={c.step.cite} />}
              {srcs.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">
                  <span className="underline decoration-hairline underline-offset-2">{s.name}</span>
                  <span className="text-muted">
                    · checked {shortDate(s.checked)}
                    {s.status !== "ok" ? ` · ${s.status}` : ""}
                  </span>
                  <IconExternal size={12} className="text-muted" />
                </a>
              ))}
              {c.status === "unknown" && !srcs.length && <p className="text-muted">No dataset. Rules as of {shortDate(CHECKED)}.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function CiteLink({ cite }: { cite: NonNullable<Lens["cite"]> }) {
  const d = DOCS[cite.doc];
  return (
    <a href={d.url} target="_blank" rel="noreferrer" className="flex flex-wrap items-center gap-1 text-[12px] text-ink-2 hover:text-ink">
      <span className="underline decoration-hairline underline-offset-2">{d.name}</span>
      {cite.page && <span className="text-muted">· {cite.page}</span>}
      {cite.section && <span className="text-muted">· {cite.section}</span>}
      {cite.caveat && <span className="text-unknown">· {cite.caveat}</span>}
      <IconExternal size={12} className="text-muted" />
    </a>
  );
}

function GoodToKnow({ row }: { row: Row }) {
  const s = row.site;
  const items: { k: string; v: string; tone?: "pass" | "fail" | "unknown" }[] = [];
  items.push(
    has(row.flags, F.hqta)
      ? { k: "Transit", v: "In a high-quality transit area: likely no parking minimum (AB 2097, proxy)", tone: "pass" }
      : { k: "Transit", v: "Not in a mapped high-quality transit area" },
  );
  if (has(row.flags, F.liquefaction)) items.push({ k: "Ground", v: "Liquefaction zone: expect a geotechnical study", tone: "fail" });
  if (has(row.flags, F.landslide)) items.push({ k: "Ground", v: "Landslide zone", tone: "fail" });
  if (s?.ces.percentile != null) items.push({ k: "Pollution burden", v: `CalEnviroScreen ${ordinal(Math.round(s.ces.percentile))} percentile` });
  if (s?.signals.heSite) {
    const h = s.signals.heSite;
    const cap = [h.lower && `${h.lower} lower`, h.moderate && `${h.moderate} moderate`, h.aboveModerate && `${h.aboveModerate} above-moderate`].filter(Boolean).join(", ");
    items.push({ k: "City plan", v: `Listed in the Housing Element sites inventory${cap ? ` (${cap} income units)` : ""}` });
  }
  if (s?.existingUse) items.push({ k: "Used as", v: s.existingUse });
  if (s?.yearBuilt) items.push({ k: "Built", v: String(s.yearBuilt) });
  if (s?.assessed.land != null) items.push({ k: "Assessed", v: `Land $${n(s.assessed.land)} · building $${n(s.assessed.improvement ?? 0)}` });
  if (s?.signals.surplus?.contact) items.push({ k: "Agency contact", v: s.signals.surplus.contact });
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Good to know</h3>
      <dl className="flex flex-col">
        {items.map((it) => (
          <div key={it.k + it.v} className="grid grid-cols-[110px_1fr] gap-3 border-b border-hairline py-2 text-[13px]">
            <dt className="text-muted">{it.k}</dt>
            <dd className={clsx("text-ink-2", it.tone === "fail" && "text-fail", it.tone === "pass" && "text-pass")}>{it.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function OtherLaw({ ev, row, data }: { ev: Evaluation; row: Row; data: CityData }) {
  const [open, setOpen] = useState(false);
  const v = verdictText(ev);
  return (
    <li className="border-b border-hairline">
      <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex w-full items-center gap-3 py-2.5 text-left">
        <StatusMark status={ev.verdict === "likely" ? "pass" : ev.verdict === "no" ? "fail" : "unknown"} />
        <span className="flex flex-1 flex-col">
          <span className="text-[13.5px] font-medium text-ink">
            {LENS_BY_ID[ev.lens.id].name} <span className="font-normal text-muted">· {ev.lens.law}</span>
          </span>
          <span className="text-[12px] text-muted">{v.sub}</span>
        </span>
        <IconChevron size={14} className={clsx("shrink-0 text-muted transition-transform duration-200", open && "rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden pl-8"
          >
            <ChecksBlock ev={ev} row={row} data={data} />
            <div className="h-3" />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function PassMenu({ onPass }: { onPass: (r: PassReason) => void }) {
  const [open, setOpen] = useState(false);
  const reasons: [PassReason, string][] = [
    ["too_small", "Too small"],
    ["hazard", "Hazard / site issue"],
    ["wont_sell", "Owner won't sell"],
    ["already_built", "Already built"],
    ["other", "Other"],
  ];
  return (
    <div className="relative">
      <IconButton label="Pass" onClick={() => setOpen((v) => !v)}>
        <IconX size={16} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-10 right-0 z-20 flex w-48 flex-col rounded-[14px] bg-surface p-1.5 shadow-[var(--shadow-panel)]"
          >
            <span className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-muted">Why pass?</span>
            {reasons.map(([id, label]) => (
              <Button key={id} variant="ghost" className="h-8 justify-start rounded-[10px] px-2.5 text-[13px]" onClick={() => onPass(id)}>
                {label}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
