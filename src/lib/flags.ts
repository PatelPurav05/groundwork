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
} as const;

export type FlagName = keyof typeof F;

export const has = (flags: number, bit: number) => (flags & bit) !== 0;
