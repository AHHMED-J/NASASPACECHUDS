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
- **Radiación y temperatura: simuladas** (`app/src/lib/sim.js`). Es el único archivo a sustituir por datos o modelos reales; A* solo lee `radRisk` y `tempRisk`.
