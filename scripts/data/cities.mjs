// Per-city source configuration. Build one city with:
//   node scripts/data/build.mjs            (default: santa-ana)
//   node scripts/data/build.mjs anaheim    (only when its config is complete)
//
// Raw cache:  data/raw/<slug>/<source>/...
// Outputs:    public/data/<slug>/{parcels,sites,sources,addresses}.json + public/data/cities.json

// ZoneCategory: single_family | multi_family | mixed_use | commercial | industrial | public | open_space | other
//
// Santa Ana local zoning (ZONECLASS) → category. Built from the distinct ZONECLASS/ZONEDESC values
// actually present in the PBA_ZoningClassifications layer (see README for the counts).
const SANTA_ANA_ZONE_MAP = {
  // Residential
  R1: 'single_family',   // Single-Family Residence
  RE: 'single_family',   // Residential-Estate
  R2: 'multi_family',    // Two-Family Residence
  R3: 'multi_family',    // Multiple-Family Residence
  R4: 'multi_family',    // Suburban Apartment
  // Commercial / office
  C1: 'commercial',      // Community Commercial
  'C1-MD': 'commercial', // Community Commercial - Museum District
  C2: 'commercial',      // General Commercial
  C4: 'commercial',      // Planned Shopping Center
  C5: 'commercial',      // Arterial Commercial
  CSM: 'commercial',     // South Main Street Commercial District
  P: 'commercial',       // Professional (office)
  CR: 'mixed_use',       // Commercial Residential
  // Industrial
  M1: 'industrial',      // Light Industrial
  M2: 'industrial',      // Heavy Industrial
  // Specific plans / overlays (all mixed-use plans in Santa Ana)
  SP1: 'mixed_use',      // Bristol Street Corridor Specific Plan
  SP2: 'mixed_use',      // Harbor Mixed Use Transit Corridor Specific Plan
  SP3: 'mixed_use',      // Midtown Specific Plan
  SP4: 'mixed_use',      // MainPlace Specific Plan
  SP5: 'mixed_use',      // Related Bristol Specific Plan
  SP6: 'mixed_use',      // The Village Specific Plan
  OZ1: 'mixed_use',      // Metro East Overlay Zone (only used when no base zone contains the point)
  // Public / open space / other
  GC: 'public',          // Government Center
  O: 'open_space',       // Open Space Land
  A1: 'other',           // General Agricultural (in Santa Ana mostly flood channels, utility & rail land)
  // SD1..SD98 "Specific Development No. N": intentionally NOT mapped (each district is bespoke);
  // category falls back to SCAG ZN24_SCAG (if not 7777), then SCAG general plan GP24_CITY.
};

// SCAG ZN24_SCAG / GP24_SCAG / LU24 use the SCAG land-use code list (first digits = class).
// Used only as a fallback when the parcel centroid does not fall in a local zoning polygon.
export function scagCodeToCategory(code) {
  if (!code) return null;
  const c = String(code).trim();
  if (/^111/.test(c)) return 'single_family';            // 1110 single-family residential
  if (/^11[2-4]/.test(c)) return 'multi_family';         // 1120 multi-family, 1130 mobile homes, 1140 mixed res
  if (/^115|^1100$/.test(c)) return 'multi_family';
  if (/^12/.test(c)) return 'commercial';                // 1200 commercial & services
  if (/^13/.test(c)) return 'industrial';                // 1300 industrial
  if (/^14/.test(c)) return 'public';                    // 1400 transportation, communications, utilities
  if (/^16/.test(c)) return 'mixed_use';                 // 1600 mixed residential & commercial
  if (/^15/.test(c)) return 'industrial';                // 1500 mixed commercial & industrial
  if (/^18/.test(c)) return 'open_space';                // 1800 open space & recreation
  if (/^19/.test(c)) return 'other';                     // 1900 vacant (land use) / urban vacant
  if (/^2/.test(c)) return 'other';                      // 2000 agriculture
  if (/^3/.test(c)) return 'other';                      // 3000 vacant
  if (/^4/.test(c)) return 'open_space';                 // 4000 water
  if (/^888/.test(c)) return 'other';                    // 888 specific plan (no detail)
  return 'other';
}

export const CITIES = {
  'santa-ana': {
    slug: 'santa-ana',
    name: 'Santa Ana',
    // From the assessor layer's returnExtentOnly (outSR=4326), padded ~0.001°.
    bbox: [-117.948, 33.690, -117.828, 33.785],
    parcels: {
      url: 'https://gis.santa-ana.org/server/rest/services/Public/GIS_AssessorParcels/MapServer/0',
      pageSize: 1000,
      // MailAddress exists on this layer and is deliberately never requested.
      outFields: 'OBJECTID,AssessmentNo,SiteAddress,SiteCityState,SiteZip5,LandVal,ImprovedVal,AssdAmt,LotType,LegalLotID',
      fields: { apn: 'AssessmentNo', address: 'SiteAddress', land: 'LandVal', improvement: 'ImprovedVal', yearBuilt: null },
    },
    zoning: {
      url: 'https://gis.santa-ana.org/server/rest/services/Public/PBA_ZoningClassifications/FeatureServer/0',
      pageSize: 2000,
      outFields: 'OBJECTID,ZONECLASS,ZONEDESC,ZONESUFFIX,ZONEOVERLAY,ZONEUSESUFFIX,SDM',
      codeField: 'ZONECLASS', descField: 'ZONEDESC', overlayField: 'ZONEOVERLAY',
      categoryMap: SANTA_ANA_ZONE_MAP,
    },
    scagCity: 'Santa Ana',          // SCAG LDX layers CITY value
    heJurisdiction: 'SANTA ANA',    // SCAG HE layer Jurisdiction value (not present in the layer as of 2026-11-07)
    slaCity: 'Santa Ana',           // HCD SLA CSV "City" / "Local Agency"
    footprintsCity: 'SANTA ANA',
  },

  // Config stub only; NOT fetched or built. Parcel/zoning layer URLs and field names must be
  // verified before building (Anaheim assessor values come from a different publisher).
  anaheim: {
    slug: 'anaheim',
    name: 'Anaheim',
    bbox: null,
    parcels: null,
    zoning: null,
    scagCity: 'Anaheim',
    heJurisdiction: 'ANAHEIM',
    slaCity: 'Anaheim',
    footprintsCity: 'ANAHEIM',
    incomplete: true,
  },
};

export function getCity(slug = 'santa-ana') {
  const c = CITIES[slug];
  if (!c) throw new Error(`Unknown city "${slug}". Known: ${Object.keys(CITIES).join(', ')}`);
  if (c.incomplete) throw new Error(`City "${slug}" config is incomplete (parcels/zoning layers not set). Fill it in scripts/data/cities.mjs first.`);
  return c;
}
