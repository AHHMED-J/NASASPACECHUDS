import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import ElevationProfile from './components/ElevationProfile'
import { loadDem } from './lib/dem'
import { findRoute, isBlocked } from './lib/route'

export default function App() {
  const [dem, setDem] = useState(null)
  const [error, setError] = useState(null)
  const [maxElev, setMaxElev] = useState(-500)
  const [maxSlope, setMaxSlope] = useState(20)
  const [w, setW] = useState({ slope: 1, rad: 2, temp: 1 })
  const [layer, setLayer] = useState('none')
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)

  useEffect(() => { loadDem().then(setDem).catch((e) => setError(e.message)) }, [])

  const filter = useMemo(() => ({ maxElev, maxSlope }), [maxElev, maxSlope])
  const route = useMemo(() => (dem && start && end ? findRoute(dem, start, end, filter, w) : null), [dem, start, end, filter, w])
  const noRoute = start && end && !route

  // arrastrar: 'down' fija el inicio, 'move' actualiza el destino (la ruta A* se recalcula en vivo)
  const onPick = (phase, [lon, lat]) => {
    if (!dem) return
    const c = dem.cellOf(lon, lat)
    if (!c) return
    if (phase === 'down') { setStart(c); setEnd(null) }
    else if (phase === 'move' || phase === 'up') setEnd((prev) => (prev && prev[0] === c[0] && prev[1] === c[1] ? prev : c))
  }
  const blockedEnd = dem && start && end && (isBlocked(dem, start[1] * dem.size + start[0], filter) || isBlocked(dem, end[1] * dem.size + end[0], filter))

  const stats = useMemo(() => {
    if (!route) return null
    const el = route.cells.map(([x, y]) => dem.elev[y * dem.size + x])
    const sl = route.cells.map(([x, y]) => dem.slope[y * dem.size + x])
    const avg = (a) => route.cells.reduce((s, [x, y]) => s + a[y * dem.size + x], 0) / route.cells.length
    return { rad: avg(dem.rad), temp: avg(dem.temp), km: route.distanceKm, min: Math.min(...el), max: Math.max(...el), slope: Math.max(...sl) }
  }, [route, dem])

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-cyan-900/50 bg-[#070c16] p-4 md:w-80 md:border-b-0 md:border-r">
        <header>
          <h1 className="text-lg font-bold tracking-wide text-cyan-300">MARS ROUTE · Gale</h1>
          <p className="text-xs text-slate-400">Prototipo de HUD de navegación EVA</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-slate-500">Filtros</h2>
          <label className="block text-sm">
            Altura máxima: <b className="text-cyan-300">{maxElev} m</b>
            <input type="range" className="w-full accent-cyan-400" min={dem?.elevMin ?? -4500} max={dem?.elevMax ?? 500} step={50}
              value={maxElev} onChange={(e) => setMaxElev(+e.target.value)} />
          </label>
          <label className="block text-sm">
            Pendiente máxima: <b className="text-cyan-300">{maxSlope}°</b>
            <input type="range" className="w-full accent-cyan-400" min={2} max={35} step={1}
              value={maxSlope} onChange={(e) => setMaxSlope(+e.target.value)} />
          </label>
          <p className="text-xs text-red-300/80">■ Rojo = zona bloqueada por el filtro</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-slate-500">Prioridades de la ruta <span className="normal-case text-amber-400">(radiación y temperatura simuladas)</span></h2>
          {[['slope', 'Evitar pendiente'], ['rad', 'Evitar radiación'], ['temp', 'Evitar frío']].map(([k, label]) => (
            <label key={k} className="block text-sm">
              {label}: <b className="text-cyan-300">{w[k]}</b>
              <input type="range" className="w-full accent-cyan-400" min={0} max={5} step={0.5} value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} />
            </label>
          ))}
          <label className="block text-sm">
            Capa en mapa:{' '}
            <select className="ml-1 rounded border border-cyan-900 bg-[#0b1322] p-1" value={layer} onChange={(e) => setLayer(e.target.value)}>
              <option value="none">Ninguna</option>
              <option value="rad">Radiación (sim.)</option>
              <option value="temp">Temperatura (sim.)</option>
            </select>
          </label>
        </section>

        <section className="text-sm">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">Ruta</h2>
          <p className="mb-2 text-slate-400">Mantén el clic en el <b className="text-green-400">inicio</b>, arrastra y suelta en el <b className="text-amber-400">destino</b>. <span className="text-slate-500">Shift+arrastrar mueve el mapa.</span></p>
          {noRoute && <p className="text-red-400">{blockedEnd ? 'El inicio o el destino cae en una zona roja (bloqueada). Elige puntos fuera del rojo o relaja los filtros.' : 'No hay camino con estos filtros. Relájalos.'}</p>}
          {stats && (
            <dl className="grid grid-cols-2 gap-2">
              <div><dt className="text-xs text-slate-500">Distancia</dt><dd className="text-lg text-cyan-300">{stats.km.toFixed(1)} km</dd></div>
              <div><dt className="text-xs text-slate-500">Pend. máx</dt><dd className="text-lg text-cyan-300">{stats.slope.toFixed(1)}°</dd></div>
              <div><dt className="text-xs text-slate-500">Radiación media*</dt><dd className="text-lg text-cyan-300">{stats.rad.toFixed(2)} mSv/d</dd></div>
              <div><dt className="text-xs text-slate-500">Temp. media*</dt><dd className="text-lg text-cyan-300">{stats.temp.toFixed(0)} °C</dd></div>
              <div><dt className="text-xs text-slate-500">Elev. mín</dt><dd className="text-lg text-cyan-300">{stats.min} m</dd></div>
              <div><dt className="text-xs text-slate-500">Elev. máx</dt><dd className="text-lg text-cyan-300">{stats.max} m</dd></div>
            </dl>
          )}
          {(start || end) && <button className="mt-3 rounded border border-cyan-800 px-3 py-1 text-xs hover:bg-cyan-900/40" onClick={() => { setStart(null); setEnd(null) }}>Reiniciar</button>}
        </section>

        <section className="shrink-0">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">Perfil de elevación</h2>
          <div className="h-40 md:h-48">{dem && <ElevationProfile dem={dem} route={route} />}</div>
        </section>

        <p className="shrink-0 text-[10px] leading-snug text-slate-500">
          *Simulado (radiación y temperatura). Mapa base: NASA Trek (MOLA). Elevación y pendiente: DEM MOLA/HRSC 200 m de USGS (datos reales).
        </p>
      </aside>

      <main className="relative min-h-0 flex-1">
        {error && <div className="absolute z-10 m-3 rounded bg-red-900 p-3 text-sm">{error}</div>}
        <MapView dem={dem} layer={layer} filter={filter} route={route} start={start} end={end} onPick={onPick} />
      </main>
    </div>
  )
}
