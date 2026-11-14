import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import ElevationProfile from './components/ElevationProfile'
import TemperatureCard from './components/TemperatureCard'
import DataPanel from './components/DataPanel'
import { loadDem } from './lib/dem'
import { radiationFor, SOLAR, RAD_REF_TEXT } from './lib/radiation'
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

const Select = (props) => <select {...props} className="mt-1 w-full rounded border border-cyan-900 bg-[#0b1322] p-1 text-sm" />
const Title = ({ children }) => <h2 className="text-xs uppercase tracking-widest text-slate-500">{children}</h2>

export default function App() {
  const [baseDem, setDem] = useState(null)
  const [temp, setTemp] = useState(null)
  const [error, setError] = useState(null)
  const [solar, setSolar] = useState('mid')
  const [ls, setLs] = useState(90)
  const [hour, setHour] = useState(12)
  const [maxElevSel, setMaxElevSel] = useState(null)
  const w = W
  const [basemap, setBasemap] = useState('ortho')
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
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-cyan-900/50 bg-[#070c16] p-4 md:w-80 md:border-b-0 md:border-r">
        <header>
          <h1 className="text-lg font-bold tracking-wide text-cyan-300">MARS ROUTE · Gale</h1>
          <p className="text-xs text-slate-400">Prototipo de HUD de navegación EVA</p>
          <button className="mt-2 w-full rounded border border-cyan-700 bg-cyan-900/30 px-3 py-1.5 text-sm font-bold text-cyan-200 hover:bg-cyan-800/50" onClick={() => setShowData(true)}>
            Ver todos los datos considerados
          </button>
        </header>

        <section className="space-y-3">
          <Title>Escenario</Title>
          <label className="block text-sm">Actividad solar
            <Select value={solar} onChange={(e) => setSolar(e.target.value)}>
              {Object.entries(SOLAR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </label>
          <TemperatureCard temp={temp} ls={ls} setLs={setLs} hour={hour} setHour={setHour} />
        </section>

        <section className="space-y-3">
          <Title>Filtros de la ruta</Title>
          <label className="block text-sm">
            Altura máxima: <b className="text-cyan-300">{maxElev} m</b>
            <input type="range" className="w-full accent-cyan-400" min={baseDem?.elevMin ?? -4500} max={baseDem?.elevMax ?? 0} step={50} value={maxElev} onChange={(e) => setMaxElevSel(+e.target.value)} />
          </label>
        </section>

        <section className="space-y-2">
          <Title>Mapa</Title>
          <label className="block text-sm">Mapa base
            <Select value={basemap} onChange={(e) => setBasemap(e.target.value)}>
              <option value="ortho">Ortofoto HiRISE (Trek)</option>
              <option value="relief">Relieve del DEM (50 m)</option>
              <option value="trek">NASA Trek (MOLA 463 m)</option>
            </Select>
          </label>
          <label className="block text-sm">Capa
            <Select value={layer} onChange={(e) => setLayer(e.target.value)}>
              {LAYERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </label>
          <p className="text-[11px] text-slate-500"><span className="text-red-300/80">■ Rojo</span> = bloqueado (muy alto o más de {CONST.MAX_SLOPE_DEG}° de pendiente) · <span className="text-slate-400">■ Gris</span> = sin dato · <span className="text-sky-300">▲</span> base</p>
        </section>

        <section className="text-sm">
          <Title>Ruta</Title>
          <p className="my-2 text-slate-400">Mantén el clic en el <b className="text-green-400">inicio</b>, arrastra y suelta en el <b className="text-amber-400">destino</b>. <span className="text-slate-500">Shift+arrastrar mueve el mapa.</span></p>
          {noRoute && <p className="text-red-400">{blockedEnd ? 'El inicio o el destino cae en una zona bloqueada. Elige puntos fuera del rojo o sube la altura máxima.' : 'No hay camino con estos límites. Sube la altura máxima.'}</p>}
          {stats && (
            <>
              {stats.tMin !== null && <p className="mt-2 text-[11px] text-slate-400">Superficie durante la salida: {(stats.tMin - 273.15).toFixed(0)} a {(stats.tMax - 273.15).toFixed(0)} °C (rango del traje, lunar: {CONST.SUIT_EXT_K[0] - 273}…{CONST.SUIT_EXT_K[1] - 273} °C).</p>}
              {warnings.map((m) => <p key={m} className="mt-1 text-[12px] text-amber-300">⚠ {m}</p>)}
            </>
          )}
          {(start || end) && <button className="mt-3 rounded border border-cyan-800 px-3 py-1 text-xs hover:bg-cyan-900/40" onClick={() => { setStart(null); setEnd(null) }}>Reiniciar</button>}
        </section>

        <section className="shrink-0">
          <Title>Perfil de elevación</Title>
          <div className="mt-2 h-40 md:h-48">{dem && <ElevationProfile dem={dem} route={route} />}</div>
        </section>

        <p className="shrink-0 text-[10px] leading-snug text-slate-500">
          Radiación: modelo anclado en datos de MSL/RAD ({RAD_REF_TEXT}). Temperatura y presión: Mars Climate Database (LMD). Elevación: DEM MOLA/HRSC/HiRISE de USGS. Mapa: NASA Trek. Detalle y fuentes en "Ver todos los datos considerados".
        </p>
      </aside>

      <main className="relative min-h-0 flex-1">
        {error && <div className="absolute z-10 m-3 rounded bg-red-900 p-3 text-sm">{error}</div>}
        {stats && (
          <dl className="absolute right-3 top-3 z-10 grid grid-cols-3 gap-x-4 rounded border border-cyan-900/60 bg-[#070c16]/90 px-3 py-2 backdrop-blur">
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
