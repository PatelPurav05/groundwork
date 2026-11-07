"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { runSieve, type SieveResult } from "./rules/engine";
import { LENS_BY_ID, type LensId } from "./rules/lenses";
import type { CityData } from "./data";

export type { SieveResult };

const memo = new Map<string, SieveResult>();

/** Sieve results are pure functions of (city, lens); compute once and share. */
export function getSieve(data: CityData | null, lensId: LensId | null): SieveResult | null {
  if (!data || !lensId) return null;
  const key = `${data.city.slug}:${lensId}`;
  if (!memo.has(key)) memo.set(key, runSieve(data, LENS_BY_ID[lensId]));
  return memo.get(key)!;
}

export function useSieve(): SieveResult | null {
  const data = useStore((s) => s.data);
  const lensId = useStore((s) => s.lensId);
  return useMemo(() => getSieve(data, lensId), [data, lensId]);
}
