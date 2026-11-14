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
Prototipo de HUD de navegación: mapa de Gale (NASA Trek vía OpenLayers), filtro de **altura máxima**, ruta A* multifactor entre dos clics y perfil de elevación (Chart.js).

- Stack: React + Vite + Tailwind + OpenLayers + proj4 + Chart.js.
- Capa base: NASA Trek WMTS (MOLA ClrShade, EPSG:104905).
- Elevación y pendiente: **datos reales a alta resolución**. DEM "Mars MSL Gale Merged DEM 1m" de USGS (HiRISE + CTX + HRSC, anclado a MOLA), zona de Curiosity (~137.1-137.7°E, -5.1 a -4.1°N, ~33×57 km). `npm run fetch-dem` lee el GeoTIFF remoto de 3.6 GB por filas (peticiones parciales, ~300 MB) y lo promedia a **celdas de 50 m** → `app/public/data/gale-dem.f32` (+ `.json`). Rango obtenido: -4625 a -328 m (USGS publica -4625.9 a -322.6). El 82% del rectángulo tiene dato; el resto se marca en gris y queda bloqueado. Fuente: https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m
  - Pendiente calculada sobre celdas de 50 m (antes 740 m). Sigue siendo regional, no la escala de un rover (metros).
  - Mapa base (selector): **ortofoto HiRISE** de Curiosity servida por NASA Trek (capa `curiosity_hirise_mosaic`, WMTS hasta nivel 16 ≈ 0.6 m/px, en escala de grises, cobertura 137.12-137.73°E / -4.93 a -4.25°N), relieve sombreado generado del DEM, o Trek MOLA (463 m, borroso a este zoom). La ortofoto es solo para mirar: A* no la usa.
- **Radiación: modelo anclado en datos de la NASA** (`app/src/lib/radiation.js`). Fuente: Guo et al. 2018, JGR, https://arxiv.org/abs/1712.06987 (MSL/RAD + HZETRN2015).
  - Referencia medida en Gale: ~220 µGy/día × Q≈3.05 → **~0.67 mSv/día** (a ~-4.4 km, 840 Pa).
  - Pendiente dosis-presión: 126 µSv/día cada 250 Pa (HZETRN2015, Φ=500 MV); se debilita con la actividad solar y se anula hacia Φ≈900-1000 MV (selector "Actividad solar").
  - La presión por altura usa una atmósfera isoterma (T=210 K, **supuesto nuestro**).
  - **Límite importante:** Curiosity está siempre a ~-4.4 km, así que lo medido cubre solo 700-950 Pa. Las zonas altas del recorte (hasta ~+1 km) son **extrapolación lineal**. No se modela relieve local ni albedo.
  - El modelo coincide con RAD en el punto de anclaje **por construcción**: es referencia, no validación independiente.
- **Temperatura: datos reales de la Mars Climate Database** (LMD, v6.2, escenario "climatology average solar"), consultados con `npm run fetch-mcd` (48 consultas con pausa; la web es de uso moderado) → `app/public/data/gale-temp.json`. Tabla de 4 estaciones (Ls 0/90/180/270) × 12 horas locales (temperatura de superficie/aire y presión de superficie), en el centro de la zona. En Gale la superficie va de ~-90 °C de noche a ~+13 °C de día.
  - **Es una condición de hora/estación, no un costo espacial:** medimos 9 puntos dentro de los 150 km y la MCD solo varía ~1 K (su resolución es gruesa). Por eso no entra en el costo de A* ni hay capa de temperatura. Para variación espacial haría falta inercia térmica/albedo (THEMIS/TES, vía Trek).
  - Créditos de la MCD: LMD/OU/IAA/ESA/CNES. https://www-mars.lmd.jussieu.fr/mcd_python/
- Radiación y estación: la presión de superficie de cada celda parte de la presión **real de la MCD** para la estación y hora elegidas (721-965 Pa en nuestra zona, coherente con el rango medido por REMS de 700-950 Pa que cita el paper).

### Parámetros de la ruta (A*)
**Constantes (no editables en la UI, ver `app/src/lib/constants.js`)**: pendiente máx. 20° (valor Artemis/xEMU lunar, supuesto), velocidad 2.7 km/h, excursión máx. 10 km (solo aviso), límite de dosis 600 mSv, rango térmico del traje 93–378 K (xEMU lunar; no hay límite de traje marciano publicado), base (Bradbury Landing), altura de antena 2 m, oblicuidad de Marte 25.19°, celda 50 m.

**Variables (barra lateral)**: actividad solar, estación, hora local, pesos de esfuerzo / radiación / terreno rugoso / comunicación / sol, y altura máxima.

**Factores en el costo**: esfuerzo metabólico (polinomio de Minetti 2002, coeficientes de memoria, sin verificar contra el paper; gravedad terrestre) + penalización por pendiente lateral (forma supuesta); radiación (modelo Guo 2018); rugosidad (desviación estándar de alturas de 1 m tras quitar tendencia, relativa al p95; es un proxy, el DEM no resuelve rocas; `gale-rough.f32` vía `npm run fetch-dem`); comunicación (línea de vista a la base, viewshed); sol/sombra (posición solar + sombras del terreno). Bloqueo: altura > máx., pendiente > 20° o sin dato.

**Botón "Ver todos los datos considerados"** (`DataPanel.jsx`): lista parámetros variables, constantes con fuente, datos reales, modelos, resultado de la ruta actual y lo que NO se considera (dunas/arena, margen a acantilados más allá de no cortar esquinas, temperatura espacial, etc.).
