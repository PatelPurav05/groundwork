// OSM places of worship via Overpass (nodes, ways, relations with geometry), cached.
// Tries several Overpass instances with backoff. Run: node scripts/data/fetch-osm.mjs [city]
import { cached, step, isMain } from './lib.mjs';
import { getCity } from './cities.mjs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export async function fetchOsm(city) {
  const [w, s, e, n] = city.bbox;
  const q = `[out:json][timeout:90];nwr["amenity"="place_of_worship"](${s},${w},${n},${e});out geom tags;`;
  const src = `${city.slug}/osm_worship`;
  return step(src, { name: 'OpenStreetMap places of worship (amenity=place_of_worship)', url: ENDPOINTS[0], note: `Overpass bbox query: ${q}` }, async () => {
    let lastErr;
    for (const ep of ENDPOINTS) {
      try {
        const data = await cached(src, 'overpass.json', ep, {
          init: { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
          tries: 3, timeoutMs: 150000,
          validate: (d) => { if (!Array.isArray(d.elements)) throw new Error('no elements[] in response'); },
        });
        return { records: data.elements.length, note: `Overpass bbox query via ${ep}: ${q}` };
      } catch (err) {
        lastErr = err;
        console.warn(`  overpass ${ep} failed: ${err.message}; trying next instance`);
      }
    }
    throw lastErr;
  });
}

if (isMain(import.meta.url)) await fetchOsm(getCity(process.argv[2]));
