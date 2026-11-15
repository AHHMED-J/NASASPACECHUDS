# Arquitectura — Mars Route (Gale)

Aplicación web de una sola página que planea rutas de caminata (EVA) sobre el cráter Gale y explica por qué la ruta gira. Todo corre en el navegador; no hay servidor propio.

## Stack
React 19 + Vite + Tailwind v4 · OpenLayers (mapa) · proj4 (proyecciones de Marte) · Chart.js (gráficas).

## Estructura

```
NASASPACECUCKS/
├── Agents/                 Bitácora (CAMBIOS.md), instrucciones y estos documentos
├── README.md               Documentación general, fuentes y parámetros
└── app/
    ├── public/data/        Datos descargados (los lee el navegador)
    ├── scripts/            Descargan y preparan los datos (Node, se corren a mano)
    └── src/
        ├── main.jsx        Arranque
        ├── App.jsx         Estado, cálculo de la ruta y barra lateral
        ├── components/     Interfaz
        └── lib/            Lógica (sin interfaz)
```

## Flujo de datos

```
NASA / USGS ──(scripts/ fetch-*)──► public/data/ ──(fetch en el navegador)──► lib/dem.js
                                                                                  │
                          lib/radiation, comm, effort, dunas ─► riesgos 0–1 por celda
                                                                                  ▼
 clic inicio + clic destino ─► lib/route.js (A*) ─► lib/explain.js ─► App.jsx ─► MapView / lista
```

## Datos (`app/public/data/`)

| Archivo | Qué es | Origen |
|---|---|---|
| `gale-dem.f32/.json`, `gale-rough.f32` | Relieve de todo el cráter a 200 m y su rugosidad | USGS, DEM global MOLA–HRSC |
| `gale50-dem.f32/.json`, `gale50-rough.f32` | Relieve a 50 m de la zona de Curiosity | USGS, DEM de Gale de 1 m promediado |
| `gale-dunes.json` | Campos de dunas de Gale (GeoJSON) | USGS MGD3 (OFR 2007-1158) |
| `curiosity-traverse.json` | Recorrido real de Curiosity y su distancia por sol | NASA/JPL MMGIS |
| `gale-temp.json` | Temperatura y presión por hora y estación | Mars Climate Database (LMD) |

## Scripts (`app/scripts/`)

| Script | Comando | Genera |
|---|---|---|
| `fetch-dem.mjs` | `npm run fetch-dem` | DEM de 200 m y rugosidad |
| `fetch-dem-1m.mjs` | `npm run fetch-dem-1m` | DEM de 50 m (`gale50-*`) |
| `fetch-dunes.mjs` | `npm run fetch-dunes` | `gale-dunes.json` |
| `fetch-curiosity.mjs` | `npm run fetch-curiosity` | `curiosity-traverse.json` |
| `fetch-mcd.mjs` | `npm run fetch-mcd` | `gale-temp.json` |

## Código (`app/src/`)

### Componentes
- **`App.jsx`**: estado global (inicio, destino, hora, altura máxima, modo comparación), llama a A* y al explicador, calcula las estadísticas y arma la barra lateral.
- **`MapView.jsx`**: mapa de OpenLayers. Mapa base (relieve o Trek MOLA), capas de riesgo, ruta, recorrido de Curiosity, marcadores numerados de los giros y atajo descartado.
- **`DataPanel.jsx`**: panel "Datos considerados" (qué se usa, fuente, y qué no se considera).
- **`ElevationProfile.jsx`**: perfil de elevación de la ruta.
- **`TemperatureCard.jsx`**: hora local, temperatura y curva de 24 h.

### Lógica (`lib/`)
- **`dem.js`**: carga los datos y construye la malla de celdas: pendiente, rugosidad, línea de vista, radiación y dunas (rasteriza los polígonos del USGS).
- **`route.js`**: A* de 8 vecinos con montículo tipado. `stepParts` desglosa el costo de un paso por factor.
- **`explain.js`**: detecta los giros (Douglas–Peucker) y los compara con el atajo recto, con la misma fórmula de costo.
- **`effort.js`**: esfuerzo al caminar según el gradiente (Minetti 2002), normalizado de 0 a 1.
- **`radiation.js`**: dosis por celda según la presión (modelo anclado en MSL/RAD, Guo 2018).
- **`comm.js`**: línea de vista con la base, con la curvatura de Marte.
- **`curiosity.js`**: carga, corte por sol y comparación con nuestra ruta.
- **`sun.js`**: posición del Sol y sombras (solo capa visual).
- **`temperature.js`**: lee la tabla de la MCD.
- **`constants.js`**: constantes fijas con su fuente.

## Cálculo de la ruta
1. Cada factor se normaliza de 0 (ideal) a 1 (lo peor): esfuerzo, radiación, rugosidad, comunicación y dunas.
2. Costo de cada metro = `1 + Σ peso × riesgo`. Pesos fijos: esfuerzo 1, radiación 2, el resto 1.
3. Se bloquean las celdas con pendiente > 20°, sobre la altura máxima o sin dato, y no se cortan esquinas.
4. A* devuelve la ruta; el explicador la compara con atajos para decir por qué gira.

## Decisiones de diseño
- **Todo en el navegador**: no hay servidor; los datos se descargan una vez con los scripts y se guardan en el repo.
- **Dos resoluciones**: 200 m para todo el cráter y 50 m para la zona de Curiosity (se carga solo en modo comparación).
- **Clic-clic en vez de arrastrar**: A* corre una sola vez por ruta; así se gasta menos y el explicador usa el mismo resultado.
- **Sin supuestos sin fuente**: se quitaron la ladera de lado, la sombra en el costo y la arena estimada.
