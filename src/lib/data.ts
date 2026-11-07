import type { CityIndexEntry, ParcelColumns, Site, Source } from "./types";

export interface CityData {
  city: CityIndexEntry;
  parcels: ParcelColumns;
  sites: Site[];
  siteByApn: Map<string, Site>;
  sources: Source[];
  sourceById: Map<string, Source>;
}

const cache = new Map<string, Promise<unknown>>();
function getJSON<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

export async function loadCities(): Promise<CityIndexEntry[]> {
  return getJSON<CityIndexEntry[]>("/data/cities.json");
}

/** Stand-in id for a lot the assessor published without an APN, stable across files by position. */
export const NO_APN = "noapn:";
const stableId = (lng: number, lat: number) => `${NO_APN}${lng.toFixed(5)},${lat.toFixed(5)}`;
export const isRealApn = (id: string | null | undefined): id is string => !!id && !id.startsWith(NO_APN);

/**
 * Every parcel and site gets a non-null id, so nothing downstream ever keys on null.
 * Idempotent: the fetched JSON is cached and normalized in place once.
 */
function normalize(parcels: ParcelColumns, sites: Site[]) {
  const c = parcels.columns;
  for (let i = 0; i < parcels.count; i++) if (!c.apn[i]) c.apn[i] = stableId(c.lng[i], c.lat[i]);
  for (const s of sites) {
    if (!s.apn) s.apn = stableId(s.lng, s.lat);
    s.signals ??= {};
    s.outline ??= [];
  }
}

export async function loadCity(city: CityIndexEntry): Promise<CityData> {
  const base = `/data/${city.slug}`;
  const [parcels, sites, sources] = await Promise.all([
    getJSON<ParcelColumns>(`${base}/parcels.json`),
    getJSON<Site[]>(`${base}/sites.json`),
    getJSON<Source[]>(`${base}/sources.json`),
  ]);
  return buildCityData(city, parcels, sites, sources);
}

/** Pure assembly from already-fetched files (also used by `npm run check`). */
export function buildCityData(city: CityIndexEntry, parcels: ParcelColumns, sites: Site[], sources: Source[]): CityData {
  normalize(parcels, sites);
  return {
    city,
    parcels,
    sites,
    siteByApn: new Map(sites.map((s) => [s.apn, s])),
    sources,
    sourceById: new Map(sources.map((s) => [s.id, s])),
  };
}

/** Addresses aligned to parcels.json order. Ids come from the (normalized) parcel columns. */
export async function loadAddresses(data: CityData) {
  const a = await getJSON<{ apn: (string | null)[]; address: (string | null)[] }>(`/data/${data.city.slug}/addresses.json`);
  return { apn: data.parcels.columns.apn, address: a.address };
}
