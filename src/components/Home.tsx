"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { LENSES } from "@/lib/rules/lenses";
import { n } from "@/lib/format";
import { LensArt } from "./LensArt";
import { IconChevron, IconSearch } from "./ui";

export function Home({ onSearch }: { onSearch: () => void }) {
  const data = useStore((s) => s.data)!;
  const chooseLens = useStore((s) => s.chooseLens);
  const [hot, setHot] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-7 px-6 pt-7 pb-6">
      <header className="flex flex-col gap-3">
        <p className="tnum text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          {data.city.name} · {n(data.parcels.count)} parcels
        </p>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">
          Which of these could become <em className="text-clay not-italic">homes</em>?
        </h1>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          New California laws opened land that used to be off-limits. Pick what you&rsquo;re looking for and we&rsquo;ll sieve the
          whole city, one legal test at a time.
        </p>
      </header>

      <nav aria-label="What are you looking for?" className="-mx-2 flex flex-col">
        <p className="px-2 pb-2 text-[12px] font-medium text-muted">What are you looking for?</p>
        {LENSES.map((lens) => (
          <button
            key={lens.id}
            onClick={() => chooseLens(lens.id)}
            onMouseEnter={() => setHot(lens.id)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(lens.id)}
            onBlur={() => setHot(null)}
            className="press group flex items-center gap-3.5 rounded-[18px] p-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
          >
            <span className="grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-paper transition-colors duration-200 group-hover:bg-surface">
              <LensArt id={lens.id} playing={hot === lens.id} className="size-[60px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-baseline gap-2">
                <span className="text-[15px] font-semibold text-ink">{lens.name}</span>
                <span className="text-[11px] font-medium text-muted">{lens.law}</span>
              </span>
              <span className="text-[13px] leading-snug text-ink-2">{lens.hook}</span>
            </span>
            <IconChevron className="shrink-0 text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-hairline pt-5">
        <p className="text-[13px] text-ink-2">Already have a place in mind?</p>
        <button
          onClick={onSearch}
          className="press flex h-11 items-center gap-2.5 rounded-full bg-surface px-4 text-left text-[14px] text-muted shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
        >
          <IconSearch />
          <span className="flex-1">Check an address or APN</span>
          <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">⌘K</kbd>
        </button>
      </div>
    </div>
  );
}
