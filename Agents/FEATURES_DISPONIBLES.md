# Features disponibles en el repo

Lo que ya funciona hoy en la rama `feature/mars-route-demo`.

## Mapa
- Cráter Gale completo (~311 × 311 km, 136.4–139.2°E / −6.8 a −4.0°N).
- Mapa base: relieve sombreado del DEM o NASA Trek MOLA.
- Capas de riesgo: radiación, rugosidad, comunicación, campos de dunas USGS y sombras.
- Marcador **BASE** (Bradbury Landing).

## Ruta
- Clic en el inicio y clic en el destino (un tercer clic reinicia).
- Ruta A* multifactor: esfuerzo, radiación, rugosidad, comunicación y dunas, todos normalizados de 0 a 1.
- Bloqueo por pendiente mayor a 20°, altura máxima (con control deslizante) y datos faltantes.
- Distancia, tiempo a pie y elevación en una tarjeta sobre el mapa.
- Perfil de elevación.
- Avisos: alejamiento mayor a 10 km de la base, tramos sin línea de vista, temperatura fuera del rango del traje.

## Explicación de la ruta (aporte principal)
- Marcadores numerados en cada giro importante.
- Frase por giro con el motivo: pendiente, altura, sin datos, subida, dunas, radiación, comunicación o rugosidad.
- Al elegir un giro se ve en rojo el atajo recto que se descartó.
- Resumen por motivo.

## Escenario
- Hora local con temperatura de superficie y aire (Mars Climate Database) y curva de 24 h.
- En "Opciones": estación y actividad solar.

## Comparación con Curiosity (benchmark)
- Recorrido real de Curiosity (NASA/JPL), sin influir en nuestra ruta.
- Corte por sol y fecha terrestre aproximada.
- Relieve de 50 m (zona de Curiosity) o de 200 m (cráter completo).
- Casilla "Evitar campos de dunas (USGS)".
- Botón para usar su inicio y su posición en ese sol.
- Métricas: distancia media y máxima, % a menos de 500 m, largos.

## Datos y transparencia
- Panel "Datos considerados": fuente de cada dato, qué es medición, modelo o supuesto, y lo que no se considera.
- Bitácora de cambios en `Agents/CAMBIOS.md`.

## Herramientas de datos
- `npm run fetch-dem`, `fetch-dem-1m`, `fetch-dunes`, `fetch-curiosity`, `fetch-mcd`.
