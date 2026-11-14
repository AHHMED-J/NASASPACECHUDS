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
- Elevación y pendiente (rama `feature/gale-full`): **todo el cráter Gale (~311×311 km, 136.4-139.2°E / -6.8 a -4.0°N) a 200 m**, del DEM global USGS "MOLA–HRSC Blended DEM 200 m v2" (https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m). `npm run fetch-dem` lee solo esa ventana del GeoTIFF remoto (~1.4 MB por peticiones parciales) → `app/public/data/gale-dem.f32` (829×830 celdas, 2.7 MB) + `gale-rough.f32` (rugosidad a ~600 m: desviación respecto a un plano en 3×3 celdas). Rango: -4688 a +1464 m. El DEM de 1 m de la zona de Curiosity sigue disponible con `npm run fetch-dem-1m` (sobrescribe los mismos archivos).
  - A 200 m la pendiente y la rugosidad se suavizan: se subestiman pendientes abruptas, y no se ven rocas. La línea de vista incluye la curvatura de Marte (a 20 km la superficie cae ~59 m).
  - Mapa base (selector): relieve sombreado generado del DEM, o Trek MOLA (463 m, borroso a este zoom). La ortofoto HiRISE se quitó de la interfaz (solo se usa en `npm run fetch-sand` para estimar la arena).
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
**Constantes (no editables en la UI, ver `app/src/lib/constants.js`)**: pendiente máx. 20° (valor Artemis/xEMU lunar, supuesto), velocidad 2.7 km/h, excursión máx. 10 km (solo aviso), límite de dosis 600 mSv, rango térmico del traje 93–378 K (xEMU lunar; no hay límite de traje marciano publicado), base (Bradbury Landing), altura de antena 2 m, oblicuidad de Marte 25.19°, celda 200 m (cráter completo) o 50 m (zona de Curiosity).

**Variables (barra lateral)**: hora local y altura máxima; en "Opciones": estación y actividad solar. Los pesos de la ruta son fijos (esfuerzo 1, radiación 2, rugosidad 1, comunicación 1, arena 1).

**Factores en el costo**: arena oscura estimada (ver abajo); esfuerzo metabólico (polinomio de Minetti 2002, coeficientes de memoria, sin verificar contra el paper; gravedad terrestre); radiación (modelo Guo 2018); rugosidad (desviación estándar de alturas de 1 m tras quitar tendencia, relativa al p95; es un proxy, el DEM no resuelve rocas; `gale-rough.f32` vía `npm run fetch-dem`); comunicación (línea de vista a la base, viewshed); sol/sombra (posición solar + sombras del terreno). Bloqueo: altura > máx., pendiente > 20° o sin dato.

**Botón "Ver todos los datos considerados"** (`DataPanel.jsx`): lista parámetros variables, constantes con fuente, datos reales, modelos, resultado de la ruta actual y lo que NO se considera (dunas/arena, margen a acantilados más allá de no cortar esquinas, temperatura espacial, etc.).

### Comparación con Curiosity (benchmark)
Casilla "Mostrar recorrido real de Curiosity": dibuja el recorrido real del rover (NASA/JPL MMGIS, `npm run fetch-curiosity` → `app/public/data/curiosity-traverse.json`, simplificado a ~2 m, con la distancia y posición oficial al final de cada sol). No entra en A*. Mientras está activa, nuestra ruta usa **solo el relieve** (esfuerzo por subidas/bajadas y bloqueo > 20°; sin radiación, rugosidad, comunicación ni filtro de altura). Controles:
- **Hasta el sol X**: recorta el recorrido de Curiosity en esa fecha (la posición final es el waypoint oficial de ese sol).
- **Relieve (DEM)**: 50 m en la zona de Curiosity (DEM USGS de 1 m promediado; `npm run fetch-dem-1m` → `gale50-*`) o 200 m del cráter completo.
- **Evitar arena oscura**: añade el mapa de arena estimado (`npm run fetch-sand` → `gale50-sand.u8`): celdas oscuras en la ortofoto HiRISE de Trek (~10 m/px, percentil 6 del brillo) y lisas en el DEM de 1 m. Es una estimación (no hay mapa público de arena de Gale); solo cubre la zona de la ortofoto. También pesa en la ruta normal (peso 1) y se puede ver como capa.
- "Usar su inicio y su posición en ese sol" pone nuestros extremos en los de Curiosity; se muestran distancia media/máxima al recorrido, % a menos de 500 m y largos.

Limitación: Curiosity se desvió por ciencia, arena y desgaste de ruedas; no buscó el camino más corto.

### Por qué esta ruta (explicación de giros)
Clic en el inicio y clic en el destino (arrastrar mueve el mapa). A* corre una sola vez y luego `app/src/lib/explain.js`:
1. Detecta los giros importantes simplificando la ruta (Douglas-Peucker; ignora zigzags menores a ~3 celdas o 2 % del largo).
2. En cada giro compara el tramo real con el **atajo recto** entre el giro anterior y el siguiente, usando la misma fórmula de costo que A* (`stepParts` en `route.js`), separada por factor.
3. El motivo es lo que hace inviable o más caro el atajo: bloqueo (pendiente > 20°, altura máxima, sin datos) o el factor con mayor sobrecosto (subida, arena, radiación, comunicación, rugosidad). Si el atajo no es más caro (efecto de la cuadrícula), el giro no se explica.
Se muestra como marcadores numerados por color de motivo, una lista en la barra lateral y, al seleccionar uno, el atajo descartado en rojo punteado (con una ✕ donde estaría bloqueado).
