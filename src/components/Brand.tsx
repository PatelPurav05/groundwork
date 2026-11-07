import { LogoMark } from "./LogoMark";

/** Lockup: the mark plus the wordmark in ink, Bricolage 800 at tight tracking. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2" aria-label="Groundwork">
      <LogoMark size={26} />
      <span className="display text-[20px] leading-none tracking-[-0.035em] text-ink" aria-hidden>
        Groundwork
      </span>
    </span>
  );
}
