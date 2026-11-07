"use client";

import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { CheckStatus } from "@/lib/types";

/* ---------- Score stamp: a printed blue disc, coral pass a hair out of register ---------- */

export function ScoreStamp({ score, size = 44, top = false, className }: { score: number; size?: number; top?: boolean; className?: string }) {
  const off = Math.max(1.5, size / 28);
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      aria-label={`Score ${score.toFixed(1)} out of 10`}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: top ? "var(--blue)" : "var(--coral)", transform: `translate(${off}px, ${off * 0.7}px)` }}
      />
      <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: top ? "var(--coral)" : "var(--blue)" }} />
      <span
        className="display tnum relative leading-none"
        style={{ fontSize: size * 0.36, color: top ? "var(--ink)" : "var(--stock)", fontWeight: 800 }}
      >
        {score.toFixed(1)}
      </span>
    </span>
  );
}

/* ---------- Check marks: blue = pass, coral = fail, no ink = unknown ---------- */

export function StatusMark({ status, size = 20 }: { status: CheckStatus; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 20 20", "aria-hidden": true, className: "shrink-0" } as const;
  if (status === "pass")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="10" fill="var(--blue)" />
        <path d="M6 10.3l2.6 2.6L14 7.5" fill="none" stroke="var(--stock)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "fail")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="10" fill="var(--coral)" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="9" fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="0.1 3" strokeLinecap="round" />
      <path d="M8.2 8a1.9 1.9 0 113 1.5c-.7.5-1.2.9-1.2 1.8M10 13.7v.1" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Tags ---------- */

export function Tag({
  children,
  tone = "plain",
  className,
}: {
  children: ReactNode;
  tone?: "plain" | "blue" | "coral" | "dotted" | "ink";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[11.5px] font-medium leading-none whitespace-nowrap",
        tone === "plain" && "bg-stock-2 text-muted",
        tone === "blue" && "bg-blue-tint text-blue-ink",
        tone === "coral" && "bg-coral-tint text-coral-ink",
        tone === "ink" && "bg-ink text-stock",
        tone === "dotted" && "border border-dashed border-muted/60 text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const AssumedTag = () => <Tag tone="dotted">assumed</Tag>;

/* ---------- Buttons ---------- */

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={clsx(
        "press inline-flex items-center justify-center gap-2 rounded-full font-medium disabled:pointer-events-none disabled:opacity-45",
        size === "md" ? "h-10 px-4 text-[14px]" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-blue text-stock hover:bg-blue-ink",
        variant === "secondary" && "bg-stock-2 text-ink hover:bg-stock-3",
        variant === "ghost" && "text-muted hover:bg-stock-2 hover:text-ink",
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
      className={clsx("press grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-stock-2 hover:text-ink", className)}
    >
      {children}
    </button>
  );
}

/* ---------- Section heading inside the sheet (sentence case, no eyebrow) ---------- */

export function SheetHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-1">
      <h3 className="display text-[17px] font-bold tracking-[-0.02em] text-ink">{children}</h3>
      {aside}
    </div>
  );
}

/* ---------- Icons (1.6 stroke, 20 grid) ---------- */

type IconProps = { size?: number; className?: string };
const icon = (path: ReactNode) =>
  function Icon({ size = 18, className }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
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
export const IconSparkle = icon(<path d="M10 3.5l1.6 4.9 4.9 1.6-4.9 1.6L10 16.5l-1.6-4.9L3.5 10l4.9-1.6z" />);
export const IconCopy = icon(
  <>
    <rect x="7" y="7" width="9" height="9" rx="2" />
    <path d="M4 12.5V5.5A1.5 1.5 0 015.5 4h7" />
  </>,
);
export const IconPrint = icon(<path d="M6 7.5V3.5h8v4M6 13.5H4.5v-6h11v6H14M6 11.5h8v5H6z" />);
