// Carga del DEM (Float32 binario, NaN = sin dato) y utilidades de celdas / pendiente.
import { simulate } from './radiation.js'
import { viewshed } from './comm.js'

// Mapa de arena (malla de 50 m de la zona de Curiosity), compartido por ambos DEM
let sandGrid = null
async function loadSand(base) {
  if (sandGrid) return sandGrid
  const [m, b] = await Promise.all([fetch(`${base}data/gale50-dem.json`), fetch(`${base}data/gale50-sand.u8`)])
  if (!m.ok || !b.ok) return null
  sandGrid = { meta: await m.json(), v: new Uint8Array(await b.arrayBuffer()) }
  return sandGrid
}

/** prefix 'gale' = cráter completo (200 m), 'gale50' = zona de Curiosity (50 m, del DEM de 1 m) */
export async function loadDem(prefix = 'gale') {
  const base = import.meta.env.BASE_URL
  const [metaRes, binRes, roughRes] = await Promise.all([
    fetch(`${base}data/${prefix}-dem.json`), fetch(`${base}data/${prefix}-dem.f32`), fetch(`${base}data/${prefix}-rough.f32`),
  ])
  if (!metaRes.ok || !binRes.ok) throw new Error('No se pudo cargar el DEM (corre: npm run fetch-dem)')
  const meta = await metaRes.json()
  const elev = new Float32Array(await binRes.arrayBuffer())
  const rough = roughRes.ok ? new Float32Array(await roughRes.arrayBuffer()) : new Float32Array(elev.length).fill(NaN)
  return buildDem(meta, elev, rough, await loadSand(base))
}

// Muestrea el mapa de arena (0..1) en cada celda del DEM: promedio de 4x4 puntos dentro de la celda. NaN = sin dato.
function sampleSand(dem, sand) {
  const out = new Float32Array(dem.n).fill(NaN)
  if (!sand) return out
  const { w: sw, h: sh, bbox: [a0, b0, a1, b1] } = sand.meta
  const sdx = (a1 - a0) / sw, sdy = (b1 - b0) / sh
  for (let y = 0; y < dem.h; y++) for (let x = 0; x < dem.w; x++) {
    let n = 0, s = 0
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      const lon = dem.lonMin + (x + (k + 0.5) / 4) * dem.dLon, lat = dem.latMax - (y + (j + 0.5) / 4) * dem.dLat
      const sx = Math.floor((lon - a0) / sdx), sy = Math.floor((b1 - lat) / sdy)
      if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue
      const v = sand.v[sy * sw + sx]
      n++; s += v / 255
    }
    if (n) out[y * dem.w + x] = s / n
  }
  return out
}

/** Construye la malla a partir de los datos ya cargados (sin red; se usa también en pruebas). */
export function buildDem(meta, elev, rough, sand = null) {
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

  // Rugosidad -> riesgo 0..1 RELATIVO a la zona (percentil 95 = 1). No hay umbral físico publicado.
  const valid = []
  for (let i = 0; i < rough.length; i++) if (Number.isFinite(rough[i])) valid.push(rough[i])
  valid.sort((a, b) => a - b)
  const roughP95 = valid.length ? valid[Math.floor(valid.length * 0.95)] : 1
  const roughRisk = Float32Array.from(rough, (v) => (Number.isFinite(v) ? Math.min(1, v / roughP95) : 0))

  const out = { ...meta, elev, w, h, n: w * h, cellM, lonMin, latMin, lonMax, latMax, dLon, dLat, lonLat, cellOf, slope, rough, roughRisk }
  const { visible, baseCell } = viewshed(out)
  const commRisk = Float32Array.from(visible, (v, i) => (Number.isNaN(elev[i]) ? NaN : v ? 0 : 1)) // 1 = sin línea de vista
  const sandRisk = sampleSand(out, sand) // fracción de arena oscura 0..1 (NaN fuera de la ortofoto)
  return { ...out, visible, commRisk, baseCell, sandRisk, ...simulate(out) }
}
