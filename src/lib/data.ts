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

export async function loadCity(city: CityIndexEntry): Promise<CityData> {
  const base = `/data/${city.slug}`;
  const [parcels, sites, sources] = await Promise.all([
    getJSON<ParcelColumns>(`${base}/parcels.json`),
    getJSON<Site[]>(`${base}/sites.json`),
    getJSON<Source[]>(`${base}/sources.json`),
  ]);
  return {
    city,
    parcels,
    sites,
    siteByApn: new Map(sites.map((s) => [s.apn, s])),
    sources,
    sourceById: new Map(sources.map((s) => [s.id, s])),
  };
}

export async function loadAddresses(city: CityIndexEntry) {
  return getJSON<{ apn: string[]; address: (string | null)[] }>(`/data/${city.slug}/addresses.json`);
}
