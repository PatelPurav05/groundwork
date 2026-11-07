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
import { IconBack, IconBookmark, IconBookmarkFilled, IconButton, IconChevron, IconPrint, IconX, ScoreRing, Tag } from "./ui";

const REASONS: { id: PassReason; label: string }[] = [
  { id: "too_small", label: "Too small" },
  { id: "hazard", label: "Hazard / site issue" },
  { id: "wont_sell", label: "Owner won't sell" },
  { id: "already_built", label: "Already built" },
  { id: "other", label: "Other" },
];

export function Shortlist({ onPrint }: { onPrint: () => void }) {
  const data = useStore((s) => s.data)!;
  const sieve = useSieve()!;
  const goHome = useStore((s) => s.goHome);
  const tab = useStore((s) => s.listTab);
  const setTab = useStore((s) => s.setListTab);
  const saved = useStore((s) => s.saved);
  const passed = useStore((s) => s.passed);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const [showHow, setShowHow] = useState(false);

  const ranked = useMemo(() => {
    return sieve.survivorApns
      .map((a) => data.siteByApn.get(a))
      .filter((s): s is Site => !!s)
      .map((s) => ({ site: s, score: scoreSite(s, sieve.lens.id) }))
      .sort((a, b) => b.score.score - a.score.score || b.score.units - a.score.units);
  }, [data, sieve]);

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
  const missing = sieve.survivorApns.length - ranked.length;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-4 bg-surface/95 px-6 pt-5 pb-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <IconButton label="Start over" onClick={goHome} className="-ml-2">
            <IconBack />
          </IconButton>
          <span className="text-[13px] font-medium text-ink-2">{sieve.lens.name}</span>
          <Tag className="ml-auto">{sieve.lens.law}</Tag>
        </div>
        <div className="flex items-end justify-between gap-3">
          <h2 className="serif text-[30px] leading-none">
            <span className="tnum">{n(ranked.length)}</span> {ranked.length === 1 ? "site" : "sites"} worth a call
          </h2>
          <IconButton label="Print a board brief of saved sites" onClick={onPrint}>
            <IconPrint />
          </IconButton>
        </div>
        <button onClick={() => setShowHow((v) => !v)} className="press -mt-1 flex items-center gap-1 self-start text-[12.5px] text-muted hover:text-ink">
          From {n(sieve.total)} parcels. How we got here
          <IconChevron size={14} className={clsx("transition-transform duration-200", showHow && "rotate-90")} />
        </button>
        <AnimatePresence initial={false}>
          {showHow && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="pb-2">
                <Receipt sieve={sieve} compact />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip on={filters.transit} onClick={() => setFilter("transit", !filters.transit)}>Near transit</FilterChip>
          <FilterChip on={filters.vacant} onClick={() => setFilter("vacant", !filters.vacant)}>Open land</FilterChip>
          <FilterChip on={filters.minHomes === 10} onClick={() => setFilter("minHomes", filters.minHomes === 10 ? null : 10)}>10+ homes</FilterChip>
        </div>

        <div role="tablist" className="relative flex gap-5 border-b border-hairline text-[13px]">
          {(["review", "saved", "passed"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={clsx("relative -mb-px pb-2.5 font-medium", tab === t ? "text-ink" : "text-muted hover:text-ink-2")}
            >
              {t === "review" ? "To review" : t === "saved" ? "Saved" : "Passed"}
              <span className="tnum ml-1.5 text-muted">{lists[t].length}</span>
              {tab === t && <motion.span layoutId="tab-underline" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-ink" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-2 px-4 pt-2 pb-6">
        <AnimatePresence initial={true} mode="popLayout">
          {items.map(({ site, score }, i) => (
            <SiteCard key={site.apn} site={site} score={score.score} units={score.units} rank={ranked.findIndex((r) => r.site.apn === site.apn) + 1} index={i} />
          ))}
        </AnimatePresence>
        {items.length === 0 && <EmptyTab tab={tab} filtered={filtered.length !== ranked.length} />}
        {missing > 0 && tab === "review" && (
          <li className="px-2 pt-3 text-[12px] text-muted">
            {n(missing)} more parcels passed but have no detail record yet. They&rsquo;re on the map.
          </li>
        )}
      </ul>
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        "press h-8 rounded-full px-3 text-[12.5px] font-medium",
        on ? "bg-ink text-paper" : "bg-surface-2 text-ink-2 hover:bg-[#e6e1d7]",
      )}
    >
      {children}
    </button>
  );
}

function EmptyTab({ tab, filtered }: { tab: string; filtered: boolean }) {
  const copy =
    tab === "saved"
      ? "Nothing saved yet. Press S on a site, or tap the bookmark."
      : tab === "passed"
        ? "Sites you pass on land here, with your reason."
        : filtered
          ? "No sites match these filters. Try removing one."
          : "You've been through every site.";
  return <li className="px-2 py-10 text-center text-[13.5px] text-muted">{copy}</li>;
}

function SiteCard({ site, score, units, rank, index }: { site: Site; score: number; units: number; rank: number; index: number }) {
  const data = useStore((s) => s.data)!;
  const lensId = useStore((s) => s.lensId)!;
  const open = useStore((s) => s.openSite);
  const hover = useStore((s) => s.hover);
  const hovered = useStore((s) => s.hoveredApn === site.apn);
  const isSaved = useStore((s) => !!s.saved[site.apn]);
  const isPassed = useStore((s) => !!s.passed[site.apn]);
  const toggleSave = useStore((s) => s.toggleSave);
  const pass = useStore((s) => s.pass);
  const unpass = useStore((s) => s.unpass);
  const [asking, setAsking] = useState(false);

  const ev = useMemo(() => evaluate(data, LENS_BY_ID[lensId], rowFromSite(site)), [data, lensId, site]);
  const facts = [site.zoning.local ? `Zoned ${site.zoning.local}` : null, acres(site.lotSqft), units > 0 ? `~${n(units)} homes` : null].filter(Boolean);

  useEffect(() => {
    if (!hovered) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "s") toggleSave(site.apn);
      if (e.key === "x") setAsking(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovered, site.apn, toggleSave]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: 0.32, delay: Math.min(index, 12) * 0.04, ease: [0.23, 1, 0.32, 1] } }}
      exit={{ opacity: 0, transform: "scale(0.97)", transition: { duration: 0.16 } }}
      onMouseEnter={() => hover(site.apn)}
      onMouseLeave={() => hover(null)}
      className={clsx(
        "group relative rounded-[18px] bg-surface transition-shadow duration-200",
        hovered ? "shadow-[var(--shadow-card-hover)]" : "shadow-[var(--shadow-card)]",
      )}
    >
      <button onClick={() => open(site.apn)} className="press flex w-full items-start gap-3 rounded-[18px] p-3.5 pr-20 text-left">
        <span className="tnum w-4 pt-3 text-right text-[12px] font-medium text-muted">{rank}</span>
        <ScoreRing score={score} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
          <span className="truncate text-[15px] font-semibold text-ink">{siteTitle(site)}</span>
          <span className="truncate text-[12.5px] text-ink-2">{facts.join(" · ")}</span>
          <span className="flex flex-wrap gap-1">
            {has(site.flags, F.hqta) && <Tag tone="pass">Near transit</Tag>}
            {has(site.flags, F.vacant) && <Tag tone="pass">Vacant</Tag>}
            {has(site.flags, F.surplus) && <Tag tone="clay">Surplus notice</Tag>}
            {ev.failed.filter((c) => c.step.kind === "flag").map((c) => (
              <Tag key={c.step.id} tone="fail">{c.step.id === "sla_window" ? "Window closed" : c.step.cut}</Tag>
            ))}
            {has(site.flags, F.heSite) && <Tag>In city plan</Tag>}
            {ev.unknown.length > 0 && <Tag tone="unknown">{ev.unknown.length} to confirm</Tag>}
          </span>
        </span>
      </button>
      <div className="absolute top-3 right-3 flex gap-0.5">
        {isPassed ? (
          <IconButton label="Undo pass" onClick={() => unpass(site.apn)}>
            <IconBack size={16} />
          </IconButton>
        ) : (
          <>
            <IconButton label={isSaved ? "Unsave (S)" : "Save (S)"} onClick={() => toggleSave(site.apn)} className={isSaved ? "text-clay hover:text-clay" : ""}>
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
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3.5 py-3">
              <span className="mr-1 text-[12px] text-muted">Why pass?</span>
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    pass(site.apn, r.id);
                    setAsking(false);
                  }}
                  className="press h-7 rounded-full bg-surface-2 px-2.5 text-[12px] font-medium text-ink-2 hover:bg-ink hover:text-paper"
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

