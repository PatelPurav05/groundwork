"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { useSieve } from "@/lib/useSieve";
import { findSource, type SieveResult } from "@/lib/rules/engine";
import { DOCS } from "@/lib/rules/cites";
import { n } from "@/lib/format";
import { Button, IconBack, IconButton, StatusMark, Tag } from "./ui";

const STEP_MS = 1050;
const POOL_MS = 1500;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Drives sieveProgress from 0 → steps.length, then hands off to the shortlist. */
function useDirector(sieve: SieveResult | null) {
  const mode = useStore((s) => s.mode);
  const setProgress = useStore((s) => s.setSieveProgress);
  const finish = useStore((s) => s.finishSieve);
  const skipRef = useRef(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!sieve || mode !== "sieve") return;
    skipRef.current = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const durations = sieve.steps.map((s) => (s.step.kind === "pool" ? POOL_MS : STEP_MS));
    const total = durations.reduce((a, b) => a + b, 0);
    let start = 0;
    let raf = 0;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = (now: number) => {
      if (!start) start = now;
      let t = reduce || skipRef.current ? total : now - start;
      let p = 0;
      for (const d of durations) {
        if (t >= d) {
          p += 1;
          t -= d;
        } else {
          p += t / d;
          break;
        }
      }
      setProgress(Math.min(p, sieve.steps.length));
      if (p >= sieve.steps.length) {
        doneTimer = setTimeout(finish, reduce || skipRef.current ? 150 : 1000);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(doneTimer);
    };
  }, [sieve, mode, setProgress, finish]);

  return {
    skip: () => {
      skipRef.current = true;
      force((x) => x + 1);
    },
  };
}

export function SieveScreen() {
  const sieve = useSieve();
  const progress = useStore((s) => s.sieveProgress);
  const goHome = useStore((s) => s.goHome);
  const { skip } = useDirector(sieve);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  if (!sieve) return null;
  const k = Math.min(Math.floor(progress), sieve.steps.length - 1);
  const frac = progress >= sieve.steps.length ? 1 : easeOut(progress - Math.floor(progress));
  const prev = k === 0 ? sieve.total : sieve.steps[k - 1].remaining;
  const done = progress >= sieve.steps.length;
  // At the end, count lots, not assessor records (several records can share one lot).
  const remaining = done ? sieve.survivorApns.length : Math.round(prev + (sieve.steps[k].remaining - prev) * frac);
  const label = n(remaining);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-4">
        <IconButton label="Back" onClick={goHome}>
          <IconBack />
        </IconButton>
        <span className="text-[13.5px] font-medium text-ink">{sieve.lens.name}</span>
        <span className="ml-auto pr-2 font-mono text-[11px] text-blue">{sieve.lens.law}</span>
      </div>

      <div className="flex flex-col gap-2 px-6 pt-6 pb-7" aria-live="polite">
        <span className={clsx("display tnum block text-[88px] leading-[0.85] text-blue", done && "misreg")} data-text={label}>
          <span>{label}</span>
        </span>
        <span className="text-[15px] text-ink">
          {done ? (remaining === 1 ? "lot left standing." : "lots left standing.") : "parcels still in the running"}
        </span>
      </div>

      <div className="border-t border-hairline px-6 pt-4">
        <Receipt sieve={sieve} progress={progress} />
      </div>

      <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-6">
        <span className="text-[12.5px] text-muted">Each cut cites its data. Unknowns never cut.</span>
        {!done && (
          <Button variant="ghost" size="sm" onClick={skip}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}

/** The methodology, written as a receipt. Also shown (static) above the shortlist. */
export function Receipt({ sieve, progress = Infinity, compact }: { sieve: SieveResult; progress?: number; compact?: boolean }) {
  const data = useStore((s) => s.data)!;
  const shown = progress === Infinity ? sieve.steps.length : Math.ceil(progress + 0.001);
  return (
    <ol className="flex flex-col">
      <li className="flex items-baseline justify-between pb-3 text-[13.5px] text-muted">
        <span>Every parcel in {data.city.name}</span>
        <span className="tnum font-mono text-[12.5px] text-ink">{n(sieve.total)}</span>
      </li>
      {sieve.steps.map((s, i) => {
        const visible = i < shown;
        const active = progress !== Infinity && i === Math.floor(progress) && progress < sieve.steps.length;
        const local = active ? progress - i : 1;
        const srcs = [...new Set(s.step.sources.map((id) => findSource(data, id)?.name).filter(Boolean))] as string[];
        return (
          <li
            key={s.step.id}
            className={clsx(
              "relative grid grid-cols-[76px_1fr] gap-x-3 gap-y-1 border-t border-hairline py-3 transition-[opacity,transform,filter] duration-300 ease-[var(--ease-out)]",
              visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-1 opacity-0 blur-[2px]",
            )}
          >
            <span className="tnum pt-px text-right font-mono text-[13px] font-medium text-coral-ink">
              −{n(Math.round(s.removed * (active ? easeOut(local) : 1)))}
            </span>
            <span className="text-[14px] leading-snug text-ink">{s.step.cut}</span>
            {!compact && (
              <span className="col-start-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted">
                {s.step.kind === "practical" ? (
                  <Tag tone="dotted">our assumption</Tag>
                ) : s.step.cite ? (
                  <a href={DOCS[s.step.cite.doc].url} target="_blank" rel="noreferrer" className="text-blue underline decoration-blue/30 hover:decoration-blue">
                    {sieve.lens.law}, {s.step.cite.page}
                  </a>
                ) : null}
                {srcs.length > 0 && <span>· {srcs.join(" + ")}</span>}
              </span>
            )}
            {active && <span className="absolute bottom-[-1px] left-0 h-[2px] bg-coral" style={{ width: `${Math.min(100, local * 100)}%` }} aria-hidden />}
          </li>
        );
      })}
      {sieve.unknowns.length > 0 && (
        <li className={clsx("flex flex-col gap-2.5 border-t border-hairline pt-4 pb-1 transition-opacity duration-300", shown >= sieve.steps.length ? "opacity-100" : "opacity-0")}>
          <span className="text-[13px] font-medium text-ink">Not cut, shown as a question on every lot</span>
          {sieve.unknowns.map((u) => (
            <span key={u.id} className="flex items-center gap-2.5 text-[13.5px] text-muted">
              <StatusMark status="unknown" size={18} />
              {u.label}
            </span>
          ))}
        </li>
      )}
    </ol>
  );
}
