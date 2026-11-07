"use client";

/** Last-resort boundary for anything outside the sheet's own boundaries. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid h-full place-items-center bg-stock p-8">
      <div className="flex max-w-[40ch] flex-col items-start gap-3">
        <p className="display text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink">Groundwork hit a snag.</p>
        <p className="text-[14.5px] leading-relaxed text-muted">Reload to start again. Your saved and passed lots are kept in this browser.</p>
        <button onClick={reset} className="press h-10 rounded-full bg-blue px-4 text-[14px] font-medium text-stock hover:bg-blue-ink">
          Try again
        </button>
      </div>
    </main>
  );
}
