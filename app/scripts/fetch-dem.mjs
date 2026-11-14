// Recorta Gale del DEM global MOLA/HRSC (USGS, 200 m/px, enteros de 16 bits en METROS)
// usando peticiones parciales (range requests): no descarga los ~11 GB del archivo.
// Uso: npm run fetch-dem
// Fuente: https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m
// Licencia: MOLA (CC0) + HRSC (CC BY-SA 3.0 IGO). Citar a los autores.
import { fromUrl } from 'geotiff'
import { writeFileSync, mkdirSync } from 'node:fs'

const URL_DEM = 'https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif'
const BBOX = [136.5, -6.5, 139.0, -4.0] // lonMin, latMin, lonMax, latMax
const SIZE = 200

const tiff = await fromUrl(URL_DEM)
const img = await tiff.getImage()
const [west, , , north] = img.getBoundingBox()
const [resX, resY] = img.getResolution() // resY es negativo
const nodata = img.getGDALNoData()

const x0 = Math.floor((BBOX[0] - west) / resX)
const x1 = Math.ceil((BBOX[2] - west) / resX)
const y0 = Math.floor((north - BBOX[3]) / -resY)
const y1 = Math.ceil((north - BBOX[1]) / -resY)
console.log(`ventana nativa ${x1 - x0}x${y1 - y0} px -> remuestreo a ${SIZE}x${SIZE}`)

const [band] = await tiff.readRasters({
  window: [x0, y0, x1, y1],
  width: SIZE,
  height: SIZE,
  resampleMethod: 'bilinear',
  interleave: false,
})
const elev = Array.from(band, (v) => Math.round(v))
if (elev.some((v) => v === nodata || !Number.isFinite(v))) throw new Error('Hay celdas sin dato (nodata) en el recorte')

const elevMin = Math.min(...elev), elevMax = Math.max(...elev)
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../public/data/gale-dem.json', import.meta.url),
  JSON.stringify({
    bbox: BBOX, size: SIZE, elevMin, elevMax, elev,
    source: 'USGS MOLA/HRSC blended DEM 200 m (v2), metros sobre el datum de Marte',
  }),
)
console.log(`OK gale-dem.json ${SIZE}x${SIZE}  elevación real: ${elevMin} .. ${elevMax} m`)
