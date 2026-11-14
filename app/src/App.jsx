import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import ElevationProfile from './components/ElevationProfile'
import TemperatureCard from './components/TemperatureCard'
import DataPanel from './components/DataPanel'
import { loadDem } from './lib/dem'
import { radiationFor, SOLAR } from './lib/radiation'
import { loadTemp } from './lib/temperature'
import { shadeMap } from './lib/sun'
import { effortRel } from './lib/effort'
import { CONST } from './lib/constants'
import { findRoute, isBlocked } from './lib/route'

// Pesos fijos de la ruta (ya no son controles): siempre se minimizan esfuerzo, radiación y rugosidad y se mantiene comunicación.
// 'Sol' queda en 0: no aporta seguridad (no modelamos calor/energía) y la sombra sigue disponible como capa.
const W = { effort: 1, rad: 2, rough: 1, comm: 1, shade: 0 }
const LAYERS = [
  ['none', 'Ninguna'],
  ['rad', 'Radiación (rojo = más dosis)'],
  ['rough', 'Rugosidad (rojo = más rugoso)'],
  ['comm', 'Comunicación (rojo = sin vista a la base)'],
  ['shade', 'Sombra (rojo = en sombra)'],
]

const Select = (props) => <select {...props} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm" />
const Title = ({ children }) => <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h2>

export default function App() {
  const [baseDem, setDem] = useState(null)
  const [temp, setTemp] = useState(null)
  const [error, setError] = useState(null)
  const [solar, setSolar] = useState('mid')
  const [ls, setLs] = useState(90)
  const [hour, setHour] = useState(12)
  const [maxElevSel, setMaxElevSel] = useState(null)
  const w = W
  const [basemap, setBasemap] = useState('relief')
  const [layer, setLayer] = useState('none')
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [showData, setShowData] = useState(false)

  useEffect(() => { loadDem().then(setDem).catch((e) => setError(e.message)) }, [])
  useEffect(() => { loadTemp().then(setTemp).catch((e) => setError(e.message)) }, [])

  // sombras: dependen de la estación y la hora
  const shade = useMemo(() => (baseDem ? shadeMap(baseDem, ls, hour) : null), [baseDem, ls, hour])
  // radiación: depende de la actividad solar y de la presión real (MCD) de la estación/hora
  const dem = useMemo(() => {
    if (!baseDem) return null
    let atm = null
    const p = temp?.table[ls]?.[hour]?.pres
    if (p) {
      const c = baseDem.cellOf(temp.point.lon, temp.point.lat)
      const z = c ? baseDem.elev[c[1] * baseDem.w + c[0]] : NaN
      if (Number.isFinite(z)) atm = { pressure: p, elev: z }
    }
    return { ...baseDem, ...radiationFor(baseDem, SOLAR[solar].phi, atm), shade }
  }, [baseDem, solar, temp, ls, hour, shade])

  const maxElev = maxElevSel ?? (baseDem ? Math.round((baseDem.elevMin + 0.75 * (baseDem.elevMax - baseDem.elevMin)) / 50) * 50 : 0)
  const filter = useMemo(() => ({ maxElev, maxSlope: CONST.MAX_SLOPE_DEG }), [maxElev])

  // Un solo cálculo A* a la vez y siempre con el último destino (los movimientos intermedios no se acumulan).
  const [route, setRoute] = useState(null)
  const [computing, setComputing] = useState(false)
  const job = useRef({ busy: false, again: false, args: null })
  useEffect(() => {
    const j = job.current
    if (!dem || !start || !end) { setRoute(null); return }
    j.args = { dem, start, end, filter, w }
    if (j.busy) { j.again = true; return }
    const run = () => {
      j.busy = true
      setComputing(true)
      setTimeout(() => {
        const a = j.args
        setRoute(findRoute(a.dem, a.start, a.end, a.filter, a.w))
        j.busy = false
        if (j.again) { j.again = false; run() } else setComputing(false)
      }, 0)
    }
    run()
  }, [dem, start, end, filter, w])
  const noRoute = start && end && !computing && !route

  // arrastrar: 'down' fija el inicio, 'move' actualiza el destino
  const onPick = (phase, [lon, lat]) => {
    if (!dem) return
    const c = dem.cellOf(lon, lat)
    if (!c) return
    if (phase === 'down') { setStart(c); setEnd(null) }
    else if (phase === 'move' || phase === 'up') setEnd((prev) => (prev && prev[0] === c[0] && prev[1] === c[1] ? prev : c))
  }
  const blockedEnd = dem && start && end && (isBlocked(dem, start[1] * dem.w + start[0], filter) || isBlocked(dem, end[1] * dem.w + end[0], filter))

  const stats = useMemo(() => {
    if (!route) return null
    const { cells } = route
    const speed = CONST.WALK_KMH * 1000 // m/h
    const idx = (c) => c[1] * dem.w + c[0]
    let seg = 0, eff = 0, dose = 0, sun = 0, vis = 0, rough = 0, nRough = 0, maxSlope = 0, minE = Infinity, maxE = -Infinity, maxExc = 0
    cells.forEach((c, k) => {
      const i = idx(c)
      maxSlope = Math.max(maxSlope, dem.slope[i])
      minE = Math.min(minE, dem.elev[i]); maxE = Math.max(maxE, dem.elev[i])
      if (dem.shade[i] === 0) sun++
      if (dem.visible[i]) vis++
      if (Number.isFinite(dem.rough[i])) { rough += dem.rough[i]; nRough++ }
      if (dem.baseCell) maxExc = Math.max(maxExc, Math.hypot(c[0] - dem.baseCell[0], c[1] - dem.baseCell[1]) * dem.cellM)
      if (k) {
        const p = cells[k - 1]
        const d = Math.hypot(c[0] - p[0], c[1] - p[1]) * dem.cellM
        seg += d
        eff += effortRel((dem.elev[i] - dem.elev[idx(p)]) / d) * d
        dose += (dem.rad[i] / 24) * (d / speed) // mSv/día -> mSv/h × horas en la celda
      }
    })
    const timeH = seg / speed
    // temperatura de superficie durante la salida (la tabla de la MCD es cada 2 h)
    let tMin = null, tMax = null
    if (temp) {
      for (let t = 0; t <= Math.ceil(timeH / 2) * 2; t += 2) {
        const hh = (Math.floor(hour / 2) * 2 + t) % 24
        const v = temp.table[ls][hh].surf
        tMin = tMin === null ? v : Math.min(tMin, v)
        tMax = tMax === null ? v : Math.max(tMax, v)
      }
    }
    return {
      km: route.distanceKm, timeH, doseMsv: dose, effortRel: seg ? eff / seg : 1,
      sunPct: (100 * sun) / cells.length, visPct: (100 * vis) / cells.length, rough: nRough ? rough / nRough : NaN,
      maxSlope, min: Math.round(minE), max: Math.round(maxE), maxExcKm: maxExc / 1000, tMin, tMax,
    }
  }, [route, dem, temp, ls, hour])

  const warnings = []
  if (stats) {
    if (stats.maxExcKm > CONST.MAX_EXCURSION_KM) warnings.push(`Se aleja ${stats.maxExcKm.toFixed(1)} km de la base (planificación: ${CONST.MAX_EXCURSION_KM} km).`)
    if (stats.tMin !== null && (stats.tMin < CONST.SUIT_EXT_K[0] || stats.tMax > CONST.SUIT_EXT_K[1])) warnings.push('La temperatura sale del rango externo de diseño del traje (lunar).')
    if (stats.visPct < 100) warnings.push(`${(100 - stats.visPct).toFixed(0)}% del recorrido sin línea de vista a la base.`)
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-b border-white/10 bg-[#0a0f1a] p-5 md:w-80 md:border-b-0 md:border-r">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-cyan-300">Mars Route</h1>
            <p className="text-xs text-slate-500">Gale · navegación EVA</p>
          </div>
          <button className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => setShowData(true)}>Datos considerados</button>
        </header>

        <section>
          <Title>Escenario</Title>
          <div className="space-y-4">
            <TemperatureCard temp={temp} ls={ls} setLs={setLs} hour={hour} setHour={setHour} />
            <label className="block text-sm"><span className="text-slate-400">Actividad solar</span>
              <Select value={solar} onChange={(e) => setSolar(e.target.value)}>
                {Object.entries(SOLAR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </label>
          </div>
        </section>

        <section>
          <Title>Ruta</Title>
          <label className="mb-4 block text-sm">
            <div className="flex items-baseline justify-between"><span className="text-slate-400">Altura máxima</span><b className="text-base text-cyan-300">{maxElev} m</b></div>
            <input type="range" className="mt-1 w-full accent-cyan-400" min={baseDem?.elevMin ?? -4500} max={baseDem?.elevMax ?? 0} step={50} value={maxElev} onChange={(e) => setMaxElevSel(+e.target.value)} />
          </label>
          <p className="text-sm text-slate-400">Arrastra en el mapa del <b className="text-green-400">inicio</b> al <b className="text-amber-400">destino</b>. <span className="text-slate-500">Shift+arrastrar mueve el mapa.</span></p>
          {noRoute && <p className="mt-2 text-sm text-red-400">{blockedEnd ? 'El inicio o el destino cae en zona bloqueada.' : 'No hay camino con estos límites. Sube la altura máxima.'}</p>}
          {stats && (
            <div className="mt-3 space-y-1.5">
              {stats.tMin !== null && <p className="text-xs text-slate-400">Superficie durante la salida: {(stats.tMin - 273.15).toFixed(0)} a {(stats.tMax - 273.15).toFixed(0)} °C</p>}
              {warnings.map((m) => <p key={m} className="rounded-md bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-300">{m}</p>)}
            </div>
          )}
          {(start || end) && <button className="mt-3 rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => { setStart(null); setEnd(null) }}>Reiniciar</button>}
        </section>

        <section className="shrink-0">
          <Title>Perfil de elevación</Title>
          <div className="h-40">{dem && <ElevationProfile dem={dem} route={route} />}</div>
        </section>

        <details className="shrink-0 text-sm">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">Mapa</summary>
          <div className="mt-3 space-y-3">
            <label className="block"><span className="text-slate-400">Mapa base</span>
              <Select value={basemap} onChange={(e) => setBasemap(e.target.value)}>
                <option value="relief">Relieve del DEM</option>
                <option value="trek">NASA Trek (MOLA)</option>
              </Select>
            </label>
            <label className="block"><span className="text-slate-400">Capa</span>
              <Select value={layer} onChange={(e) => setLayer(e.target.value)}>
                {LAYERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </Select>
            </label>
            <p className="text-[11px] text-slate-500"><span className="text-red-300/80">■</span> bloqueado (muy alto o &gt;{CONST.MAX_SLOPE_DEG}°) · <span className="text-slate-400">■</span> sin dato · <span className="text-sky-300">▲</span> base</p>
          </div>
        </details>
      </aside>

      <main className="relative min-h-0 flex-1">
        {error && <div className="absolute z-10 m-3 rounded bg-red-900 p-3 text-sm">{error}</div>}
        {stats && (
          <dl className="absolute right-3 top-3 z-10 grid grid-cols-3 gap-x-4 rounded-lg border border-white/10 bg-[#0a0f1a]/90 px-3 py-2 backdrop-blur">
            {[
              ['Distancia', `${stats.km.toFixed(1)} km`],
              ['Tiempo a pie', `${stats.timeH.toFixed(1)} h`],
              ['Elevación', `${stats.min} a ${stats.max} m`],
            ].map(([k, v]) => <div key={k}><dt className="text-[11px] text-slate-400">{k}</dt><dd className="text-base text-cyan-300">{v}</dd></div>)}
          </dl>
        )}
        <MapView dem={dem} layer={layer} basemap={basemap} filter={filter} route={route} start={start} end={end} onPick={onPick} />
      </main>

      {showData && (
        <DataPanel onClose={() => setShowData(false)}
          state={{ w, maxElev, solar, ls, hour, temp, stats, elevMin: baseDem?.elevMin, elevMax: baseDem?.elevMax }} />
      )}
    </div>
  )
}
