"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/store";
import { loadCities, loadCity } from "@/lib/data";
import { n } from "@/lib/format";
import { Home } from "./Home";
import { SieveScreen } from "./Sieve";
import { Shortlist } from "./Shortlist";
import { SiteDetail } from "./SiteDetail";
import { SearchPalette } from "./Search";
import { BoardBrief } from "./BoardBrief";
import { IconSearch } from "./ui";

const CityMap = dynamic(() => import("./CityMap").then((m) => m.CityMap), { ssr: false });

export function App() {
  const data = useStore((s) => s.data);
  const setData = useStore((s) => s.setData);
  const mode = useStore((s) => s.mode);
  const selectedApn = useStore((s) => s.selectedApn);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    loadCities()
      .then((cities) => loadCity(cities.find((c) => c.built) ?? cities[0]))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [setData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "/" && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Each new screen starts at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [mode, selectedApn]);

  const screenKey = mode === "site" ? `site-${selectedApn}` : mode;

  return (
    <main className="relative h-full w-full overflow-hidden bg-paper">
      <div className="absolute inset-0 print:hidden">{data && <CityMap />}</div>

      {/* Panel: left column on desktop, bottom sheet on phones */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 top-[38vh] z-10 flex flex-col md:inset-y-4 md:left-4 md:right-auto md:top-4 md:w-[420px] print:hidden">
        <div className="pointer-events-auto mb-3 hidden items-center gap-2 px-2 md:flex">
          <Wordmark />
        </div>
        <section
          aria-label="Groundwork"
          className="pointer-events-auto relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] bg-surface shadow-[var(--shadow-panel)]"
        >
          <div ref={scroller} className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {!data ? (
              <Loading error={error} />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={screenKey}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)", filter: "blur(4px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)", transition: { duration: 0.26, ease: [0.23, 1, 0.32, 1] } }}
                  exit={{ opacity: 0, filter: reduce ? "none" : "blur(2px)", transition: { duration: 0.12 } }}
                >
                  {mode === "home" && <Home onSearch={() => setSearchOpen(true)} />}
                  {mode === "sieve" && <SieveScreen />}
                  {mode === "list" && <Shortlist onPrint={() => window.print()} />}
                  {mode === "site" && <SiteDetail address={null} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          <footer className="border-t border-hairline px-5 py-2.5 text-[10.5px] leading-snug text-muted">
            Prototype · not legal, financial or lending advice · Santa Ana only · data and rules checked Nov 7, 2026
          </footer>
        </section>
      </div>

      {/* Search pill */}
      {data && (
        <button
          onClick={() => setSearchOpen(true)}
          className="press absolute top-4 right-4 z-10 flex h-11 items-center gap-2.5 rounded-full bg-surface/95 pr-3 pl-4 text-[14px] text-muted shadow-[var(--shadow-panel)] backdrop-blur hover:text-ink print:hidden"
        >
          <IconSearch />
          <span className="hidden sm:inline">Search an address or ask</span>
          <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
        </button>
      )}

      {data && (
        <>
          {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
          <BoardBrief />
        </>
      )}
    </main>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="6" fill="var(--ink)" />
        <g fill="var(--paper)">
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={6.5 + c * 4.5} cy={6.5 + r * 4.5} r={r === 2 && c === 2 ? 0 : 1.1} opacity={0.55} />))}
        </g>
        <circle cx="15.5" cy="15.5" r="2" fill="var(--clay)" />
      </svg>
      <span className="serif text-[21px] leading-none text-ink">Groundwork</span>
    </span>
  );
}

function Loading({ error }: { error: string | null }) {
  return (
    <div className="flex flex-col gap-3 px-6 pt-8">
      <span className="serif text-[34px] leading-[1.05] text-ink/30">Laying out {n(57926)} parcels…</span>
      {error && <p className="text-[13px] text-fail">Couldn&rsquo;t load the city data: {error}</p>}
    </div>
  );
}
