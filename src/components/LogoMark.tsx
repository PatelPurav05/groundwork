/**
 * Groundwork mark: a house standing on its foundation, with the foundation rising through the
 * doorway. Blue house, coral groundwork: the opening into the home *is* the ground it stands on.
 * Drawn on a 32 grid.
 */
export function LogoMark({ size = 28, className, mono = false }: { size?: number; className?: string; mono?: boolean }) {
  const house = mono ? "currentColor" : "var(--blue)";
  const ground = mono ? "currentColor" : "var(--coral)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      {/* Walls + gable with a softened apex; the doorway is knocked out (evenodd). */}
      <path
        fill={house}
        fillRule="evenodd"
        d="M15.05 4.62a1.5 1.5 0 0 1 1.9 0l9.1 7.47c.6.5.95 1.23.95 2.01V23H5V14.1c0-.78.35-1.51.95-2.01l9.1-7.47ZM13.5 23v-5.25a1.25 1.25 0 0 1 1.25-1.25h2.5a1.25 1.25 0 0 1 1.25 1.25V23h-5Z"
      />
      {/* Foundation slab, wider than the walls, rising through the doorway as one shape. */}
      <path
        fill={ground}
        d="M14.75 17.75h2.5c.14 0 .25.11.25.25v6.25H28.75c.69 0 1.25.56 1.25 1.25v1.75c0 .69-.56 1.25-1.25 1.25H3.25C2.56 28.5 2 27.94 2 27.25V25.5c0-.69.56-1.25 1.25-1.25H14.5V18c0-.14.11-.25.25-.25Z"
      />
    </svg>
  );
}
