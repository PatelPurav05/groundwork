// HCD Surplus Land Act Notices of Availability CSV (statewide; filtered to the city in build).
// Resource URL found via the CKAN API: package_show?id=surplus-land-act-notices-of-availability-received
import { cached, step, isMain } from './lib.mjs';
import { getCity } from './cities.mjs';

export const SLA_PACKAGE = 'https://data.ca.gov/api/3/action/package_show?id=surplus-land-act-notices-of-availability-received';

export async function fetchSla(city) {
  const src = `${city.slug}/hcd_sla`;
  return step(src, { name: 'HCD Surplus Land Act Notices of Availability', url: 'https://data.ca.gov/dataset/surplus-land-act-notices-of-availability-received' }, async () => {
    const pkg = await cached(src, 'package.json', SLA_PACKAGE);
    const res = pkg.result.resources.find((r) => /csv/i.test(r.format) || /\.csv$/i.test(r.url));
    if (!res) throw new Error('no CSV resource in package');
    const csv = await cached(src, 'noa_information.csv', res.url, { raw: true });
    const lines = csv.split('\n').length;
    return { records: lines - 1, csvUrl: res.url, note: `CSV resource: ${res.url} (statewide, ~${lines - 1} lines incl. multi-line cells); filtered to ${city.slaCity} in build.` };
  });
}

if (isMain(import.meta.url)) await fetchSla(getCity(process.argv[2]));
