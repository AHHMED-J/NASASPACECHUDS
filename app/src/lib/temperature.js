// Temperatura real de la Mars Climate Database (LMD) en el centro de Gale, por estación (Ls) y hora local.
// Generado por `npm run fetch-mcd` -> public/data/gale-temp.json
export async function loadTemp() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/gale-temp.json`)
  if (!res.ok) throw new Error('Could not load gale-temp.json (run: npm run fetch-mcd)')
  return res.json()
}
export const kToC = (k) => k - 273.15
export const SEASONS = {
  0: 'Ls 0° (equinox, northern spring)',
  90: 'Ls 90° (solstice, northern summer)',
  180: 'Ls 180° (equinox, northern autumn)',
  270: 'Ls 270° (solstice, southern summer)',
}
