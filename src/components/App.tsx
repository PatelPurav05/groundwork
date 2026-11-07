"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/store";
import { loadCities, loadCity } from "@/lib/data";
import { Home } from "./Home";
import { SieveScreen } from "./Sieve";
import { Shortlist } from "./Shortlist";
import { SiteDetail } from "./SiteDetail";
import { SearchPalette } from "./Search";
import { BoardBrief } from "./BoardBrief";
import { Wordmark } from "./Brand";
import { ScreenBoundary } from "./ScreenBoundary";
import { IconSearch } from "./ui";

const CityMap = dynamic(() => import("./CityMap").then((m) => m.CityMap), { ssr: false });

export function App() {
  const data = useStore((s) => s.data);
  const setData = useStore((s) => s.setData);
  const mode = useStore((s) => s.mode);
  const selectedApn = useStore((s) => s.selectedApn);
  const goHome = useStore((s) => s.goHome);
  const closeSite = useStore((s) => s.closeSite);
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
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [mode, selectedApn]);

  const screenKey = mode === "site" ? `site-${selectedApn}` : mode;

  return (
    <main className="relative h-full w-full overflow-hidden bg-stock">
      <div className="absolute inset-0 md:left-[440px] print:hidden">
        {data && (
          <ScreenBoundary fallback={<MapUnavailable />}>
            <CityMap />
          </ScreenBoundary>
        )}
      </div>

      {/* The sheet: docked, full height, square, printed on the same stock as the map. */}
      <section
        aria-label="Groundwork"
        className="absolute inset-x-0 bottom-0 top-[42vh] z-10 flex flex-col border-t border-hairline bg-stock shadow-[0_-12px_40px_-20px_rgb(20_27_60/0.3)] md:inset-y-0 md:left-0 md:right-auto md:top-0 md:w-[440px] md:border-t-0 md:border-r md:shadow-none print:hidden"
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-hairline px-6">
          <button onClick={goHome} className="press -ml-1 rounded-lg px-1 py-1" aria-label="Groundwork, start over">
            <Wordmark animate />
          </button>
          {data && (
            <button
              onClick={() => setSearchOpen(true)}
              className="press flex h-9 items-center gap-2 rounded-full bg-stock-2 pr-2 pl-3 text-[13px] text-muted hover:bg-stock-3 hover:text-ink"
            >
              <IconSearch size={16} />
              <span>Search</span>
              <kbd className="rounded-[5px] bg-stock px-1.5 py-0.5 font-mono text-[10.5px] text-muted">⌘K</kbd>
            </button>
          )}
        </header>

        <div ref={scroller} className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!data ? (
            <Loading error={error} />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screenKey}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)", filter: "blur(3px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)", transition: { duration: 0.26, ease: [0.23, 1, 0.32, 1] } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <ScreenBoundary onRecover={mode === "site" ? closeSite : goHome}>
                  {mode === "home" && <Home onSearch={() => setSearchOpen(true)} />}
                  {mode === "sieve" && <SieveScreen />}
                  {mode === "list" && <Shortlist onPrint={() => window.print()} />}
                  {mode === "site" && <SiteDetail address={null} />}
                </ScreenBoundary>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <footer className="shrink-0 border-t border-hairline px-6 py-2.5 text-[11px] leading-snug text-muted">
          Prototype for screening, not legal or financial advice. Santa Ana only. Data and rules checked Nov 7, 2026.
        </footer>
      </section>

      {data && (
        <>
          {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
          <BoardBrief />
        </>
      )}
    </main>
  );
}

/** If WebGL or the map fails, the sheet still works: the list and site pages carry everything. */
function MapUnavailable() {
  return (
    <div className="grid h-full place-items-center bg-stock-2 p-8 text-center">
      <p className="max-w-[32ch] text-[14px] leading-relaxed text-muted">
        The map couldn&rsquo;t start in this browser. Every list, check and source still works in the panel.
      </p>
    </div>
  );
}

function Loading({ error }: { error: string | null }) {
  return (
    <div className="flex flex-col gap-3 px-6 pt-10">
      <p className="display text-[40px] leading-[0.95] text-blue/25">Printing the city…</p>
      {error && <p className="text-[13px] text-coral-ink">Couldn&rsquo;t load the city data: {error}</p>}
    </div>
  );
}
