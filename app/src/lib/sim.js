// RADIACIÓN: MODELO SIMPLIFICADO calculado desde el DEM real (no es una medición ni un mapa oficial).
// TEMPERATURA: SIMULADA (valores inventados con ideas físicas).

// --- Radiación (rayos cósmicos galácticos, GCR) ---
// 1) Atmósfera encima: presión barométrica P = P0·exp(-h/H), masa de columna X = P/g.
//    Más altura -> menos atmósfera -> más dosis.
// 2) Relieve: las paredes tapan parte del cielo. Fracción de cielo visible = 1 - media(sin(ángulo de horizonte)).
// 3) Calibración: dosis en el aterrizaje de Curiosity (Bradbury, ~ -4500 m) = 0.64 mSv/día,
//    valor publicado de RAD (GCR, dosis equivalente). Verificar contra la publicación antes de citarlo.
// SUPUESTOS (inventados/simplificados): la curva dosis-vs-columna y su escala X0.
const P0 = 610 // Pa, presión de referencia en el datum de Marte
const H = 11100 // m, altura de escala atmosférica
const G = 3.71 // m/s², gravedad en Marte
const X0 = 40 // g/cm², escala de la curva de atenuación (supuesto)
const RAD_CAL = { elev: -4500, mSvDay: 0.64 }
const column = (h) => ((P0 * Math.exp(-h / H)) / G) / 10 // g/cm²  (1 kg/m² = 0.1 g/cm²)
const atmFactor = (h) => 0.5 + 0.5 * Math.exp(-column(h) / X0)

function skyVisible(dem) {
  const { size, elev, dLat, dLon, lonLat, mPerDeg } = dem
  const AZ = 16, R = 40 // direcciones y alcance en celdas (~30 km)
  const out = new Float32Array(size * size)
  const dirs = Array.from({ length: AZ }, (_, k) => [Math.cos((2 * Math.PI * k) / AZ), Math.sin((2 * Math.PI * k) / AZ)])
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const z0 = elev[y * size + x]
      const lat = lonLat(x, y)[1]
      const kx = dLon * mPerDeg * Math.cos((lat * Math.PI) / 180), ky = dLat * mPerDeg
      let sum = 0
      for (const [dx, dy] of dirs) {
        let hmax = 0
        for (let r = 1; r <= R; r++) {
          const xx = Math.round(x + dx * r), yy = Math.round(y + dy * r)
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) break
          const dist = Math.hypot(dx * r * kx, dy * r * ky)
          const a = Math.atan((elev[yy * size + xx] - z0) / dist)
          if (a > hmax) hmax = a
        }
        sum += Math.sin(hmax)
      }
      out[y * size + x] = 1 - sum / AZ
    }
  return out
}

export function simulate(dem) {
  const { size, elev, elevMin, elevMax } = dem
  const sky = skyVisible(dem)
  const k = RAD_CAL.mSvDay / atmFactor(RAD_CAL.elev)
  const rad = new Float32Array(size * size) // mSv/día (modelo)
  const temp = new Float32Array(size * size) // °C (simulada)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      rad[i] = k * atmFactor(elev[i]) * sky[i]
      const n = (elev[i] - elevMin) / (elevMax - elevMin)
      temp[i] = -45 - 15 * n + 12 * Math.sin(x / 9) * Math.cos(y / 11)
    }
  const norm = (a, invert = false) => {
    const lo = Math.min(...a), hi = Math.max(...a)
    return Float32Array.from(a, (v) => (invert ? 1 - (v - lo) / (hi - lo) : (v - lo) / (hi - lo)))
  }
  // riesgo 0..1 RELATIVO dentro de la zona (más radiación = peor; más frío = peor)
  return { rad, temp, radRisk: norm(rad), tempRisk: norm(temp, true) }
}
