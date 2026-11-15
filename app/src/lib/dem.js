// Carga del DEM y utilidades de celdas / pendiente.
// Cráter completo ('gale'): mapas GeoTIFF locales (gale_elevacion.tif y gale_suelo.tif, creados con `npm run fetch-mapas`).
// Zona de Curiosity ('gale50'): DEM de 1 m promediado a 50 m (Float32 binario, `npm run fetch-dem-1m`).
import { simulate } from './radiation.js'
import { viewshed } from './comm.js'
import { loadTif } from './mapManager.js'
import { CONST } from './constants.js'

const R_MARS = 3396190

// Campos de dunas del USGS (MGD3), polígonos lon/lat compartidos por ambos DEM
let dunes = null
async function loadDunes(base) {
  if (dunes) return dunes
  const r = await fetch(`${base}data/gale-dunes.json`)
  dunes = r.ok ? await r.json() : null
  return dunes
}

// Inercia térmica THEMIS (opcional: si falta el archivo, el factor de polvo queda en 0)
const loadSoil = () => loadTif('gale_suelo.tif').catch(() => null)

// Rugosidad: desviación estándar (m) de los residuos respecto a un plano ajustado en ventanas de 3×3 celdas.
export function roughness3x3(elev, w, h) {
  const rough = new Float32Array(w * h).fill(NaN)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let n = 0, sz = 0, sx = 0, sy = 0
      for (let dy = -1; dy <= 1 && n >= 0; dy++) for (let dx = -1; dx <= 1; dx++) {
        const z = elev[(y + dy) * w + x + dx]
        if (Number.isNaN(z)) { n = -1; break }
        n++; sz += z; sx += dx * z; sy += dy * z
      }
      if (n !== 9) continue
      // plano z = a + b·dx + c·dy en malla simétrica: b = Σdx·z/6, c = Σdy·z/6
      const b = sx / 6, c = sy / 6, mean = sz / 9
      let ss = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const e = elev[(y + dy) * w + x + dx] - (mean + b * dx + c * dy); ss += e * e }
      rough[y * w + x] = Math.sqrt(ss / 9)
    }
  return rough
}

/** prefix 'gale' = cráter completo (200 m, GeoTIFF local), 'gale50' = zona de Curiosity (50 m, del DEM de 1 m) */
export async function loadDem(prefix = 'gale') {
  const base = import.meta.env.BASE_URL
  if (prefix === 'gale') {
    const [map, soil, duneGeo] = await Promise.all([loadTif('gale_elevacion.tif'), loadSoil(), loadDunes(base)])
    const { w, h, bbox, dLon, data: elev } = map
    let elevMin = Infinity, elevMax = -Infinity, valid = 0
    for (const v of elev) if (!Number.isNaN(v)) { valid++; if (v < elevMin) elevMin = v; if (v > elevMax) elevMax = v }
    const meta = { w, h, bbox, cellM: Math.round(dLon * ((Math.PI * R_MARS) / 180)), elevMin, elevMax, validFraction: valid / (w * h),
      source: 'USGS Mars MGS MOLA - MEX HRSC Blended DEM Global 200m v2, ventana del cráter Gale (gale_elevacion.tif)' }
    return buildDem(meta, elev, roughness3x3(elev, w, h), duneGeo, soil)
  }
  const [metaRes, binRes, roughRes] = await Promise.all([
    fetch(`${base}data/${prefix}-dem.json`), fetch(`${base}data/${prefix}-dem.f32`), fetch(`${base}data/${prefix}-rough.f32`),
  ])
  if (!metaRes.ok || !binRes.ok) throw new Error(`No se pudo cargar el DEM ${prefix} (corre: npm run fetch-dem-1m)`)
  const meta = await metaRes.json()
  const elev = new Float32Array(await binRes.arrayBuffer())
  const rough = roughRes.ok ? new Float32Array(await roughRes.arrayBuffer()) : new Float32Array(elev.length).fill(NaN)
  return buildDem(meta, elev, rough, await loadDunes(base), await loadSoil())
}

// Inercia térmica por celda del DEM: promedio de los píxeles THEMIS (100 m) que caen en la celda.
function soilOnGrid(dem, soil) {
  const ti = new Float32Array(dem.n).fill(NaN)
  if (!soil) return ti
  for (let y = 0; y < dem.h; y++) {
    const la1 = dem.latMax - y * dem.dLat, la0 = la1 - dem.dLat
    for (let x = 0; x < dem.w; x++) {
      const lo0 = dem.lonMin + x * dem.dLon
      ti[y * dem.w + x] = soil.meanInBox(lo0, la0, lo0 + dem.dLon, la1)
    }
  }
  return ti
}

// Polvo -> riesgo 0..1 en escala FÍSICA FIJA: inercia <= TI_DUST (superficie dominada por polvo) = 1,
// >= TI_FIRM = 0, lineal entre ambos (la interpolación es supuesto nuestro). Sin dato = 0.
const dustRiskOf = (ti) => (Number.isNaN(ti) ? 0 : Math.min(1, Math.max(0, (CONST.TI_FIRM - ti) / (CONST.TI_FIRM - CONST.TI_DUST))))

// Fracción (0..1) de cada celda dentro de un campo de dunas: rasteriza los polígonos por líneas de barrido
// sobre una submalla de SUB×SUB puntos por celda (regla par-impar) y promedia.
const SUB = 4
function rasterDunes(dem, geo) {
  const out = new Float32Array(dem.n)
  if (!geo) return out
  const W = dem.w * SUB, H = dem.h * SUB
  const sdLon = dem.dLon / SUB, sdLat = dem.dLat / SUB
  const rings = geo.features.flatMap((f) => f.geometry.coordinates)
  const xs = []
  for (let sy = 0; sy < H; sy++) {
    const lat = dem.latMax - (sy + 0.5) * sdLat
    xs.length = 0
    for (const ring of rings)
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const [x1, y1] = ring[m], [x2, y2] = ring[k]
        if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1))
      }
    if (!xs.length) continue
    xs.sort((a, b) => a - b)
    const row = Math.floor(sy / SUB) * dem.w
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const s0 = Math.max(0, Math.ceil((xs[k] - dem.lonMin) / sdLon - 0.5))
      const s1 = Math.min(W - 1, Math.floor((xs[k + 1] - dem.lonMin) / sdLon - 0.5))
      for (let sx = s0; sx <= s1; sx++) out[row + Math.floor(sx / SUB)] += 1 / (SUB * SUB)
    }
  }
  return out
}

/** Construye la malla a partir de los datos ya cargados (sin red; se usa también en pruebas). */
export function buildDem(meta, elev, rough, duneGeo = null, soil = null) {
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
  const sandRisk = rasterDunes(out, duneGeo) // fracción de la celda dentro de un campo de dunas USGS (0..1)
  const ti = soilOnGrid(out, soil) // inercia térmica THEMIS (J m⁻² K⁻¹ s⁻½) por celda
  const dustRisk = Float32Array.from(ti, dustRiskOf)
  return { ...out, visible, commRisk, baseCell, sandRisk, ti, dustRisk, ...simulate(out) }
}
