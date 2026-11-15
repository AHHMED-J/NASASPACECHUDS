// Constantes FIJAS del modelo (no se exponen como controles). Cada una declara su origen:
//   'fuente'   = valor tomado de una publicación/estándar (con enlace)
//   'modelo'   = parte de un modelo físico/empírico publicado
//   'supuesto' = decisión nuestra, no verificada: se marca así en el panel de datos
export const CONST = {
  MAX_SLOPE_DEG: 20, // pendiente máxima caminable
  WALK_KMH: 2.7, // velocidad de marcha para caminatas largas
  MAX_EXCURSION_KM: 10, // alejamiento máximo de la base (planificación)
  DOSE_LIMIT_MSV: 600, // límite de dosis efectiva de carrera
  SUIT_EXT_K: [93, 378], // rango térmico externo de diseño del traje xEMU
  BASE: { name: 'Bradbury Landing (Curiosity landing site)', lat: -4.5895, lon: 137.4417 },
  ANTENNA_H_M: 2, // altura de antena (base y astronauta)
  MARS_OBLIQUITY_DEG: 25.19,
  CELL_M: 200, // DEM del cráter completo; la zona de Curiosity también existe a 50 m (DEM de 1 m promediado)
}

export const FIXED = [
  { id: 'slope', label: "Maximum walking slope", value: `${CONST.MAX_SLOPE_DEG}°`, kind: 'fuente',
    source: "NASA lunar EVA operations concept (Artemis/xEMU): walking on slopes up to 20 degrees; Apollo 15 reached approximately 17 degrees.",
    url: 'https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf',
    caveat: "Lunar value (1/6 g). No Mars-specific limit is established here." },
  { id: 'speed', label: "Walking speed", value: `${CONST.WALK_KMH} km/h`, kind: 'fuente',
    source: "NASA planning value for walkbacks longer than one hour, based on Apollo experience.",
    url: 'https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.gaits.html',
    caveat: "Based on lunar experience, not measurements from a crewed Mars mission." },
  { id: 'excursion', label: "Maximum distance from base", value: `${CONST.MAX_EXCURSION_KM} km`, kind: 'fuente',
    source: "NASA planning assumption based on Apollo experience and walkback studies.",
    url: 'https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf',
    caveat: "Warning only; does not block routes." },
  { id: 'dose', label: "Career dose limit", value: `${CONST.DOSE_LIMIT_MSV} mSv`, kind: 'fuente',
    source: "NASA-STD-3001 career effective-dose reference: 600 mSv.",
    url: 'https://www.nationalacademies.org/news/nasa-should-update-astronaut-radiation-exposure-limits-improve-communication-of-cancer-risks',
    caveat: "The original source discusses a proposed Mars exception of approximately 900 mSv; this is not an EVA dose budget." },
  { id: 'suit', label: "External suit temperature range", value: `${CONST.SUIT_EXT_K[0]} – ${CONST.SUIT_EXT_K[1]} K`, kind: 'fuente',
    source: "Lunar xEMU design reference: 93 to 378 K.",
    url: 'https://ntrs.nasa.gov/citations/20240005277',
    caveat: "Lunar reference; no published Mars suit thermal limits were identified by the team." },
  { id: 'base', label: "Base location", value: `${CONST.BASE.lat}°, ${CONST.BASE.lon}°`, kind: 'fuente',
    source: "Curiosity landing site (Bradbury Landing).", url: null, caveat: "Coordinates are a reference; the base is hypothetical." },
  { id: 'obliq', label: "Mars obliquity", value: `${CONST.MARS_OBLIQUITY_DEG}°`, kind: 'fuente',
    source: "Astronomical reference value used for solar position.", url: null, caveat: "" },
  { id: 'antenna', label: "Antenna height", value: `${CONST.ANTENNA_H_M} m`, kind: 'supuesto',
    source: "Team assumption for base and astronaut.", url: null, caveat: "Not validated against real equipment." },
  { id: 'cell', label: "Map cell size", value: `${CONST.CELL_M} m`, kind: 'supuesto',
    source: "Resolution of the global USGS HRSC/MOLA terrain grid covering Gale.", url: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m', caveat: "Slopes and roughness are smoothed; short steep features can be missed." },
]
