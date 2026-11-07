export type ZoneCategory =
  | "single_family"
  | "multi_family"
  | "mixed_use"
  | "commercial"
  | "industrial"
  | "public"
  | "open_space"
  | "other";

export interface CityIndexEntry {
  slug: string;
  name: string;
  bbox: [number, number, number, number];
  center: [number, number];
  parcelCount: number;
  built: boolean;
}

/** Every parcel in the city, columnar, for the sieve. */
export interface ParcelColumns {
  count: number;
  bbox: [number, number, number, number];
  zoneCodes: string[];
  columns: {
    apn: string[];
    lng: number[];
    lat: number[];
    lot: number[];
    zone: number[];
    flags: number[];
  };
}

export interface Site {
  apn: string;
  address: string | null;
  lng: number;
  lat: number;
  outline: [number, number][];
  lotSqft: number | null;
  zoning: { local: string | null; category: ZoneCategory | null; generalPlan: string | null };
  existingUse: string | null;
  existingUseCode?: string | null;
  yearBuilt: number | null;
  assessed: { land: number | null; improvement: number | null };
  coverage: number | null;
  hazards: {
    fire: string | null;
    flood: string | null;
    liquefaction: boolean | null;
    landslide: boolean | null;
  };
  transit: { hqta: boolean | null };
  ces: { percentile: number | null; tract: string | null };
  signals: {
    worship?: { name: string | null; religion: string | null; osmId: string | null; source?: "osm" | "scag-landuse" | "both" };
    surplus?: {
      agency: string | null;
      status: string | null;
      date: string | null;
      contact: string | null;
      acres: number | null;
      raw: Record<string, string>;
    };
    heSite?: {
      lower: number | null;
      moderate: number | null;
      aboveModerate: number | null;
      raw: Record<string, string>;
    };
  };
  flags: number;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  checked: string;
  status: "ok" | "failed" | "partial";
  note?: string;
  records?: number;
}

export type CheckStatus = "pass" | "fail" | "unknown";
