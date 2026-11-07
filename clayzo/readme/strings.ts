/** Copy whose drawn width something else is placed against (see measure.ts). */
export const ROW_TEXT = { font: "ui", size: 21, weight: 500 } as const;
export const SIEVE_LABELS = ["no place of worship mapped", "in a very high fire zone", "in a FEMA flood zone", "smaller than 10,000 sq ft"];
export const MEASURE: { text: string; font: "display" | "ui" | "mono"; size: number; weight: number }[] = [
  ...SIEVE_LABELS.map((text) => ({ text, ...ROW_TEXT })),
];
