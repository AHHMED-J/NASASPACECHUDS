# Investigación de datasets — paso 0 del plan de migración

Revisión de los datos que pide `contexto_datasets_nasa.md`: dónde están, en qué formato, qué resolución tienen y si sirven para planear una ruta a pie. Fecha: 2026-11-14. Agente: Claude.

**Alcance.** El motor de rutas está pensado para **cualquier zona de Marte**; Gale es solo la **zona de prueba**. Por eso cada dataset se evaluó en dos niveles: qué mide en Gale (donde hay datos de Curiosity para comparar) y qué cobertura y comportamiento tiene en todo el planeta (sección 9). Los veredictos de la tabla dependen del **tamaño de la ventana de ruta**.

**Cómo se verificó.** Para cada archivo se buscó la ficha oficial, se descargó o se leyó por partes el archivo real, y se midieron los valores en la ventana de Gale (136.4–139.2°E, −6.8 a −4.0°N). Lo que no se pudo comprobar con el archivo se marca **(sin verificar)**.

## Resumen

| Variable del md | Dataset | Formato real | Resolución | Valores en Gale | ¿Sirve para la ruta? |
|---|---|---|---|---|---|
| Relieve | MOLA MEGDR 463 m | GeoTIFF, 2.1 GB, lectura por partes ✅ | 463 m | −4 607 a +1 347 m | ✅ Sí (ya usamos uno mejor: 200 m) |
| Dunas (extra, no estaba en el md) | Campos de dunas USGS (MGD3, 2007) | Polígonos GML | contorno de cada campo | 2 campos, ~425 y ~414 km² | ✅ Sí (ya se usa) |
| Percloratos | Odyssey GRS, cloro | Tabla de texto (no GeoTIFF) | **5° ≈ 300 km** | **2 valores:** 0.566 y 0.583 % | ❌ No |
| Radiación (magnetismo) | MGS MAG/ER (Lillis 2008) y modelo Langlais 2018 | Tabla de texto; o numérico vía JMARS ✅ | 0.5°; calculado a 185 km / 130 km de altura | 53–72 / 51–105 nT | ❌ No |
| Radiación (por altura) | Curiosity RAD + relieve MOLA | Medición en un punto; la altura de cada celda da su presión | la del relieve | ~0.67 mSv/día medido | ✅ Sí (ya se usa) |
| Temperatura | THEMIS | **No existe** un mapa de temperatura listo | — | — | ❌ No |
| Inercia térmica | THEMIS (Fergason) | GeoTIFF por recuadros, 2.6 GB, lectura por partes ✅ | 100 m | 98–819 | ✅ Sí, para polvo (por agregar). **No separa las dunas** |
| Inercia térmica | TES (Putzig y Mellon 2007) | Numérico vía servicio JMARS ✅ | 20 px/° ≈ 3 km | 93–551 (noche) | ⚠️ Parcial: solo zonas de más de ~30 km |

**Conclusión corta (para ventanas de hasta ~100 km, como Gale):** mueven la ruta el relieve (y la radiación que se calcula con él), los campos de dunas del USGS y, por agregar, la inercia térmica THEMIS como indicador de polvo. El cloro y el magnetismo tienen celdas mucho más grandes que el cráter, así que en una ventana del tamaño de Gale son casi constantes. No hay un mapa de temperatura. La inercia térmica no distingue las dunas de la roca, así que no reemplaza a los campos de dunas.

---

## 1. Relieve — MOLA

- **Archivo:** `Mars_MGS_MOLA_DEM_mosaic_global_463m.tif` en el servidor del USGS ([ficha](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m)). URL directa: `https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`.
- **Verificado leyendo el archivo:**
  - 46 080 × 23 040 píxeles (las cifras del md coinciden), 2 125 771 142 bytes, una banda, "sin dato" = −32768.
  - Proyección equirectangular en metros; origen en −180° de longitud.
  - El servidor acepta lectura por partes: la ventana de Gale (360 × 360 píxeles) se leyó en **~4 s** sin bajar el archivo entero.
- **En Gale:** −4 607 a +1 347 m.
- **Nota:** el DEM que ya usamos (MOLA–HRSC de 200 m, 11.4 GB, mismo servidor) es más fino y también se lee por partes. Para todo Marte, MOLA de 463 m basta; para zonas de interés conviene el de 200 m.
- **Las versiones del PDS** ([MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html)) vienen en recuadros `.IMG`, no en GeoTIFF. El GeoTIFF del USGS es más cómodo.

## 2. Percloratos — Odyssey GRS (cloro)

- **Dónde:** PDS Geosciences, conjunto `ODY-M-GRS-5-ELEMENTS-V1.0` ([página](https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html)). Archivos: `data/smoothed/cl_sr_5x5.tab` y `data/unsmoothed/5x5/cl_5x5.tab`.
- **Verificado leyendo el archivo:**
  - Es una **tabla de texto**, no un GeoTIFF: 2 592 filas de latitud, longitud, concentración (% en peso) y error.
  - **Celdas de 5° × 5° (~300 km).** La versión suavizada además usa un filtro de 10°.
  - **No hay cloro a 2° × 2°.** La nota del archivo dice que no hay conteos suficientes para que el ajuste sea estadísticamente significativo.
  - Solo 1 508 de 2 592 celdas tienen dato (latitudes medias; los polos están enmascarados). Rango global: 0.22 a 0.80 %.
- **En Gale:** el cráter cae en **dos celdas**: 0.566 ± 0.035 % y 0.583 ± 0.037 %. La diferencia (0.017 %) es **menor que el error de medición**.
- **Problemas para la ruta:**
  - Normalizado a 0–1 dentro de una ventana así, sería ruido o una división entre cero.
  - Mide **cloro total**, no percloratos. Qué fracción es perclorato no se puede saber desde órbita.
  - GRS ve solo los primeros decímetros del suelo.
- **Uso razonable:** dato de contexto ("en Gale el cloro es ~0.57 %, cerca del promedio de Marte, 0.49 %"), no capa de costo.
- Cita: Boynton et al. 2007, JGR 112, E12S99; Keller et al. 2006 ([artículo](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2006JE002679)).

## 3. Radiación — magnetismo cortical (MGS MAG/ER)

- **Dónde:** PDS PPI, `MGS-M-ER-5-FIELD-MAP-V1.0` ([ficha](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-ER-5-FIELD-MAP-V1.0)). Archivo: `https://pds-ppi.igpp.ucla.edu/data/MGS-M-ER-5-FIELD-MAP-V1.0/DATA/LILLIS_ER_MAP.TAB` (3.5 MB).
- **Verificado leyendo el archivo:**
  - **Tabla de texto**, no GeoTIFF: una rejilla de 0.5° (360 filas de latitud × 720 de longitud este), en grupos de 6 valores por línea.
  - Comprobamos el orden de filas y columnas: el máximo cae en ~178°E, −54°, que es Terra Sirenum/Cimmeria, donde se conocen los campos más fuertes.
  - El −7777.7 es "sin dato" (29 827 celdas).
- **En Gale:** 30 celdas, valores entre **53 y 72**. Están por encima del 85 % del planeta.
- **Problemas para la ruta:**
  - El mapa es la intensidad del campo **a 185 km de altura**, no en la superficie. La rejilla es de 0.5°, pero el detalle real es mucho más grueso: los mapas de este tipo resuelven del orden de 200 km.
  - La etiqueta del archivo advierte que estos valores **no son** mediciones del magnetómetro y pide contactar al autor antes de publicarlos.
  - Que los campos de la corteza protejan contra los rayos cósmicos galácticos es dudoso: son partículas de muy alta energía. **(sin verificar: falta una fuente que lo cuantifique a nivel del suelo)**.
- **Uso razonable:** dato de contexto, no capa de costo.
- Cita: Lillis et al. 2008, Icarus 194, 575–596.

## 4. Radiación — Curiosity RAD

- Es una **serie de tiempo en un solo punto** (donde está el rover), no un mapa.
- Ya la usamos como referencia: ~0.67 mSv/día a −4.4 km (Guo et al. 2018). Dentro de una ventana, la variación espacial de la dosis sale de la **presión**, es decir, de la **elevación**. Eso es lo que hace hoy `radiation.js`.
- **Para todo Marte:** el ancla de Gale se puede extender con la misma relación dosis–presión. Fuera de 700–950 Pa es extrapolación; eso ya está escrito en el README.

## 5. Temperatura — THEMIS

- **No encontramos un mapa de temperatura de THEMIS listo para usar.** Lo que existe:
  - Mosaicos THEMIS infrarrojo de día y de noche (100 m, hasta 22.8 GB, mismo servidor del USGS). Son **imágenes de brillo hechas para ver formas**, mezcladas de muchas horas y estaciones. Ya probamos el de noche: no son temperaturas.
  - Imágenes individuales de THEMIS en el PDS: cada una es de un momento distinto. Juntarlas sería un trabajo de investigación, no de hackathon.
- **Además:** la inercia térmica (punto 6) sale de estas mismas imágenes de noche. Usar "temperatura THEMIS" e "inercia térmica THEMIS" como dos factores sería contar el mismo dato dos veces.
- **Ya medimos** que la temperatura del modelo de la MCD casi no cambia dentro de una zona (~1 K en 150 km). Cambia con la hora y la estación, no con el lugar.
- **Uso razonable:** como hoy, tarjeta de hora y estación (MCD o REMS), no capa de costo.

## 6. Inercia térmica — THEMIS (el candidato más serio)

- **Dónde:** Astropedia, "THEMIS Thermal Inertia Mosaic Quantitative" ([ficha del recuadro de Gale](https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp)).
  - La ficha enlaza un `.cub` (formato ISIS). **Existe también un GeoTIFF** en la carpeta `ancillary`: `https://asc-astropedia.s3.us-west-2.amazonaws.com/Mars/Odyssey/THEMIS-Global-Thermal-Inertia-Mosaic/Quantitative-32-Bit/ancillary/THEMIS_TI_Mosaic_Quant_30S120E_100mpp.tif`.
  - El recuadro que cubre Gale es **30S120E** (−30° a 0°, 120°E a 180°E).
- **Verificado leyendo el archivo:**
  - 35 565 × 17 782 píxeles, 32 bits con decimales, 100 m, 2.6 GB.
  - El servidor acepta lectura por partes: la ventana de Gale (1 661 × 1 661 píxeles) se leyó en **~1.4 s**.
  - Valores en Gale: 98 a 819 (unidades de inercia térmica, J m⁻² K⁻¹ s⁻½). Precisión absoluta ~20 %, según la ficha (Fergason et al. 2006).
- **Prueba: ¿separa las dunas?** Medimos la inercia en los puntos del recorrido de Curiosity (mediana en ±1 km alrededor de cada punto):

  | Lugar | Sol | Inercia (mediana ±1 km) |
  |---|---|---|
  | Bradbury (llanura) | 21 | 551 |
  | Yellowknife Bay (roca) | 166 | 565 |
  | Hidden Valley (arena suelta) | 672 | 452 |
  | Dunas Bagnold: High Dune | 1168 | 451 |
  | Dunas Bagnold: Namib Dune | 1192 | 448 |
  | Murray (roca) | 1500 | 417 |
  | Vera Rubin Ridge (roca) | 1999 | 431 |

  En el piso del cráter, dentro de los campos de dunas USGS la mediana es 327 y fuera 379. Los rangos se mezclan mucho.

- **Resultado:** las dunas Bagnold (~450) tienen **la misma inercia** que la roca de Murray (~420) y Vera Rubin Ridge (~430). Solo se distinguen de la llanura de aterrizaje (~550). En Gale, la inercia térmica **no separa arena de roca** lo suficiente para usarla como "suelo blando". Esto coincide con la prueba de THEMIS de noche: la arena de Bagnold es gruesa y guarda calor.
- **Uso posible:** la inercia muy baja (< ~150) corresponde a polvo fino. Como indicador de suelo blando puede servir en otras zonas, pero **no marca dunas**, ni en Gale ni en el resto del planeta (sección 9). Hay que decirle al jurado que en Gale casi no cambia la ruta.

## 7. Inercia térmica — TES

- Mapas de Putzig y Mellon 2007, de noche y de día, a **20 px/°** (~3 km). El servidor de PSI no respondió, pero **se leyeron los valores numéricos desde el servicio JMARS** (sección 8): capas `TES_TI_Putzig_night_numeric` y `TES_TI_Putzig_day_numeric`.
- **En Gale (noche):** 93 a 551, mediana 235.
- **¿Separa las dunas?** No: dentro de los campos de dunas USGS la mediana es **281**, fuera **233**. Las dunas salen **más altas** (en la inercia THEMIS salían algo más bajas, 327 contra 379): ninguna de las dos separa la arena con claridad. En los puntos de Curiosity: Bradbury 393, Namib Dune 347, Murray 361.
- A 3 km es 30 veces más grueso que THEMIS. Solo conviene donde THEMIS tenga huecos.

## Extra encontrado: albedo TES

- `Mars_MGS_TES_Albedo_mosaic_global_7410m.tif` (16.6 MB, mismo servidor del USGS). Se leyó por partes. En Gale: 0.15 a 0.26.
- Es un indicador de polvo en superficie (claro = más polvo). Celdas de 7.4 km: contexto, no ruta.

---

## 8. Hallazgo útil: servicio JMARS de la ASU (muchas capas, cualquier recuadro)

La Universidad Estatal de Arizona (ASU, equipo de THEMIS y TES) publica un **servicio de mapas WMS** con ~3 700 capas de Marte. Muchas tienen versión `_numeric`, que devuelve **valores reales** (no colores) para el recuadro y tamaño que se pidan, en formato VICAR (cabecera de texto + números).

- **Dirección:** `http://ms-mars.mars.asu.edu/?SERVICE=WMS&REQUEST=GetMap&FORMAT=image/vicar&SRS=JMARS:4&VERSION=1.1.1&STYLES=&LAYERS=<capa>&BBOX=<lonMin>,<latMin>,<lonMax>,<latMax>&WIDTH=<n>&HEIGHT=<n>`
- **Verificado:** se pidieron 7 capas para Gale (56 × 56 celdas cada una). Todas respondieron en segundos, con un archivo de unos KB. El formato VICAR se lee fácil: cabecera con `LBLSIZE`, `FORMAT`, `NL` y `NS`, y luego los números.
- **Ventaja para el plan:** una sola forma de pedir **cualquier capa en cualquier recuadro**, ya alineada a la misma malla y sin bajar gigas. Resuelve el "alinear capas" del plan sin escribir un remuestreador.
- **Desventajas:** no es un servicio de la NASA sino de la ASU (con datos de misiones de la NASA); no tiene garantía de disponibilidad; y usa `http`, no `https`. Para la demo conviene **descargar una vez y guardar** los recortes, como hacemos hoy.

| Capa JMARS | Qué es | En Gale (56 × 56) |
|---|---|---|
| `GRS_Cl_conc_numeric` | Cloro GRS (Boynton 2007), % en peso | **2 valores:** 0.571 y 0.595 |
| `TES_TI_Putzig_night_numeric` | Inercia térmica TES de noche | 93–551 |
| `thm_ti_100m_32bit` | Inercia térmica THEMIS de 100 m (la misma de la sección 6) | (no se pidió; ya leída del GeoTIFF) |
| `mars_crustal_magnetic_field_B_magnitude_v2` | Campo magnético cortical a **130 km de altura**, modelo Langlais et al. 2018 (MGS + MAVEN), nT | 51–105 nT, varía suave |
| `tes_rock_abundance_numeric` | Abundancia de rocas TES (Nowicki y Christensen 2007), 8 px/° | casi todo 0 (cobertura ~45 % del planeta; probablemente sin dato) |
| `mars_thermophysical_categories_numeric` | Unidades termofísicas (inercia + albedo, Jones et al. 2014) | 6 clases |
| `mola_roughness_0.6km_numeric` | Rugosidad MOLA a 0.6 km (Kreslavsky y Head 2000) | 117–227 (escala 0–255) |

Otras capas que existen y podrían servir: `mola_hrsc_blend_slope_v2` (pendiente), `swim_neutron_dataset` (hielo cercano a la superficie, SWIM), `TES_Lambert_Albedo_numeric` y minerales TES.

**Índice de cubierta de polvo (DCI, Ruff y Christensen 2002):** existe en [la página de la ASU](http://tes.asu.edu/~ruff/DCI/dci.html) como TIFF de 16 px/° (~3.7 km, 50 MB), pero ese TIFF **no trae georreferencia**; hay que ubicarlo a mano.

**Magnetismo y radiación (sigue sin verificar):** no encontramos un estudio que cuantifique cuánto bajan la dosis en el suelo los campos de la corteza. Lo que sí está medido es que la atmósfera es el escudo principal (~21 g/cm² en Gale, según RAD). Las bajadas de radiación que vio Curiosity se debieron a eyecciones de masa coronal, no a la corteza.

## 9. Alcance: todo Marte (Gale como zona de prueba)

Los veredictos "no sirve" de las secciones 2 y 3 valen para ventanas del tamaño de Gale (166 km) o menores, que es la escala de una caminata o de un recorrido de rover. Para ventanas más grandes cambian. Lo que se midió a escala global:

**Cobertura de cada dataset**

| Dataset | Cobertura | Detalle verificado |
|---|---|---|
| MOLA 463 m | Todo Marte | 46 080 × 23 040 píxeles; también existe el DEM MOLA–HRSC de 200 m (11.4 GB) |
| Inercia térmica THEMIS (100 m) | **60°S a 60°N** | 24 recuadros GeoTIFF (6 franjas de longitud × 4 de latitud: `00N`, `30N`, `30S`, `60S`), de 1.5 a 2.6 GB cada uno, ~50 GB en total (estimado de los tamaños listados). Existen todos. |
| Inercia térmica TES (3 km) | 87°S a 87°N | Vía JMARS |
| Cloro GRS | **±57.5° de latitud** | Solo 1 508 de 2 592 celdas (58 %) tienen dato; los polos están enmascarados |
| Magnetismo MAG/ER (Lillis) | Todo Marte | 11.5 % de las celdas sin dato (29 827 de 259 200) |
| Campos de dunas USGS (MGD3) | Zona ecuatorial (±65°) | 547 campos en la base de 2007 que usamos |

**Cuándo sirve cada capa según el tamaño de la ruta** (medido con el mapa de cloro: la diferencia típica entre celdas vecinas, comparada con el error de medición de ±0.033 %):

| Distancia entre dos zonas | Diferencia mediana de cloro | Frente al error |
|---|---|---|
| ~300 km (5°) | 0.016 % | 0.5 veces (indistinguible) |
| ~600 km (10°) | 0.028 % | 0.8 veces |
| ~1 200 km (20°) | 0.044 % | 1.3 veces |

- El cloro solo empieza a distinguir zonas a partir de ~1 000 km. Sirve para rutas **a escala continental**, no para una caminata de unos 10–20 km, en ningún lugar de Marte.
- Con celdas de 0.5° (30 km), el magnetismo varía más: los campos fuertes están en las tierras altas del sur (el valor máximo del mapa cae en ~178°E, 54°S). Gale está en el percentil 85–91 (53–72 nT). El efecto de ese campo sobre la dosis en el suelo sigue sin una fuente que lo mida (sección 3).
- La inercia térmica TES (3 km) distingue zonas de más de ~30 km; la THEMIS (100 m) sirve a cualquier escala de ruta, pero solo entre 60°S y 60°N.

**Prueba global: ¿la inercia térmica marca los campos de dunas en todo Marte?**

Se bajó el mapa TES nocturno de todo el planeta (3 km por celda) y se midió, para cada campo de dunas del USGS lo bastante grande (al menos 15 píxeles TES dentro, unos 130 km²), la inercia dentro del campo contra su entorno inmediato (1° alrededor):

- Campos evaluados: **89** (de 547; los demás son demasiado pequeños para TES).
- Solo **27 %** tienen la inercia más baja que su entorno. La diferencia mediana (dentro menos entorno) es **+23**: las dunas salen algo *más altas*.
- Inercia mediana dentro de los campos: 299; en el entorno: 273; en todo Marte (±60°): 210.
- Solo 1 de los 89 campos tiene inercia menor a 150.

**Interpretación.** El resultado de Gale no es una excepción: en todo Marte, los campos de dunas del USGS tienen una inercia moderada (~300), no baja. Según la literatura (**sin verificar aquí**), la inercia muy baja (< ~100–150) corresponde a **polvo fino**, que es el suelo realmente blando; la arena de dunas ronda 250–400 y la roca más de ~500. Entonces la inercia térmica sirve como indicador de **polvo**, no de **dunas**. Para dunas, los campos del USGS siguen siendo la mejor fuente.

**Límites de esta prueba:** TES tiene celdas de 3 km y solo entran los campos grandes. No se repitió con THEMIS de 100 m (exigiría bajar varios de los 24 recuadros). Los polígonos del USGS marcan el contorno del campo, que incluye roca entre dunas.

**Cosas a resolver para un motor global** (no existen en el código actual):
- **Elegir recuadro:** una función que, dado un bbox, decida qué recuadros THEMIS hay que leer; una ventana que cruce el borde de un recuadro necesita unir dos lecturas.
- **Convención de longitud:** los nombres de recuadro usan longitud 0–360 este (por ejemplo `30S180E`), pero la cabecera de algunos usa −180 a 180. Hay que normalizar, y tratar el cruce del meridiano 180°.
- **Sin dato:** más allá de 60° el THEMIS no tiene inercia y el GRS tampoco; la capa debe quedar en "sin dato" y no en 0.
- **Distancia por celda:** en un mapa equirectangular, una celda es más angosta cerca de los polos (ya se corrige por fila en `dem.js`).

## 10. Qué datos mueven la ruta

Hoy la app usa **dos fuentes de datos**, no una. Del relieve salen cinco factores del costo; los campos de dunas son un dato independiente.

| Factor en el costo | De qué dato sale | ¿Funciona en todo Marte? |
|---|---|---|
| Pendiente > 20° (bloqueo) | Relieve | Sí |
| Subida (esfuerzo) | Relieve | Sí |
| Radiación | Relieve (más altura = menos atmósfera = más dosis) | Sí, extrapolando fuera de 700–950 Pa |
| Rugosidad | Relieve | Sí |
| Línea de vista con la base | Relieve | Sí, si se define una base en cada zona |
| Dunas | Campos de dunas del USGS (MGD3) | Hoy solo cargamos Gale; la base completa tiene 547 campos (±65°) |

Lo que se podría agregar:

| Dato | ¿Afectaría la ruta? |
|---|---|
| Inercia térmica THEMIS | **Sí**, es la única capa nueva útil: marcaría polvo fino (suelo blando) entre 60°S y 60°N. No reemplaza a las dunas. |
| Cloro GRS | No a escala de caminata (solo a partir de ~1 000 km). |
| Magnetismo MAG/ER | No hay fuente que diga cuánto cambia la dosis en el suelo. |
| Temperatura | No hay mapa; cambia con la hora y la estación, no con el lugar. |

**En resumen:** para todo Marte quedan tres datos reales que mueven la ruta: el relieve, los campos de dunas del USGS y la inercia térmica THEMIS (por agregar).

**Para usarlo fuera de Gale:** `radiation.js` calcula la presión de cada celda desde su altura, anclada en Gale (840 Pa a −4.4 km). Opcionalmente la ajusta con la MCD, que `fetch-mcd.mjs` consulta en un solo punto de Gale. En otra zona se puede seguir con la altura, o consultar la MCD en el centro de la zona. Para las dunas basta con cargar la base completa del USGS en vez del recorte de Gale.

## Qué significa para el plan de migración

1. **El lector de GeoTIFF por ventana funciona** con los dos productos grandes que importan (MOLA y la inercia THEMIS): solo se baja la zona pedida, en segundos. Esa parte del plan está bien.
2. **El cloro y el magnetismo no son GeoTIFF**: son tablas de texto. Hace falta un lector distinto, convertirlas una vez a GeoTIFF, o pedirlas al servicio JMARS (sección 8), que las entrega ya recortadas y alineadas.
3. **Con celdas de 300 km (cloro) y ~200 km (magnetismo)**, en una ventana del tamaño de un cráter son constantes. La normalización por mínimo y máximo de la ventana las convierte en ruido o divide entre cero. Recomendación: usarlas como **datos de contexto de la zona** (una cifra en el panel), no como capas de costo.
4. **La temperatura como capa no tiene dataset.** Se queda como condición de hora y estación.
5. **Diseñar para todo Marte desde el inicio:** elegir recuadro por bbox, normalizar longitudes y dejar "sin dato" fuera de 60° (sección 9). Gale queda como zona de prueba de esa misma lógica.
6. **Considerar el servicio JMARS** como fuente única para capas pequeñas: evita escribir un lector por formato y un remuestreador. Guardar los recortes en el repo para no depender del servicio en la demo.
7. **La inercia térmica es la única capa nueva con resolución útil**, pero marca polvo, no dunas: no reemplaza a los campos de dunas del USGS. Recomendación: agregarla como factor extra de suelo blando (polvo), sin quitar las dunas.

## Fuentes

- MOLA 463 m: [Astropedia](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m) · [PDS MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html)
- GRS: [PDS Geosciences](https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html) · [Keller et al. 2006](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2006JE002679)
- MAG/ER: [PDS](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-ER-5-FIELD-MAP-V1.0) · [Lillis et al. (resumen)](https://www.lpi.usra.edu/meetings/lpsc2005/pdf/2366.pdf)
- THEMIS inercia térmica: [mosaico global](https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic) · [recuadro 30S120E](https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp)
- TES inercia térmica: [Putzig y Mellon 2007](https://se.psi.edu/inertia/2007/) · [TES ASU](https://tes.mars.asu.edu/products) · [Mars Global Data Sets (ASU)](https://www.mars.asu.edu/data/)
- Abundancia de rocas: [Nowicki y Christensen 2007](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2006JE002798)
- Cubierta de polvo: [TES DCI](http://tes.asu.edu/~ruff/DCI/dci.html)
- Radiación en superficie: [Hassler et al. 2014 (RAD)](https://www.science.org/cms/asset/b9057f23-375b-447a-ba62-65a4e7f691a4/pap.pdf)
