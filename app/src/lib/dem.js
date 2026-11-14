// Carga del DEM recortado (Gale) y utilidades de celdas / pendiente.
const M_PER_DEG = (2 * Math.PI * 3396190) / 360 // metros por grado en Marte (ecuador)

import { simulate } from './radiation'

export async function loadDem() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/gale-dem.json`)
  if (!res.ok) throw new Error('No se pudo cargar gale-dem.json (corre: npm run fetch-dem)')
  const d = await res.json()
  const [lonMin, latMin, lonMax, latMax] = d.bbox
  const { size, elev } = d
  const dLon = (lonMax - lonMin) / size
  const dLat = (latMax - latMin) / size

  const lonLat = (x, y) => [lonMin + (x + 0.5) * dLon, latMax - (y + 0.5) * dLat]
  const cellOf = (lon, lat) => {
    const x = Math.floor((lon - lonMin) / dLon)
    const y = Math.floor((latMax - lat) / dLat)
    return x < 0 || y < 0 || x >= size || y >= size ? null : [x, y]
  }
  const at = (x, y) => elev[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))]

  // Pendiente (grados) por diferencias centrales
  const slope = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const lat = lonLat(x, y)[1]
      const cx = dLon * M_PER_DEG * Math.cos((lat * Math.PI) / 180)
      const cy = dLat * M_PER_DEG
      const dzdx = (at(x + 1, y) - at(x - 1, y)) / (2 * cx)
      const dzdy = (at(x, y + 1) - at(x, y - 1)) / (2 * cy)
      slope[y * size + x] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
    }

  const out = { ...d, lonMin, latMin, lonMax, latMax, dLon, dLat, lonLat, cellOf, slope, mPerDeg: M_PER_DEG }
  return { ...out, ...simulate(out) }
}
