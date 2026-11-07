/** Copy whose drawn width something else is placed against (see measure.ts). */
export const ROW_TEXT = { font: "ui", size: 21, weight: 500 } as const;
export const SIEVE_LABELS = [
  "no place of worship mapped",
  "in a FEMA flood zone",
  "within 1,200 ft of heavy industry",
  "under 75% urban edge",
  "smaller than 10,000 sq ft",
];
/** The App card's Claude callout; its width sets the App column's width. */
export const CLAUDE_TEXT = { font: "ui", size: 19, weight: 500 } as const;
export const CLAUDE_LINES = ["reads plain-language search · drafts owner letters", "researches each lot’s open questions (saved)"];
export const MEASURE: { text: string; font: "display" | "ui" | "mono"; size: number; weight: number }[] = [
  ...SIEVE_LABELS.map((text) => ({ text, ...ROW_TEXT })),
  ...CLAUDE_LINES.map((text) => ({ text, ...CLAUDE_TEXT })),
  { text: "HCD surplus notices", font: "mono", size: 18, weight: 500 },
  { text: "parcels.json · 57,926", font: "mono", size: 18, weight: 500 },
  { text: "23-bit flags + enrichment", font: "ui", size: 19, weight: 500 },
  { text: "Site page · every check sourced", font: "ui", size: 19, weight: 500 },
  { text: "Also checked, none cut: fire zone, fault zone, wetland, easement", font: "ui", size: 20, weight: 500 },
  { text: "Not near a Title V facility or refinery", font: "ui", size: 20, weight: 500 },
];
