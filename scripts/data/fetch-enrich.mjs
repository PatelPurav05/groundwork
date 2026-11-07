// Enrichment layers (fault zones, historic, contamination, wetlands, farmland, conservation, freeways).
// Cached under data/raw/<city>/<source>/. Run: node scripts/data/fetch-enrich.mjs [city]
import { arcgisQueryAll, envelopeParams, step, writeMeta, readMeta, isMain, CHECKED } from './lib.mjs';
import { SOURCES } from './sources.mjs';
import { getCity } from './cities.mjs';

const S = SOURCES;

export async function fetchEnrich(city) {
  const P = (id) => `${city.slug}/${id}`;
  const env = () => envelopeParams(city.bbox);
  // padded bbox (~0.003° ≈ 300 m) so freeways just outside the city line still count for the 500 ft test
  const pad = 0.003;
  const envPad = () => envelopeParams([city.bbox[0] - pad, city.bbox[1] - pad, city.bbox[2] + pad, city.bbox[3] + pad]);

  await step(P('ap_fault'), { ...S.ap_fault, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('ap_fault'), S.ap_fault.url, { ...env(), outFields: 'OBJECTID,QUAD_NAME,ZN_RELEASED', maxAllowableOffset: 0.00001 }, { pageSize: 2000 });
    return { records: f.length };
  });

  if (city.historic) {
    await step(P('historic_props'), { name: `${city.name} historic properties (Register / survey points)`, url: city.historic.properties }, async () => {
      const f = await arcgisQueryAll(P('historic_props'), city.historic.properties, { outFields: 'OBJECTID,ID_NUM,CATEGORY,ADDRESS,HISTORIC_NAME,STATUS,APN' }, { pageSize: 1000 });
      return { records: f.length };
    });
    await step(P('historic_districts'), { name: `${city.name} historic districts`, url: city.historic.districts }, async () => {
      const f = await arcgisQueryAll(P('historic_districts'), city.historic.districts, { outFields: 'OBJECTID,DISTRICTNAME' }, { pageSize: 1000 });
      return { records: f.length };
    });
  }

  await step(P('nrhp_points'), { ...S.nrhp_points, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('nrhp_points'), S.nrhp_points.url, { ...env(), outFields: 'OBJECTID,NRIS_Refnum,RESNAME,ResType,Address,City,CertDate,STATUS' });
    return { records: f.length };
  });
  await step(P('nrhp_polys'), { ...S.nrhp_polys, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('nrhp_polys'), S.nrhp_polys.url, { ...env(), outFields: 'OBJECTID,NRIS_Refnum,RESNAME,ResType,Address,City,CertDate,STATUS' });
    return { records: f.length };
  });

  // Staff names (supervisor, project manager) are deliberately not requested.
  await step(P('envirostor'), { ...S.envirostor, note: 'Envelope query on the city bbox (padded 300 m).' }, async () => {
    const f = await arcgisQueryAll(P('envirostor'), S.envirostor.url, {
      ...envPad(), outFields: 'OBJECTID,project_name,address,city,site_type,envirostor_id,status,status_date,special_program,latitude,longitude',
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('nwi'), { ...S.nwi, note: 'Envelope query on the city bbox; geometry generalized to ~1 m.' }, async () => {
    const f = await arcgisQueryAll(P('nwi'), S.nwi.url, { ...env(), outFields: 'OBJECTID,ATTRIBUTE,WETLAND_TYPE,ACRES', maxAllowableOffset: 0.00001 }, { pageSize: 500 });
    return { records: f.length };
  });

  await step(P('fmmp'), { ...S.fmmp, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('fmmp'), S.fmmp.url, { ...env(), outFields: 'OBJECTID,polygon_ty,polygon_ac,upd_year', maxAllowableOffset: 0.00001 }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('cpad'), { ...S.cpad, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('cpad'), S.cpad.url, {
      ...env(), outFields: 'OBJECTID,HOLDING_ID,UNIT_NAME,SITE_NAME,AGNCY_NAME,ACCESS_TYP,GAP1_acres,GAP2_acres,GAP3_acres,GAP4_acres', maxAllowableOffset: 0.00001,
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('cced'), { ...S.cced, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('cced'), S.cced.url, { ...env(), outFields: 'OBJECTID,sitename,esmthldr,e_type', maxAllowableOffset: 0.00001 }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('shn'), { ...S.shn, note: 'Envelope query on the city bbox padded ~300 m.' }, async () => {
    const f = await arcgisQueryAll(P('shn'), S.shn.url, { ...envPad(), outFields: 'OBJECTID,RouteId,RouteNum,Alignment', maxAllowableOffset: 0.00001 }, { pageSize: 2000 });
    return { records: f.length };
  });

  // Sources searched for but not found as a usable public service: recorded as failed, nothing fetched.
  for (const [id, info] of Object.entries({
    geotracker: {
      name: 'SWRCB GeoTracker cleanup sites',
      url: 'https://geotracker.waterboards.ca.gov/',
      note: 'No official SWRCB ArcGIS REST layer of GeoTracker cleanup sites was found (searched gispublic.waterboards.ca.gov/portalserver Geotracker folder and ArcGIS Online). Third-party copies were not used. Only the DTSC EnviroStor half of the hazardous-waste check is answered.',
    },
    ca_register: {
      name: 'California Register of Historical Resources (OHP)',
      url: 'https://ohp.parks.ca.gov/',
      note: 'OHP does not publish the California Register / Historic Resources Inventory as a public GIS service; not checked. National Register (NPS) and the city register are used instead.',
    },
  })) {
    const m = readMeta(P(id));
    if (!m) writeMeta(P(id), { ...info, status: 'failed', records: 0, checked: CHECKED });
  }
}

if (isMain(import.meta.url)) await fetchEnrich(getCity(process.argv[2]));
