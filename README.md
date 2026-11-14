# NASA Space Apps – Health Monitoring

## Requisitos (todos)
- Git
- Node 24 (usa `nvm use` en Mac/Linux, o nvm-windows / instalador desde nodejs.org)
- Un editor (VS Code recomendado)

## Arrancar
1. `git clone https://github.com/AHHMED-J/NASASPACECUCKS.git && cd NASASPACECUCKS`
2. `cp .env.example .env` (en Windows: `copy .env.example .env`) y rellena las claves, pedidas por el chat privado.
3. `cd app && npm install && npm run dev`
4. Abre http://localhost:5173

## Reglas
- Instalar paquetes: `npm install <paquete>` y commit de `package.json` + `package-lock.json`. Nunca borres el lockfile.
- Tras un pull con dependencias nuevas: `npm install`.
- Nunca subas `.env`. Las variables `VITE_*` son visibles en el navegador: no pongas secretos ahí.
- Nombres de archivo con mayúsculas exactas (`Header.jsx` se importa como `./Header`).

## Demo: Mars Route (Gale)
Prototipo de HUD de navegación: mapa de Gale (NASA Trek vía OpenLayers), filtros de **altura** y **pendiente**, ruta A* entre dos clics y perfil de elevación (Chart.js).

- Stack: React + Vite + Tailwind + OpenLayers + proj4 + Chart.js.
- Capa base: NASA Trek WMTS (MOLA ClrShade, EPSG:104905).
- Elevación y pendiente: **datos reales**. DEM global MOLA/HRSC 200 m de USGS (metros), recortado a Gale con `npm run fetch-dem` (peticiones parciales, no baja los ~11 GB). Resultado en `app/public/data/gale-dem.json`. Licencia: MOLA (CC0) + HRSC (CC BY-SA 3.0 IGO); citar autores.
- **Radiación: modelo anclado en datos de la NASA** (`app/src/lib/radiation.js`). Fuente: Guo et al. 2018, JGR, https://arxiv.org/abs/1712.06987 (MSL/RAD + HZETRN2015).
  - Referencia medida en Gale: ~220 µGy/día × Q≈3.05 → **~0.67 mSv/día** (a ~-4.4 km, 840 Pa).
  - Pendiente dosis-presión: 126 µSv/día cada 250 Pa (HZETRN2015, Φ=500 MV); se debilita con la actividad solar y se anula hacia Φ≈900-1000 MV (selector "Actividad solar").
  - La presión por altura usa una atmósfera isoterma (T=210 K, **supuesto nuestro**).
  - **Límite importante:** Curiosity está siempre a ~-4.4 km, así que lo medido cubre solo 700-950 Pa. Las zonas altas del recorte (hasta ~+1 km) son **extrapolación lineal**. No se modela relieve local ni albedo.
  - El modelo coincide con RAD en el punto de anclaje **por construcción**: es referencia, no validación independiente.
- **Temperatura: datos reales de la Mars Climate Database** (LMD, v6.2, escenario "climatology average solar"), consultados con `npm run fetch-mcd` (48 consultas con pausa; la web es de uso moderado) → `app/public/data/gale-temp.json`. Tabla de 4 estaciones (Ls 0/90/180/270) × 12 horas locales, en el centro de la zona. En Gale la superficie va de ~-90 °C de noche a ~+13 °C de día.
  - **Es una condición de hora/estación, no un costo espacial:** medimos 9 puntos dentro de los 150 km y la MCD solo varía ~1 K (su resolución es gruesa). Por eso no entra en el costo de A* ni hay capa de temperatura. Para variación espacial haría falta inercia térmica/albedo (THEMIS/TES, vía Trek).
  - Créditos de la MCD: LMD/OU/IAA/ESA/CNES. https://www-mars.lmd.jussieu.fr/mcd_python/
- A* solo lee `radRisk` (riesgo de radiación 0-1 en escala física fija), pendiente y los filtros de altura/pendiente.
