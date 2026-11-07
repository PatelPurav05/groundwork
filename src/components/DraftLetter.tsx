"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Evaluation } from "@/lib/rules/engine";
import type { Lens, Row } from "@/lib/rules/lenses";
import { acres, displayApn } from "@/lib/format";
import { Button, IconCopy, IconSparkle } from "./ui";

function factSheet(lens: Lens, ev: Evaluation, row: Row, title: string, city: string, units: number) {
  const s = row.site;
  const lines = [
    `Parcel: ${title}, ${city}, CA (APN ${displayApn(row.apn)})`,
    row.lot ? `Lot size: ${acres(row.lot)}` : null,
    s?.zoning.local ? `Zoning: ${s.zoning.local}` : null,
    `Pathway being explored: ${lens.law}. ${lens.plain}`,
    units ? `Rough screening estimate (assumption, not a promise): about ${units} homes` : null,
    s?.signals.worship ? `Ownership is only a lead: a place of worship${s.signals.worship.name ? ` (${s.signals.worship.name})` : ""} is mapped here; we do not know who owns the land.` : null,
    s?.signals.surplus?.agency ? `Recipient: ${s.signals.surplus.agency}, which filed a Surplus Land Act notice for this parcel.` : null,
    ev.unknown.length ? `Still unconfirmed: ${ev.unknown.map((u) => u.step.label.toLowerCase()).join("; ")}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function template(lens: Lens, title: string, row: Row) {
  const to = row.site?.signals.surplus?.agency ?? "Property owner";
  const own = row.site?.signals.worship
    ? `We understand there is a congregation at this location, and we wanted to ask whether the institution owns the land and would be open to a conversation.`
    : `We wanted to ask whether you would be open to a conversation about the property's future.`;
  return `Dear ${to},

My name is [Your name], and I work with [Organization], a nonprofit that builds affordable homes in Orange County. We are exploring sites at ${title} that may qualify for affordable housing under ${lens.law}, a California law that streamlines approvals for this kind of project.

${own} We are at an early stage and are not making an offer; we would simply like to learn whether housing here is something you would consider.

Would you have 20 minutes for a call in the next few weeks? You can reach me at [phone] or [email].

With thanks,
[Your name]
[Title], [Organization]`;
}

export function DraftLetter(props: { lens: Lens; ev: Evaluation; row: Row; title: string; cityName: string; units: number }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "drafting" | "done" | "template">("idle");
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function draft() {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setText("");
    setState("drafting");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: factSheet(props.lens, props.ev, props.row, props.title, props.cityName, props.units) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
      setState("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setText(template(props.lens, props.title, props.row));
      setState("template");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "idle" ? (
        <Button variant="secondary" onClick={draft} className="self-start">
          <IconSparkle size={16} />
          Draft a first letter
        </Button>
      ) : null}
      <AnimatePresence>
        {state !== "idle" && (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col gap-2 rounded-[18px] bg-stock-2 p-4 ring-1 ring-hairline"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted">
                {state === "drafting" ? "Drafting with Claude…" : state === "template" ? "Template (Claude unavailable)" : "Draft by Claude: edit before you use it"}
              </span>
              <div className="flex gap-1">
                {state !== "drafting" && (
                  <Button variant="ghost" className="h-7 px-2.5 text-[12px]" onClick={draft}>
                    Redo
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="h-7 px-2.5 text-[12px]"
                  disabled={!text}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    } catch {
                      // Clipboard blocked (permissions / insecure context): leave the text selectable instead.
                      setCopied(false);
                    }
                  }}
                >
                  <IconCopy size={14} />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="scroll-quiet w-full resize-y bg-transparent text-[14.5px] leading-relaxed text-ink outline-none"
              aria-label="Letter draft"
            />
            <p className="text-[11px] text-muted">Groundwork never sends anything. Brackets are yours to fill in.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
