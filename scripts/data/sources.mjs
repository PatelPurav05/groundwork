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
  ap_fault: {
    name: 'CGS Alquist-Priolo Earthquake Fault Zones',
    url: 'https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Alquist_Priolo_Fault_Zones/FeatureServer/0',
  },
  nrhp_points: {
    name: 'National Register of Historic Places (NPS) points',
    url: 'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0',
  },
  nrhp_polys: {
    name: 'National Register of Historic Places (NPS) polygons',
    url: 'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/1',
  },
  envirostor: {
    name: 'DTSC EnviroStor cleanup sites (Public Data Export)',
    url: 'https://services3.arcgis.com/Oy2JTCD10wkoelxS/arcgis/rest/services/Envirostor_Public_Data_Export/FeatureServer/0',
  },
  nwi: {
    name: 'USFWS National Wetlands Inventory',
    url: 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0',
  },
  fmmp: {
    name: 'CA DOC FMMP California Important Farmland 2022',
    url: 'https://gis.conservation.ca.gov/server/rest/services/DLRP/CaliforniaImportantFarmland_2022/FeatureServer/0',
  },
  cpad: {
    name: 'California Protected Areas Database (CPAD) Holdings, current release (GreenInfo Network)',
    url: 'https://services1.arcgis.com/4ZKi1B1zTblbwgWB/arcgis/rest/services/CPAD_Holdings_Current_Release/FeatureServer/0',
  },
  cced: {
    name: 'California Conservation Easement Database (CCED), CNRA',
    url: 'https://gis.cnra.ca.gov/arcgis/rest/services/Boundaries/CCED_AccessType/MapServer/0',
  },
  shn: {
    name: 'Caltrans State Highway Network (SHN Odometer lines)',
    url: 'https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/SHN_Odometer/FeatureServer/0',
  },
};
