"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { useStore, type PassReason } from "@/lib/store";
import { useSieve } from "@/lib/useSieve";
import { scoreSite } from "@/lib/score";
import { evaluate, rowFromSite } from "@/lib/rules/engine";
import { LENS_BY_ID } from "@/lib/rules/lenses";
import { F, has } from "@/lib/flags";
import { acres, n, siteTitle } from "@/lib/format";
import type { Site } from "@/lib/types";
import { Receipt } from "./Sieve";
import { IconBack, IconBookmark, IconBookmarkFilled, IconButton, IconChevron, IconPrint, IconX, ScoreStamp, Tag } from "./ui";

const REASONS: { id: PassReason; label: string }[] = [
  { id: "too_small", label: "Too small" },
  { id: "hazard", label: "Site issue" },
  { id: "wont_sell", label: "Won't sell" },
  { id: "already_built", label: "Already built" },
  { id: "other", label: "Other" },
];

const EASE = [0.23, 1, 0.32, 1] as const;

export function Shortlist({ onPrint }: { onPrint: () => void }) {
  const data = useStore((s) => s.data)!;
  // Can be null for a frame while this screen animates out after "start over".
  const sieve = useSieve();
  const goHome = useStore((s) => s.goHome);
  const tab = useStore((s) => s.listTab);
  const setTab = useStore((s) => s.setListTab);
  const saved = useStore((s) => s.saved);
  const passed = useStore((s) => s.passed);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const [showHow, setShowHow] = useState(false);

  const ranked = useMemo(
    () =>
      (sieve?.survivorApns ?? [])
        .map((a) => data.siteByApn.get(a))
        .filter((s): s is Site => !!s)
        .map((s) => ({ site: s, score: scoreSite(s, sieve!.lens.id) }))
        .sort((a, b) => b.score.score - a.score.score || b.score.units - a.score.units),
    [data, sieve],
  );

  const filtered = ranked.filter(({ site, score }) => {
    if (filters.transit && !has(site.flags, F.hqta)) return false;
    if (filters.vacant && !(has(site.flags, F.vacant) || has(site.flags, F.lowCover))) return false;
    if (filters.minHomes && score.units < filters.minHomes) return false;
    return true;
  });

  const lists = {
    review: filtered.filter(({ site }) => !saved[site.apn] && !passed[site.apn]),
    saved: filtered.filter(({ site }) => saved[site.apn]),
    passed: filtered.filter(({ site }) => passed[site.apn]),
  };
  const items = lists[tab];
  const rankOf = useMemo(() => new Map(ranked.map((r, i) => [r.site.apn, i + 1])), [ranked]);
  if (!sieve) return null;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex flex-col bg-stock">
        <div className="flex items-center gap-2 px-4 pt-4">
          <IconButton label="Start over" onClick={goHome}>
            <IconBack />
          </IconButton>
          <span className="text-[13.5px] font-medium text-ink">{sieve.lens.name}</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="font-mono text-[11px] text-blue">{sieve.lens.law}</span>
            <IconButton label="Print a board brief of saved lots" onClick={onPrint}>
              <IconPrint size={17} />
            </IconButton>
          </span>
        </div>

        <div className="flex flex-col gap-3 px-6 pt-3 pb-4">
          <h2 className="display text-[34px] leading-[0.95] text-blue">
            {filtered.length === ranked.length ? (
              <>
                <span className="tnum">{n(ranked.length)}</span> {ranked.length === 1 ? "lot" : "lots"} worth a call
              </>
            ) : (
              <>
                <span className="tnum">{n(filtered.length)}</span> of {n(ranked.length)} lots match
              </>
            )}
          </h2>
          <button onClick={() => setShowHow((v) => !v)} aria-expanded={showHow} className="press flex items-center gap-1 self-start text-[13px] text-muted hover:text-ink">
            Sifted from {n(sieve.total)} parcels. See the cuts
            <IconChevron size={14} className={clsx("transition-transform duration-200", showHow && "rotate-90")} />
          </button>
          <AnimatePresence initial={false}>
            {showHow && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="overflow-hidden"
              >
                <Receipt sieve={sieve} compact />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
            <FilterChip on={filters.transit} onClick={() => setFilter("transit", !filters.transit)}>
              Near transit
            </FilterChip>
            <FilterChip on={filters.vacant} onClick={() => setFilter("vacant", !filters.vacant)}>
              Open land
            </FilterChip>
            <FilterChip on={!!filters.minHomes} onClick={() => setFilter("minHomes", filters.minHomes ? null : 10)}>
              {filters.minHomes ?? 10}+ homes
            </FilterChip>
          </div>
        </div>

        <div role="tablist" className="relative flex gap-6 border-b border-hairline px-6 text-[13.5px]">
          {(["review", "saved", "passed"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={clsx("relative -mb-px pb-3 font-medium transition-colors duration-150", tab === t ? "text-ink" : "text-muted hover:text-ink")}
            >
              {t === "review" ? "To review" : t === "saved" ? "Saved" : "Passed"}
              <span className="tnum ml-1.5 font-mono text-[11.5px] text-muted">{lists[t].length}</span>
              {tab === t && <motion.span layoutId="tab-underline" className="absolute inset-x-0 bottom-0 h-[2px] bg-blue" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col pb-6">
        <AnimatePresence initial mode="popLayout">
          {items.map(({ site, score }, i) => (
            <SiteRow key={site.apn} site={site} score={score.score} units={score.units} rank={rankOf.get(site.apn) ?? 0} index={i} />
          ))}
        </AnimatePresence>
        {items.length === 0 && <EmptyTab tab={tab} filtered={filtered.length !== ranked.length} />}
      </ul>
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx("press h-8 rounded-full px-3 text-[13px] font-medium", on ? "bg-blue text-stock" : "bg-stock-2 text-ink hover:bg-stock-3")}
    >
      {children}
    </button>
  );
}

function EmptyTab({ tab, filtered }: { tab: string; filtered: boolean }) {
  const copy =
    tab === "saved"
      ? "Nothing saved yet. Press S on a lot, or tap its bookmark."
      : tab === "passed"
        ? "Lots you pass on land here, with your reason."
        : filtered
          ? "No lots match these filters. Try removing one."
          : "You've been through every lot.";
  return <li className="px-6 py-12 text-center text-[14px] text-muted">{copy}</li>;
}

function SiteRow({ site, score, units, rank, index }: { site: Site; score: number; units: number; rank: number; index: number }) {
  const data = useStore((s) => s.data)!;
  const lensId = useStore((s) => s.lensId);
  const open = useStore((s) => s.openSite);
  const hover = useStore((s) => s.hover);
  const hovered = useStore((s) => s.hoveredApn === site.apn);
  const isSaved = useStore((s) => !!s.saved[site.apn]);
  const isPassed = useStore((s) => !!s.passed[site.apn]);
  const toggleSave = useStore((s) => s.toggleSave);
  const pass = useStore((s) => s.pass);
  const unpass = useStore((s) => s.unpass);
  const [asking, setAsking] = useState(false);

  const ev = useMemo(() => (lensId ? evaluate(data, LENS_BY_ID[lensId], rowFromSite(site)) : null), [data, lensId, site]);
  const facts = [acres(site.lotSqft), site.zoning.local, units > 0 ? `~${n(units)} homes` : null].filter(Boolean);
  const flagFails = ev?.failed.filter((c) => c.step.kind === "flag") ?? [];

  useEffect(() => {
    if (!hovered) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "s") toggleSave(site.apn);
      if (e.key === "x") setAsking(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovered, site.apn, toggleSave]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: 0.3, delay: Math.min(index, 10) * 0.035, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      onMouseEnter={() => hover(site.apn)}
      onMouseLeave={() => hover(null)}
      className={clsx("group relative border-b border-hairline transition-colors duration-150", hovered && "bg-stock-2")}
    >
      <button onClick={() => open(site.apn)} className="flex w-full items-start gap-3.5 py-4 pr-24 pl-6 text-left">
        <ScoreStamp score={score} top={rank === 1} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline gap-2">
            <span className="tnum font-mono text-[11px] text-muted">{rank}</span>
            <span className="truncate text-[15.5px] font-semibold text-ink">{siteTitle(site)}</span>
          </span>
          <span className="truncate font-mono text-[11.5px] text-muted">{facts.join("  ·  ")}</span>
          <span className="flex flex-wrap gap-1 pt-1">
            {has(site.flags, F.vacant) && <Tag tone="blue">Vacant</Tag>}
            {has(site.flags, F.hqta) && <Tag tone="blue">Near transit</Tag>}
            {has(site.flags, F.surplus) && <Tag tone="coral">Surplus notice</Tag>}
            {flagFails.map((c) => (
              <Tag key={c.step.id} tone="coral">
                {c.step.id === "sla_window" ? "Window closed" : c.step.cut}
              </Tag>
            ))}
            {ev && ev.unknown.length > 0 && <Tag tone="dotted">{ev.unknown.length} to confirm</Tag>}
          </span>
        </span>
      </button>
      <div className="absolute top-3.5 right-4 flex gap-0.5">
        {isPassed ? (
          <IconButton label="Undo pass" onClick={() => unpass(site.apn)}>
            <IconBack size={16} />
          </IconButton>
        ) : (
          <>
            <IconButton label={isSaved ? "Unsave (S)" : "Save (S)"} onClick={() => toggleSave(site.apn)} className={isSaved ? "text-coral-ink hover:text-coral-ink" : ""}>
              {isSaved ? <IconBookmarkFilled size={17} /> : <IconBookmark size={17} />}
            </IconButton>
            <IconButton label="Pass (X)" onClick={() => setAsking((v) => !v)}>
              <IconX size={16} />
            </IconButton>
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {asking && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 px-6 pb-4">
              <span className="mr-1 text-[12.5px] text-muted">Why pass?</span>
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    pass(site.apn, r.id);
                    setAsking(false);
                  }}
                  className="press h-7 rounded-full bg-stock px-2.5 text-[12.5px] font-medium text-ink ring-1 ring-hairline hover:bg-blue hover:text-stock hover:ring-blue"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
