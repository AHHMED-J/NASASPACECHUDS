import { FIXED, CONST } from '../lib/constants'
import { SOLAR } from '../lib/radiation'
import { SEASONS } from '../lib/temperature'
const kinds = {real: 'DATA', modelo: 'MODEL', fuente: 'SOURCED CONSTANT', supuesto: 'TEAM ASSUMPTION', info: 'CONTEXT ONLY'}
const Heading = ({children}) => <h3 className="mt-6 mb-2 text-cyan-300 font-bold">{children}</h3>
export default function DataPanel({onClose,state}) {
 const {w,maxElev,solar,ls,hour,temp,stats}=state
 const row=temp?.table[ls]?.[hour]
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4" onClick={onClose}>
 <div role="dialog" aria-modal="true" aria-label="Data and assumptions" className="relative mx-auto my-6 max-w-3xl border border-white/20 bg-[#131321] p-6 text-slate-200" onClick={e=>e.stopPropagation()}>
 <button className="float-right border border-white/20 px-3 py-2" onClick={onClose} aria-label="Close data panel">×</button>
 <h2 className="text-xl text-cyan-300">Route data and assumptions</h2>
 <p className="mt-3 text-sm">A* minimizes modeled total cost: distance multiplied by cell preferences and climbing effort. Data, models and team assumptions are identified below.</p>
 <Heading>1 · Scenario and route preferences</Heading>
 <p>{SEASONS[ls]} · Local time {String(hour).padStart(2,'0')}:00 · {SOLAR[solar].label}</p>
 <p>Maximum elevation: {maxElev} m. Fixed weights: effort {w.effort}, radiation {w.rad}, roughness {w.rough}, communication {w.comm}, dunes {w.sand}.</p>
 <p>Factors are normalized from 0 to 1. A weight of 1 doubles the per-meter cost at maximum risk. These weights are team choices, not physical quantities. Start and destination are selected on the map.</p>
 <Heading>2 · Fixed parameters and sources</Heading>
 <ul className="space-y-3">{FIXED.map(item=><li key={item.id}><b>{item.label}: {item.value}</b> <small>({kinds[item.kind]})</small><p>{item.source} {item.url && <a className="underline text-cyan-300" href={item.url} target="_blank" rel="noreferrer">Source</a>}</p>{item.caveat && <p className="text-amber-300">Note: {item.caveat}</p>}</li>)}</ul>
 <Heading>3 · Terrain data</Heading>
 <p>USGS MOLA–HRSC global blended DEM v2, Gale crop at 200 m; the Curiosity comparison can use a 50 m grid derived from a 1 m DEM. Elevation range: {Math.round(state.elevMin)} to {Math.round(state.elevMax)} m. Slopes describe the grid scale, not individual footholds.</p>
 <p>Roughness is deviation from a plane in 3×3-cell windows, normalized to the regional 95th percentile. It is a terrain proxy, not a map of individual rocks.</p>
 <p>Dune fields: USGS Mars Global Digital Dune Database (Hayward et al., 2007). Two fields in Gale include Bagnold dunes (425 km²) and field 1376-059 (414 km²), mapped using THEMIS and MOC imagery. Cell coverage increases cost; it does not block travel. Field boundaries contain both sand and rock. <a className="underline" href="https://pubs.usgs.gov/of/2007/1158/" target="_blank" rel="noreferrer">USGS source</a></p>
 <Heading>4 · Environmental and mobility models</Heading>
 <p>Mars Climate Database v6: average-dust climate scenario at the region center, not a live measurement. Surface: {row ? (row.surf-273.15).toFixed(0) : '–'} °C; air: {row ? (row.air-273.15).toFixed(0) : '–'} °C; pressure: {row ? row.pres.toFixed(0) : '–'} Pa.</p>
 <p>Radiation is anchored to MSL/RAD (~0.67 mSv/day) and HZETRN2015 dose–pressure relationships (Guo et al., 2018). Pressure varies with MCD season/time and elevation using an assumed 210 K isothermal atmosphere. Outside 700–950 Pa, the relationship is extrapolated linearly. Local shielding and albedo are not modeled. Risk scale: 0.60 to 0.90 mSv/day maps to 0 to 1.</p>
 <p>Walking effort uses the Minetti et al. (2002) gradient polynomial. Coefficients have not been verified against the original paper. It describes unsuited walking on Earth, not Mars. Normalized effort: 0 for gentle downhill, 1 for climbing at {CONST.MAX_SLOPE_DEG}°, approximately 0.12 on level ground.</p>
 <p>Shadow is calculated from terrain and solar geometry; it is visual only and does not change routing or predict cooling.</p>
 <p>Communication is approximate line of sight to base with {CONST.ANTENNA_H_M} m antennas and Mars curvature. Radio range and small terrain obstacles are not modeled.</p>
 <p>Diagonal moves cannot cut through blocked grid corners. Time equals distance divided by {CONST.WALK_KMH} km/h. Dose sums modeled rate multiplied by travel time, without suit shielding. The {CONST.DOSE_LIMIT_MSV} mSv reference is a career limit, not a walk limit.</p>
 <p>Temperature is shown for context and compared with the lunar suit reference. It does not affect routing because the climate grid has little spatial variation within this area.</p>
 {stats && <><Heading>5 · Current route</Heading><p>{stats.km.toFixed(1)} km · {stats.timeH.toFixed(1)} h walking · estimated dose {stats.doseMsv.toFixed(3)} mSv ({(100*stats.doseMsv/CONST.DOSE_LIMIT_MSV).toFixed(2)}% of the career reference) · effort {stats.effortRel.toFixed(2)}× level-ground effort · {stats.visPct.toFixed(0)}% with line of sight · maximum distance from base {stats.maxExcKm.toFixed(1)} km.</p></>}
 <Heading>6 · Not modeled</Heading><ul className="list-disc pl-5"><li>Loose sand outside mapped dune fields and individual dune shapes.</li><li>Individual rocks and meter-scale slopes.</li><li>Oxygen, energy, suit endurance and Mars gravity effects on effort.</li><li>Dust storms, changing dust scenarios and local temperature variation.</li><li>Return routes, total mission duration and science tasks.</li><li>Mars-specific suit thermal limits.</li></ul>
 </div></div>
}
