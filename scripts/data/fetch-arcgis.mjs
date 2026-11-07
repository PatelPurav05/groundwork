// Fetch every ArcGIS REST layer used by the pipeline into data/raw/<source>/ (cached).
// Run: node scripts/data/fetch-arcgis.mjs
import { arcgisQueryAll, envelopeParams, step, isMain } from './lib.mjs';
import { SOURCES } from './sources.mjs';
import { getCity } from './cities.mjs';

const S = SOURCES;

export async function fetchArcgis(city) {
  const P = (id) => `${city.slug}/${id}`;
  const env = () => envelopeParams(city.bbox);
  // Assessor parcels. MailAddress is deliberately NOT requested (personal info).
  await step(P('parcels'), { name: `${city.name} Assessor Parcels`, url: city.parcels.url }, async () => {
    const f = await arcgisQueryAll(P('parcels'), city.parcels.url, { outFields: city.parcels.outFields }, { pageSize: city.parcels.pageSize });
    return { records: f.length };
  });

  await step(P('zoning'), { name: `${city.name} Zoning`, url: city.zoning.url }, async () => {
    const f = await arcgisQueryAll(P('zoning'), city.zoning.url, { outFields: city.zoning.outFields }, { pageSize: city.zoning.pageSize });
    return { records: f.length };
  });

  const scagWhere = `CITY='${city.scagCity}'`;
  await step(P('scag_zoning'), { ...S.scag_zoning, note: `Filtered ${scagWhere}; attributes only, joined by APN.` }, async () => {
    const f = await arcgisQueryAll(P('scag_zoning'), S.scag_zoning.url, {
      where: scagWhere, returnGeometry: 'false',
      outFields: 'OBJECTID,APN24,CITY,ACRES,SLOPE,ZN24_CITY,ZN24_SCAG,ZN24_CITY_2ND,ZN24_SCAG_2ND,STACK',
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('scag_landuse'), { ...S.scag_landuse, note: `Filtered ${scagWhere}; attributes only, joined by APN.` }, async () => {
    const f = await arcgisQueryAll(P('scag_landuse'), S.scag_landuse.url, {
      where: scagWhere, returnGeometry: 'false',
      outFields: 'OBJECTID,APN24,CITY,LU24,LU24_2ND,STACK',
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('scag_gp'), { ...S.scag_gp, note: `Filtered ${scagWhere}; attributes only, joined by APN.` }, async () => {
    const f = await arcgisQueryAll(P('scag_gp'), S.scag_gp.url, {
      where: scagWhere, returnGeometry: 'false',
      outFields: 'OBJECTID,APN24,CITY,GP24_CITY,GP24_SCAG,DEN_MAX,FAR_MAX,STACK',
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  // HE sites: there is no "SANTA ANA" Jurisdiction value in this layer, so pull everything that
  // intersects the city bbox and join by APN.
  await step(P('scag_he'), S.scag_he, async () => {
    const f = await arcgisQueryAll(P('scag_he'), S.scag_he.url, { ...env() }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('fire'), { ...S.fire, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('fire'), S.fire.url, { ...env(), maxAllowableOffset: 0.00002 });
    return { records: f.length };
  });

  await step(P('fire_calfire'), { ...S.fire_calfire, note: 'Envelope query on the city bbox, layers 0 (SRA), 1 (LRA), 2 (awaiting zoning).' }, async () => {
    let n = 0;
    for (const id of [0, 1, 2]) {
      const f = await arcgisQueryAll(P(`fire_calfire/layer${id}`), `${S.fire_calfire.url}/${id}`, { ...env(), maxAllowableOffset: 0.00002, orderByFields: undefined });
      n += f.length;
    }
    return { records: n };
  });

  await step(P('flood'), { ...S.flood, note: 'Envelope query on the city bbox; geometry generalized to ~1 m.' }, async () => {
    const f = await arcgisQueryAll(P('flood'), S.flood.url, {
      ...env(), outFields: 'OBJECTID,FLD_ZONE,ZONE_SUBTY,SFHA_TF,DFIRM_ID', maxAllowableOffset: 0.00001,
    });
    return { records: f.length };
  });

  await step(P('liquefaction'), { ...S.liquefaction, note: 'Envelope query on the city bbox; geometry generalized to ~2 m.' }, async () => {
    const f = await arcgisQueryAll(P('liquefaction'), S.liquefaction.url, {
      ...env(), outFields: 'OBJECTID,QUAD_NAME,RELEASED', maxAllowableOffset: 0.00002,
    });
    return { records: f.length };
  });

  await step(P('landslide'), { ...S.landslide, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('landslide'), S.landslide.url, {
      ...env(), outFields: 'OBJECTID,QUAD_NAME,RELEASED', maxAllowableOffset: 0.00002,
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('hqta'), { ...S.hqta, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('hqta'), S.hqta.url, {
      ...env(), outFields: 'OBJECTID,agency_primary,hqta_type,hqta_details,route_id', maxAllowableOffset: 0.00001,
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('ces'), { ...S.ces, note: 'Envelope query on the city bbox.' }, async () => {
    const f = await arcgisQueryAll(P('ces'), S.ces.url, {
      ...env(), outFields: 'OBJECTID,tract,ZIP,ApproxLoc,county,CIscore,CIscoreP', maxAllowableOffset: 0.00001,
    }, { pageSize: 2000 });
    return { records: f.length };
  });

  await step(P('footprints'), { ...S.footprints, note: 'Envelope query on the city bbox (includes some neighbours; only footprints whose centroid falls in a parcel of this city are used).' }, async () => {
    const f = await arcgisQueryAll(P('footprints'), S.footprints.url, {
      ...env(), outFields: 'OBJECTID,Shape.STArea(),City',
    }, { pageSize: 1000, maxPages: 200 });
    return { records: f.length };
  });
}

if (isMain(import.meta.url)) {
  await fetchArcgis(getCity(process.argv[2]));
}
