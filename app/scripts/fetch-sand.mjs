// Mapa APROXIMADO de arena oscura (dunas Bagnold y mantos de arena basáltica) en la zona de Curiosity.
// No hay un mapa vectorial público de arena para Gale, así que lo estimamos con dos datos reales:
//   1) Brillo de la ortofoto HiRISE de NASA Trek (capa curiosity_hirise_mosaic) a ~10 m/px:
//      la arena basáltica de Gale es mucho más oscura que la roca y el regolito que la rodean.
//   2) Rugosidad a 1 m del DEM de USGS (gale50-rough.f32): la arena es lisa; las sombras de rocas y escarpes no.
// Resultado: public/data/gale50-sand.u8 (0..255 = fracción de píxeles oscuros en cada celda de 50 m, ya filtrada
// por rugosidad) sobre la misma malla que gale50-dem. 255 = sin dato fuera de la ortofoto se guarda como 0.
// Uso: npm run fetch-sand   (requiere haber corrido fetch-dem-1m o tener gale50-*.)
import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const HIRISE = 'https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm'
const EXT = [137.1224669, -4.9254743, 137.7298129, -4.2489588] // cobertura de la ortofoto en Trek
const Z = 12
const RES = 360 / 512 / 2 ** Z // grados por píxel (~10 m)
const TILE = 256 * RES
const meta = JSON.parse(readFileSync(new URL('../public/data/gale50-dem.json', import.meta.url)))
const rb = readFileSync(new URL('../public/data/gale50-rough.f32', import.meta.url))
const rough = new Float32Array(rb.buffer, rb.byteOffset, rb.byteLength / 4)
const { w, h, bbox: [lonMin, latMin, lonMax, latMax] } = meta
const dLon = (lonMax - lonMin) / w, dLat = (latMax - latMin) / h

// 1) mosaico de brillo a ~10 m/px
const tx0 = Math.floor((EXT[0] + 180) / TILE), tx1 = Math.floor((EXT[2] + 180) / TILE)
const ty0 = Math.floor((90 - EXT[3]) / TILE), ty1 = Math.floor((90 - EXT[1]) / TILE)
const MW = (tx1 - tx0 + 1) * 256, MH = (ty1 - ty0 + 1) * 256
const gray = new Uint8Array(MW * MH), has = new Uint8Array(MW * MH)
const jobs = []
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty])
let done = 0
async function get([tx, ty]) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${HIRISE}/${Z}/${ty}/${tx}.png`).catch(() => null)
    if (r && r.status === 404) return
    if (!r || !r.ok) continue
    const png = PNG.sync.read(Buffer.from(await r.arrayBuffer()))
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const k = (y * 256 + x) * 4
      if (png.data[k + 3] < 200) continue // transparente = sin imagen
      const o = ((ty - ty0) * 256 + y) * MW + (tx - tx0) * 256 + x
      gray[o] = png.data[k]; has[o] = 1
    }
    return
  }
}
await Promise.all(Array.from({ length: 8 }, async () => { for (let j; (j = jobs.shift()); ) { await get(j); if (++done % 50 === 0) console.log('tiles', done) } }))

// umbral de "oscuro": percentil 6 del brillo de la escena (calibrado a ojo: con 15 % entraba terreno gris normal;
// con 6 % queda la franja de dunas Bagnold y los mantos de arena oscura)
const hist = new Uint32Array(256); let nv = 0
for (let i = 0; i < gray.length; i++) if (has[i]) { hist[gray[i]]++; nv++ }
const P = +(process.env.SAND_P ?? 0.06)
let acc = 0, DARK = 0
for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= nv * P) { DARK = v; break } }
if (process.env.SAND_DUMP) { // depuración: brillo a ~10 m/px
  const png = new PNG({ width: MW, height: MH }); for (let i = 0; i < gray.length; i++) { png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = gray[i]; png.data[i * 4 + 3] = 255 }
  writeFileSync(process.env.SAND_DUMP, PNG.sync.write(png)); console.log('mosaico', MW, MH, 'tx0', tx0, 'ty0', ty0)
}

// rugosidad: la arena es lisa → solo cuenta como arena si la rugosidad de la celda es menor a la mediana
const rv = Array.from(rough).filter(Number.isFinite).sort((a, b) => a - b)
const RMED = rv[Math.floor(rv.length / 2)]

const out = new Uint8Array(w * h)
let cells = 0, sandy = 0
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const lon0 = lonMin + x * dLon, lat0 = latMax - y * dLat
  const px0 = Math.floor((lon0 + 180) / RES) - tx0 * 256, px1 = Math.floor((lon0 + dLon + 180) / RES) - tx0 * 256
  const py0 = Math.floor((90 - lat0) / RES) - ty0 * 256, py1 = Math.floor((90 - lat0 + dLat) / RES) - ty0 * 256
  let n = 0, d = 0
  for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
    if (px < 0 || py < 0 || px >= MW || py >= MH) continue
    const o = py * MW + px
    if (!has[o]) continue
    n++; if (gray[o] <= DARK) d++
  }
  if (!n) continue
  cells++
  const r = rough[y * w + x]
  const smooth = Number.isFinite(r) ? r <= RMED : true
  const f = smooth ? d / n : 0
  out[y * w + x] = Math.round(255 * f)
  if (f >= 0.5) sandy++
}
writeFileSync(new URL('../public/data/gale50-sand.u8', import.meta.url), out)
console.log(`OK ${jobs.length + done} tiles; umbral oscuro ${DARK}/255; rugosidad mediana ${RMED.toFixed(2)} m; celdas con imagen ${cells}; con arena (>=50% oscuro y liso) ${sandy} (${(100 * sandy / cells).toFixed(1)}%)`)
