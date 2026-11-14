// Recorrido real de Curiosity (referencia). Solo se dibuja y se compara: nunca entra en el cálculo de A*.
const M_PER_DEG = (2 * Math.PI * 3396190) / 360

export async function loadCuriosity() {
  const r = await fetch(`${import.meta.env.BASE_URL}data/curiosity-traverse.json`)
  if (!r.ok) throw new Error('Falta curiosity-traverse.json (corre: npm run fetch-curiosity)')
  return r.json()
}

// Proyección local en metros (equirectangular alrededor de la latitud media)
function projector(lat0) {
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)
  return ([lon, lat]) => [lon * kx, lat * M_PER_DEG]
}

export function lengthKm(coords) {
  const P = projector(coords[0][1])
  let d = 0
  for (let i = 1; i < coords.length; i++) { const a = P(coords[i - 1]), b = P(coords[i]); d += Math.hypot(b[0] - a[0], b[1] - a[1]) }
  return d / 1000
}

function distToPolyline(p, poly) {
  let best = Infinity
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1], [bx, by] = poly[i]
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2)) : 0
    const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))
    if (d < best) best = d
  }
  return best
}

/** Compara nuestra ruta (lista de [lon,lat]) con el recorrido de Curiosity.
 *  meanM / maxM: distancia de cada punto de nuestra ruta al recorrido de Curiosity; within = % a menos de `tolM`. */
export function compareRoutes(ours, curiosity, tolM = 500) {
  const P = projector(curiosity[0][1])
  const poly = curiosity.map(P)
  let sum = 0, max = 0, inside = 0
  for (const c of ours) {
    const d = distToPolyline(P(c), poly)
    sum += d; if (d > max) max = d; if (d <= tolM) inside++
  }
  return { meanM: sum / ours.length, maxM: max, within: (100 * inside) / ours.length, tolM }
}
