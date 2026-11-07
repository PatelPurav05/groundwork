"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { LENSES } from "@/lib/rules/lenses";
import { n } from "@/lib/format";
import { LensArt } from "./LensArt";
import { IconArrow, IconSearch } from "./ui";

export function Home({ onSearch }: { onSearch: () => void }) {
  const data = useStore((s) => s.data)!;
  const chooseLens = useStore((s) => s.chooseLens);
  const [hot, setHot] = useState<string | null>(null);
  const count = n(data.parcels.count);

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-4 px-6 pt-8 pb-7">
        <h1 className="flex flex-col gap-2">
          <span className="display misreg tnum block text-[80px] leading-[0.82]" data-text={count}>
            <span>{count}</span>
          </span>
          <span className="display text-[27px] leading-[1.05] font-bold tracking-[-0.025em] text-ink">
            parcels in {data.city.name}. Which could hold homes?
          </span>
        </h1>
        <p className="max-w-[34ch] text-[15px] leading-relaxed text-ink">
          New state laws opened land that used to be off-limits. Pick what you&rsquo;re after and we&rsquo;ll sift the whole city, one
          test at a time, citing the data behind every cut.
        </p>
      </header>

      <nav aria-label="What are you looking for?" className="border-t border-hairline">
        <h2 className="px-6 pt-5 pb-1 text-[13px] font-medium text-muted">What are you looking for?</h2>
        <ul>
          {LENSES.map((lens) => (
            <li key={lens.id} className="border-b border-hairline last:border-b-0">
              <button
                onClick={() => chooseLens(lens.id)}
                onMouseEnter={() => setHot(lens.id)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(lens.id)}
                onBlur={() => setHot(null)}
                className="group flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors duration-150 hover:bg-stock-2 focus-visible:bg-stock-2"
              >
                <LensArt id={lens.id} playing={hot === lens.id} className="w-[84px] shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="display text-[19px] leading-tight font-bold tracking-[-0.02em] text-ink">{lens.name}</span>
                  <span className="text-[13.5px] leading-snug text-muted">{lens.hook}</span>
                  <span className="font-mono text-[11px] text-blue">{lens.law}</span>
                </span>
                <IconArrow
                  size={18}
                  className="shrink-0 text-blue opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-hairline px-6 py-6">
        <button onClick={onSearch} className="press group flex w-full items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-tint text-blue">
            <IconSearch size={17} />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-[14.5px] font-medium text-ink">Already have a lot in mind?</span>
            <span className="text-[13px] text-muted">Check any address or APN against all five laws</span>
          </span>
          <IconArrow size={17} className="text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
