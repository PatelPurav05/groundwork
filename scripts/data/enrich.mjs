// City-wide enrichment: industrial proximity, fault zones, historic, contamination, wetlands,
// farmland, conservation, freeway distance, and (sites only) urban-perimeter share.
// All distance work is done in a local planar projection (equirectangular, metres) around the city centre.
import Flatbush from 'flatbush';
import { esriToGeoJSON, pointInGeom, normApn } from './lib.mjs';

export const ENRICH_FLAGS = {
  heavy_industry_1200: 1 << 13, adj_industrial: 1 << 14, fault_zone: 1 << 15, historic: 1 << 16,
  hazwaste: 1 << 17, wetland: 1 << 18, farmland: 1 << 19, conservation: 1 << 20, freeway_500: 1 << 21,
  urban_perimeter_ok: 1 << 22,
};

const FT = 0.3048;
const HEAVY_M = 1200 * FT; // 365.76 m
const ADJ_M = 15 * FT;     // 4.57 m
const FWY_M = 500 * FT;    // 152.4 m
const HAZ_M = 50 * FT;     // 15.24 m

// ------------------------------------------------------------------ planar geometry
function makeProj(lng0, lat0) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  return {
    f: ([x, y]) => [(x - lng0) * kx, (y - lat0) * ky],
    inv: ([x, y]) => [x / kx + lng0, y / ky + lat0],
  };
}
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
function projGeom(g, P) {
  return { type: g.type, coordinates: g.type === 'Polygon' ? g.coordinates.map((r) => r.map(P.f)) : g.coordinates.map((p) => p.map((r) => r.map(P.f))) };
}
function bboxOf(rings) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const r of rings) for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}
const allRings = (pg) => polysOf(pg).flat();
function ptSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return Math.sqrt(x * x + y * y);
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
/** Min distance between two projected polygon geometries (0 if they overlap/touch). */
function polyDist(A, B, cutoff = Infinity) {
  const ra = allRings(A), rb = allRings(B);
  if (pointInGeom(ra[0][0], B) || pointInGeom(rb[0][0], A)) return 0;
  let best = Infinity;
  const pass = (R1, R2) => {
    for (const r1 of R1) for (const p of r1) for (const r2 of R2) for (let i = 0; i < r2.length - 1; i++) {
      const d = ptSeg(p[0], p[1], r2[i][0], r2[i][1], r2[i + 1][0], r2[i + 1][1]);
      if (d < best) { best = d; if (best === 0) return; }
    }
  };
  pass(ra, rb); if (best > 0) pass(rb, ra);
  return best;
}

// ------------------------------------------------------------------ main
export function enrich(ctx) {
  const { parcels, city, loadPages, polygonLayer, ok, log } = ctx;
  const P = makeProj((city.bbox[0] + city.bbox[2]) / 2, (city.bbox[1] + city.bbox[3]) / 2);
  const n = parcels.length;

  // projected geometry + index in metres
  const pg = parcels.map((p) => projGeom(p.g, P));
  const pc = parcels.map((p) => P.f(p.c));
  const pbb = pg.map((g) => bboxOf(allRings(g)));
  const idxM = new Flatbush(n);
  for (const b of pbb) idxM.add(...b);
  idxM.finish();
  const parcelsAtM = (pt) => idxM.search(pt[0], pt[1], pt[0], pt[1]).filter((i) => pointInGeom(pt, pg[i]));

  const out = parcels.map(() => ({ flags: 0, nearestHeavyFt: null, historic: null, hazwaste: null, conservationName: null, wetlandType: null, farmlandType: null }));
  const stats = {};
  const known = {};

  // ---------------- 1. industrial proximity (local zoning; parcel = zone at its centroid)
  const heavyZ = new Set(city.heavyIndustrialZones || []), indZ = new Set(city.industrialZones || []);
  const heavyIdx = [], indIdx = [];
  parcels.forEach((p, i) => { if (heavyZ.has(p.zoneLocal)) heavyIdx.push(i); if (indZ.has(p.zoneLocal)) indIdx.push(i); });
  const zoningOk = ok('zoning');
  known.heavy_industry_1200 = zoningOk && heavyZ.size > 0;
  known.adj_industrial = zoningOk && indZ.size > 0;
  const mkIdx = (list) => { if (!list.length) return null; const ix = new Flatbush(list.length); for (const i of list) ix.add(...pbb[i]); ix.finish(); return ix; };
  const hIx = mkIdx(heavyIdx), iIx = mkIdx(indIdx);
  if (known.heavy_industry_1200 && hIx) {
    for (let i = 0; i < n; i++) {
      const [a, b, c, d] = pbb[i];
      if (heavyZ.has(parcels[i].zoneLocal)) { out[i].flags |= ENRICH_FLAGS.heavy_industry_1200; continue; }
      for (const k of hIx.search(a - HEAVY_M, b - HEAVY_M, c + HEAVY_M, d + HEAVY_M)) {
        if (polyDist(pg[i], pg[heavyIdx[k]]) <= HEAVY_M) { out[i].flags |= ENRICH_FLAGS.heavy_industry_1200; break; }
      }
    }
  }
  if (known.adj_industrial && iIx) {
    for (let i = 0; i < n; i++) {
      const [a, b, c, d] = pbb[i];
      for (const k of iIx.search(a - ADJ_M, b - ADJ_M, c + ADJ_M, d + ADJ_M)) {
        const j = indIdx[k];
        if (j === i || (parcels[j].apnN && parcels[j].apnN === parcels[i].apnN)) continue;
        if (polyDist(pg[i], pg[j]) <= ADJ_M) { out[i].flags |= ENRICH_FLAGS.adj_industrial; break; }
      }
    }
  }
  /** nearest M2 parcel distance in feet (sites only; computed lazily). */
  const nearestHeavyFt = (i) => {
    if (!known.heavy_industry_1200 || !hIx) return null;
    if (heavyZ.has(parcels[i].zoneLocal)) return 0;
    const [a, b, c, d] = pbb[i];
    const cx = (a + c) / 2, cy = (b + d) / 2;
    let best = Infinity;
    for (const k of hIx.neighbors(cx, cy, 12)) best = Math.min(best, polyDist(pg[i], pg[heavyIdx[k]]));
    return Number.isFinite(best) ? Math.round(best / FT) : null;
  };
  stats.industry = { heavyParcels: heavyIdx.length, industrialParcels: indIdx.length };

  // ---------------- 2. point-in-polygon layers on the centroid
  const pipLayer = (id, bit, attrFn) => {
    if (!ok(id)) return { loaded: false, hits: 0 };
    const layer = polygonLayer(loadPages(id));
    let hits = 0;
    parcels.forEach((p, i) => {
      const a = layer.lookup(p.c);
      if (a.length) { hits++; if (bit) out[i].flags |= bit; attrFn && attrFn(out[i], a); }
    });
    return { loaded: true, hits, features: layer.size };
  };
  const fault = pipLayer('ap_fault', ENRICH_FLAGS.fault_zone);
  known.fault_zone = fault.loaded;

  const wet = pipLayer('nwi', ENRICH_FLAGS.wetland, (o, a) => { o.wetlandType = a[0].WETLAND_TYPE || null; });
  known.wetland = wet.loaded;

  // farmland: FMMP Prime (P) or Statewide Importance (S) only
  let farmHits = 0;
  if (ok('fmmp')) {
    const layer = polygonLayer(loadPages('fmmp').filter((f) => ['P', 'S'].includes(f.attributes.polygon_ty)));
    parcels.forEach((p, i) => { const a = layer.lookup(p.c); if (a.length) { farmHits++; out[i].flags |= ENRICH_FLAGS.farmland; out[i].farmlandType = a[0].polygon_ty; } });
  }
  known.farmland = ok('fmmp');

  // conservation: CPAD holding or CCED easement
  let consHits = 0;
  const cpadL = ok('cpad') ? polygonLayer(loadPages('cpad')) : null;
  const ccedL = ok('cced') ? polygonLayer(loadPages('cced')) : null;
  parcels.forEach((p, i) => {
    const ce = ccedL ? ccedL.lookup(p.c) : [];
    const cp = cpadL ? cpadL.lookup(p.c) : [];
    if (ce.length || cp.length) {
      consHits++;
      out[i].flags |= ENRICH_FLAGS.conservation;
      out[i].conservationName = ce.length ? `${ce[0].sitename || 'Conservation easement'} (CCED easement)` : `${cp[0].UNIT_NAME || cp[0].SITE_NAME || 'Protected area'} (CPAD, ${cp[0].AGNCY_NAME || 'agency unknown'})`;
    }
  });
  known.conservation = ok('cpad') && ok('cced');

  // ---------------- 3. historic
  const histOkAny = ok('historic_props') || ok('historic_districts') || ok('nrhp_points') || ok('nrhp_polys');
  known.historic = histOkAny;
  const byApn = new Map();
  parcels.forEach((p, i) => { if (p.apnN) { if (!byApn.has(p.apnN)) byApn.set(p.apnN, []); byApn.get(p.apnN).push(i); } });
  const setHist = (i, h) => { if (!out[i].historic) out[i].historic = h; out[i].flags |= ENRICH_FLAGS.historic; };
  const hs = { register: 0, registerByPoint: 0, nrhpPoint: 0, nrhpPoly: 0, district: 0 };
  if (ok('historic_props')) {
    for (const f of loadPages('historic_props')) {
      const a = f.attributes;
      const h = { name: a.HISTORIC_NAME || a.ADDRESS || null, source: `${city.name} Register of Historical Properties (${a.CATEGORY === '*' ? 'uncategorized' : a.CATEGORY})` };
      let hits = byApn.get(normApn(a.APN)) || [];
      if (!hits.length && f.geometry && f.geometry.x != null) { hits = parcelsAtM(P.f([f.geometry.x, f.geometry.y])); if (hits.length) hs.registerByPoint++; }
      if (hits.length) hs.register++;
      hits.forEach((i) => setHist(i, h));
    }
  }
  if (ok('nrhp_points')) {
    for (const f of loadPages('nrhp_points')) {
      if (!f.geometry || f.geometry.x == null) continue;
      const hits = parcelsAtM(P.f([f.geometry.x, f.geometry.y]));
      if (hits.length) hs.nrhpPoint++;
      hits.forEach((i) => setHist(i, { name: f.attributes.RESNAME || null, source: `National Register of Historic Places (${f.attributes.NRIS_Refnum})` }));
    }
  }
  const distLayer = (id, label, nameField) => {
    if (!ok(id)) return;
    const layer = polygonLayer(loadPages(id));
    parcels.forEach((p, i) => { const a = layer.lookup(p.c); if (a.length) { hs[label]++; setHist(i, { name: a[0][nameField] || null, source: label === 'nrhpPoly' ? `National Register historic district (${a[0].NRIS_Refnum})` : `${city.name} historic district` }); } });
  };
  distLayer('nrhp_polys', 'nrhpPoly', 'RESNAME');
  distLayer('historic_districts', 'district', 'DISTRICTNAME');
  stats.historic = hs;

  // ---------------- 4. hazardous waste (EnviroStor, active statuses) — point in parcel or within 50 ft
  const ACTIVE = /^(active|backlog|inactive - needs evaluation|inactive - action required|certified o&m)/i;
  let hazSites = 0, hazActive = 0, hazMatched = 0;
  known.hazwaste = ok('envirostor');
  if (ok('envirostor')) {
    for (const f of loadPages('envirostor')) {
      hazSites++;
      const a = f.attributes;
      if (!ACTIVE.test(a.status || '')) continue;
      hazActive++;
      const x = f.geometry?.x ?? a.longitude, y = f.geometry?.y ?? a.latitude;
      if (x == null || y == null) continue;
      const pt = P.f([x, y]);
      const cands = idxM.search(pt[0] - HAZ_M, pt[1] - HAZ_M, pt[0] + HAZ_M, pt[1] + HAZ_M);
      const hits = cands.filter((i) => pointInGeom(pt, pg[i]) || allRings(pg[i]).some((r) => r.some((v, k) => k < r.length - 1 && ptSeg(pt[0], pt[1], v[0], v[1], r[k + 1][0], r[k + 1][1]) <= HAZ_M)));
      if (hits.length) hazMatched++;
      for (const i of hits) {
        if (!out[i].hazwaste) out[i].hazwaste = { name: a.project_name || null, id: a.envirostor_id || null, status: a.status || null, source: `DTSC EnviroStor (${a.site_type || 'site'})` };
        out[i].flags |= ENRICH_FLAGS.hazwaste;
      }
    }
  }
  stats.hazwaste = { sitesInBbox: hazSites, activeStatus: hazActive, matchedToParcel: hazMatched };

  // ---------------- 5. freeway within 500 ft (SHN lines, segment index)
  known.freeway_500 = ok('shn');
  let shnSegs = 0;
  if (ok('shn')) {
    const segs = [];
    for (const f of loadPages('shn')) for (const path of f.geometry?.paths || []) {
      const pp = path.map(P.f);
      for (let k = 0; k < pp.length - 1; k++) segs.push([pp[k], pp[k + 1]]);
    }
    shnSegs = segs.length;
    if (segs.length) {
      const sIx = new Flatbush(segs.length);
      for (const [a, b] of segs) sIx.add(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
      sIx.finish();
      for (let i = 0; i < n; i++) {
        const [a, b, c, d] = pbb[i];
        const cand = sIx.search(a - FWY_M, b - FWY_M, c + FWY_M, d + FWY_M);
        if (!cand.length) continue;
        const rings = allRings(pg[i]);
        let hit = false;
        for (const s of cand) {
          const [A, B] = segs[s];
          if (pointInGeom(A, pg[i])) { hit = true; break; }
          for (const r of rings) {
            for (let k = 0; k < r.length - 1 && !hit; k++) {
              if (ptSeg(r[k][0], r[k][1], A[0], A[1], B[0], B[1]) <= FWY_M || ptSeg(A[0], A[1], r[k][0], r[k][1], r[k + 1][0], r[k + 1][1]) <= FWY_M || segsCross(A, B, r[k], r[k + 1])) hit = true;
            }
            if (hit) break;
          }
          if (hit) break;
        }
        if (hit) out[i].flags |= ENRICH_FLAGS.freeway_500;
      }
    }
  }
  stats.freeway = { segments: shnSegs };

  // ---------------- 6. urban perimeter (sites only; computed on demand)
  const NONURBAN_LU = (c) => /^(19|2|3|4|18)/.test(c) || c === '1437'; // vacant, agriculture, water, open space, flood channels
  const URBAN_CATS = new Set(['single_family', 'multi_family', 'mixed_use', 'commercial', 'industrial', 'public']);
  const STEPS = [1, 2, 4, 7, 10, 15, 20, 25, 30, 40, 50, 60];
  function classify(j) {
    const q = parcels[j];
    if (q.luCode) return NONURBAN_LU(q.luCode) ? 'non' : 'urban';
    if (q.zoneCat === 'open_space') return 'non';
    if (URBAN_CATS.has(q.zoneCat)) return 'urban';
    return 'unk';
  }
  const landuseOk = ok('scag_landuse');
  function urbanPerimeter(i) {
    if (!landuseOk) return null;
    const self = parcels[i];
    const rings = polysOf(pg[i]).map((p) => p[0]); // outer rings
    let perim = 0;
    for (const r of rings) for (let k = 0; k < r.length - 1; k++) perim += Math.hypot(r[k + 1][0] - r[k][0], r[k + 1][1] - r[k][1]);
    const step = Math.max(5, perim / 400);
    let urban = 0, non = 0, unk = 0, gap = 0, total = 0;
    for (const r of rings) {
      let acc = 0; // distance into the current segment of the next sample
      for (let k = 0; k < r.length - 1; k++) {
        const [ax, ay] = r[k], [bx, by] = r[k + 1];
        const L = Math.hypot(bx - ax, by - ay);
        if (L === 0) continue;
        let first = true;
        const ux = (bx - ax) / L, uy = (by - ay) / L;
        let nx = -uy, ny = ux; // left normal; flip if it points inside
        let t = acc;
        for (; t < L; t += step) {
          const px = ax + ux * t, py = ay + uy * t;
          if (first) { // decide outward side once per segment
            first = false;
            const tx = px + nx * 0.5 + ux * Math.min(0.5, L / 2), ty = py + ny * 0.5 + uy * Math.min(0.5, L / 2);
            if (pointInGeom([tx, ty], pg[i])) { nx = -nx; ny = -ny; }
          }
          total++;
          let found = null;
          for (const d of STEPS) {
            const q = [px + nx * d, py + ny * d];
            if (pointInGeom(q, pg[i])) continue;
            const hits = parcelsAtM(q).filter((j) => j !== i && !(self.apnN && parcels[j].apnN === self.apnN));
            if (hits.length) { found = hits[0]; break; }
          }
          if (found === null) gap++;
          else { const c = classify(found); if (c === 'urban') urban++; else if (c === 'non') non++; else unk++; }
        }
        acc = t - L;
      }
    }
    const classified = urban + non;
    if (!total || classified < 0.5 * total) return { pct: null, total, urban, non, unk, gap };
    return { pct: Math.round((100 * urban) / classified), total, urban, non, unk, gap };
  }

  log(`enrich: heavy-industry parcels ${heavyIdx.length}, industrial ${indIdx.length}; fault hits ${fault.hits}; wetland ${wet.hits}; farmland ${farmHits}; conservation ${consHits}; historic`, hs, `hazwaste`, stats.hazwaste, `SHN segments ${shnSegs}`);
  return { out, known, stats, nearestHeavyFt, urbanPerimeter };
}
