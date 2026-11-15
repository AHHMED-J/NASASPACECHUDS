// Carga de mapas GeoTIFF LOCALES (public/data/*.tif) con geotiff.js. Sin servicios externos: el navegador
// solo pide el archivo al propio servidor de la app. Los mapas se crean una vez con `npm run fetch-mapas`.
import { fromArrayBuffer } from 'geotiff'

const cache = new Map()

/** Carga un GeoTIFF de una banda en grados (lon/lat). Devuelve la cuadrícula y funciones de consulta:
 *  - pixel(x, y): valor crudo de la celda (columna x, fila y desde el norte); NaN = sin dato o fuera.
 *  - atLonLat(lon, lat): valor de la celda que contiene ese punto.
 *  - meanInBox(lonMin, latMin, lonMax, latMax): promedio de las celdas cuyo centro cae en el recuadro
 *    (si no cae ninguna, el valor del centro del recuadro). Sirve para pasar el mapa a otra cuadrícula. */
export async function loadTif(name) {
  if (cache.has(name)) return cache.get(name)
  const p = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
    if (!res.ok) throw new Error(`Missing data/${name} (run: npm run fetch-mapas)`)
    const tiff = await fromArrayBuffer(await res.arrayBuffer())
    const img = await tiff.getImage()
    const w = img.getWidth(), h = img.getHeight()
    const [lonMin, latMax] = img.getOrigin()
    const [dLon, negDLat] = img.getResolution()
    const dLat = -negDLat
    const nodata = img.getGDALNoData()
    const [raw] = await img.readRasters({ samples: [0] })
    const data = Float32Array.from(raw, (v) => (v === nodata ? NaN : v))
    const bbox = [lonMin, latMax - h * dLat, lonMin + w * dLon, latMax]
    const pixel = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? NaN : data[y * w + x])
    const atLonLat = (lon, lat) => pixel(Math.floor((lon - lonMin) / dLon), Math.floor((latMax - lat) / dLat))
    const meanInBox = (lo0, la0, lo1, la1) => {
      const x0 = Math.ceil((lo0 - lonMin) / dLon - 0.5), x1 = Math.floor((lo1 - lonMin) / dLon - 0.5)
      const y0 = Math.ceil((latMax - la1) / dLat - 0.5), y1 = Math.floor((latMax - la0) / dLat - 0.5)
      let s = 0, n = 0
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = pixel(x, y); if (!Number.isNaN(v)) { s += v; n++ } }
      return n ? s / n : atLonLat((lo0 + lo1) / 2, (la0 + la1) / 2)
    }
    return { name, w, h, bbox, dLon, dLat, data, pixel, atLonLat, meanInBox }
  })()
  cache.set(name, p)
  p.catch(() => cache.delete(name))
  return p
}
