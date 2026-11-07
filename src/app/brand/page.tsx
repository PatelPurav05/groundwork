"use client";

import { useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { LensIcon } from "@/components/LensIcon";
import { LENSES } from "@/lib/rules/lenses";

/** Design board: the mark and lens icons at every size they ship at. Not linked from the app. */
export default function BrandBoard() {
  const [hot, setHot] = useState<string | null>(null);
  return (
    <main className="h-full overflow-y-auto bg-stock p-12 text-ink">
      <section className="flex flex-col gap-10">
        <div className="flex items-end gap-10">
          {[16, 20, 24, 32, 48, 96, 192].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <LogoMark size={s} />
              <span className="font-mono text-[11px] text-muted">{s}</span>
            </div>
          ))}
          <div className="flex items-end gap-6 rounded-2xl bg-blue p-6 text-stock">
            <LogoMark size={48} mono />
            <LogoMark size={24} mono />
          </div>
          <div className="flex items-end gap-6 rounded-2xl bg-ink p-6 text-stock">
            <LogoMark size={48} mono />
          </div>
        </div>

        <div className="flex items-center gap-12">
          <span className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="display text-[22px] leading-none tracking-[-0.035em] text-ink">Groundwork</span>
          </span>
          <span className="flex items-center gap-4">
            <LogoMark size={56} />
            <span className="display text-[46px] leading-none tracking-[-0.04em] text-ink">Groundwork</span>
          </span>
        </div>

        <div className="flex gap-6">
          {LENSES.map((l) => (
            <button
              key={l.id}
              onMouseEnter={() => setHot(l.id)}
              onMouseLeave={() => setHot(null)}
              className="flex w-[150px] flex-col items-center gap-3 rounded-2xl bg-stock-2 p-5"
            >
              <LensIcon id={l.id} playing={hot === l.id} size={96} />
              <span className="text-[13px] font-medium">{l.name}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-8">
          {LENSES.map((l) => (
            <LensIcon key={l.id} id={l.id} size={48} />
          ))}
          {LENSES.map((l) => (
            <LensIcon key={`s${l.id}`} id={l.id} size={32} />
          ))}
        </div>
      </section>
    </main>
  );
}
