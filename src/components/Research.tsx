"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { useStore, type ResearchFinding } from "@/lib/store";
import type { CheckResult } from "@/lib/rules/engine";
import type { Lens, Row } from "@/lib/rules/lenses";
import { acres, displayApn, shortDate } from "@/lib/format";
import { Button, IconExternal, IconSparkle } from "./ui";

type Phase = "idle" | "running" | "error";

/**
 * Per-lot web research for the checks no public layer answers. Runs on request (it costs a
 * minute and real tokens), streams what it's doing, and stores findings in this browser.
 */
export function useResearch(lens: Lens, row: Row, title: string, city: string, unknown: CheckResult[]) {
  const record = useStore((s) => s.research[row.apn]);
  const setResearch = useStore((s) => s.setResearch);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const fresh = record && record.law === lens.law ? record : null;
  const byId = new Map((fresh?.findings ?? []).map((f) => [f.id, f]));

  // Research anyone has already done for this lot is saved on the server; pull it in on open.
  useEffect(() => {
    if (fresh) return;
    let live = true;
    fetch(`/api/research?apn=${encodeURIComponent(row.apn)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { research?: Record<string, { at: string; findings: ResearchFinding[] }> } | null) => {
        const saved = j?.research?.[lens.law];
        if (live && saved?.findings?.length) setResearch(row.apn, { at: Date.parse(saved.at) || Date.now(), law: lens.law, findings: saved.findings });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [row.apn, lens.law, fresh, setResearch]);

  async function run(force = false) {
    if (!unknown.length) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setPhase("running");
    setLog([]);
    setError(null);
    const s = row.site;
    const facts = [
      `APN ${displayApn(row.apn)}.`,
      row.lot ? `Lot ${acres(row.lot)}.` : null,
      s?.zoning.local ? `Zoned ${s.zoning.local}.` : null,
      s?.existingUse ? `Existing use: ${s.existingUse.replace(/^\d+\s*/, "")}.` : null,
      s?.signals.worship?.name ? `Place of worship mapped here: ${s.signals.worship.name}.` : null,
      s?.signals.surplus?.agency ? `Surplus Land Act notice filed by ${s.signals.surplus.agency}${s.signals.surplus.date ? ` on ${s.signals.surplus.date}` : ""}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force, apn: row.apn, title, city, law: lens.law, facts, questions: unknown.map((u) => ({ id: u.step.id, label: u.step.label })) }),
        signal: ac.signal,
      });
      if (res.status === 503) throw new Error("Research needs an Anthropic API key on the server.");
      if (!res.ok || !res.body) throw new Error("Research couldn't start.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; findings?: ResearchFinding[]; at?: string; message?: string };
          if (ev.type === "status" && ev.text) setLog((l) => (l[l.length - 1] === ev.text ? l : [...l, ev.text!]));
          if (ev.type === "result" && ev.findings) {
            setResearch(row.apn, { at: (ev.at && Date.parse(ev.at)) || Date.now(), law: lens.law, findings: ev.findings });
            setPhase("idle");
          }
          if (ev.type === "error") throw new Error(ev.message ?? "Research failed.");
        }
      }
      setPhase((p) => (p === "running" ? "idle" : p));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setPhase("error");
    }
  }

  return { phase, log, error, findings: byId, at: fresh?.at ?? null, run, count: unknown.length };
}

export type ResearchState = ReturnType<typeof useResearch>;

/** The action + live feed, shown above the open questions. */
export function ResearchBar({ r }: { r: ResearchState }) {
  const done = r.findings.size > 0;
  return (
    <div className="mb-2 flex flex-col gap-2 rounded-[12px] bg-blue-tint/60 p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue text-stock">
          <IconSparkle size={15} className={clsx(r.phase === "running" && "animate-pulse")} />
        </span>
        <p className="flex-1 text-[13px] leading-snug text-ink">
          {r.phase === "running"
            ? "Claude is searching public records for these questions…"
            : done
              ? `Researched ${r.at ? shortDate(new Date(r.at).toISOString()) : ""} and saved for everyone who opens this lot. Web findings are evidence to verify, not answers.`
              : `Claude can search public records for ${r.count === 1 ? "this question" : `these ${r.count} questions`}. Takes about a minute.`}
        </p>
        {r.phase !== "running" && (
          <Button size="sm" variant={done ? "ghost" : "primary"} onClick={() => r.run(done)}>
            {done ? "Research again" : "Research"}
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {r.phase === "running" && r.log.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-1 overflow-hidden pl-11">
            {r.log.slice(-3).map((t, i, a) => (
              <li key={`${t}-${i}`} className={clsx("truncate text-[12px]", i === a.length - 1 ? "text-ink" : "text-muted")}>
                {t}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {r.error && <p className="pl-11 text-[12.5px] text-coral-ink">{r.error}</p>}
    </div>
  );
}

const ANSWER = {
  yes: { label: "Sources suggest yes", cls: "bg-blue text-stock" },
  no: { label: "Sources suggest no", cls: "bg-coral text-ink" },
  unclear: { label: "Still unclear", cls: "border border-dashed border-muted/60 text-muted" },
} as const;

/** One finding, under its question. */
export function FindingNote({ f }: { f: ResearchFinding }) {
  const a = ANSWER[f.answer];
  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-[10px] bg-stock-2 p-2.5">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={clsx("inline-flex h-[20px] items-center rounded-full px-2 text-[11px] font-medium", a.cls)}>{a.label}</span>
        <span className="text-[11px] text-muted">web research · {f.confidence} confidence · verify</span>
      </span>
      <span className="text-[12.5px] leading-snug text-ink">{f.summary}</span>
      {f.sources.length > 0 && (
        <span className="flex flex-col gap-0.5">
          {f.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="group/l flex items-center gap-1 text-[12px]">
              <span className="truncate text-blue underline decoration-blue/30 group-hover/l:decoration-blue">{s.title || new URL(s.url).hostname}</span>
              <IconExternal size={11} className="shrink-0 text-muted" />
            </a>
          ))}
        </span>
      )}
    </div>
  );
}
