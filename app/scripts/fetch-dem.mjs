// Descarga un recorte del MOLA (USGS WMS) alrededor del cráter Gale y lo guarda como JSON.
// Uso: npm run fetch-dem
//
// OJO: el WMS devuelve grises de 8 bits normalizados POR PETICIÓN (no metros absolutos).
// Para el demo reescalamos 0-255 al rango aproximado de Gale (ELEV_MIN..ELEV_MAX).
// Para valores reales: baja el DEM (GeoTIFF) desde Trek y reemplaza este script.
import { writeFileSync, mkdirSync } from 'node:fs'
import { PNG } from 'pngjs'

const BBOX = [136.5, -6.5, 139.0, -4.0] // lonMin, latMin, lonMax, latMax
const SIZE = 160
const ELEV_MIN = -4500 // m, aprox. suelo de Gale
const ELEV_MAX = 500 // m, aprox. punto más alto del recorte

const url =
  'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map' +
  `&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=MOLA_bw&STYLES=&SRS=EPSG:4326` +
  `&BBOX=${BBOX.join(',')}&WIDTH=${SIZE}&HEIGHT=${SIZE}&FORMAT=image/png`

const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
if (!res.ok || !res.headers.get('content-type')?.includes('png')) {
  throw new Error(`WMS error ${res.status}: ${(await res.text()).slice(0, 300)}`)
}
const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()))
let g = Array.from({ length: SIZE * SIZE }, (_, i) => png.data[i * 4])

// Suavizado simple (caja 3x3, 2 pasadas) para quitar el efecto "terraza" del 8-bit
for (let pass = 0; pass < 2; pass++) {
  const out = g.slice()
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let s = 0, n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < SIZE && yy < SIZE) { s += g[yy * SIZE + xx]; n++ }
        }
      out[y * SIZE + x] = s / n
    }
  g = out
}
const lo = Math.min(...g), hi = Math.max(...g)
const elev = g.map((v) => Math.round(ELEV_MIN + ((v - lo) / (hi - lo)) * (ELEV_MAX - ELEV_MIN)))

mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../public/data/gale-dem.json', import.meta.url),
  JSON.stringify({ bbox: BBOX, size: SIZE, elevMin: ELEV_MIN, elevMax: ELEV_MAX, elev }),
)
console.log('OK gale-dem.json', SIZE + 'x' + SIZE)
