"use client";

import { motion, useReducedMotion } from "motion/react";
import type { LensId } from "@/lib/rules/lenses";

/**
 * Lens pictograms. One system: front elevations on a shared ground line, 64 grid.
 * Blue = what stands today. Coral = the homes the law makes possible; they rise out of the
 * ground when the row is hovered (clipped at the ground line, so they emerge rather than slide).
 */

const BLUE = "var(--blue)";
const CORAL = "var(--coral)";
const INK = "var(--ink)";
const GROUND = 52;

function Rise({ playing, delay = 0, children }: { playing: boolean; delay?: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.g
      initial={false}
      animate={playing && !reduce ? { y: [0, 18, 0] } : { y: 0 }}
      transition={playing && !reduce ? { duration: 0.9, times: [0, 0.32, 1], delay, ease: [[0.4, 0, 1, 1], [0.23, 1, 0.32, 1]] } : { duration: 0 }}
    >
      {children}
    </motion.g>
  );
}

/** A small gable home, x = left edge, w = width, h = wall height, all sitting on the ground. */
function Home({ x, w, h, fill = CORAL, door = true }: { x: number; w: number; h: number; fill?: string; door?: boolean }) {
  const roof = w * 0.42;
  const top = GROUND - h;
  const dw = Math.max(3, w * 0.24);
  const dh = Math.min(h * 0.55, 8);
  const dx = x + w / 2 - dw / 2;
  return (
    <path
      fill={fill}
      fillRule="evenodd"
      d={`M${x} ${top} L${x + w / 2} ${top - roof} L${x + w} ${top} V${GROUND} H${x} Z${
        door ? ` M${dx} ${GROUND} V${GROUND - dh + 1} q0 -1 1 -1 H${dx + dw - 1} q1 0 1 1 V${GROUND} Z` : ""
      }`}
      strokeLinejoin="round"
    />
  );
}

function Ground() {
  return <rect x="4" y={GROUND} width="56" height="2.5" rx="1.25" fill={INK} />;
}

const ART: Record<LensId, (p: { playing: boolean }) => React.ReactNode> = {
  // SB 4: a chapel with its spire; a new home rises on the lot beside it.
  faith: ({ playing }) => (
    <>
      <path fill={BLUE} d="M9 52V31l9-8 9 8v21Z" />
      <path fill={BLUE} d="M16.5 23.5V12.6c0-.5.3-.9.7-1.1L18 11l.8.5c.4.2.7.6.7 1.1v10.9Z" />
      <path fill="var(--stock)" d="M15.5 52v-7.5a2.5 2.5 0 0 1 5 0V52Z" />
      <Rise playing={playing}>
        <Home x={33} w={20} h={13} />
      </Rise>
    </>
  ),
  // Surplus Land Act: a civic building releases a parcel; a home rises on it.
  public: ({ playing }) => (
    <>
      <path fill={BLUE} d="M7 30.5 20 23l13 7.5Z" />
      <rect x="8" y="31.5" width="24" height="3" rx="0.6" fill={BLUE} />
      {[10.5, 17.75, 25].map((cx) => (
        <rect key={cx} x={cx} y="36" width="4.5" height="13" rx="0.6" fill={BLUE} />
      ))}
      <rect x="7" y="49" width="26" height="3" fill={BLUE} />
      <Rise playing={playing}>
        <Home x={38} w={18} h={12} />
      </Rise>
    </>
  ),
  // AB 2011: a low strip mall; homes stack up behind it.
  commercial: ({ playing }) => (
    <>
      <Rise playing={playing}>
        <rect x="20" y="16" width="24" height="36" rx="1.5" fill={CORAL} />
        {[0, 1, 2, 3].map((r) =>
          [0, 1].map((c) => <rect key={`${r}${c}`} x={25 + c * 9} y={21 + r * 7} width="5" height="3.5" rx="0.8" fill="var(--stock)" />),
        )}
      </Rise>
      <rect x="6" y="38" width="52" height="14" rx="1.5" fill={BLUE} />
      <rect x="6" y="38" width="52" height="3.5" rx="1" fill="var(--blue-ink)" />
      {[10, 22, 34, 46].map((x) => (
        <rect key={x} x={x} y="44.5" width="8" height="7.5" rx="0.8" fill="var(--stock)" opacity="0.9" />
      ))}
    </>
  ),
  // SB 684 / SB 1123: one lot becomes a row of small homes.
  starter: ({ playing }) => (
    <>
      {[
        { x: 6, w: 11, h: 11 },
        { x: 19, w: 11, h: 14 },
        { x: 32, w: 11, h: 11 },
        { x: 45, w: 11, h: 14 },
      ].map((p, i) => (
        <Rise key={p.x} playing={playing} delay={i * 0.06}>
          <Home x={p.x} w={p.w} h={p.h} door={false} />
          <rect x={p.x + p.w / 2 - 1.5} y={GROUND - 5} width="3" height="5" rx="0.7" fill="var(--stock)" />
        </Rise>
      ))}
    </>
  ),
  // SB 9: a house on a deep lot; a line splits it and a second home rises out back.
  backyard: ({ playing }) => (
    <>
      <Home x={7} w={22} h={16} fill={BLUE} />
      <path d="M35 12v40" stroke={INK} strokeWidth="1.6" strokeDasharray="2.4 2.6" strokeLinecap="round" opacity="0.55" />
      <Rise playing={playing}>
        <Home x={40} w={17} h={12} />
      </Rise>
    </>
  ),
};

export function LensIcon({ id, playing = false, size = 56, className }: { id: LensId; playing?: boolean; size?: number; className?: string }) {
  const Art = ART[id];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <clipPath id={`gw-above-${id}`}>
          <rect x="0" y="0" width="64" height={GROUND} />
        </clipPath>
      </defs>
      <g clipPath={`url(#gw-above-${id})`}>
        <Art playing={playing} />
      </g>
      {id === "starter" && <path d="M4 58.5h56" stroke={BLUE} strokeWidth="1.6" strokeDasharray="2.2 2.4" strokeLinecap="round" />}
      <Ground />
    </svg>
  );
}
