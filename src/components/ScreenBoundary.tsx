"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
  /** Where "go back" should take the user. */
  onRecover?: () => void;
  /** Replace the default message (e.g. for the map). */
  fallback?: ReactNode;
}

/**
 * Keeps one bad record from taking down the app: a screen that throws while rendering is
 * replaced by a short message and a way back. Keyed by screen, so it resets on navigation.
 */
export class ScreenBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[Groundwork] screen failed to render:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-6 pt-10">
        <p className="display text-[24px] leading-tight font-bold tracking-[-0.02em] text-ink">This view couldn&rsquo;t be shown.</p>
        <p className="max-w-[36ch] text-[14px] leading-relaxed text-muted">
          Something in the data for it is missing or malformed. The rest of the city still works.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            this.setState({ error: null });
            this.props.onRecover?.();
          }}
        >
          Go back
        </Button>
      </div>
    );
  }
}
