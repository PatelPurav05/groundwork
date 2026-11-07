// Shared helpers for the Groundwork data pipeline.
// - Every raw response is cached under data/raw/<source>/ and never re-fetched if present.
// - Requests are sequential with a small delay; retries with exponential backoff.
// - A source that keeps failing is marked failed (data/raw/<source>/_meta.json) and the run continues.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const RAW = path.join(ROOT, 'data', 'raw');
export const OUT = path.join(ROOT, 'public', 'data');
export const CHECKED = '2026-11-07';

// Santa Ana extent (from the assessor layer, returnExtentOnly, outSR=4326), padded slightly.
export const SA_BBOX = [-117.948, 33.690, -117.828, 33.785];

const DELAY_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

export function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

export function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeJSON(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data));
}

/** Fetch text with retry/backoff. Throws after `tries` failures. */
export async function fetchText(url, { tries = 4, timeoutMs = 120000, init = {} } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const wait = lastRequest + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetch(url, {
        ...init,
        signal: ctl.signal,
        headers: { 'User-Agent': 'Groundwork-hackathon-pipeline/0.1 (UCI Claude Impact Lab; offline, cached)', ...(init.headers || {}) },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      const back = 1000 * 2 ** i;
      console.warn(`  ! ${e.message} (attempt ${i + 1}/${tries}) ${url.slice(0, 140)}; retrying in ${back}ms`);
      if (i < tries - 1) await sleep(back);
    }
  }
  throw lastErr;
}

/** Cached fetch: returns parsed JSON (or text if raw=true). */
export async function cached(source, key, url, { raw = false, init, tries, timeoutMs, validate } = {}) {
  const dir = path.join(RAW, source);
  ensureDir(dir);
  const file = path.join(dir, key);
  if (fs.existsSync(file)) {
    const txt = fs.readFileSync(file, 'utf8');
    return raw ? txt : JSON.parse(txt);
  }
  const txt = await fetchText(url, { init, tries, timeoutMs });
  let parsed = txt;
  if (!raw) {
    parsed = JSON.parse(txt);
    if (parsed && parsed.error) throw new Error(`ArcGIS error: ${JSON.stringify(parsed.error)}`);
  }
  if (validate) validate(parsed);
  fs.writeFileSync(file, txt); // only cache successful responses
  return parsed;
}

export function metaPath(source) {
  return path.join(RAW, source, '_meta.json');
}

export function writeMeta(source, meta) {
  writeJSON(metaPath(source), { checked: CHECKED, ...meta });
}

export function readMeta(source) {
  const p = metaPath(source);
  return fs.existsSync(p) ? readJSON(p) : null;
}

const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/**
 * Page through an ArcGIS REST layer query with resultOffset/resultRecordCount.
 * Returns all features (esri JSON). Pages are cached as page-0000.json etc.
 * `params` are extra query params (where, geometry, ...).
 */
export async function arcgisQueryAll(source, layerUrl, params, { pageSize = 1000, maxPages = 400 } = {}) {
  const base = {
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: 4326,
    geometryPrecision: 6,
    orderByFields: 'OBJECTID',
    f: 'json',
    ...params,
  };
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    const q = { ...base, resultOffset: page * pageSize, resultRecordCount: pageSize };
    const url = `${layerUrl}/query?${qs(q)}`;
    const key = `page-${String(page).padStart(4, '0')}.json`;
    const data = await cached(source, key, url);
    const feats = data.features || [];
    all.push(...feats);
    if (page % 10 === 0) console.log(`  ${source}: page ${page}, ${all.length} features`);
    if (feats.length < pageSize && !data.exceededTransferLimit) break;
    if (feats.length === 0) break;
  }
  return all;
}

export function envelopeParams(bbox = SA_BBOX) {
  return {
    geometry: bbox.join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: 4326,
    spatialRel: 'esriSpatialRelIntersects',
  };
}

/** Run a fetch step, recording ok/failed meta. Never throws. */
export async function step(source, info, fn) {
  const existing = readMeta(source);
  if (existing && existing.status === 'ok') {
    console.log(`= ${source}: cached (${existing.records} records)`);
    return existing;
  }
  console.log(`> ${source}: fetching ${info.url}`);
  try {
    const res = await fn();
    const meta = { ...info, status: res.status || 'ok', records: res.records, note: res.note ?? info.note };
    writeMeta(source, meta);
    console.log(`  ${source}: ${meta.status}, ${meta.records} records`);
    return meta;
  } catch (e) {
    console.error(`  x ${source} FAILED: ${e.message}`);
    const meta = { ...info, status: 'failed', records: 0, note: `${info.note ? info.note + ' ' : ''}Fetch failed: ${e.message}` };
    writeMeta(source, meta);
    return meta;
  }
}

/** Esri polygon JSON (rings) → GeoJSON Polygon/MultiPolygon geometry using ring orientation. */
export function esriToGeoJSON(geom) {
  if (!geom || !geom.rings || geom.rings.length === 0) return null;
  // Esri: outer rings clockwise, holes counter-clockwise.
  const polys = [];
  for (const ring of geom.rings) {
    if (ring.length < 4) continue;
    const outer = signedArea(ring) < 0 || polys.length === 0;
    if (outer) polys.push([ring]);
    else {
      const host = polys.findLast((p) => pointInRing(ring[0], p[0])) || polys[polys.length - 1];
      host.push(ring);
    }
  }
  if (polys.length === 0) return null;
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}

export function signedArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return s / 2;
}

export function pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygonCoords(pt, polyCoords) {
  if (!pointInRing(pt, polyCoords[0])) return false;
  for (let k = 1; k < polyCoords.length; k++) if (pointInRing(pt, polyCoords[k])) return false;
  return true;
}

export function pointInGeom(pt, g) {
  if (!g) return false;
  if (g.type === 'Polygon') return pointInPolygonCoords(pt, g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.some((c) => pointInPolygonCoords(pt, c));
  return false;
}

export function geomBBox(g) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const [x, y] of p[0]) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export const normApn = (s) => {
  if (s === null || s === undefined) return null;
  const d = String(s).replace(/\D/g, '');
  return d.length ? d : null;
};

import { pathToFileURL } from 'node:url';
export const isMain = (metaUrl) => process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
