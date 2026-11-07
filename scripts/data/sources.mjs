// Registry of every dataset the pipeline reads. ids are what public/data/sources.json exposes.
export const SOURCES = {
  scag_zoning: {
    name: 'SCAG 2024 Zoning by parcel (Orange County)',
    url: 'https://maps.scag.ca.gov/scaggis/rest/services/LDX/Zoning_poly_OR/MapServer/0',
  },
  scag_landuse: {
    name: 'SCAG 2024 Existing Land Use by parcel (Orange County)',
    url: 'https://maps.scag.ca.gov/scaggis/rest/services/LDX/Existinglanduse_poly_OR/MapServer/0',
  },
  scag_gp: {
    name: 'SCAG 2024 General Plan Land Use by parcel (Orange County)',
    url: 'https://maps.scag.ca.gov/scaggis/rest/services/LDX/GeneralPlan_poly_OR/MapServer/0',
  },
  scag_he: {
    name: 'SCAG Housing Element Sites (6th cycle)',
    url: 'https://maps.scag.ca.gov/scaggis/rest/services/LDX/HousingElementSite_poly_scag/MapServer/0',
  },
  fire: {
    name: 'OC Fire Hazard Severity Zones (LRA)',
    url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Fire_Hazard_Severity_Zones_LRA/MapServer/0',
  },
  fire_calfire: {
    name: 'CAL FIRE Fire Hazard Severity Zones (SRA 2007 / LRA 2011)',
    url: 'https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer',
  },
  flood: {
    name: 'OC Floodplains (FEMA DFIRM)',
    url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Floodplains/MapServer/0',
  },
  liquefaction: {
    name: 'OC Liquefaction Zones (CGS Seismic Hazard Zones)',
    url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Liquefaction/MapServer/0',
  },
  landslide: {
    name: 'CGS Landslide Zones (Seismic Hazard Zones)',
    url: 'https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Landslide_Zones/FeatureServer/0',
  },
  hqta: {
    name: 'Caltrans High Quality Transit Areas',
    url: 'https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHrailroad/CA_HQ_Transit_Areas/FeatureServer/0',
  },
  ces: {
    name: 'CalEnviroScreen 5.0 results (census tracts)',
    url: 'https://services1.arcgis.com/PCHfdHz4GlDNAhBb/arcgis/rest/services/calenviroscreen50results_F_070126_gdb/FeatureServer/2',
  },
  footprints: {
    name: 'OC Building Footprints',
    url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Building_Footprints/MapServer/0',
  },
};
