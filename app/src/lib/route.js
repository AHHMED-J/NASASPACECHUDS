// A* sobre la malla del DEM. Las celdas que no pasan el filtro (altura / pendiente) se bloquean.
// Heap binario con arreglos tipados (rápido para mallas de ~1 millón de celdas)
class MinHeap {
  constructor(cap = 1 << 16) { this.p = new Float64Array(cap); this.v = new Int32Array(cap); this.size = 0 }
  push(item, pr) {
    if (this.size === this.p.length) {
      const p = new Float64Array(this.size * 2), v = new Int32Array(this.size * 2)
      p.set(this.p); v.set(this.v); this.p = p; this.v = v
    }
    const { p, v } = this
    let i = this.size++
    while (i > 0) {
      const j = (i - 1) >> 1
      if (p[j] <= pr) break
      p[i] = p[j]; v[i] = v[j]; i = j
    }
    p[i] = pr; v[i] = item
  }
  pop() {
    const { p, v } = this
    const top = v[0]
    const lastP = p[--this.size], lastV = v[this.size]
    let i = 0
    for (;;) {
      let c = 2 * i + 1
      if (c >= this.size) break
      if (c + 1 < this.size && p[c + 1] < p[c]) c++
      if (p[c] >= lastP) break
      p[i] = p[c]; v[i] = v[c]; i = c
    }
    p[i] = lastP; v[i] = lastV
    return top
  }
}

// NaN (sin dato) también bloquea: "!(x <= max)" es verdadero para NaN
export function isBlocked(dem, i, { maxElev, maxSlope }) {
  return !(dem.elev[i] <= maxElev) || !(dem.slope[i] <= maxSlope)
}

/** Devuelve { cells:[[x,y]...], distanceKm } o null si no hay ruta. */
export function findRoute(dem, start, end, filter, w = { slope: 1, rad: 0 }) {
  const { w: W, h: H, n } = dem
  const idx = ([x, y]) => y * W + x
  const s = idx(start), e = idx(end)
  if (isBlocked(dem, s, filter) || isBlocked(dem, e, filter)) return null

  const g = new Float32Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const heap = new MinHeap()
  g[s] = 0
  heap.push(s, 0)
  const cellM = dem.cellM
  // Heurística admisible: cada celda permitida cuesta al menos (1 + w.rad*8*riesgoMínimo) por metro.
  let minRisk = Infinity
  for (let i = 0; i < n; i++) if (!isBlocked(dem, i, filter) && dem.radRisk[i] < minRisk) minRisk = dem.radRisk[i]
  const mult = 1 + (Number.isFinite(minRisk) ? w.rad * 8 * minRisk : 0)
  const hh = (i) => mult * Math.hypot((i % W) - end[0], Math.floor(i / W) - end[1]) * cellM

  while (heap.size) {
    const cur = heap.pop()
    if (cur === e) break
    const cx = cur % W, cy = (cur / W) | 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const nb = ny * W + nx
        if (isBlocked(dem, nb, filter)) continue
        // costo = distancia * (1 + penalizaciones ponderadas). Siempre >= distancia,
        // así la heurística de distancia recta sigue siendo admisible (A* óptimo).
        const pen = w.slope * (dem.slope[nb] / 10) ** 2 + w.rad * 8 * dem.radRisk[nb]
        const cost = Math.hypot(dx, dy) * cellM * (1 + pen)
        const ng = g[cur] + cost
        if (ng < g[nb]) {
          g[nb] = ng
          prev[nb] = cur
          heap.push(nb, ng + hh(nb))
        }
      }
  }
  if (prev[e] === -1 && s !== e) return null

  const cells = []
  for (let c = e; c !== -1; c = prev[c]) cells.push([c % W, (c / W) | 0])
  cells.reverse()
  let dist = 0
  for (let i = 1; i < cells.length; i++)
    dist += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]) * cellM
  return { cells, distanceKm: dist / 1000 }
}
