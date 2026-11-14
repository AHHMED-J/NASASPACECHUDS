// A* sobre la malla del DEM. Las celdas que no pasan el filtro (altura / pendiente) se bloquean.
class MinHeap {
  constructor() { this.a = [] }
  push(item, p) {
    const a = this.a
    a.push([p, item])
    let i = a.length - 1
    while (i > 0) {
      const j = (i - 1) >> 1
      if (a[j][0] <= a[i][0]) break
      ;[a[i], a[j]] = [a[j], a[i]]
      i = j
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        let m = i
        const l = 2 * i + 1, r = l + 1
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[i], a[m]] = [a[m], a[i]]
        i = m
      }
    }
    return top[1]
  }
  get size() { return this.a.length }
}

export function isBlocked(dem, i, { maxElev, maxSlope }) {
  return dem.elev[i] > maxElev || dem.slope[i] > maxSlope
}

/** Devuelve { cells:[[x,y]...], distanceKm } o null si no hay ruta. */
export function findRoute(dem, start, end, filter) {
  const { size } = dem
  const idx = ([x, y]) => y * size + x
  const s = idx(start), e = idx(end)
  if (isBlocked(dem, s, filter) || isBlocked(dem, e, filter)) return null

  const g = new Float32Array(size * size).fill(Infinity)
  const prev = new Int32Array(size * size).fill(-1)
  const heap = new MinHeap()
  g[s] = 0
  heap.push(s, 0)
  const cellM = dem.dLat * dem.mPerDeg
  const h = (i) => Math.hypot((i % size) - end[0], Math.floor(i / size) - end[1]) * cellM

  while (heap.size) {
    const cur = heap.pop()
    if (cur === e) break
    const cx = cur % size, cy = (cur / size) | 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        const n = ny * size + nx
        if (isBlocked(dem, n, filter)) continue
        // costo = distancia * penalización por pendiente (prefiere terreno suave)
        const sl = dem.slope[n]
        const cost = Math.hypot(dx, dy) * cellM * (1 + (sl / 10) ** 2)
        const ng = g[cur] + cost
        if (ng < g[n]) {
          g[n] = ng
          prev[n] = cur
          heap.push(n, ng + h(n))
        }
      }
  }
  if (prev[e] === -1 && s !== e) return null

  const cells = []
  for (let c = e; c !== -1; c = prev[c]) cells.push([c % size, (c / size) | 0])
  cells.reverse()
  let dist = 0
  for (let i = 1; i < cells.length; i++)
    dist += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]) * cellM
  return { cells, distanceKm: dist / 1000 }
}
