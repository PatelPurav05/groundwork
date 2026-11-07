/** Bitmask shared by parcels.json and sites.json. Keep in sync with ARCHITECTURE.md. */
export const F = {
  fire: 1 << 0,
  flood: 1 << 1,
  liquefaction: 1 << 2,
  landslide: 1 << 3,
  hqta: 1 << 4,
  worship: 1 << 5,
  surplus: 1 << 6,
  heSite: 1 << 7,
  vacant: 1 << 8,
  lowCover: 1 << 9,
  underused: 1 << 10,
  cesHigh: 1 << 11,
  corridor: 1 << 12,
  // Enrichment (pipeline bits 13–22); see ARCHITECTURE.md FLAGS.
  heavyIndustry1200: 1 << 13,
  adjIndustrial: 1 << 14,
  faultZone: 1 << 15,
  historic: 1 << 16,
  hazwaste: 1 << 17,
  wetland: 1 << 18,
  farmland: 1 << 19,
  conservation: 1 << 20,
  freeway500: 1 << 21,
  urbanPerimeterOk: 1 << 22,
} as const;

/** Names in parcels.json `known` (which layers loaded) for each enrichment bit. */
export const KNOWN = {
  heavyIndustry1200: "heavy_industry_1200",
  adjIndustrial: "adj_industrial",
  faultZone: "fault_zone",
  historic: "historic",
  hazwaste: "hazwaste",
  wetland: "wetland",
  farmland: "farmland",
  conservation: "conservation",
  freeway500: "freeway_500",
} as const;

export type FlagName = keyof typeof F;

export const has = (flags: number, bit: number) => (flags & bit) !== 0;
