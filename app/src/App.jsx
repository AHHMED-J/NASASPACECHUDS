import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import ElevationProfile from './components/ElevationProfile'
import TemperatureCard from './components/TemperatureCard'
import { loadDem } from './lib/dem'
import { radiationFor, SOLAR } from './lib/radiation'
import { loadTemp, SEASONS } from './lib/temperature'
import { shadeMap } from './lib/sun'
import { effortRel } from './lib/effort'
import { CONST } from './lib/constants'
import { findRoute, isBlocked } from './lib/route'
import { explainRoute, REASONS } from './lib/explain'
import { loadCuriosity, compareRoutes, cutAtSol, solDate } from './lib/curiosity'
import DataPanel from './components/DataPanel'

// Pesos fijos de la ruta (ya no son controles): siempre se minimizan esfuerzo, radiación y rugosidad y se mantiene comunicación.
// 'Sol' queda en 0: no aporta seguridad (no modelamos calor/energía) y la sombra sigue disponible como capa.
const W = { effort: 1, rad: 2, rough: 1, comm: 1, sand: 1, dust: 1 }
// Modo comparación con Curiosity: solo relieve (esfuerzo por subidas/bajadas y el bloqueo por pendiente > 20°).
const W_RELIEF = { effort: 1, rad: 0, rough: 0, comm: 0, sand: 0, dust: 0 }
const LAYERS = [
  ['none', 'None'],
  ['rad', 'Radiation (red = higher dose)'],
  ['rough', 'Roughness (red = rougher)'],
  ['comm', 'Communication (red = no line of sight to base)'],
  ['shade', 'Shadow (red = shaded)'],
  ['sand', 'USGS dune fields (red = dunes)'],
  ['dust', 'Dust, THEMIS thermal inertia (red = dust)'],
]

const Select = (props) => <select {...props} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm" />
const Title = ({ children }) => <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h2>

export default function App() {
  const [craterDem, setDem] = useState(null) // cráter completo, 200 m
  const [detailDem, setDetailDem] = useState(null) // zona de Curiosity, 50 m (del DEM de 1 m)
  const [temp, setTemp] = useState(null)
  const [error, setError] = useState(null)
  const [solar, setSolar] = useState('mid')
  const [ls, setLs] = useState(90)
  const [hour, setHour] = useState(12)
  const [maxElevSel, setMaxElevSel] = useState(null)
  const [bench, setBench] = useState(false) // comparar con el recorrido real de Curiosity
  const [curiosity, setCuriosity] = useState(null)
  const [benchRes, setBenchRes] = useState('detail') // DEM usado en la comparación
  const [benchSand, setBenchSand] = useState(false) // en la comparación: además del relieve, evitar dunas (USGS)
  const [solIdx, setSolIdx] = useState(null) // recorte del recorrido de Curiosity (índice en curiosity.sols; null = último)
  const [showData, setShowData] = useState(false)
  const w = useMemo(() => (bench ? { ...W_RELIEF, sand: benchSand ? 1 : 0 } : W), [bench, benchSand])
  const useDetail = bench && benchRes === 'detail'
  const baseDem = useDetail ? detailDem : craterDem
  const [basemap, setBasemap] = useState('relief')
  const [layer, setLayer] = useState('none')
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [centerRequest, setCenterRequest] = useState(0)
  const [panel, setPanel] = useState(null)
  const [picking, setPicking] = useState(null)
  const panelTrigger = useRef(null)
  const panelClose = useRef(null)
  const closePanel = () => { setPanel(null); panelTrigger.current?.focus() }
  const openPanel = (name, event) => { panelTrigger.current = event.currentTarget; setPanel(name) }
  useEffect(() => {
    if (!panel) return
    panelClose.current?.focus()
    const escape = (event) => { if (event.key === 'Escape') { setPanel(null); panelTrigger.current?.focus() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [panel])

  useEffect(() => { loadDem().then(setDem).catch((e) => setError(e.message)) }, [])
  useEffect(() => { loadTemp().then(setTemp).catch((e) => setError(e.message)) }, [])
  useEffect(() => { if (useDetail && !detailDem) loadDem('gale50').then(setDetailDem).catch((e) => setError(e.message)) }, [useDetail, detailDem])
  useEffect(() => { if (bench && !curiosity) loadCuriosity().then(setCuriosity).catch((e) => setError(e.message)) }, [bench, curiosity])
  // al cambiar de DEM las celdas no coinciden: se reinicia la ruta
  useEffect(() => { setStart(null); setEnd(null) }, [baseDem])

  // sombras: solo se calculan si se mira esa capa (no entran en la ruta); dependen de la estación y la hora
  const shade = useMemo(() => (baseDem && layer === 'shade' ? shadeMap(baseDem, ls, hour) : null), [baseDem, layer, ls, hour])
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
  // en comparación no hay filtro de altura: solo cuenta el relieve
  const filter = useMemo(() => ({ maxElev: bench ? Infinity : maxElev, maxSlope: CONST.MAX_SLOPE_DEG }), [maxElev, bench])

  // Un solo cálculo A* a la vez y siempre con el último destino (los movimientos intermedios no se acumulan).
  const [rawRoute, setRoute] = useState(null)
  const [why, setWhy] = useState(null) // explicación de los giros de la ruta actual
  const [sel, setSel] = useState(null) // giro seleccionado
  const [computing, setComputing] = useState(false)
  const job = useRef({ busy: false, again: false, args: null })
  useEffect(() => {
    const j = job.current
    if (!dem || !start || !end) { setRoute(null); setWhy(null); setSel(null); return }
    j.args = { dem, start, end, filter, w }
    if (j.busy) { j.again = true; return }
    const run = () => {
      j.busy = true
      setComputing(true)
      setTimeout(() => {
        const a = j.args
        const r = findRoute(a.dem, a.start, a.end, a.filter, a.w)
        if (r) r.elev = a.dem.elev // malla con la que se calculó
        setRoute(r)
        setWhy(r ? explainRoute(a.dem, r, a.w, a.filter) : null) // mismos datos y pesos que A*
        setSel(null)
        j.busy = false
        if (j.again) { j.again = false; run() } else setComputing(false)
      }, 0)
    }
    run()
  }, [dem, start, end, filter, w])
  // la ruta solo vale para el DEM con el que se calculó (al cambiar de DEM se descarta)
  const route = rawRoute && dem && rawRoute.elev === dem.elev ? rawRoute : null
  const noRoute = start && end && !computing && !route

  // clic 1 = inicio, clic 2 = destino (A* y la explicación se calculan una sola vez); un tercer clic empieza otra ruta
  const onPick = (phase, [lon, lat]) => {
    if (!dem) return
    const c = dem.cellOf(lon, lat)
    if (!c) return
    if (picking === 'start' || (!picking && (!start || end))) { setStart(c); setEnd(null); setPicking('end') }
    else { setEnd(c); setPicking(null) }
  }
  const blockedEnd = dem && start && end && (isBlocked(dem, start[1] * dem.w + start[0], filter) || isBlocked(dem, end[1] * dem.w + end[0], filter))

  const stats = useMemo(() => {
    if (!route) return null
    const { cells } = route
    const speed = CONST.WALK_KMH * 1000 // m/h
    const idx = (c) => c[1] * dem.w + c[0]
    let seg = 0, eff = 0, dose = 0, vis = 0, minE = Infinity, maxE = -Infinity, maxExc = 0
    cells.forEach((c, k) => {
      const i = idx(c)
      minE = Math.min(minE, dem.elev[i]); maxE = Math.max(maxE, dem.elev[i])
      if (dem.visible[i]) vis++
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
      visPct: (100 * vis) / cells.length, min: Math.round(minE), max: Math.round(maxE), maxExcKm: maxExc / 1000, tMin, tMax,
    }
  }, [route, dem, temp, ls, hour])

  const solList = curiosity?.sols ?? []
  const solSel = solList.length ? solList[solIdx ?? solList.length - 1][0] : null
  const curCut = useMemo(() => (curiosity ? cutAtSol(curiosity, solSel) : null), [curiosity, solSel])
  const cmp = useMemo(() => {
    if (!bench || !curCut || !route || !dem) return null
    const ours = route.cells.map(([x, y]) => dem.lonLat(x, y))
    return compareRoutes(ours, curCut.coords)
  }, [bench, curCut, route, dem])
  const useCuriosityEnds = () => {
    if (!dem || !curCut) return
    const a = curCut.coords[0], b = curCut.coords[curCut.coords.length - 1]
    setStart(dem.cellOf(a[0], a[1])); setEnd(dem.cellOf(b[0], b[1])); setPicking(null)
  }

  const warnings = []
  if (stats) {
    if (stats.maxExcKm > CONST.MAX_EXCURSION_KM) warnings.push(`Reaches ${stats.maxExcKm.toFixed(1)} km from base (planning limit: ${CONST.MAX_EXCURSION_KM} km).`)
    if (stats.tMin !== null && (stats.tMin < CONST.SUIT_EXT_K[0] || stats.tMax > CONST.SUIT_EXT_K[1])) warnings.push('Temperature is outside the external design range of the lunar suit.')
    if (stats.visPct < 100) warnings.push(`${(100 - stats.visPct).toFixed(0)}% of the route has no line of sight to base.`)
  }

  return (
    <div className={`screen-app ${adminOpen ? 'admin-open' : ''}`}>
      {panel && <button className="sheet-backdrop" aria-label="Close panel" onClick={closePanel} />}

      <aside className="screen-sheet" hidden={!panel} aria-labelledby="sheet-heading" onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const focusable = [...event.currentTarget.querySelectorAll('button, input, select, summary, a[href]')].filter(el => el.getClientRects().length && !el.disabled)
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }} role="dialog" aria-modal={panel ? 'true' : undefined}>
        <header className="sheet-heading"><h2 id="sheet-heading">{{plan: 'Plan route', layers: 'Map and layers', results: 'Results'}[panel]}</h2><button className="panel-close" ref={panelClose} onClick={closePanel} aria-label="Close panel">×</button></header>



        <section hidden={panel !== 'plan'}>
          <Title>Route</Title>
          <div className="point-controls">
            {[['start', 'Start', start], ['end', 'Destination', end]].map(([id, label, cell]) => <button key={id} disabled={!dem} onClick={() => { setPicking(id); closePanel() }}><span>{label}</span><small>{cell && dem ? dem.lonLat(...cell).map(v => v.toFixed(3) + '°').join(', ') : 'Choose on map'}</small></button>)}
          </div>

          <label className="mb-4 block text-sm">
            <div className="flex items-baseline justify-between"><span className="text-slate-400">Maximum elevation</span><b className="text-base text-cyan-300">{maxElev} m</b></div>
            <input type="range" className="mt-1 w-full accent-cyan-400" min={baseDem?.elevMin ?? -4500} max={baseDem?.elevMax ?? 0} step={50} value={maxElev} onChange={(e) => setMaxElevSel(+e.target.value)} />
          </label>
          {noRoute && <p className="mt-2 text-sm text-red-400">{blockedEnd ? 'The start or destination is in a blocked area.' : 'No route meets these limits. Increase maximum elevation or choose different points.'}</p>}
          {stats && (
            <div className="mt-3 space-y-1.5">
              {stats.tMin !== null && <p className="text-xs text-slate-400">Surface temperature during the walk: {(stats.tMin - 273.15).toFixed(0)} to {(stats.tMax - 273.15).toFixed(0)} °C</p>}
              {warnings.map((m) => <p key={m} className="rounded-md bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-300">{m}</p>)}
            </div>
          )}
          {(start || end) && <button className="mt-3 rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => { setStart(null); setEnd(null); setPicking(null) }}>Reset</button>}
        </section>

        {route && why && (
          <section hidden={panel !== 'results'}>
            <Title>Why this route</Title>
            {why.items.length === 0 ? (
              <p className="text-sm text-slate-400">Nearly straight: no major detours.</p>
            ) : (
              <div className="space-y-3">{why.items.map(it => <p key={it.n} className="text-sm leading-relaxed">{it.text}</p>)}</div>
            )}
          </section>
        )}

        <section hidden={panel !== 'results'}>
          <Title>Elevation profile</Title>
          <div className="h-40">{dem && <ElevationProfile dem={dem} route={route} />}</div>
        </section>



        <details open hidden={panel !== 'layers'} className="screen-options">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">Map</summary>
          <div className="mt-3 space-y-3">
            <label className="block"><span className="text-slate-400">Basemap</span>
              <Select value={basemap} onChange={(e) => setBasemap(e.target.value)}>
                <option value="relief">DEM relief</option>
                <option value="trek">NASA Trek (MOLA)</option>
              </Select>
            </label>
            <label className="block"><span className="text-slate-400">Layer</span>
              <Select value={layer} onChange={(e) => setLayer(e.target.value)}>
                {LAYERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </Select>
            </label>
            <p className="text-[11px] text-slate-500"><span className="text-red-300/80">■</span> blocked (too high or &gt;{CONST.MAX_SLOPE_DEG}°) · <span className="text-slate-400">■</span> no data · <span className="text-sky-300">▲</span> base</p>
          </div>
        </details>

        {panel === 'results' && !route && <p>Plan a route to see its results.</p>}
        {panel === 'results' && stats && <dl className="detail-metrics"><div><dt>Estimated dose</dt><dd>{stats.doseMsv.toFixed(3)} mSv</dd></div><div><dt>Communication</dt><dd>{stats.visPct.toFixed(0)}%</dd></div><div><dt>Elevation</dt><dd>{stats.min} to {stats.max} m</dd></div></dl>}
      </aside>

      <aside className="admin-sidebar" id="admin-sidebar" aria-label="Map controls and admin">
        <div className="sidebar-actions"><button type="button" className="screen-admin" aria-expanded={adminOpen} aria-controls="admin-content" onClick={() => setAdminOpen(value => !value)}>Admin</button><button type="button" className="screen-center" disabled={!dem} onClick={() => setCenterRequest(value => value + 1)}>Center</button></div>
        {adminOpen && <div id="admin-content">
        <header className="admin-heading"><h2 id="admin-title">Admin</h2><button type="button" aria-label="Close admin sidebar" onClick={() => setAdminOpen(false)}>×</button></header>
        {route && why && <section><h3>Why this route</h3>
          {why.items.length === 0 ? <p>Nearly straight: no major detours.</p> : <>
            <div className="mb-3 flex flex-wrap gap-1.5">{Object.entries(why.summary).sort((a, b) => b[1] - a[1]).map(([k, n]) => <span key={k} className="border border-[#fbe2b499] px-2 py-0.5 text-[12px]">{REASONS[k].icon} {REASONS[k].label} ×{n}</span>)}</div>
            <ol className="space-y-1.5">{why.items.map((it) => <li key={it.n}><button type="button" onClick={() => setSel(sel === it.n ? null : it.n)} className={`flex w-full gap-2 text-left text-[13px] ${sel === it.n ? 'bg-white/15' : ''}`}><b className="shrink-0">{it.n}</b><span>{it.text}</span></button></li>)}</ol>
            <p className="mt-2">Tap a number (here or on the map) to see the straight path that was rejected.</p>
          </>}
          <div className="mt-4 h-40"><ElevationProfile dem={dem} route={route} /></div>
          {noRoute && <p className="text-red-400">{blockedEnd ? 'The start or destination is in a blocked area.' : 'No route meets these limits. Increase maximum elevation.'}</p>}
          <button type="button" className="mt-3" onClick={() => { setStart(null); setEnd(null); setPicking(null) }}>Reset route</button>
        </section>}
        <section><h3>Terrain</h3><label>Maximum elevation <strong>{maxElev} m</strong><input type="range" disabled={!baseDem} min={baseDem?.elevMin ?? -4500} max={baseDem?.elevMax ?? 0} step={50} value={maxElev} onChange={e => setMaxElevSel(+e.target.value)} /></label><p>Terrain above this elevation or steeper than {CONST.MAX_SLOPE_DEG}° is blocked.</p></section>
        <section><h3>Map</h3><label>Basemap<Select value={basemap} onChange={e => setBasemap(e.target.value)}><option value="relief">DEM relief</option><option value="trek">NASA Trek (MOLA)</option></Select></label><label>Layer<Select value={layer} onChange={e => setLayer(e.target.value)}>{LAYERS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></label></section>
        <section><h3>Environment</h3><TemperatureCard temp={temp} ls={ls} hour={hour} setHour={setHour} /><label>Season<Select value={ls} onChange={e => setLs(+e.target.value)}>{Object.entries(SEASONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></label><label>Solar activity<Select value={solar} onChange={e => setSolar(e.target.value)}>{Object.entries(SOLAR).map(([value,item]) => <option key={value} value={value}>{item.label}</option>)}</Select></label></section>
        <section><h3>Compare with Curiosity</h3>
          <label className="flex items-center gap-2"><input type="checkbox" checked={bench} onChange={(e) => setBench(e.target.checked)} /> Show Curiosity's real traverse</label>
          {bench && <>
            <p>Our route uses <b>relief only</b> (climbing and the {CONST.MAX_SLOPE_DEG}° limit). Curiosity's traverse is only drawn; it does not influence our route.</p>
            {curCut && solSel !== null && <label>Curiosity up to sol <strong>{solSel}</strong> · {solDate(solSel).toLocaleDateString('en', { year: 'numeric', month: 'short' })} · {curCut.km.toFixed(1)} km
              <input type="range" min={0} max={solList.length - 1} value={solIdx ?? solList.length - 1} onChange={(e) => setSolIdx(+e.target.value)} /></label>}
            <label>Terrain grid<Select value={benchRes} onChange={(e) => setBenchRes(e.target.value)}><option value="detail">50 m · Curiosity area (1 m DEM)</option><option value="crater">200 m · full crater</option></Select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={benchSand} onChange={(e) => setBenchSand(e.target.checked)} /> Avoid dune fields (USGS)</label>
            <button type="button" disabled={!curCut || !dem} onClick={useCuriosityEnds}>Use its start and its position on that sol</button>
            {cmp && <dl className="detail-metrics mt-3">
              <div><dt>Mean distance to Curiosity</dt><dd>{(cmp.meanM / 1000).toFixed(2)} km</dd></div>
              <div><dt>Maximum distance</dt><dd>{(cmp.maxM / 1000).toFixed(2)} km</dd></div>
              <div><dt>Route within {cmp.tolM} m of Curiosity</dt><dd>{cmp.within.toFixed(0)}%</dd></div>
              <div><dt>Length: ours / Curiosity</dt><dd>{route.distanceKm.toFixed(1)} / {curCut.km.toFixed(1)} km</dd></div>
            </dl>}
            <p>Curiosity did not look for the shortest path: it detoured for science targets, sand and wheel damage. This is an approximate benchmark.</p>
          </>}
        </section>
        <section><h3>Data</h3><p>Data sources, models and team assumptions behind the route.</p><button type="button" onClick={() => setShowData(true)}>Data sources and assumptions</button></section>
        </div>}
      </aside>
      <main className="screen-map" aria-label="Gale map">

        {error && <div className="absolute z-10 m-3 rounded bg-red-900 p-3 text-sm">{error}</div>}
        <MapView centerRequest={centerRequest} curiosity={bench ? curCut?.coords : null} dem={dem} layer={layer} basemap={basemap} filter={filter} route={route} start={start} end={end} onPick={onPick} why={route ? why : null} sel={sel} onSelect={(n) => setSel((s) => (s === n ? null : n))} />
      </main>
      {showData && <DataPanel onClose={() => setShowData(false)} state={{ w, maxElev, solar, ls, hour, temp, stats, elevMin: baseDem?.elevMin, elevMax: baseDem?.elevMax }} />}
      <footer className="screen-footer"><div className="route-summary" aria-label="Route distance and time"><span><strong aria-label="Distance">{stats ? stats.km.toFixed(1) : '0'} km</strong></span><span><strong aria-label="Time">{stats ? stats.timeH.toFixed(1) : '0'} hrs</strong></span></div></footer>


    </div>
  )
}
