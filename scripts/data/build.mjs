// Groundwork data build. Fetches (cached) then writes:
//   public/data/<slug>/parcels.json    all parcels, columnar (sieve)
//   public/data/<slug>/sites.json      candidate sites, full detail
//   public/data/<slug>/sources.json    dataset registry
//   public/data/<slug>/addresses.json  address search index aligned to parcels.json order
//   public/data/cities.json            city index
// Run from repo root:  node scripts/data/build.mjs [city-slug]   (default santa-ana)
// Offline rebuild (no network, cache only): node scripts/data/build.mjs santa-ana --no-fetch

import fs from 'node:fs';
import path from 'node:path';
import * as turf from '@turf/turf';
import Flatbush from 'flatbush';
import { parse as parseCsv } from 'csv-parse/sync';
import {
  RAW, OUT, CHECKED, readJSON, writeJSON, ensureDir, readMeta, writeMeta,
  esriToGeoJSON, pointInGeom, geomBBox, normApn,
} from './lib.mjs';
import { getCity, CITIES, scagCodeToCategory } from './cities.mjs';
import { fetchArcgis } from './fetch-arcgis.mjs';
import { fetchOsm } from './fetch-osm.mjs';
import { fetchSla } from './fetch-sla.mjs';
import { fetchEnrich } from './fetch-enrich.mjs';
import { enrich, ENRICH_FLAGS } from './enrich.mjs';

const args = process.argv.slice(2);
const city = getCity(args.find((a) => !a.startsWith('--')) || 'santa-ana');
const SLUG = city.slug;
const rawDir = (id) => path.join(RAW, SLUG, id);
const outDir = path.join(OUT, SLUG);

if (!args.includes('--no-fetch')) {
  await fetchArcgis(city);
  await fetchSla(city);
  await fetchOsm(city);
  await fetchEnrich(city);
}

// ---------------------------------------------------------------- helpers
const ZONE_CATS = ['single_family', 'multi_family', 'mixed_use', 'commercial', 'industrial', 'public', 'open_space', 'other'];
const FLAG = {
  fire_vhfhsz: 1 << 0, flood_sfha: 1 << 1, liquefaction: 1 << 2, landslide: 1 << 3, hqta: 1 << 4,
  worship: 1 << 5, surplus: 1 << 6, he_site: 1 << 7, vacant: 1 << 8, low_cover: 1 << 9,
  underused: 1 << 10, ces_high: 1 << 11, commercial_corridor: 1 << 12,
  ...ENRICH_FLAGS,
};
const SQFT_PER_M2 = 10.7639104;
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const r6 = (x) => Math.round(x * 1e6) / 1e6;

const meta = (id) => readMeta(`${SLUG}/${id}`);
const ok = (id) => meta(id)?.status === 'ok';

function loadPages(id) {
  const dir = rawDir(id);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/^page-\d+\.json$/.test(f)) out.push(...(readJSON(p).features || []));
    }
  };
  walk(dir);
  return out;
}

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const str = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** Polygon layer → spatial index + lookup(pt) returning all containing features. */
function polygonLayer(features, attrsFn = (a) => a) {
  const items = [];
  for (const f of features) {
    const g = esriToGeoJSON(f.geometry);
    if (!g) continue;
    items.push({ g, bb: geomBBox(g), a: attrsFn(f.attributes) });
  }
  const idx = items.length ? new Flatbush(items.length) : null;
  if (idx) { for (const it of items) idx.add(...it.bb); idx.finish(); }
  return {
    size: items.length,
    lookup(pt) {
      if (!idx) return [];
      return idx.search(pt[0], pt[1], pt[0], pt[1]).map((i) => items[i]).filter((it) => pointInGeom(pt, it.g)).map((it) => it.a);
    },
  };
}

// ---------------------------------------------------------------- 1. parcels
console.log('\n# building', city.name);
const pf = city.parcels.fields;
const parcelFeats = loadPages('parcels');
const parcels = [];
let noGeom = 0, centroidMoved = 0;
for (const f of parcelFeats) {
  const g = esriToGeoJSON(f.geometry);
  if (!g) { noGeom++; continue; }
  const a = f.attributes;
  const feat = { type: 'Feature', properties: {}, geometry: g };
  let c = turf.centroid(feat).geometry.coordinates;
  if (!pointInGeom(c, g)) { c = turf.pointOnFeature(feat).geometry.coordinates; centroidMoved++; }
  const apn = str(a[pf.apn]);
  parcels.push({
    apn, apnN: normApn(apn), g, bb: geomBBox(g), c,
    lot: Math.round(turf.area(feat) * SQFT_PER_M2),
    address: str(a[pf.address]),
    land: num(a[pf.land]), impr: num(a[pf.improvement]),
    yearBuilt: pf.yearBuilt ? num(a[pf.yearBuilt]) : null,
    flags: 0, zoneCat: null, zoneLocal: null,
  });
}
console.log(`parcels: ${parcels.length} (no geometry: ${noGeom}; centroid outside polygon → pointOnFeature: ${centroidMoved})`);
const pIdx = new Flatbush(parcels.length);
for (const p of parcels) pIdx.add(...p.bb);
pIdx.finish();
const parcelsAt = (pt) => pIdx.search(pt[0], pt[1], pt[0], pt[1]).filter((i) => pointInGeom(pt, parcels[i].g));
const byApn = new Map();
parcels.forEach((p, i) => { if (p.apnN) { if (!byApn.has(p.apnN)) byApn.set(p.apnN, []); byApn.get(p.apnN).push(i); } });

// ---------------------------------------------------------------- 2. SCAG joins by APN
function scagMap(id) {
  const m = new Map();
  for (const f of loadPages(id)) {
    const k = normApn(f.attributes.APN24);
    if (k && !m.has(k)) m.set(k, f.attributes);
  }
  return m;
}
const scagZ = scagMap('scag_zoning');
const scagLU = scagMap('scag_landuse');
const scagGP = scagMap('scag_gp');

// SCAG land-use code labels (SCAG land use classification legend). Codes are kept verbatim.
const LU_LABELS = {
  1110: 'Single Family Residential', 1111: 'High-Density Single Family Residential', 1112: 'Low-Density Single Family Residential',
  1120: 'Multi-Family Residential', 1122: 'Duplexes, Triplexes and 2- or 3-Unit Condominiums and Townhouses',
  1123: 'Low-Rise Apartments, Condominiums, and Townhouses', 1124: 'Medium-Rise Apartments and Condominiums',
  1125: 'High-Rise Apartments and Condominiums', 1130: 'Mobile Homes and Trailer Parks', 1140: 'Mixed Residential',
  1200: 'Commercial and Services', 1210: 'General Office Use', 1211: 'Low- and Medium-Rise Major Office Use', 1212: 'High-Rise Major Office Use',
  1220: 'Retail Stores and Commercial Services', 1221: 'Regional Shopping Center', 1222: 'Retail Centers (Non-Strip)',
  1223: 'Retail Strip Development', 1230: 'Other Commercial', 1231: 'Commercial Storage', 1233: 'Hotels and Motels',
  1240: 'Public Facilities', 1241: 'Government Offices', 1242: 'Police and Sheriff Stations', 1243: 'Fire Stations',
  1244: 'Major Medical Health Care Facilities', 1245: 'Religious Facilities', 1246: 'Other Public Facilities',
  1247: 'Public Parking Facilities', 1250: 'Special Use Facilities', 1252: 'Special Care Facilities',
  1260: 'Educational Institutions', 1261: 'Pre-Schools/Day Care Centers', 1262: 'Elementary Schools', 1263: 'Junior or Intermediate High Schools',
  1264: 'Senior High Schools', 1265: 'Colleges and Universities', 1266: 'Trade Schools and Professional Training Facilities',
  1270: 'Military Installations', 1300: 'Industrial', 1310: 'Light Industrial', 1311: 'Manufacturing, Assembly, and Industrial Services',
  1313: 'Packing Houses and Grain Elevators', 1320: 'Heavy Industrial', 1323: 'Open Storage', 1340: 'Wholesaling and Warehousing',
  1400: 'Transportation, Communications, and Utilities', 1413: 'Freeways and Major Roads', 1415: 'Bus Terminals and Yards',
  1416: 'Truck Terminals', 1430: 'Utility Facilities', 1431: 'Electrical Power Facilities', 1434: 'Water Storage Facilities',
  1435: 'Natural Gas and Petroleum Facilities', 1436: 'Water Transfer Facilities', 1437: 'Improved Flood Waterways and Structures',
  1440: 'Maintenance Yards', 1500: 'Mixed Commercial and Industrial', 1600: 'Mixed Residential and Commercial',
  1700: 'Under Construction', 1800: 'Open Space and Recreation', 1810: 'Golf Courses', 1820: 'Local Parks and Recreation',
  1880: 'Other Open Space and Recreation', 1900: 'Urban Vacant', 2600: 'Other Agriculture', 3000: 'Vacant', 3100: 'Vacant Undifferentiated',
  9999: 'Unknown',
};
const VACANT_LU = (c) => /^(19|3)\d\d$/.test(c) || c === '1247'; // urban vacant, vacant, public parking facilities

// Santa Ana general plan (GP24_CITY) → category; last-resort fallback for Specific Development zones.
function gpToCategory(gp) {
  if (!gp) return null;
  const g = gp.toUpperCase();
  if (/^LR/.test(g)) return 'single_family';
  if (/^(LMR|MR|CR)/.test(g)) return 'multi_family';
  if (/^(UN|DC)/.test(g)) return 'mixed_use';
  if (/^(GC|PAO)/.test(g)) return 'commercial';
  if (/^(IND|FLEX)/.test(g)) return 'industrial';
  if (/^INS/.test(g)) return 'public';
  if (/^OS/.test(g)) return 'open_space';
  return 'other';
}

// ---------------------------------------------------------------- 3. polygon layers
const zoningLayer = polygonLayer(loadPages('zoning'));
const floodLayer = polygonLayer(loadPages('flood'));
const liqLayer = polygonLayer(loadPages('liquefaction'));
const slideLayer = polygonLayer(loadPages('landslide'));
const fireLayer = polygonLayer([...loadPages('fire'), ...loadPages('fire_calfire')]);
const hqtaLayer = polygonLayer(loadPages('hqta'));
const cesLayer = polygonLayer(loadPages('ces'));
const zc = city.zoning;

const CORRIDOR_ZONES = new Set(['C5', 'SP1', 'SP2', 'CSM']); // Arterial Commercial, Bristol St Corridor SP, Harbor Mixed Use Transit Corridor SP, South Main St Commercial
const zoneCodeCounts = {};
const zoneSource = { local: 0, scag: 0, gp: 0, none: 0 };
const unmappedLocal = {};

for (const p of parcels) {
  const pt = p.c;
  // zoning: base zone polygon (skip overlay-zone polygons such as OZ1 when a base zone also contains the point)
  const zs = zoningLayer.lookup(pt);
  const base = zs.find((a) => !/^OZ/.test(a[zc.codeField] || '')) || zs[0] || null;
  const scz = p.apnN ? scagZ.get(p.apnN) : null;
  const gp = p.apnN ? scagGP.get(p.apnN) : null;
  p.zoneLocal = base ? str(base[zc.codeField]) : (scz ? str(scz.ZN24_CITY) : null);
  p.zoneDesc = base ? str(base[zc.descField]) : null;
  p.zoneOverlay = zs.map((a) => str(a[zc.overlayField]) || (/^OZ/.test(a[zc.codeField] || '') ? a[zc.codeField] : null)).find(Boolean) || null;
  if (p.zoneLocal) zoneCodeCounts[p.zoneLocal] = (zoneCodeCounts[p.zoneLocal] || 0) + 1;
  let cat = p.zoneLocal ? zc.categoryMap[p.zoneLocal] ?? null : null;
  if (cat) zoneSource.local++;
  if (!cat && p.zoneLocal) unmappedLocal[p.zoneLocal] = (unmappedLocal[p.zoneLocal] || 0) + 1;
  if (!cat && scz && scz.ZN24_SCAG && scz.ZN24_SCAG !== '7777') { cat = scagCodeToCategory(scz.ZN24_SCAG); if (cat) zoneSource.scag++; }
  if (!cat && gp) { cat = gpToCategory(str(gp.GP24_CITY)); if (cat) zoneSource.gp++; }
  if (!cat) zoneSource.none++;
  p.zoneCat = cat;
  p.scagZoning = scz ? { city: str(scz.ZN24_CITY), scag: str(scz.ZN24_SCAG) } : null;
  p.generalPlan = gp ? str(gp.GP24_CITY) : null;
  if (p.zoneLocal && CORRIDOR_ZONES.has(p.zoneLocal)) p.flags |= FLAG.commercial_corridor;

  // existing land use
  const lu = p.apnN ? scagLU.get(p.apnN) : null;
  const luc = lu ? str(lu.LU24) : null;
  p.existingUse = luc ? `${luc} ${LU_LABELS[luc] || '(SCAG code)'}` : null;
  p.luCode = luc;
  if (luc && VACANT_LU(luc)) p.flags |= FLAG.vacant;

  // hazards
  const fl = floodLayer.lookup(pt);
  const sfha = fl.find((a) => a.SFHA_TF === 'T' || /^[AV]/.test(a.FLD_ZONE || ''));
  const flPick = sfha || fl[0] || null;
  p.flood = flPick ? str(flPick.FLD_ZONE) : null;
  if (sfha) p.flags |= FLAG.flood_sfha;
  p.liq = liqLayer.lookup(pt).length > 0;
  if (p.liq) p.flags |= FLAG.liquefaction;
  p.slide = slideLayer.lookup(pt).length > 0;
  if (p.slide) p.flags |= FLAG.landslide;
  const fz = fireLayer.lookup(pt);
  const fireHit = fz.find((a) => /very high/i.test(a.HAZ_CLASS || a.HAZ_CODE || '')) || fz[0] || null;
  p.fire = fireHit ? str(fireHit.HAZ_CLASS) || 'in zone' : null;
  if (fireHit && /very high/i.test(fireHit.HAZ_CLASS || '')) p.flags |= FLAG.fire_vhfhsz;
  p.hqta = hqtaLayer.lookup(pt).length > 0;
  if (p.hqta) p.flags |= FLAG.hqta;
  const ce = cesLayer.lookup(pt)[0] || null;
  p.cesPct = ce && ce.CIscoreP != null && ce.CIscoreP >= 0 ? Math.round(ce.CIscoreP * 10) / 10 : null;
  p.cesTract = ce && ce.tract != null ? String(ce.tract).padStart(11, '0') : null;
  if (p.cesPct != null && p.cesPct >= 75) p.flags |= FLAG.ces_high;

  // underused: improvement value < 25% of land value (both known, land > 0)
  if (p.land != null && p.impr != null && p.land > 0 && p.impr < 0.25 * p.land) p.flags |= FLAG.underused;
}

// ---------------------------------------------------------------- 4. building footprint coverage
const fpOk = ok('footprints');
const fpArea = new Float64Array(parcels.length);
let fpAssigned = 0, fpTotal = 0;
if (fpOk) {
  for (const f of loadPages('footprints')) {
    const g = esriToGeoJSON(f.geometry);
    if (!g) continue;
    fpTotal++;
    const c = turf.centroid({ type: 'Feature', properties: {}, geometry: g }).geometry.coordinates;
    const hits = parcelsAt(c);
    if (!hits.length) continue;
    fpAssigned++;
    const area = num(f.attributes['Shape.STArea()']) ?? turf.area(g) * SQFT_PER_M2; // State Plane ft²
    for (const i of hits) fpArea[i] += area;
  }
}
for (let i = 0; i < parcels.length; i++) {
  const p = parcels[i];
  p.coverage = fpOk && p.lot > 0 ? Math.round((fpArea[i] / p.lot) * 1000) / 1000 : null;
  if (p.coverage != null && p.coverage < 0.25) p.flags |= FLAG.low_cover;
}
console.log(`footprints: ${fpAssigned}/${fpTotal} assigned to a parcel by centroid`);

// ---------------------------------------------------------------- 5. OSM places of worship
const worship = new Map(); // parcel index → info
let osmCount = 0, osmMatched = 0;
const osmFile = path.join(rawDir('osm_worship'), 'overpass.json');
if (ok('osm_worship') && fs.existsSync(osmFile)) {
  for (const e of readJSON(osmFile).elements) {
    osmCount++;
    const info = { name: str(e.tags?.name), religion: str(e.tags?.religion), osmId: `${e.type}/${e.id}`, source: 'osm' };
    const hits = new Set();
    if (e.type === 'node') parcelsAt([e.lon, e.lat]).forEach((i) => hits.add(i));
    else if (e.type === 'way' && e.geometry?.length >= 4) {
      const ring = e.geometry.map((n) => [n.lon, n.lat]);
      const closed = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1];
      const g = closed ? { type: 'Polygon', coordinates: [ring] } : null;
      const c = g ? turf.centroid(g).geometry.coordinates : ring[Math.floor(ring.length / 2)];
      parcelsAt(c).forEach((i) => hits.add(i));
      if (g) {
        // also every parcel whose centroid lies inside the mapped worship polygon (multi-parcel campuses)
        const bb = geomBBox(g);
        for (const i of pIdx.search(...bb)) if (pointInGeom(parcels[i].c, g)) hits.add(i);
      }
    } else if (e.bounds) {
      parcelsAt([(e.bounds.minlon + e.bounds.maxlon) / 2, (e.bounds.minlat + e.bounds.maxlat) / 2]).forEach((i) => hits.add(i));
    }
    if (hits.size) osmMatched++;
    for (const i of hits) { if (!worship.has(i)) worship.set(i, info); parcels[i].flags |= FLAG.worship; }
  }
}
const osmWorshipParcels = worship.size;
// SCAG existing land use 1245 (Religious Facilities) also sets the worship bit.
let luWorship = 0, bothWorship = 0;
parcels.forEach((p, i) => {
  if (p.luCode !== '1245') return;
  luWorship++;
  const prev = worship.get(i);
  if (prev) { worship.set(i, { ...prev, source: 'both' }); bothWorship++; }
  else worship.set(i, { name: null, religion: null, osmId: null, source: 'scag-landuse' });
  p.flags |= FLAG.worship;
});
console.log(`worship: OSM ${osmMatched}/${osmCount} elements → ${osmWorshipParcels} parcels; SCAG LU 1245 ${luWorship} parcels; both ${bothWorship}; total ${worship.size}`);

// ---------------------------------------------------------------- 6. Surplus Land Act notices
const surplus = new Map(); // parcel index → info
let slaRows = 0, slaCity = 0, slaMatchedApn = 0, slaMatchedXY = 0, slaUnmatched = [];
const slaFile = path.join(rawDir('hcd_sla'), 'noa_information.csv');
function parseAcres(s) {
  if (!s) return null;
  const t = String(s).replace(/,/g, '').toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  if (/\b(sf|sq\.?\s*ft|square\s*feet|sqft)\b/.test(t)) return Math.round((v / 43560) * 1000) / 1000;
  return Math.round(v * 1000) / 1000; // column is "Parcel Size (Gross Acres)"
}
function isoDate(s) {
  const m = String(s || '').match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : str(s);
}
if (ok('hcd_sla') && fs.existsSync(slaFile)) {
  const rows = parseCsv(fs.readFileSync(slaFile, 'utf8'), { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
  slaRows = rows.length;
  const want = city.slaCity.toLowerCase();
  for (const r of rows) {
    const c = String(r.City || '').trim().toLowerCase();
    const ag = String(r['Local Agency'] || '').trim().toLowerCase();
    if (c !== want && !(ag === want && !c)) continue;
    slaCity++;
    const raw = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')]));
    const info = {
      agency: str(r['Local Agency']), status: str(r['NOA Status']), date: isoDate(r['Date Notice Issued']),
      contact: str(r['Notice Contact Information- Concatenated']), acres: parseAcres(r['Parcel Size (Gross Acres)']), raw,
    };
    const apnHits = new Set();
    for (const m of String(r.APN || '').matchAll(/\d{3}\s*-?\s*\d{2,3}\s*-?\s*\d{2,3}/g)) {
      const k = normApn(m[0]);
      if (k && k.length === 8 && byApn.has(k)) byApn.get(k).forEach((i) => apnHits.add(i));
    }
    let hits = [...apnHits];
    if (hits.length) slaMatchedApn++;
    else {
      const x = num(r.x), y = num(r.y);
      if (x != null && y != null) hits = parcelsAt([x, y]);
      if (hits.length) slaMatchedXY++;
      else slaUnmatched.push(`${r['Parent Case']} APN=${r.APN} ${r.Address}`);
    }
    for (const i of hits) {
      const prev = surplus.get(i);
      if (!prev || (info.date || '') > (prev.date || '')) surplus.set(i, info);
      parcels[i].flags |= FLAG.surplus;
    }
  }
}
console.log(`SLA: ${slaCity} ${city.slaCity} rows of ${slaRows}; matched by APN ${slaMatchedApn}, by x/y ${slaMatchedXY}, unmatched ${slaUnmatched.length}`);

// ---------------------------------------------------------------- 7. Housing Element sites (SCAG)
const heSites = new Map();
const heFeats = loadPages('scag_he');
const heJurisdictions = {};
for (const f of heFeats) {
  const a = f.attributes;
  heJurisdictions[a.Jurisdiction] = (heJurisdictions[a.Jurisdiction] || 0) + 1;
  const keys = new Set([normApn(a.APN24), normApn(a.Assessor_Parcel_Number)].filter(Boolean));
  for (const k of keys) for (const i of byApn.get(k) || []) {
    heSites.set(i, {
      lower: num(a.Low_Income_HE_Capacity), moderate: num(a.Moderate_Income_HE_Capacity), aboveModerate: num(a.Above_Moderate_Income_HE_Capacity),
      raw: Object.fromEntries(Object.entries(a).map(([k2, v]) => [k2, String(v ?? '')])),
    });
    parcels[i].flags |= FLAG.he_site;
  }
}
const heCityRecords = heFeats.filter((f) => String(f.attributes.Jurisdiction || '').toUpperCase() === city.heJurisdiction).length;
console.log(`HE: ${heFeats.length} features in bbox, ${heCityRecords} with Jurisdiction=${city.heJurisdiction}, ${heSites.size} parcels matched`, heJurisdictions);

// ---------------------------------------------------------------- 7b. enrichment (industry, fault, historic, hazwaste, wetland, farmland, conservation, freeway)
const E = enrich({ parcels, city, loadPages, polygonLayer, ok, log: (...a) => console.log(...a) });
parcels.forEach((p, i) => { p.flags |= E.out[i].flags; });

// which flag layers actually loaded (so the app can tell "not in a zone" from "layer missing")
const known = {
  fire_vhfhsz: ok('fire') || ok('fire_calfire'), flood_sfha: ok('flood'), liquefaction: ok('liquefaction'), landslide: ok('landslide'),
  hqta: ok('hqta'), worship: ok('osm_worship') || ok('scag_landuse'), surplus: ok('hcd_sla'), he_site: false, vacant: ok('scag_landuse'),
  low_cover: ok('footprints'), underused: ok('parcels'), ces_high: ok('ces'), commercial_corridor: ok('zoning'),
  ...E.known,
  urban_perimeter_ok: false, // computed for sites.json only; never set in parcels.json
};
if (heFeats.filter((f) => String(f.attributes.Jurisdiction || '').toUpperCase() === city.heJurisdiction).length > 0) known.he_site = ok('scag_he');

// ---------------------------------------------------------------- 8. parcels.json
ensureDir(outDir);
let bbox = [Infinity, Infinity, -Infinity, -Infinity];
for (const p of parcels) {
  bbox = [Math.min(bbox[0], p.c[0]), Math.min(bbox[1], p.c[1]), Math.max(bbox[2], p.c[0]), Math.max(bbox[3], p.c[1])];
}
bbox = bbox.map(r5);
const parcelsJson = {
  count: parcels.length,
  bbox,
  zoneCodes: ZONE_CATS,
  known,
  columns: {
    apn: parcels.map((p) => p.apn),
    lng: parcels.map((p) => r5(p.c[0])),
    lat: parcels.map((p) => r5(p.c[1])),
    lot: parcels.map((p) => p.lot || 0),
    zone: parcels.map((p) => (p.zoneCat ? ZONE_CATS.indexOf(p.zoneCat) : -1)),
    flags: parcels.map((p) => p.flags),
  },
};
writeJSON(path.join(outDir, 'parcels.json'), parcelsJson);

// addresses.json — site addresses only (never mailing/owner), normalized uppercase
writeJSON(path.join(outDir, 'addresses.json'), {
  apn: parcels.map((p) => p.apn),
  address: parcels.map((p) => (p.address ? p.address.toUpperCase().replace(/\s+/g, ' ').trim() : null)),
});

// ---------------------------------------------------------------- 9. sites.json (candidates)
// Candidate rules = the app's lens survivor rules (no cap). A parcel is a candidate if ANY hold.
const has = (p, f) => (p.flags & f) !== 0;
const Z = (p, ...cats) => cats.includes(p.zoneCat);
const reasons = (p, i) => {
  const vacant = has(p, FLAG.vacant), low = has(p, FLAG.low_cover), under = has(p, FLAG.underused);
  const used = vacant || low || under;
  return {
    worship: has(p, FLAG.worship), surplus: has(p, FLAG.surplus), he: has(p, FLAG.he_site), vacant,
    ab2011: Z(p, 'commercial', 'mixed_use') && used && p.lot >= 10000,
    sb684: ((Z(p, 'multi_family', 'mixed_use') && p.lot <= 217800) || (Z(p, 'single_family') && vacant && p.lot <= 65340)) && used && p.lot >= 6000,
    sb9: Z(p, 'single_family') && p.lot >= 9000 && !has(p, FLAG.flood_sfha) && (low || vacant),
  };
};
const cand = new Map(); // normalised APN (or idx for null APN) → parcel index; same-APN duplicates keep the largest lot
for (let i = 0; i < parcels.length; i++) {
  const p = parcels[i];
  if (!Object.values(reasons(p, i)).some(Boolean)) continue;
  const key = p.apnN || `idx${i}`;
  const prev = cand.get(key);
  if (prev === undefined || parcels[prev].lot < p.lot) cand.set(key, i);
}
const isHard = (i) => { const r = reasons(parcels[i], i); return r.worship || r.surplus || r.he || r.vacant; };
let candIdx = [...cand.values()].sort((a, b) => isHard(b) - isHard(a) || parcels[b].lot - parcels[a].lot);
const preCap = candIdx.length;
const capNote = null;
// distinct-APN sites sharing an identical centroid + lot (condo / duplicate records; the app dedupes by geometry)
const geoGroups = new Map();
for (const i of candIdx) { const p = parcels[i]; const k = `${r5(p.c[0])},${r5(p.c[1])},${p.lot}`; geoGroups.set(k, (geoGroups.get(k) || 0) + 1); }
const dupGeomGroups = [...geoGroups.values()].filter((n) => n > 1);
const dupGeomInfo = { groups: dupGeomGroups.length, sitesInGroups: dupGeomGroups.reduce((a, b) => a + b, 0) };

function outline(g, maxV = 40) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = polys[0];
  if (polys.length > 1) best = polys.reduce((m, p) => (turf.area(turf.polygon([p[0]])) > turf.area(turf.polygon([m[0]])) ? p : m));
  let ring = best[0];
  let tol = 0.000002;
  while (ring.length > maxV && tol < 0.01) {
    const s = turf.simplify(turf.polygon([best[0]]), { tolerance: tol, highQuality: true });
    ring = s.geometry.coordinates[0];
    tol *= 2;
  }
  return ring.map(([x, y]) => [r6(x), r6(y)]);
}

const status = (id) => meta(id)?.status || 'failed';
const fireStatus = status('fire') === 'ok' || status('fire_calfire') === 'ok';
let OUTLINE_MAX = 40;
let upStats = [];
const makeSites = () => candIdx.map((i) => {
  const p = parcels[i];
  const s = {
    apn: p.apn,
    address: p.address,
    lng: r5(p.c[0]), lat: r5(p.c[1]),
    outline: outline(p.g, OUTLINE_MAX),
    lotSqft: p.lot || null,
    zoning: { local: p.zoneLocal, category: p.zoneCat, generalPlan: p.generalPlan },
    existingUse: p.existingUse,
    existingUseCode: p.luCode,
    yearBuilt: p.yearBuilt,
    assessed: { land: p.land, improvement: p.impr },
    coverage: p.coverage,
    hazards: {
      fire: fireStatus ? p.fire : 'unknown',
      flood: status('flood') === 'ok' ? p.flood : 'unknown',
      liquefaction: status('liquefaction') === 'ok' ? p.liq : null,
      landslide: status('landslide') === 'ok' ? p.slide : null,
    },
    transit: { hqta: status('hqta') === 'ok' ? p.hqta : null },
    ces: { percentile: p.cesPct, tract: p.cesTract },
    signals: {},
    flags: p.flags,
    enrich: { urbanPerimeterPct: null, historic: E.out[i].historic, hazwaste: E.out[i].hazwaste, conservationName: E.out[i].conservationName, nearestHeavyIndustryFt: E.nearestHeavyFt(i) },
  };
  const up = E.urbanPerimeter(i);
  s.enrich.urbanPerimeterPct = up ? up.pct : null;
  if (up && up.pct != null && up.pct >= 75) s.flags |= FLAG.urban_perimeter_ok;
  upStats.push(up);
  if (worship.has(i)) s.signals.worship = worship.get(i);
  if (surplus.has(i)) s.signals.surplus = surplus.get(i);
  if (heSites.has(i)) s.signals.heSite = heSites.get(i);
  return s;
});
let sites = makeSites();
if (JSON.stringify(sites).length > 6e6) { OUTLINE_MAX = 24; upStats = []; sites = makeSites(); }
writeJSON(path.join(outDir, 'sites.json'), sites);

// ---------------------------------------------------------------- 10. sources.json
const SOURCES_URL_LANDUSE = 'https://maps.scag.ca.gov/scaggis/rest/services/LDX/Existinglanduse_poly_OR/MapServer/0';
const hst = E.stats.historic;
const ENRICH_NOTES = {
  ap_fault: 'fault_zone (bit 15): parcel centroid inside an Alquist-Priolo Earthquake Fault Zone polygon. No zone polygon intersects the city bbox, so every parcel is outside a mapped zone. Liquefaction/landslide are NOT used for this test.',
  historic_props: `historic (bit 16): matched to parcels by APN (${hst.register} listings matched, ${hst.registerByPoint} of them by point-in-parcel when the APN did not match). All categories (Landmark, Key, Contributive, uncategorized) count. A listing on the local register, not a determination of eligibility.`,
  historic_districts: `historic (bit 16): parcel centroid inside a city historic district (${hst.district} parcels). PROXY: SB 9 excludes contributing structures in a district; being inside the district boundary does not mean the structure contributes.`,
  nrhp_points: `historic (bit 16): NRHP point inside the parcel (${hst.nrhpPoint} points matched).`,
  nrhp_polys: `historic (bit 16): parcel centroid inside an NRHP district/property polygon (${hst.nrhpPoly} parcels).`,
  envirostor: `hazwaste (bit 17): EnviroStor cleanup site point inside the parcel or within 50 ft of its boundary, counting only open statuses (Active, Backlog, Inactive - Needs Evaluation, Inactive - Action Required, Certified O&M - Land Use Restrictions). Closed/referred sites (No Further Action, Certified, Refer: *, No Action Required, Withdrawn) are ignored. ${E.stats.hazwaste.activeStatus} open of ${E.stats.hazwaste.sitesInBbox} sites in bbox; ${E.stats.hazwaste.matchedToParcel} matched a parcel. PROXY for the Cortese list (Gov. Code 65962.5): GeoTracker (water board) cases are not included. Staff names are not fetched.`,
  nwi: 'wetland (bit 18): parcel centroid inside any NWI polygon (all types: riverine, freshwater pond, emergent, forested/shrub, lake). NWI is not a jurisdictional delineation; riverine and lake polygons include deepwater habitat.',
  fmmp: 'farmland (bit 19): parcel centroid in FMMP 2022 Prime Farmland (P) or Farmland of Statewide Importance (S). Other FMMP classes (urban D, grazing G, other X) are not counted.',
  cpad: 'conservation (bit 20): parcel centroid in a CPAD holding. CPAD includes ordinary city parks and school fields; it is protected open space, not necessarily an NCCP or easement. Also see cced.',
  cced: 'conservation (bit 20): parcel centroid in a CCED conservation easement. No easement intersects the city bbox.',
  shn: `freeway_500 (bit 21): any State Highway Network centerline segment within 500 ft of the parcel boundary (planar distance). Every SHN route in and around ${city.name} (I-5, SR-22, SR-55, SR-57, I-405) is a freeway; for other cities, check that SHN routes there are freeways.`,
};
const fpMeta = meta('footprints');
const entry = (id, extra = {}) => {
  const m = meta(id) || { name: id, url: '', status: 'failed', records: 0 };
  return { id, name: m.name, url: m.url, checked: m.checked || CHECKED, status: m.status, records: m.records, note: m.note, ...extra };
};
const joinNote = 'Spatial joins are point-in-polygon on the parcel centroid (turf.centroid; pointOnFeature when the centroid falls outside an irregular lot).';
const sources = [
  entry('parcels', { note: `Primary parcel universe. ${parcels.length} parcels with geometry. Lot area computed from polygon geometry (turf.area, ft²). MailAddress never requested; no owner names. APN formats seen: 999-999-99 and 999-99-999 (condos); joined to other sources after stripping non-digits. "underused" = ImprovedVal < 25% of LandVal when both present and LandVal > 0.` }),
  entry('zoning', { note: `Local zoning by ${joinNote} Codes mapped to ZoneCategory in scripts/data/cities.mjs; Specific Development (SD*) zones fall back to SCAG ZN24_SCAG, then SCAG general plan GP24_CITY.` }),
  entry('scag_zoning', { note: `${meta('scag_zoning')?.note || ''} Fallback zone category for SD* zones and for parcels outside local zoning polygons.`.trim() }),
  entry('scag_landuse', { note: `${meta('scag_landuse')?.note || ''} vacant flag = LU24 1900 (urban vacant), 3xxx (vacant) or 1247 (public parking facilities). worship bit also set for LU24 = 1245 (${luWorship} parcels, ${bothWorship} also in OSM); the label "Religious Facilities" for 1245 is from the SCAG land-use legend as recalled, not confirmed against the service (which publishes no code labels) — unverified label. Condo APNs (999-99-999) are not in SCAG, so they have no existing use.`.trim() }),
  entry('scag_gp', { note: meta('scag_gp')?.note }),
  entry('scag_he', heCityRecords === 0
    ? { status: 'failed', note: `Fetched ${heFeats.length} features intersecting the ${city.name} bbox, but none have Jurisdiction=${city.heJurisdiction} (present: ${Object.keys(heJurisdictions).join(', ')}) and none match a ${city.name} APN. The layer does not cover ${city.name}; the Housing Element test is unknown.` }
    : { note: `Joined by APN (APN24 / Assessor_Parcel_Number).` }),
  entry('hcd_sla', { records: slaCity, note: `${meta('hcd_sla')?.note || ''} ${slaCity} ${city.slaCity} rows of ${slaRows}; matched by APN ${slaMatchedApn}, by notice x/y point-in-parcel ${slaMatchedXY}, unmatched ${slaUnmatched.length}. Sizes like "9,005 SF" converted to acres. Contacts are public-agency staff as published in the notice.`.trim() }),
  entry('osm_worship', { note: `${meta('osm_worship')?.note || ''} ${osmMatched}/${osmCount} OSM elements matched to ${osmWorshipParcels} parcels (node in parcel; way: parcel containing the way centroid plus parcels whose centroid is inside the way polygon). A lead (proxy), not proof of ownership. OSM coverage is incomplete. worship bit = OSM OR SCAG LU24 1245 (see scag_landuse).`.trim() }),
  entry('fire', { note: `${meta('fire')?.note || ''} ${fireLayer.size} fire hazard polygons intersect the city; no parcel is in a mapped zone.`.trim() }),
  entry('fire_calfire', { note: `${meta('fire_calfire')?.note || ''} Cross-check: 0 polygons intersect the city.`.trim() }),
  entry('flood', { note: `${joinNote} flood_sfha = SFHA_TF='T' or FLD_ZONE starting with A or V.` }),
  entry('liquefaction', { note: `${joinNote} Zones of required investigation (CGS Seismic Hazard Zones).` }),
  entry('landslide', { note: `${joinNote} ${slideLayer.size} landslide zone polygons intersect the city bbox.` }),
  entry('hqta', { note: `${joinNote} Any HQTA polygon type (hq_corridor_bus, major_stop_bus, major_stop_rail).` }),
  entry('ces', { note: `${joinNote} ces_high = CIscoreP ≥ 75.` }),
  entry('footprints', { note: `${fpMeta?.note || ''} Coverage = sum of footprint Shape.STArea() (ft²) for footprints whose centroid falls in the parcel ÷ parcel lot area (approximation; footprints straddling lot lines count fully for one parcel; stacked condo polygons each receive the footprint). ${fpAssigned}/${fpTotal} footprints assigned. low_cover = coverage < 0.25. Footprint capture date unknown.`.trim() }),
  { id: 'derived_corridor', name: 'Commercial corridor (derived from local zoning)', url: city.zoning.url, checked: CHECKED, status: 'partial',
    note: `commercial_corridor bit set when the local zone is a named corridor/arterial district (${[...CORRIDOR_ZONES].join(', ')}). Proxy only: AB 2011 street right-of-way width (70–150 ft) is NOT tested.` },
  { id: 'derived_industry', name: 'Industrial proximity (derived from local zoning + parcel polygons)', url: city.zoning.url, checked: CHECKED, status: ok('zoning') ? 'partial' : 'failed', records: E.stats.industry.heavyParcels,
    note: `heavy_industry_1200 (bit 13): parcel is zoned ${(city.heavyIndustrialZones || []).join('/')} (ZONEDESC "Heavy Industrial") or its boundary is within 1,200 ft of a parcel whose centroid zone is ${(city.heavyIndustrialZones || []).join('/')} (${E.stats.industry.heavyParcels} parcels). adj_industrial (bit 14): boundary within 15 ft of another parcel zoned ${(city.industrialZones || []).join('/')} (${E.stats.industry.industrialParcels} parcels; covers touching lots and lots split only by a lot-line gap). PROXY: SB 4 tests "a site permitted for heavy industrial use" and "more than one-third of the square footage dedicated to light industrial use"; zoning is used in place of permits/actual use. Industrial parcels outside ${city.name} are not in the parcel set and are not considered. Distances are planar (local equirectangular projection).` },
  { id: 'derived_urban_perimeter', name: 'Urban perimeter share (derived, sites only)', url: SOURCES_URL_LANDUSE, checked: CHECKED, status: ok('scag_landuse') ? 'partial' : 'failed', records: sites.length,
    note: 'urbanPerimeterPct: the site boundary is sampled every 5 m (or perimeter/400 if longer); from each sample we step outward 1–60 m and take the first other parcel hit. Neighbour is urban unless its SCAG LU24 is vacant (19xx, 3xxx), agriculture (2xxx), water (4xxx), open space (18xx) or flood channel (1437); neighbours with no LU24 use their zone category (open_space = non-urban, other/unknown = unclassified). pct = urban / (urban + non-urban) samples; samples finding no parcel within 60 m (wide freeways, city edge) or unclassified neighbours are excluded; pct is null if fewer than half the samples are classified. Streets are crossed: parcels separated only by a street are treated as adjoining (the SB 35 rule, as recalled, unverified for SB 4). urban_perimeter_ok (bit 22) = pct ≥ 75, sites.json only (0 in parcels.json).' },
  ...['ap_fault', 'historic_props', 'historic_districts', 'nrhp_points', 'nrhp_polys', 'ca_register', 'envirostor', 'geotracker', 'nwi', 'fmmp', 'cpad', 'cced', 'shn'].map((id) => entry(id, { note: [meta(id)?.note, ENRICH_NOTES[id]].filter(Boolean).join(' ') })),
];
writeJSON(path.join(outDir, 'sources.json'), sources);

// ---------------------------------------------------------------- 11. cities.json
const citiesPath = path.join(OUT, 'cities.json');
let cities = fs.existsSync(citiesPath) ? readJSON(citiesPath) : [];
cities = cities.filter((c) => c.slug !== SLUG);
const cb = city.bbox;
cities.push({ slug: SLUG, name: city.name, bbox: cb, center: [r5((cb[0] + cb[2]) / 2), r5((cb[1] + cb[3]) / 2)], parcelCount: parcels.length, built: true });
writeJSON(citiesPath, cities.sort((a, b) => a.name.localeCompare(b.name)));

// ---------------------------------------------------------------- 12. report
const flagCounts = Object.fromEntries(Object.entries(FLAG).map(([k, b]) => [k, parcels.filter((p) => p.flags & b).length]));
const siteFlagCounts = Object.fromEntries(Object.entries(ENRICH_FLAGS).map(([k, b]) => [k, sites.filter((x) => x.flags & b).length]));
const ups = sites.map((x) => x.enrich.urbanPerimeterPct);
const upVals = ups.filter((v) => v != null).sort((a, b) => a - b);
const q = (f) => upVals[Math.min(upVals.length - 1, Math.floor(f * upVals.length))];
const urbanPerimeterDist = {
  null: ups.length - upVals.length, n: upVals.length, min: upVals[0], p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), max: upVals.at(-1),
  ge75: upVals.filter((v) => v >= 75).length, eq100: upVals.filter((v) => v === 100).length,
  buckets: Object.fromEntries(['0-24', '25-49', '50-74', '75-89', '90-99', '100'].map((b) => [b, 0])),
  meanGapShare: Math.round(100 * upStats.reduce((a, s2) => a + (s2 && s2.total ? s2.gap / s2.total : 0), 0) / upStats.length) + '%',
};
for (const v of upVals) urbanPerimeterDist.buckets[v < 25 ? '0-24' : v < 50 ? '25-49' : v < 75 ? '50-74' : v < 90 ? '75-89' : v < 100 ? '90-99' : '100']++;
const sigCounts = { worshipOsm: 0, worshipScag: 0, worshipBoth: 0, worship: 0, surplus: 0, he: 0, vacant: 0, ab2011: 0, sb684: 0, sb9: 0 };
for (const i of candIdx) { const r = reasons(parcels[i], i); for (const k in r) if (r[k]) sigCounts[k]++; const w = worship.get(i); if (w) sigCounts[{ osm: 'worshipOsm', 'scag-landuse': 'worshipScag', both: 'worshipBoth' }[w.source]]++; }
const worshipApns = new Set([...worship.keys()].map((i) => parcels[i].apnN || `idx${i}`));
const siteApns = new Set(candIdx.map((i) => parcels[i].apnN || `idx${i}`));
const worshipMissing = [...worshipApns].filter((k) => !siteApns.has(k)).length;
const sizes = Object.fromEntries(['parcels.json', 'sites.json', 'sources.json', 'addresses.json'].map((f) => [f, `${(fs.statSync(path.join(outDir, f)).size / 1e6).toFixed(2)} MB`]));
const report = {
  city: SLUG, parcels: parcels.length, flagCounts, siteFlagCounts, known, urbanPerimeterDist, enrichStats: E.stats, candidates: sites.length, candidatesBySignal: sigCounts,
  zoneCategoryCounts: Object.fromEntries([...ZONE_CATS, null].map((c) => [c ?? 'unknown', parcels.filter((p) => p.zoneCat === c).length])),
  zoneCategorySource: zoneSource, unmappedLocalCodes: unmappedLocal,
  localZoneCodeCounts: Object.fromEntries(Object.entries(zoneCodeCounts).sort((a, b) => b[1] - a[1])),
  duplicateApnParcels: parcels.filter((p) => p.apnN && byApn.get(p.apnN).length > 1).length,
  nullApnParcels: parcels.filter((p) => !p.apn).length,
  scagApnMatch: parcels.filter((p) => p.apnN && scagZ.has(p.apnN)).length,
  outlineMaxVertices: OUTLINE_MAX, sameGeometryDistinctApn: dupGeomInfo, worshipParcels: worship.size, worshipApnsMissingFromSites: worshipMissing, slaUnmatched, sizes,
};
writeJSON(path.join(RAW, SLUG, '_build-report.json'), report);
console.log(JSON.stringify(report, null, 2));

if (args.includes('--debug')) {
  let agree = 0, tot = 0; const dis = {};
  for (const p of parcels) if (p.scagZoning?.city && p.zoneLocal) { tot++; if (p.scagZoning.city.trim() === p.zoneLocal) agree++; else { const k = `${p.zoneLocal}->${p.scagZoning.city}`; dis[k] = (dis[k] || 0) + 1; } }
  console.log('local vs SCAG ZN24_CITY agreement', agree, '/', tot, Object.entries(dis).sort((a, b) => b[1] - a[1]).slice(0, 25));
  const a1 = parcels.filter((p) => p.zoneLocal === 'A1');
  console.log('A1 parcels', a1.length, 'with scag', a1.filter((p) => p.scagZoning).length, 'apn fmt', a1.slice(0, 8).map((p) => p.apn + ' ' + p.lot + ' ' + p.existingUse));
  const cov = parcels.filter((p) => p.zoneCat === 'single_family' && p.coverage != null).map((p) => p.coverage).sort((a, b) => a - b);
  console.log('SF coverage p10/p50/p90', cov[Math.floor(cov.length * 0.1)], cov[Math.floor(cov.length * 0.5)], cov[Math.floor(cov.length * 0.9)], 'zero', cov.filter((c) => c === 0).length);
  const pool = { hard: 0, ab2011: 0, sb684: 0, sb9: 0 };
  for (const i of cand.values()) { const r = reasons(parcels[i], i); if (r.worship || r.surplus || r.he || r.vacant) pool.hard++; else if (r.ab2011) pool.ab2011++; else if (r.sb684) pool.sb684++; else if (r.sb9) pool.sb9++; }
  console.log('pre-cap pools', pool);
}
