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
        doneTimer = setTimeout(finish, reduce || skipRef.current ? 150 : 900);
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

  return (
    <div className="flex flex-col gap-6 px-6 pt-5 pb-6">
      <div className="flex items-center gap-2">
        <IconButton label="Back" onClick={goHome} className="-ml-2">
          <IconBack />
        </IconButton>
        <span className="text-[13px] font-medium text-ink-2">{sieve.lens.name}</span>
        <Tag className="ml-auto">{sieve.lens.law}</Tag>
      </div>

      <div className="flex flex-col gap-1">
        <span className="serif tnum text-[64px] leading-[0.9] text-ink" aria-live="polite">
          {n(remaining)}
        </span>
        <span className="text-[14px] text-ink-2">
          {done ? (remaining === 1 ? "site left standing" : "sites left standing") : "parcels still in the running"}
        </span>
      </div>

      <Receipt sieve={sieve} progress={progress} />

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted">Every cut is a public dataset. Unknowns never cut.</span>
        {!done && (
          <Button variant="ghost" onClick={skip} className="h-8 px-3 text-[13px]">
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
      <li className="flex items-baseline justify-between border-b border-dashed border-hairline pb-2.5 text-[13px] text-ink-2">
        <span>All parcels in {data.city.name}</span>
        <span className="tnum font-medium text-ink">{n(sieve.total)}</span>
      </li>
      {sieve.steps.map((s, i) => {
        const visible = i < shown;
        const active = progress !== Infinity && i === Math.floor(progress) && progress < sieve.steps.length;
        const local = active ? progress - i : 1;
        const src = s.step.sources.map((id) => findSource(data, id)?.name).find(Boolean);
        return (
          <li
            key={s.step.id}
            className={clsx(
              "relative flex flex-col gap-1 border-b border-hairline py-2.5 transition-[opacity,transform,filter] duration-300 ease-[var(--ease-out)]",
              visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-1 opacity-0 blur-[2px]",
            )}
          >
            <div className="flex items-baseline gap-3">
              <span className="tnum w-[68px] shrink-0 text-right text-[13px] font-semibold text-fail">
                − {n(Math.round(s.removed * (active ? easeOut(local) : 1)))}
              </span>
              <span className="flex-1 text-[13.5px] leading-snug text-ink">{s.step.cut}</span>
            </div>
            {!compact && (
              <div className="flex flex-wrap items-center gap-1.5 pl-[80px] text-[11.5px] text-muted">
                {s.step.kind === "practical" ? (
                  <Tag tone="unknown">our assumption</Tag>
                ) : s.step.cite ? (
                  <a href={DOCS[s.step.cite.doc].url} target="_blank" rel="noreferrer" className="underline decoration-hairline underline-offset-2 hover:text-ink">
                    {sieve.lens.law} · {s.step.cite.page}
                  </a>
                ) : null}
                {src && <span>· {src}</span>}
              </div>
            )}
            {active && (
              <span
                className="absolute bottom-[-1px] left-0 h-px bg-clay"
                style={{ width: `${Math.min(100, local * 100)}%` }}
                aria-hidden
              />
            )}
          </li>
        );
      })}
      {sieve.unknowns.length > 0 && (
        <li
          className={clsx(
            "flex flex-col gap-2 pt-3 transition-opacity duration-300",
            shown >= sieve.steps.length ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="text-[12px] font-medium text-muted">Not cut. Shown as a question on every site:</span>
          {sieve.unknowns.map((u) => (
            <span key={u.id} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <StatusMark status="unknown" size={16} />
              {u.label}
            </span>
          ))}
        </li>
      )}
    </ol>
  );
}
