// Carga del DEM (Float32 binario, NaN = sin dato) y utilidades de celdas / pendiente.
import { simulate } from './radiation'

const M_PER_DEG = (2 * Math.PI * 3396190) / 360 // metros por grado en Marte (ecuador)

export async function loadDem() {
  const base = import.meta.env.BASE_URL
  const [metaRes, binRes] = await Promise.all([fetch(`${base}data/gale-dem.json`), fetch(`${base}data/gale-dem.f32`)])
  if (!metaRes.ok || !binRes.ok) throw new Error('No se pudo cargar el DEM (corre: npm run fetch-dem)')
  const meta = await metaRes.json()
  const elev = new Float32Array(await binRes.arrayBuffer())
  const { w, h, cellM } = meta
  const [lonMin, latMin, lonMax, latMax] = meta.bbox
  const dLon = (lonMax - lonMin) / w
  const dLat = (latMax - latMin) / h

  const lonLat = (x, y) => [lonMin + (x + 0.5) * dLon, latMax - (y + 0.5) * dLat]
  const cellOf = (lon, lat) => {
    const x = Math.floor((lon - lonMin) / dLon)
    const y = Math.floor((latMax - lat) / dLat)
    return x < 0 || y < 0 || x >= w || y >= h ? null : [x, y]
  }
  const at = (x, y) => elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]

  // Pendiente (grados) por diferencias centrales; NaN si falta algún dato vecino (queda bloqueada)
  const slope = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const lat = latMax - (y + 0.5) * dLat
    const cx = cellM * Math.cos((lat * Math.PI) / 180) // equirectangular: columnas se acercan con la latitud
    for (let x = 0; x < w; x++) {
      const dzdx = (at(x + 1, y) - at(x - 1, y)) / (2 * cx)
      const dzdy = (at(x, y + 1) - at(x, y - 1)) / (2 * cellM)
      slope[y * w + x] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
    }
  }

  const out = { ...meta, elev, w, h, n: w * h, cellM, lonMin, latMin, lonMax, latMax, dLon, dLat, lonLat, cellOf, slope, mPerDeg: M_PER_DEG }
  return { ...out, ...simulate(out) }
}
