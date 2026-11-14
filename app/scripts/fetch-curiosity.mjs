// Recorrido REAL de Curiosity (NASA/JPL, mapa MMGIS de la misión MSL) para usarlo como referencia (benchmark).
// No se usa para calcular nuestra ruta: solo se dibuja y se compara.
// Uso: npm run fetch-curiosity  -> public/data/curiosity-traverse.json
// Fuente: https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json (+ MSL_waypoints.json para sol y distancia)
import { writeFileSync } from 'node:fs'

const BASE = 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/'
const trav = await (await fetch(BASE + 'MSL_traverse.json')).json()
const wps = await (await fetch(BASE + 'MSL_waypoints.json')).json()

const pts = []
for (const f of trav.features) {
  const g = f.geometry
  const lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]
  for (const l of lines) for (const [lon, lat] of l) {
    const q = pts[pts.length - 1]
    if (!q || q[0] !== lon || q[1] !== lat) pts.push([lon, lat])
  }
}

// Simplificación Douglas-Peucker con tolerancia de ~2 m (en grados), iterativa
const TOL = 2 / ((2 * Math.PI * 3396190) / 360)
const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
const stack = [[0, pts.length - 1]]
while (stack.length) {
  const [a, b] = stack.pop()
  const [ax, ay] = pts[a], [bx, by] = pts[b]
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12
  let dmax = 0, k = -1
  for (let i = a + 1; i < b; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L
    if (d > dmax) { dmax = d; k = i }
  }
  if (dmax > TOL) { keep[k] = 1; stack.push([a, k], [k, b]) }
}
const coords = pts.filter((_, i) => keep[i]).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])
const last = wps.features[wps.features.length - 1].properties
const out = {
  source: 'NASA/JPL MSL MMGIS: MSL_traverse.json / MSL_waypoints.json', url: BASE + 'MSL_traverse.json',
  sol: last.sol, distKm: last.dist_km, points: pts.length, coords,
}
writeFileSync(new URL('../public/data/curiosity-traverse.json', import.meta.url), JSON.stringify(out))
console.log(`OK sol ${last.sol}, ${last.dist_km} km, ${pts.length} -> ${coords.length} puntos`)
