// Crea los dos mapas locales del cráter Gale como GeoTIFF, leyendo SOLO la ventana del cráter de cada archivo global
// (peticiones HTTP parciales: no se descargan los archivos completos).
//   public/data/gale_elevacion.tif  DEM USGS "Mars MGS MOLA - MEX HRSC Blended DEM Global 200m" v2 (Float32, m; -32768 = sin dato)
//     (el original es Int16; se guarda en Float32 porque writeArrayBuffer de geotiff.js no escribe Int16)
//   public/data/gale_suelo.tif      Inercia térmica THEMIS cuantitativa (Fergason et al. 2006), 100 m (UInt16, J m⁻² K⁻¹ s⁻½; 0 = sin dato)
// Ambos en grados (lon/lat planetocéntricas, esfera de Marte R = 3 396 190 m) y con el mismo recuadro.
// Uso: npm run fetch-mapas
// Fuentes:
//   https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m
//   https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic
import { fromUrl, writeArrayBuffer } from 'geotiff'
import { writeFileSync, mkdirSync } from 'node:fs'

const URL_DEM = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif'
// Recuadro THEMIS 30S120E (0° a 30°S, 120°E a 180°E): contiene todo Gale. Proyección cilíndrica simple en metros.
const URL_TI = 'https://asc-astropedia.s3.us-west-2.amazonaws.com/Mars/Odyssey/THEMIS-Global-Thermal-Inertia-Mosaic/Quantitative-32-Bit/ancillary/THEMIS_TI_Mosaic_Quant_30S120E_100mpp.tif'
const BOX = { lonMin: 136.4, lonMax: 139.2, latMax: -4.0, latMin: -6.8 } // todo el cráter + borde
const R = 3396190
const M_PER_DEG = (2 * Math.PI * R) / 360
const OUT = new URL('../public/data/', import.meta.url)

// GeoTIFF en grados con la esfera de Marte (código 32767 = sistema definido por el usuario)
function tif(values, w, h, lon0, lat0, dLon, dLat, nodata, description) {
  return Buffer.from(writeArrayBuffer(values, {
    width: w, height: h,
    ModelPixelScale: [dLon, dLat, 0],
    ModelTiepoint: [0, 0, 0, lon0, lat0, 0],
    GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1, GeographicTypeGeoKey: 32767,
    GeogCitationGeoKey: 'Mars 2000, esfera R = 3396190 m (planetocéntrica, longitud este)',
    GDAL_NODATA: String(nodata),
    ImageDescription: description,
  }))
}

mkdirSync(OUT, { recursive: true })

// ---- 1) Elevación: ventana del DEM global (ya está en grados) ----
const dem = await fromUrl(URL_DEM)
const di = await dem.getImage()
const [res] = di.getResolution() // grados por píxel
const [ox, oy] = di.getOrigin()
const demNodata = di.getGDALNoData()
const x0 = Math.round((BOX.lonMin - ox) / res), x1 = Math.round((BOX.lonMax - ox) / res)
const y0 = Math.round((oy - BOX.latMax) / res), y1 = Math.round((oy - BOX.latMin) / res)
const w = x1 - x0, h = y1 - y0
const lonMin = ox + x0 * res, latMax = oy - y0 * res, lonMax = ox + x1 * res, latMin = oy - y1 * res
const [raw] = await dem.readRasters({ window: [x0, y0, x1, y1], samples: [0] })
const elev = new Float32Array(w * h)
let min = Infinity, max = -Infinity, valid = 0
for (let i = 0; i < elev.length; i++) {
  const v = raw[i]
  if (v === demNodata || !Number.isFinite(v)) { elev[i] = -32768; continue }
  elev[i] = v; valid++
  if (v < min) min = v
  if (v > max) max = v
}
writeFileSync(new URL('gale_elevacion.tif', OUT), tif(elev, w, h, lonMin, latMax, res, res, -32768,
  'USGS Mars MGS MOLA - MEX HRSC Blended DEM Global 200m v2, ventana del cráter Gale'))
console.log(`elevación ${w}x${h} (~${Math.round(res * M_PER_DEG)} m), ${min}..${max} m, con dato ${(100 * valid / (w * h)).toFixed(1)}%`)

// ---- 2) Suelo: inercia térmica THEMIS, mismo recuadro, resolución nativa (100 m) ----
const ti = await fromUrl(URL_TI)
const tii = await ti.getImage()
const [tox, toy] = tii.getOrigin() // metros
const [tres] = tii.getResolution() // metros por píxel
const tiNodata = tii.getGDALNoData()
const tx0 = Math.floor((lonMin * M_PER_DEG - tox) / tres), tx1 = Math.ceil((lonMax * M_PER_DEG - tox) / tres)
const ty0 = Math.floor((toy - latMax * M_PER_DEG) / tres), ty1 = Math.ceil((toy - latMin * M_PER_DEG) / tres)
const tw = tx1 - tx0, th = ty1 - ty0
const [traw] = await ti.readRasters({ window: [tx0, ty0, tx1, ty1], samples: [0] })
const soil = new Uint16Array(tw * th)
let tmin = Infinity, tmax = -Infinity, tvalid = 0
for (let i = 0; i < soil.length; i++) {
  const v = traw[i]
  if (v === tiNodata || !(v > 0) || !Number.isFinite(v)) continue // 0 = sin dato
  soil[i] = Math.min(65535, Math.round(v)); tvalid++ // redondeo a entero: muy por debajo del error del producto (~20 %)
  if (v < tmin) tmin = v
  if (v > tmax) tmax = v
}
const tDeg = tres / M_PER_DEG
writeFileSync(new URL('gale_suelo.tif', OUT), tif(soil, tw, th, (tox + tx0 * tres) / M_PER_DEG, (toy - ty0 * tres) / M_PER_DEG, tDeg, tDeg, 0,
  'THEMIS Global Thermal Inertia Mosaic (cuantitativo, Fergason et al. 2006), recuadro 30S120E, ventana del cráter Gale'))
console.log(`suelo ${tw}x${th} (~${tres} m), inercia ${Math.round(tmin)}..${Math.round(tmax)}, con dato ${(100 * tvalid / (tw * th)).toFixed(1)}%`)
