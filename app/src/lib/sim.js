// DATOS SIMULADOS (no son mediciones). Sirven para demostrar el costo multi-factor.
// Ideas físicas reales, valores inventados:
//  - Radiación: la atmósfera marciana protege más a baja altitud (más presión) -> más dosis arriba.
//    Orden de magnitud real: ~0.6 mSv/día en Gale (RAD de Curiosity).
//  - Temperatura: baja con la altitud + variación local según pendiente/orientación (simulada).
export function simulate(dem) {
  const { size, elev, slope, elevMin, elevMax } = dem
  const rad = new Float32Array(size * size) // mSv/día
  const temp = new Float32Array(size * size) // °C
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const n = (elev[i] - elevMin) / (elevMax - elevMin) // 0..1
      rad[i] = 0.55 + 0.1 * n + 0.01 * slope[i] + 0.15 * Math.sin(x / 13 + 1) * Math.sin(y / 17) // + parches simulados de apantallamiento
      temp[i] = -45 - 15 * n + 12 * Math.sin(x / 9) * Math.cos(y / 11) // °C, ondulación local
    }
  const norm = (a, invert = false) => {
    const lo = Math.min(...a), hi = Math.max(...a)
    return Float32Array.from(a, (v) => {
      const t = (v - lo) / (hi - lo)
      return invert ? 1 - t : t
    })
  }
  // riesgo 0..1: más radiación = peor; más frío = peor
  return { rad, temp, radRisk: norm(rad), tempRisk: norm(temp, true) }
}
