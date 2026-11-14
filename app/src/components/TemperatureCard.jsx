import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { kToC, SEASONS } from '../lib/temperature'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

export default function TemperatureCard({ temp, ls, setLs, hour, setHour }) {
  if (!temp) return <p className="text-xs text-slate-500">Cargando temperatura…</p>
  const row = temp.table[ls]
  const now = row[hour]
  const hours = temp.lt
  const line = (key, color) => ({
    label: key === 'surf' ? 'Superficie' : 'Aire (2 m)',
    data: hours.map((h) => +kToC(row[h][key]).toFixed(1)),
    borderColor: color, pointRadius: hours.map((h) => (h === hour ? 5 : 0)), pointBackgroundColor: color, tension: 0.3,
  })
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        Estación:{' '}
        <select className="ml-1 w-full rounded border border-cyan-900 bg-[#0b1322] p-1 text-xs" value={ls} onChange={(e) => setLs(+e.target.value)}>
          {temp.ls.map((v) => <option key={v} value={v}>{SEASONS[v]}</option>)}
        </select>
      </label>
      <label className="block">
        Hora local: <b className="text-cyan-300">{String(hour).padStart(2, '0')}:00</b>
        <input type="range" className="w-full accent-cyan-400" min={0} max={22} step={2} value={hour} onChange={(e) => setHour(+e.target.value)} />
      </label>
      <dl className="grid grid-cols-2 gap-2">
        <div><dt className="text-xs text-slate-500">Superficie</dt><dd className="text-lg text-cyan-300">{kToC(now.surf).toFixed(0)} °C</dd></div>
        <div><dt className="text-xs text-slate-500">Aire (2 m)</dt><dd className="text-lg text-cyan-300">{kToC(now.air).toFixed(0)} °C</dd></div>
      </dl>
      <div className="h-32">
        <Line
          data={{ labels: hours.map((h) => `${h}h`), datasets: [line('surf', '#f59e0b'), line('air', '#22d3ee')] }}
          options={{
            animation: false, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } } } },
            scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, title: { display: true, text: '°C', color: '#94a3b8' } } },
          }}
        />
      </div>
    </div>
  )
}
