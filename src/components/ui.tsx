"use client";

import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { scoreTone } from "@/lib/score";
import type { CheckStatus } from "@/lib/types";

/* ---------- Score ring (the Beli move: one number, one colour) ---------- */

const TONE = {
  high: "var(--score-high)",
  mid: "var(--score-mid)",
  low: "var(--score-low)",
} as const;

export function ScoreRing({ score, size = 44, className }: { score: number; size?: number; className?: string }) {
  const tone = scoreTone(score);
  const stroke = Math.max(2.5, size / 15);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }} aria-label={`Score ${score.toFixed(1)} out of 10`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 10)}
        />
      </svg>
      <span
        className="tnum absolute inset-0 grid place-items-center font-semibold"
        style={{ color: TONE[tone], fontSize: size * 0.32, letterSpacing: "-0.02em" }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

/* ---------- Check status marks ---------- */

export function StatusMark({ status, size = 20 }: { status: CheckStatus; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 20 20", "aria-hidden": true } as const;
  if (status === "pass")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="10" fill="var(--pass-soft)" />
        <path d="M6 10.4l2.6 2.6L14 7.6" fill="none" stroke="var(--pass)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "fail")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="10" fill="var(--fail-soft)" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="var(--fail)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="9.25" fill="var(--unknown-soft)" stroke="var(--unknown)" strokeWidth="1" strokeDasharray="2.2 2" />
      <text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--unknown)">?</text>
    </svg>
  );
}

/* ---------- Tags ---------- */

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "clay" | "pass" | "fail" | "unknown" | "ink";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-medium leading-none whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "clay" && "bg-clay-soft text-clay-ink",
        tone === "pass" && "bg-pass-soft text-pass",
        tone === "fail" && "bg-fail-soft text-fail",
        tone === "unknown" && "bg-unknown-soft text-unknown",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AssumedTag() {
  return (
    <Tag tone="unknown" className="uppercase tracking-[0.06em] text-[9.5px]">
      assumed
    </Tag>
  );
}

/* ---------- Buttons ---------- */

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={clsx(
        "press inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" && "bg-ink text-paper hover:bg-[#2c2a26]",
        variant === "secondary" && "bg-surface text-ink shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={clsx("press grid size-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink", className)}
    >
      {children}
    </button>
  );
}

/* ---------- Icons (1.6 stroke, 20 grid) ---------- */

type IconProps = { size?: number; className?: string };
const icon = (path: ReactNode) =>
  function Icon({ size = 18, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {path}
      </svg>
    );
  };

export const IconBack = icon(<path d="M12 4.5L6.5 10l5.5 5.5" />);
export const IconArrow = icon(<path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />);
export const IconSearch = icon(
  <>
    <circle cx="9" cy="9" r="5.25" />
    <path d="M13 13l3.5 3.5" />
  </>,
);
export const IconBookmark = icon(<path d="M6 3.5h8v13l-4-3-4 3z" />);
export const IconBookmarkFilled = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
    <path d="M6 3.5h8v13l-4-3-4 3z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
export const IconX = icon(<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />);
export const IconChevron = icon(<path d="M8 5.5l4.5 4.5L8 14.5" />);
export const IconExternal = icon(<path d="M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5L9 11" />);
export const IconSparkle = icon(<path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.5 5.5l2 2M12.5 12.5l2 2M14.5 5.5l-2 2M7.5 12.5l-2 2" />);
export const IconCopy = icon(
  <>
    <rect x="7" y="7" width="9" height="9" rx="2" />
    <path d="M4 12.5V5.5A1.5 1.5 0 015.5 4h7" />
  </>,
);
export const IconTransit = icon(
  <>
    <rect x="5" y="3.5" width="10" height="11" rx="2.5" />
    <path d="M5 10h10M7.5 17l1-2.5M12.5 17l-1-2.5" />
  </>,
);
export const IconPrint = icon(<path d="M6 7.5V3.5h8v4M6 13.5H4.5v-6h11v6H14M6 11.5h8v5H6z" />);
