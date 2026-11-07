"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { loadAddresses } from "@/lib/data";
import { LENSES, LENS_BY_ID, type LensId } from "@/lib/rules/lenses";
import { acres, displayApn, n, titleAddress } from "@/lib/format";
import { countMatches, parseLocal, parseWithClaude, type ParsedQuery } from "@/lib/query";
import { LensIcon } from "./LensIcon";
import { IconArrow, IconPin, IconSearch, IconSparkle, Tag } from "./ui";

type Result =
  | { kind: "ask"; q: string; parsed: ParsedQuery; count: number | null }
  | { kind: "lens"; id: LensId; count: number }
  | { kind: "parcel"; apn: string; label: string; sub: string };

const EXAMPLES = ["Church land near transit", "Empty lots for 10 starter homes", "Strip malls near a bus line", "Public land for sale", "1500 N Main"];

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
  const [claude, setClaude] = useState<"unknown" | "on" | "off">("unknown");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    loadAddresses(data)
      .then((a) => live && setAddr(a))
      .catch(() => live && setAddr({ apn: [], address: [] }));
    // One cheap probe so the footer can say honestly whether Claude reads the query.
    fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => live && setClaude(r.status === 503 ? "off" : "on"))
      .catch(() => live && setClaude("off"));
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, [data]);

  const lensCounts = useMemo(() => {
    const none = { transit: false, vacant: false, minHomes: null };
    return Object.fromEntries(LENSES.map((l) => [l.id, countMatches(data, l.id, none)])) as Record<LensId, number>;
  }, [data]);

  const groups = useMemo(() => {
    const t = q.trim();
    const out: { title: string | null; items: Result[] }[] = [];
    if (!t) {
      out.push({ title: "Find sites", items: LENSES.map((l) => ({ kind: "lens", id: l.id, count: lensCounts[l.id] })) });
      return out;
    }
    const T = t.toUpperCase();
    const digits = t.replace(/\D/g, "");
    const looksLikeApn = digits.length >= 5 && /^[\d\s-]+$/.test(t);
    const parcels: Result[] = [];
    if (addr) {
      for (let i = 0; i < addr.apn.length && parcels.length < 5; i++) {
        const a = addr.address[i];
        const id = addr.apn[i];
        const hit = looksLikeApn ? id.replace(/\D/g, "").startsWith(digits) : !!a && t.length >= 3 && a.includes(T);
        if (!hit) continue;
        const site = data.siteByApn.get(id);
        const facts = [`APN ${displayApn(id)}`, site?.zoning.local, acres(site?.lotSqft)].filter(Boolean).join("  ·  ");
        parcels.push({ kind: "parcel", apn: id, label: titleAddress(a) ?? `Parcel ${displayApn(id)}`, sub: facts });
      }
    }
    const parsed = parseLocal(t);
    const words = t.split(/\s+/).length;
    const describes = !looksLikeApn && (parsed.lens != null || parsed.understood.length > 0 || (words >= 2 && !/^\d/.test(t)));
    if (describes) {
      out.push({
        title: null,
        items: [{ kind: "ask", q: t, parsed, count: parsed.lens ? countMatches(data, parsed.lens, parsed.filters) : null }],
      });
    }
    if (parcels.length) out.push({ title: "Addresses", items: parcels });
    const lenses = LENSES.filter((l) => l.id !== parsed.lens && `${l.name} ${l.law} ${l.hook}`.toLowerCase().includes(t.toLowerCase()));
    if (lenses.length) out.push({ title: "Find sites", items: lenses.map((l) => ({ kind: "lens", id: l.id, count: lensCounts[l.id] })) });
    if (!out.length) out.push({ title: null, items: [{ kind: "ask", q: t, parsed, count: null }] });
    return out;
  }, [q, addr, data, lensCounts]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    list.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function apply(lens: LensId, p: ParsedQuery) {
    chooseLens(lens);
    setFilters(p.filters);
    onClose();
  }

  async function run(r: Result) {
    if (r.kind === "parcel") {
      probe(r.apn);
      onClose();
      return;
    }
    if (r.kind === "lens") {
      chooseLens(r.id);
      onClose();
      return;
    }
    setNote(null);
    if (claude !== "off") {
      setAsking(true);
      abort.current?.abort();
      abort.current = new AbortController();
      const read = await parseWithClaude(r.q, abort.current.signal);
      setAsking(false);
      if (read?.lens) return apply(read.lens, read);
    }
    if (r.parsed.lens) return apply(r.parsed.lens, r.parsed);
    setNote("That doesn't map to one of the five pathways we screen. Try a kind of land (church, strip mall, public land, backyard) or an address.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-[600px] flex-col overflow-hidden rounded-[16px] bg-stock shadow-[var(--shadow-float)] ring-1 ring-hairline"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-5">
          <IconSearch className="shrink-0 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
              setNote(null);
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, flat.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && flat[sel]) run(flat[sel]);
            }}
            placeholder="Describe a site, or type an address or APN"
            aria-label="Describe a site, or type an address or APN"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
          {asking ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-blue">
              <IconSparkle size={14} className="animate-pulse" /> Reading
            </span>
          ) : (
            <kbd className="shrink-0 rounded-[5px] bg-stock-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">esc</kbd>
          )}
        </div>

        <div ref={list} className="scroll-quiet max-h-[56vh] overflow-y-auto">
          {!q && (
            <div className="flex flex-wrap gap-1.5 px-5 pt-4 pb-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setQ(ex);
                    setSel(0);
                    input.current?.focus();
                  }}
                  className="press h-8 rounded-full bg-stock-2 px-3 text-[13px] text-ink hover:bg-stock-3"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          {groups.map((g, gi) => {
            const offset = groups.slice(0, gi).reduce((a, x) => a + x.items.length, 0);
            return (
              <div key={`${g.title}-${gi}`} className="px-2 pt-2 pb-1">
                {g.title && <p className="px-3 pt-2 pb-1.5 text-[12px] font-medium text-muted">{g.title}</p>}
                {g.items.map((r, i) => (
                  <Row key={i} r={r} idx={offset + i} active={offset + i === sel} onHover={() => setSel(offset + i)} onRun={() => run(r)} />
                ))}
              </div>
            );
          })}
          {note && <p className="mx-5 my-3 rounded-[10px] bg-coral-tint px-3 py-2.5 text-[13px] leading-snug text-ink">{note}</p>}
          <div className="h-2" />
        </div>

        <div className="flex items-center gap-4 border-t border-hairline px-5 py-2.5 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <IconSparkle size={12} className={claude === "on" ? "text-blue" : "text-muted"} />
            {claude === "on" ? "Descriptions read by Claude" : claude === "off" ? "Keyword matching (no Claude key set)" : "Plain-language search"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="grid h-[18px] min-w-[18px] place-items-center rounded-[4px] bg-stock-2 px-1 font-mono text-[10.5px] text-ink">{children}</kbd>;
}

function Row({ r, idx, active, onHover, onRun }: { r: Result; idx: number; active: boolean; onHover: () => void; onRun: () => void }) {
  return (
    <button
      data-idx={idx}
      onMouseMove={onHover}
      onClick={onRun}
      className={clsx("flex w-full items-center gap-3.5 rounded-[11px] px-3 py-2.5 text-left transition-colors duration-100", active && "bg-stock-2")}
    >
      {r.kind === "lens" && (
        <>
          <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-stock-2 ring-1 ring-hairline">
            <LensIcon id={r.id} size={34} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14.5px] font-medium text-ink">{LENS_BY_ID[r.id].name}</span>
            <span className="truncate font-mono text-[11px] text-blue">{LENS_BY_ID[r.id].law}</span>
          </span>
          <span className="tnum shrink-0 font-mono text-[11.5px] text-muted">{n(r.count)} lots</span>
        </>
      )}
      {r.kind === "parcel" && (
        <>
          <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-blue-tint text-blue">
            <IconPin size={19} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14.5px] font-medium text-ink">{r.label}</span>
            <span className="truncate font-mono text-[11px] text-muted">{r.sub}</span>
          </span>
          <span className="shrink-0 text-[12px] text-muted">Check this lot</span>
        </>
      )}
      {r.kind === "ask" && (
        <>
          <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-blue-tint text-blue">
            {r.parsed.lens ? <LensIcon id={r.parsed.lens} size={34} /> : <IconSparkle size={19} />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[14.5px] font-medium text-ink">
              {r.parsed.lens ? LENS_BY_ID[r.parsed.lens].name : <>Find sites matching &ldquo;{r.q}&rdquo;</>}
            </span>
            {r.parsed.lens || r.parsed.understood.length ? (
              <span className="flex flex-wrap items-center gap-1">
                {r.parsed.lens && <Tag tone="blue">{LENS_BY_ID[r.parsed.lens].law}</Tag>}
                {r.parsed.understood.map((u) => (
                  <Tag key={u}>{u}</Tag>
                ))}
              </span>
            ) : (
              <span className="text-[12px] text-muted">Press enter and we&rsquo;ll work out which law fits</span>
            )}
          </span>
          {r.count != null ? (
            <span className="tnum shrink-0 font-mono text-[11.5px] text-ink">{n(r.count)} lots</span>
          ) : (
            <IconArrow size={16} className="shrink-0 text-muted" />
          )}
        </>
      )}
    </button>
  );
}
