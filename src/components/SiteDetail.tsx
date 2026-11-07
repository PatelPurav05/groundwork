"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { useStore, type PassReason, type ResearchFinding } from "@/lib/store";
import { evaluate, findSource, rowForApn, type CheckResult, type Evaluation } from "@/lib/rules/engine";
import { LENSES, type Lens, type Row } from "@/lib/rules/lenses";
import { DOCS, CHECKED } from "@/lib/rules/cites";
import { scoreSite } from "@/lib/score";
import { F, has } from "@/lib/flags";
import { acres, displayApn, n, shortDate, siteTitle } from "@/lib/format";
import type { CityData } from "@/lib/data";
import { AssumedTag, Button, IconBack, IconBookmark, IconBookmarkFilled, IconButton, IconChevron, IconExternal, IconX, ScoreStamp, SheetHeading, StatusMark, Tag } from "./ui";
import { DraftLetter } from "./DraftLetter";
import { FindingNote, ResearchBar, useResearch, type ResearchState } from "./Research";
import { LensIcon } from "./LensIcon";

const EASE = [0.23, 1, 0.32, 1] as const;

export function SiteDetail({ address }: { address: string | null }) {
  const data = useStore((s) => s.data)!;
  // Null for a frame while this screen animates out after "back".
  const apn = useStore((s) => s.selectedApn);
  const lensId = useStore((s) => s.lensId);
  const probe = useStore((s) => !!apn && s.probeApn === apn);
  const close = useStore((s) => s.closeSite);
  const isSaved = useStore((s) => !!apn && !!s.saved[apn]);
  const toggleSave = useStore((s) => s.toggleSave);
  const pass = useStore((s) => s.pass);

  const row = useMemo(() => (apn ? rowForApn(data, apn) : null), [data, apn]);
  const evals = useMemo(() => (row ? LENSES.map((l) => evaluate(data, l, row)) : []), [data, row]);
  if (!apn) return null;
  if (!row) return <div className="p-6 text-[14px] text-muted">We couldn&rsquo;t find that parcel in {data.city.name}.</div>;

  const site = row.site;
  const primary = !probe && lensId ? evals.find((e) => e.lens.id === lensId)! : bestEval(evals, row);
  const others = evals.filter((e) => e !== primary);
  const score = site && !probe && lensId ? scoreSite(site, lensId) : null;
  const est = primary.lens.estimate(row);
  const title = siteTitle(site, address, apn);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-stock px-4 py-3">
        <IconButton label="Back" onClick={close}>
          <IconBack />
        </IconButton>
        <span className="text-[13.5px] text-muted">{probe || !lensId ? "Lot check" : "Back to the list"}</span>
        <span className="ml-auto flex gap-0.5">
          <IconButton label={isSaved ? "Unsave" : "Save"} onClick={() => toggleSave(apn)} className={isSaved ? "text-coral-ink hover:text-coral-ink" : ""}>
            {isSaved ? <IconBookmarkFilled size={17} /> : <IconBookmark size={17} />}
          </IconButton>
          <PassMenu
            onPass={(r) => {
              pass(apn, r);
              close();
            }}
          />
        </span>
      </div>

      <header className="flex flex-col gap-2 px-6 pt-2 pb-6">
        <h2 className="display text-[32px] leading-[0.98] text-ink">{title}</h2>
        <p className="tnum font-mono text-[11.5px] text-muted">
          APN {displayApn(apn)}
          {row.lot ? `  ·  ${acres(row.lot)}` : ""}
          {site?.zoning.local ? `  ·  ${site.zoning.local}` : ""}
          {`  ·  ${data.city.name}`}
        </p>
      </header>

      <VerdictBlock ev={primary} score={score?.score ?? null} units={primary.verdict !== "no" ? est.units : 0} basis={est.basis} />

      <section className="px-6 pt-7">
        <PrimaryChecks ev={primary} row={row} data={data} title={title} />
      </section>

      <section className="mx-6 mt-8 flex flex-col gap-3 border-t border-hairline pt-6">
        <SheetHeading>Next step</SheetHeading>
        <p className="text-[14.5px] leading-relaxed text-ink">{primary.lens.nextStep}</p>
        <DraftLetter lens={primary.lens} ev={primary} row={row} title={title} cityName={data.city.name} units={est.units} />
      </section>

      <section className="mx-6 mt-8 border-t border-hairline pt-6">
        <SheetHeading>Good to know</SheetHeading>
        <GoodToKnow row={row} />
      </section>

      {score && (
        <section className="mx-6 mt-8 border-t border-hairline pt-6">
          <SheetHeading aside={<span className="font-mono text-[12px] text-muted">{score.score.toFixed(1)} / 10</span>}>Why it ranks here</SheetHeading>
          <ul className="flex flex-col">
            {score.parts.map((p) => (
              <li key={p.label} className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 text-[13.5px] last:border-b-0">
                <span className="text-ink">{p.label}</span>
                <span className={clsx("tnum font-mono text-[12.5px] font-medium", p.delta >= 0 ? "text-blue" : "text-coral-ink")}>
                  {p.delta >= 0 ? "+" : "−"}
                  {Math.abs(p.delta).toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-[12px] text-muted">A screening score for ranking, not a valuation. The weights are our assumption.</p>
        </section>
      )}

      <section className="mx-6 mt-8 mb-8 border-t border-hairline pt-6">
        <SheetHeading>The other four laws</SheetHeading>
        <ul className="flex flex-col">
          {others.map((e) => (
            <OtherLaw key={e.lens.id} ev={e} row={row} data={data} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Lead with the pathway that's open and yields the most homes. */
function bestEval(evals: Evaluation[], row: Row): Evaluation {
  const rank = { likely: 0, maybe: 1, no: 2 } as const;
  return [...evals].sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.lens.estimate(row).units - a.lens.estimate(row).units)[0];
}

const ordinal = (x: number) => {
  const v = x % 100;
  return x + (v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][x % 10] ?? "th");
};

function verdictText(ev: Evaluation) {
  if (ev.verdict === "no") {
    const f = ev.failed.find((c) => c.step.kind === "pool" || c.step.kind === "law") ?? ev.failed[0];
    return { head: `Not under ${ev.lens.law}`, sub: f ? sentence(f.step.cut) : "" };
  }
  if (ev.verdict === "maybe") return { head: `Possible under ${ev.lens.law}`, sub: `It passes the legal tests we can run, but ${ev.failed.map((f) => f.step.cut).join(" and ")}.` };
  const u = ev.unknown.length;
  return { head: `Likely yes under ${ev.lens.law}`, sub: u ? `If ${u} ${u === 1 ? "thing checks" : "things check"} out that no public data can answer.` : "Every test passed." };
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + ".";

function VerdictBlock({ ev, score, units, basis }: { ev: Evaluation; score: number | null; units: number; basis: string }) {
  const v = verdictText(ev);
  const yes = ev.verdict === "likely";
  return (
    <section className={clsx("relative mx-6 overflow-hidden rounded-[14px]", yes ? "bg-blue-tint" : ev.verdict === "no" ? "bg-coral-tint" : "bg-stock-2")}>
      <div className={clsx("absolute inset-0", yes ? "halftone" : "halftone-coral")} aria-hidden />
      <div className="relative flex items-start gap-4 p-5">
        <span className="grid size-[60px] shrink-0 place-items-center rounded-[14px] bg-stock/80"><LensIcon id={ev.lens.id} size={48} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="display text-[21px] leading-tight font-bold tracking-[-0.02em] text-ink">{v.head}</p>
          <p className="text-[13.5px] leading-snug text-ink">{v.sub}</p>
        </div>
        {score != null && <ScoreStamp score={score} size={48} />}
      </div>
      <p className="relative px-5 pb-4 text-[13px] leading-relaxed text-ink/80">{ev.lens.plain}</p>
      {units > 0 && (
        <div className="relative flex items-center gap-4 border-t border-ink/10 bg-stock/70 px-5 py-4">
          <span className="display tnum text-[40px] leading-none text-blue">~{n(units)}</span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
              homes <AssumedTag />
            </span>
            <span className="text-[12px] leading-snug text-muted">{basis}</span>
          </span>
        </div>
      )}
    </section>
  );
}

/** The current lens's checks, with on-demand research for the open questions. */
function PrimaryChecks({ ev, row, data, title }: { ev: Evaluation; row: Row; data: CityData; title: string }) {
  const research = useResearch(ev.lens, row, title, data.city.name, ev.unknown);
  return <ChecksBlock ev={ev} row={row} data={data} research={research} />;
}

function ChecksBlock({ ev, row, data, research }: { ev: Evaluation; row: Row; data: CityData; research?: ResearchState }) {
  const groups: { title: string; items: CheckResult[] }[] = [
    { title: "Didn't pass", items: ev.failed },
    { title: "Passed", items: ev.passed },
    { title: "No public data can answer these yet", items: ev.unknown },
  ];
  return (
    <div className="flex flex-col gap-6">
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <div key={g.title} className="flex flex-col">
            <SheetHeading aside={<span className="tnum font-mono text-[12px] text-muted">{g.items.length}</span>}>{g.title}</SheetHeading>
            {research && g.items === ev.unknown && <ResearchBar r={research} />}
            <ul className="flex flex-col">
              {g.items.map((c) => (
                <CheckRow key={c.step.id} c={c} data={data} finding={research?.findings.get(c.step.id)} />
              ))}
            </ul>
          </div>
        ))}
      {row.site?.signals.worship && ev.lens.id === "faith" && (
        <p className="rounded-[12px] border border-dashed border-muted/50 p-3.5 text-[13px] leading-snug text-ink">
          <strong className="font-semibold">This is a lead, not a fact.</strong> Maps show a place of worship here; they don&rsquo;t say who owns the land.
          Confirming ownership takes the County Assessor roll or a conversation.
        </p>
      )}
    </div>
  );
}

function CheckRow({ c, data, finding }: { c: CheckResult; data: CityData; finding?: ResearchFinding }) {
  const [open, setOpen] = useState(false);
  const srcs = [...new Map(c.step.sources.map((id) => findSource(data, id)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => [s.id, s])).values()];
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 py-3 text-left">
        <StatusMark status={c.status} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] leading-snug text-ink">{c.step.label}</span>
          {c.detail && <span className="text-[12.5px] leading-snug text-muted">{c.detail}</span>}
        </span>
        {c.step.kind === "practical" && <Tag tone="dotted">our call</Tag>}
        <IconChevron size={14} className={clsx("mt-1 shrink-0 text-muted transition-transform duration-200", open && "rotate-90")} />
      </button>
      {finding && (
        <div className="pb-3 pl-8">
          <FindingNote f={finding} />
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div className="flex flex-col gap-2 pb-3.5 pl-8 text-[12.5px] leading-snug text-ink">
              {c.step.assumption && <p className="text-muted">{c.step.assumption}</p>}
              {c.step.cite && <CiteLink cite={c.step.cite} />}
              {srcs.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="group/l flex items-center gap-1.5">
                  <span className="text-blue underline decoration-blue/30 group-hover/l:decoration-blue">{s.name}</span>
                  <span className="font-mono text-[11px] text-muted">
                    checked {shortDate(s.checked)}
                    {s.status !== "ok" ? ` · ${s.status}` : ""}
                  </span>
                  <IconExternal size={12} className="text-muted" />
                </a>
              ))}
              {c.status === "unknown" && !srcs.length && <p className="text-muted">No dataset covers this. Rules as of {shortDate(CHECKED)}.</p>}
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
    <a href={d.url} target="_blank" rel="noreferrer" className="group/l flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="text-blue underline decoration-blue/30 group-hover/l:decoration-blue">{d.name}</span>
      {cite.page && <span className="font-mono text-[11px] text-muted">{cite.page}</span>}
      {cite.section && <span className="font-mono text-[11px] text-muted">· {cite.section}</span>}
      {cite.caveat && <span className="text-[11.5px] text-coral-ink">· {cite.caveat}</span>}
      <IconExternal size={12} className="text-muted" />
    </a>
  );
}

function GoodToKnow({ row }: { row: Row }) {
  const s = row.site;
  const items: { k: string; v: string; warn?: boolean }[] = [];
  items.push(
    has(row.flags, F.hqta)
      ? { k: "Transit", v: "In a high-quality transit area, so likely no parking minimum (AB 2097; proxy)" }
      : { k: "Transit", v: "Not in a mapped high-quality transit area" },
  );
  if (has(row.flags, F.freeway500)) items.push({ k: "Freeway", v: "Within 500 ft of a freeway: AB 2011 projects need air filtration and other building features (AB 2243)", warn: true });
  if (has(row.flags, F.conservation)) items.push({ k: "Open space", v: s?.enrich?.conservationName ? `On or next to ${s.enrich.conservationName} (protected open space)` : "On protected open space (parks, school fields)", warn: true });
  if (has(row.flags, F.liquefaction)) items.push({ k: "Ground", v: "Liquefaction zone: expect a geotechnical study", warn: true });
  if (has(row.flags, F.landslide)) items.push({ k: "Ground", v: "Landslide zone", warn: true });
  if (s?.ces.percentile != null) items.push({ k: "Pollution", v: `CalEnviroScreen ${ordinal(Math.round(s.ces.percentile))} percentile` });
  if (s?.signals.heSite) {
    const h = s.signals.heSite;
    const cap = [h.lower && `${h.lower} lower`, h.moderate && `${h.moderate} moderate`, h.aboveModerate && `${h.aboveModerate} above-moderate`].filter(Boolean).join(", ");
    items.push({ k: "City plan", v: `In the Housing Element sites inventory${cap ? ` (${cap} income units)` : ""}` });
  }
  if (s?.existingUse) items.push({ k: "Used as", v: s.existingUse.replace(/^\d+\s*/, "") });
  if (s?.assessed.land != null) items.push({ k: "Assessed", v: `Land $${n(s.assessed.land)}, building $${n(s.assessed.improvement ?? 0)}` });
  if (s?.signals.surplus?.agency) items.push({ k: "Agency", v: s.signals.surplus.agency });
  return (
    <dl className="flex flex-col">
      {items.map((it) => (
        <div key={it.k + it.v} className="grid grid-cols-[96px_1fr] gap-3 border-b border-hairline py-2.5 text-[13.5px] last:border-b-0">
          <dt className="text-muted">{it.k}</dt>
          <dd className={clsx(it.warn ? "text-coral-ink" : "text-ink")}>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function OtherLaw({ ev, row, data }: { ev: Evaluation; row: Row; data: CityData }) {
  const [open, setOpen] = useState(false);
  const v = verdictText(ev);
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left">
        <StatusMark status={ev.verdict === "likely" ? "pass" : ev.verdict === "no" ? "fail" : "unknown"} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">
            {ev.lens.name} <span className="font-mono text-[11px] font-normal text-blue">{ev.lens.law}</span>
          </span>
          <span className="text-[12.5px] text-muted">{v.sub}</span>
        </span>
        <IconChevron size={14} className={clsx("shrink-0 text-muted transition-transform duration-200", open && "rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden pb-4 pl-8">
            <ChecksBlock ev={ev} row={row} data={data} />
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
    ["hazard", "Site issue"],
    ["wont_sell", "Owner won't sell"],
    ["already_built", "Already built"],
    ["other", "Other"],
  ];
  return (
    <div className="relative">
      <IconButton label="Pass" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <IconX size={16} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: EASE }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-10 right-0 z-20 flex w-48 flex-col rounded-[12px] bg-stock p-1.5 shadow-[var(--shadow-float)] ring-1 ring-hairline"
          >
            <span className="px-2.5 pt-1 pb-1.5 text-[12px] text-muted">Why pass?</span>
            {reasons.map(([id, label]) => (
              <Button key={id} variant="ghost" size="sm" className="justify-start rounded-[8px] px-2.5 text-ink" onClick={() => onPass(id)}>
                {label}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
