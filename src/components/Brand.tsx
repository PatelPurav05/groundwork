"use client";

/** Static riso house-of-dots mark: used until/unless the animated Clayzo LogoMark is available. */
export function StaticMark({ size = 26 }: { size?: number }) {
  // 6x6 dot screen; the house silhouette is the set of lit cells, dot radius shades the roof.
  const cells: [number, number, number][] = [];
  const house = [
    "..##..",
    ".####.",
    "######",
    "##..##",
    "##..##",
    "######",
  ];
  house.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "#") cells.push([x, y, y < 2 ? 0.34 : 0.42]);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 6 6" aria-hidden className="shrink-0 overflow-visible">
      <g style={{ mixBlendMode: "multiply" }} fill="var(--coral)" transform="translate(0.16 0.12)">
        <rect x="2" y="3" width="2" height="2.6" rx="0.3" />
      </g>
      <g fill="var(--blue)" style={{ mixBlendMode: "multiply" }}>
        {cells.map(([x, y, r]) => (
          <circle key={`${x}${y}`} cx={x + 0.5} cy={y + 0.5} r={r} />
        ))}
      </g>
    </svg>
  );
}

// Swapped for the animated Clayzo <LogoMark> once it lands.
const LogoMark = ({ size }: { size: number; animate?: boolean }) => <StaticMark size={size} />;

export function Wordmark({ animate = false }: { animate?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" aria-label="Groundwork">
      <LogoMark size={26} animate={animate} />
      <span className="display text-[20px] leading-none tracking-[-0.035em] text-blue" aria-hidden>
        Groundwork
      </span>
    </span>
  );
}
