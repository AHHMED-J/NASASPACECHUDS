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

// Costo por celda (multiplicador de distancia), precalculado una vez por combinación de filtros/pesos.
// Infinity = bloqueada. Así el bucle de A* no vuelve a evaluar filtros ni penalizaciones por vecino.
let cache = null
function prepare(dem, filter, w) {
  const c = cache
  if (c && c.elev === dem.elev && c.slope === dem.slope && c.risk === dem.radRisk &&
      c.maxElev === filter.maxElev && c.maxSlope === filter.maxSlope && c.ws === w.slope && c.wr === w.rad) return c
  const { n, elev, slope, radRisk } = dem
  const cost = new Float32Array(n)
  let minRisk = Infinity
  for (let i = 0; i < n; i++) {
    if (!(elev[i] <= filter.maxElev) || !(slope[i] <= filter.maxSlope)) { cost[i] = Infinity; continue }
    const r = radRisk[i]
    cost[i] = 1 + w.slope * (slope[i] / 10) ** 2 + w.rad * 8 * r
    if (r < minRisk) minRisk = r
  }
  // Heurística admisible: toda celda permitida cuesta al menos (1 + w.rad*8*riesgoMínimo) por metro.
  const mult = 1 + (Number.isFinite(minRisk) ? w.rad * 8 * minRisk : 0)
  cache = { elev: dem.elev, slope: dem.slope, risk: dem.radRisk, maxElev: filter.maxElev, maxSlope: filter.maxSlope, ws: w.slope, wr: w.rad, cost, mult }
  return cache
}

const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
const DY = [-1, -1, -1, 0, 0, 1, 1, 1]
const STEP = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2]
const OCT = Math.SQRT2 - 1

/** Devuelve { cells:[[x,y]...], distanceKm } o null si no hay ruta. */
export function findRoute(dem, start, end, filter, w = { slope: 1, rad: 0 }) {
  const { w: W, h: H, n, cellM } = dem
  const { cost, mult } = prepare(dem, filter, w)
  const s = start[1] * W + start[0], e = end[1] * W + end[0]
  if (!Number.isFinite(cost[s]) || !Number.isFinite(cost[e])) return null

  const g = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const heap = new MinHeap()
  const ex = end[0], ey = end[1], k = mult * cellM
  // heurística octil (distancia exacta en malla de 8 vecinos sin obstáculos) × costo mínimo por metro
  const hh = (x, y) => {
    const dx = Math.abs(x - ex), dy = Math.abs(y - ey)
    return k * (dx > dy ? dx + OCT * dy : dy + OCT * dx)
  }
  g[s] = 0
  heap.push(s, hh(start[0], start[1]))

  while (heap.size) {
    const cur = heap.pop()
    if (closed[cur]) continue // entrada vieja (ya se expandió con mejor costo)
    if (cur === e) break
    closed[cur] = 1
    const cx = cur % W, cy = (cur / W) | 0
    const gc = g[cur]
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d]
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const nb = ny * W + nx
      const ng = gc + cellM * STEP[d] * cost[nb] // Infinity si está bloqueada: nunca mejora g
      if (ng < g[nb]) {
        g[nb] = ng
        prev[nb] = cur
        heap.push(nb, ng + hh(nx, ny))
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
