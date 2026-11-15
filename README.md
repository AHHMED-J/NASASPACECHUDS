# NASA Space Apps — Motor de rutas en Marte

Sistema de rutas óptimas sobre la superficie de Marte. El costo de cada celda sale del algoritmo A* y de capas GeoTIFF (`.tif`) de la NASA. El usuario asigna el peso de cada variable en la interfaz.

La malla no está fija en el cráter Gale. Gale puede usarse como ventana de ejemplo. La extensión geográfica es un parámetro: cualquier región de Marte cuyos rásteres quepan en memoria tras recorte, reducción de resolución y lectura por teselas.

## Requisitos

- Git
- Node 24 (en Mac/Linux: `nvm use`; en Windows: nvm-windows o el instalador de nodejs.org)
- Un editor
- Procesamiento de GeoTIFF pesados con la librería `geotiff`, en módulos ES (`.mjs`)
- Normalización de cada capa a una escala común `[0, 1]` antes de aplicar los pesos

Los productos originales de la NASA llegan a unos 46 000 × 23 000 píxeles. El motor trabaja con archivos ya recortados a la ventana de interés y reducidos de resolución (por ejemplo en QGIS), y los lee por teselas. Un mapa global completo no se carga de una vez en RAM.

Instalación de la librería de lectura, dentro de `app`:

```bash
npm install geotiff
```

`npm install` en `app` también la trae: `geotiff` ya figura en las dependencias de desarrollo del proyecto.

## Arrancar

1. `git clone https://github.com/AHHMED-J/NASASPACECUCKS.git && cd NASASPACECUCKS`
2. `cp .env.example .env` (en Windows: `copy .env.example .env`) y rellena las claves pedidas por el chat privado.
3. `cd app && npm install && npm install geotiff && npm run dev`
4. Abre http://localhost:5173

Los mapas del cráter ya están en el repo: `app/public/data/gale_elevacion.tif` (DEM MOLA–HRSC, 200 m) y `app/public/data/gale_suelo.tif` (inercia térmica THEMIS, 100 m). La app los lee localmente con `geotiff`. Para volver a crearlos: `cd app && npm run fetch-mapas`. El script lee solo la ventana de Gale de los GeoTIFF globales del USGS, sin descargar los archivos completos.

## Reglas

- Instalar paquetes con `npm install <paquete>` y hacer commit de `package.json` y `package-lock.json`. El lockfile no se borra.
- Tras un pull con dependencias nuevas: `npm install`.
- Nunca subas `.env`. Las variables `VITE_*` son visibles en el navegador: no pongas secretos ahí.
- Nombres de archivo con mayúsculas exactas (`Header.jsx` se importa como `./Header`).

## Capas de la heurística A*

Cada variable es un ráster alineado a la misma grilla. El valor de celda se normaliza a `[0, 1]` (0 favorable, 1 costoso) con el mínimo y el máximo de esa matriz, y después se multiplica por el peso que eligió el usuario.

| Capa | Variable | Dataset | Efecto en A* |
|---|---|---|---|
| Percloratos | Concentración de percloratos (\(ClO_4^-\)), a partir de los mapas de cloro | Mars Odyssey GRS (Gamma Ray Spectrometer) | Más cloro → más costo (oxidante tóxico y corrosivo para el traje) |
| Radiación | Exposición a GCR y SPE. La elevación aproxima el espesor de atmósfera; el magnetismo cortical es un escudo local | Curiosity RAD (referencia medida) y MGS MAG/ER (Mars Global Surveyor Magnetometer) | Más elevación y menos magnetismo → más costo |
| Temperatura | Fluctuación térmica. El gradiente combina temporada, latitud y altitud | THEMIS (Thermal Emission Imaging System) | Temperaturas extremas → más costo |
| Relieve | Elevación y pendiente (slope) | MOLA (Mars Orbiter Laser Altimeter) | Pendiente mayor a 15–20° → costo infinito (celda intransitable). La cota también entra en el término de radiación |
| Inercia térmica | Transitabilidad del suelo: arena suelta o roca | THEMIS o TES | Inercia baja (arena o polvo, riesgo de hundimiento) → más costo. Inercia alta (roca) → menos costo |

La elevación MOLA va de unos −8 200 m a +21 200 m. Ese rango, como el resto de capas, se traduce a una penalización de 0 a 1 antes de ponderar. La pendiente no es un peso más: por encima del umbral la celda queda fuera del grafo.

## Costo de la ruta

\[
f(n) = g(n) + h(n)
\]

\(g(n)\) acumula el costo de las celdas ya recorridas. En una celda transitable:

\[
Costo = (V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})
\]

\(V\) es el valor normalizado de 0 a 1. \(P\) es el peso de la interfaz. \(V_{suelo}\) sale de la inercia térmica, orientada para que la arena pese más que la roca. \(V_{rad}\) combina la elevación (menos atmósfera) y el magnetismo cortical (menos campo, más exposición), con Curiosity RAD como ancla de la magnitud.

## Stack

- Interfaz: React 19, Vite, Tailwind v4, OpenLayers, proj4, Chart.js.
- Datos y búsqueda: JavaScript en ES Modules (`.mjs`), Node, librería `geotiff` (`npm install geotiff`).
- Lectura: ancho, alto y valor de cada píxel de la banda principal del `.tif`, para consultar la celda \((x, y)\) durante A*.
- Normalización en caliente: mínimo y máximo de cada matriz cargada, escala `[0, 1]`, con el sentido de costo de esa capa.
- Memoria: recorte previo, downsampling y tiling. Los `.tif` de trabajo son ventanas reducidas, no el ráster global crudo.

El detalle de datasets, la fórmula y las reglas de memoria están en `Agents/contexto_datasets_nasa.md`. La estructura del motor está en `Agents/ARQUITECTURA.md`.
