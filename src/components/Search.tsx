"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { loadAddresses } from "@/lib/data";
import { LENSES, LENS_BY_ID, type LensId } from "@/lib/rules/lenses";
import { displayApn, titleAddress } from "@/lib/format";
import { IconArrow, IconSearch, IconSparkle } from "./ui";

type Result =
  | { kind: "parcel"; apn: string; label: string; sub: string }
  | { kind: "lens"; id: LensId; label: string; sub: string }
  | { kind: "ask"; q: string; label: string; sub: string };

/** Local fallback when Claude isn't reachable: keyword → lens. */
function guessLens(q: string): { lens: LensId | null; nearTransit: boolean; openLand: boolean; minHomes: number | null } {
  const s = q.toLowerCase();
  const lens: LensId | null = /church|congregat|faith|temple|mosque|synagog|religio|college|seminar/.test(s)
    ? "faith"
    : /surplus|public land|city land|school district|agency|government/.test(s)
      ? "public"
      : /strip|mall|retail|commercial|parking lot|office/.test(s)
        ? "commercial"
        : /starter|small lot|subdivi|10 homes|ten homes/.test(s)
          ? "starter"
          : /backyard|lot split|duplex|single.family|adu/.test(s)
            ? "backyard"
            : null;
  const m = s.match(/(\d+)\s*\+?\s*(homes|units|houses)/);
  return { lens, nearTransit: /transit|bus|train|rail|metro/.test(s), openLand: /vacant|empty|open land/.test(s), minHomes: m ? Number(m[1]) : null };
}

/** Mounted only while open, so every open starts fresh. Opens instantly: it is used constantly. */
export function SearchPalette({ onClose }: { onClose: () => void }) {
  const data = useStore((s) => s.data)!;
  const probe = useStore((s) => s.probe);
  const chooseLens = useStore((s) => s.chooseLens);
  const setFilters = useStore((s) => s.setFilters);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [addr, setAddr] = useState<{ apn: string[]; address: (string | null)[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadAddresses(data.city)
      .then((a) => live && setAddr(a))
      .catch(() => live && setAddr({ apn: [], address: [] }));
    return () => {
      live = false;
    };
  }, [data.city]);

  const results = useMemo<Result[]>(() => {
    const t = q.trim();
    if (!t) {
      return LENSES.map((l) => ({ kind: "lens" as const, id: l.id, label: l.name, sub: l.law }));
    }
    const out: Result[] = [];
    const digits = t.replace(/\D/g, "");
    const T = t.toUpperCase();
    if (addr) {
      for (let i = 0; i < addr.apn.length && out.length < 6; i++) {
        const a = addr.address[i];
        const apnD = addr.apn[i]?.replace(/\D/g, "") ?? "";
        const hit = (digits.length >= 5 && digits.length === t.replace(/[\s-]/g, "").length && apnD.startsWith(digits)) || (a && t.length >= 3 && a.includes(T));
        if (hit) out.push({ kind: "parcel", apn: addr.apn[i], label: titleAddress(a) ?? `APN ${displayApn(addr.apn[i])}`, sub: `APN ${displayApn(addr.apn[i])}` });
      }
    }
    for (const l of LENSES) if ((l.name + l.law + l.hook).toLowerCase().includes(t.toLowerCase())) out.push({ kind: "lens", id: l.id, label: l.name, sub: l.law });
    if (t.split(/\s+/).length >= 2 || !out.length) out.push({ kind: "ask", q: t, label: `“${t}”`, sub: "Find sites matching this" });
    return out;
  }, [q, addr]);


  async function run(r: Result) {
    if (r.kind === "parcel") {
      probe(r.apn);
      onClose();
    } else if (r.kind === "lens") {
      chooseLens(r.id);
      onClose();
    } else {
      setAsking(true);
      let parsed = null as null | { lens: LensId | null; nearTransit: boolean; openLand: boolean; minHomes: number | null; explanation?: string };
      try {
        const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: r.q }) });
        if (res.ok) {
          const j = await res.json();
          parsed = { lens: j.lens === "none" ? null : j.lens, nearTransit: j.nearTransit, openLand: j.openLand, minHomes: j.minHomes, explanation: j.explanation };
        }
      } catch {}
      if (!parsed) parsed = guessLens(r.q);
      setAsking(false);
      if (!parsed.lens) {
        setNote("That doesn't match one of the five pathways we screen. Try “church land”, “strip malls near transit”, or an address.");
        return;
      }
      chooseLens(parsed.lens);
      setFilters({ transit: parsed.nearTransit, vacant: parsed.openLand, minHomes: parsed.minHomes });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-[14vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-5">
          <IconSearch className="text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter" && results[sel]) run(results[sel]);
            }}
            placeholder="An address, an APN, or what you're looking for"
            className="h-14 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted focus-visible:outline-none"
          />
          {asking && <span className="text-[12px] text-muted">Reading…</span>}
        </div>
        <ul className="scroll-quiet max-h-[50vh] overflow-y-auto p-2">
          {!q && <li className="px-3 pt-1 pb-2 text-[11.5px] text-muted">Try “church land near a bus line” or “1500 N Main”</li>}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.label}-${i}`}>
              <button
                onMouseMove={() => setSel(i)}
                onClick={() => run(r)}
                className={clsx("flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left", i === sel && "bg-surface-2")}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-paper text-ink-2">
                  {r.kind === "ask" ? <IconSparkle size={16} /> : r.kind === "lens" ? <span className="text-[10px] font-semibold">{LENS_BY_ID[r.id].law.split(" ")[0]}</span> : <IconSearch size={15} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-medium text-ink">{r.label}</span>
                  <span className="truncate text-[12px] text-muted">{r.sub}</span>
                </span>
                {i === sel && <IconArrow size={15} className="text-muted" />}
              </button>
            </li>
          ))}
        </ul>
        {note && <p className="border-t border-hairline px-5 py-3 text-[12.5px] text-ink-2">{note}</p>}
      </div>
    </div>
  );
}
