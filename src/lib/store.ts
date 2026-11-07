"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CityData } from "./data";
import type { LensId } from "./rules/lenses";

export type Mode = "home" | "sieve" | "list" | "site";
export type PassReason = "too_small" | "hazard" | "wont_sell" | "already_built" | "other";
export type ListTab = "review" | "saved" | "passed";
export interface ResearchFinding {
  id: string;
  answer: "yes" | "no" | "unclear";
  summary: string;
  sources: { title: string; url: string }[];
  confidence: "low" | "medium" | "high";
}
export interface ResearchRecord {
  at: number;
  law: string;
  findings: ResearchFinding[];
}
export interface Filters {
  transit: boolean;
  vacant: boolean;
  minHomes: number | null;
}
const NO_FILTERS: Filters = { transit: false, vacant: false, minHomes: null };

interface State {
  data: CityData | null;
  mode: Mode;
  lensId: LensId | null;
  /** Float progress through the sieve steps; the map animates from this. */
  sieveProgress: number;
  sieveDone: boolean;
  selectedApn: string | null;
  hoveredApn: string | null;
  listTab: ListTab;
  /** "Check an address" opens a single-parcel report even if it is not a candidate. */
  probeApn: string | null;
  saved: Record<string, { at: number }>;
  /** Claude web research per lot, kept in this browser. Evidence to verify, never a pass. */
  research: Record<string, ResearchRecord>;
  setResearch: (apn: string, r: ResearchRecord) => void;
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  setFilters: (f: Partial<Filters>) => void;
  passed: Record<string, { at: number; reason: PassReason }>;

  setData: (d: CityData) => void;
  chooseLens: (id: LensId) => void;
  setSieveProgress: (p: number) => void;
  finishSieve: () => void;
  goHome: () => void;
  openSite: (apn: string) => void;
  probe: (apn: string) => void;
  closeSite: () => void;
  hover: (apn: string | null) => void;
  setListTab: (t: ListTab) => void;
  toggleSave: (apn: string) => void;
  pass: (apn: string, reason: PassReason) => void;
  unpass: (apn: string) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      data: null,
      mode: "home",
      lensId: null,
      sieveProgress: 0,
      sieveDone: false,
      selectedApn: null,
      hoveredApn: null,
      listTab: "review",
      probeApn: null,
      saved: {},
      passed: {},
      research: {},
      setResearch: (apn, r) => set((s) => ({ research: { ...s.research, [apn]: r } })),
      filters: NO_FILTERS,
      setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
      setFilters: (f) => set({ filters: { ...NO_FILTERS, ...f } }),

      setData: (data) => set({ data }),
      chooseLens: (lensId) =>
        set({ lensId, mode: "sieve", filters: NO_FILTERS, sieveProgress: 0, sieveDone: false, selectedApn: null, probeApn: null, listTab: "review" }),
      setSieveProgress: (sieveProgress) => set({ sieveProgress }),
      finishSieve: () => set({ sieveDone: true, mode: "list" }),
      goHome: () =>
        set({ mode: "home", lensId: null, sieveProgress: 0, sieveDone: false, selectedApn: null, probeApn: null }),
      openSite: (apn) => set({ selectedApn: apn, mode: "site", probeApn: null }),
      probe: (apn) => set({ selectedApn: apn, probeApn: apn, mode: "site" }),
      closeSite: () => {
        const { lensId, sieveDone } = get();
        set({ selectedApn: null, probeApn: null, mode: lensId && sieveDone ? "list" : "home" });
      },
      hover: (hoveredApn) => set({ hoveredApn }),
      setListTab: (listTab) => set({ listTab }),
      toggleSave: (apn) =>
        set((s) => {
          const saved = { ...s.saved };
          const passed = { ...s.passed };
          if (saved[apn]) delete saved[apn];
          else {
            saved[apn] = { at: Date.now() };
            delete passed[apn];
          }
          return { saved, passed };
        }),
      pass: (apn, reason) =>
        set((s) => {
          const saved = { ...s.saved };
          delete saved[apn];
          return { saved, passed: { ...s.passed, [apn]: { at: Date.now(), reason } } };
        }),
      unpass: (apn) =>
        set((s) => {
          const passed = { ...s.passed };
          delete passed[apn];
          return { passed };
        }),
    }),
    {
      name: "groundwork",
      partialize: (s) => ({ saved: s.saved, passed: s.passed, research: s.research }),
    },
  ),
);
