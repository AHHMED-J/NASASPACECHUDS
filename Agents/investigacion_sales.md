# Investigación: sales dañinas (perclorato, cloruros, sulfatos)

Seguimiento de la investigación de datasets (`investigacion_datasets.md`). La pregunta es si hay información sobre sales dañinas que pueda entrar al costo de una ruta en cualquier zona de Marte. Se partió de las afirmaciones de un chat con Gemini y se verificó cada una con fuentes primarias y con los archivos reales. Fecha: 2026-11-14. Agente: Claude.

## Resumen

| Sal                             | ¿Por qué daña?                                                                                                          | ¿Hay mapa?                                                                                      | ¿Sirve para la ruta?                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Perclorato**                  | Tóxico: bloquea la captación de yodo en la tiroides. Viaja en el polvo.                                                 | **No.** Desde órbita no se detecta de forma confiable.                                          | **No como costo.** Está repartido en el suelo de todo Marte. Es un tema de manejo del polvo al volver al hábitat. |
| **Cloruros** (depósitos de sal) | No son tóxicos como el perclorato. El riesgo sería la corrosión del equipo (dato de la Tierra, sin verificar en Marte). | **Sí:** 1 605 polígonos (Hill y Christensen 2026), ~100 m                                       | **Sí, como capa opcional** fuera de Gale. Mismo formato que las dunas. En Gale no hay ninguno.                    |
| **Sulfatos**                    | Spirit se quedó atascado en 2009 al romper una costra de suelo rico en sulfatos (Troy).                                 | Solo grueso (TES, ~15 km). El mapa fino (MOCAAS, 100 m; Gale a 10 m) no se puede descargar hoy. | **Todavía no:** no hay mapa usable.                                                                               |

## 1. Verificación del chat con Gemini

| Afirmación                                                                                           | Veredicto     | Fuente                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El perclorato está en el suelo en 0.5–1 % en peso                                                    | ✅ Cierto     | Davila et al. 2013: 0.5–1 %. Phoenix: 0.4–0.6 % (Hecht et al. 2009). Curiosity en Gale: 0.05 a 1.05 % (Sutter et al. 2017).                                                                                                                                                                                                                                                                           |
| Forma salmueras corrosivas que alteran la tracción y dañan ruedas y sellos                           | ❌ Sin fuente | No se encontró ningún estudio sobre tracción o corrosión por salmueras. Las salmueras por absorción de humedad son lentas y de escala muy pequeña (PSJ 2023). En Gale, los datos de REMS indican que la superficie **no** es favorable a formarlas. Un modelo global da salmueras (meta)estables en ~40 % de la superficie, pero solo hasta el 2 % del año y sobre todo en latitudes altas del norte. |
| El polvo con perclorato se pega al traje y entra al hábitat; afecta tiroides, pulmones y médula ósea | ⚠️ En parte   | Tiroides: sí (Davila 2013). Pulmones: el polvo de Marte en general (revisión GeoHealth 2025). **Médula ósea: no se encontró fuente.** NASA (2026) considera el perclorato inhalado de **bajo riesgo** si se respeta el límite general de polvo (0.1 mg/m³, partículas < 10 μm); la preocupación es la ingesta, por ejemplo en cultivos.                                                               |
| No hay mapa global de perclorato                                                                     | ✅ Cierto     | Leask et al. 2018: las detecciones de perclorato con CRISM, incluidas las de las líneas de pendiente recurrentes (RSL), no se sostienen al reprocesar los datos.                                                                                                                                                                                                                                      |
| El cloro del GRS y los 965 polígonos de CaSSIS sirven como sustitutos por zona                       | ⚠️ En parte   | El GRS tiene celdas de ~300 km (ya descartado). Los 965 de CaSSIS (Bickel et al. 2024) son **recuadros**, no polígonos, y son **candidatos**: el ~50 % de las detecciones automáticas se descartó a mano. Además son cloruros, no perclorato.                                                                                                                                                         |
| Datos en PDS, Zenodo y JMARS                                                                         | ✅ En general | GRS en PDS; el catálogo de Hill está en Zenodo; el de CaSSIS está en BORIS (Universidad de Berna), no en Zenodo.                                                                                                                                                                                                                                                                                      |

## 2. Perclorato

- **Concentración:** 0.05 a 1.05 % en las muestras de Curiosity en Gale (Sutter et al. 2017). Cambia mucho incluso a metros de distancia: John Klein ~0.1 % y Cumberland ~1.2 % (equivalente Cl₂O₇), dos perforaciones de la misma unidad (Archer et al. 2018). Esa variación es real, pero ningún mapa la captura.
- **Mapa:** no existe. Desde órbita no se detecta de forma confiable (Leask et al. 2018).
- **Daño:** tiroides (Davila et al. 2013). Para NASA, el riesgo por inhalación queda cubierto por el límite general de polvo; el perclorato se maneja por todas las vías de exposición, sobre todo la ingesta.
- **Para la ruta:** no sirve como costo, porque no hay dato por celda y está en todas partes. Es un aviso de operación: limpiar el traje y controlar el polvo antes de entrar al hábitat o al rover.
- **Idea nuestra, sin verificar:** la exposición al polvo podría ser mayor en zonas de polvo fino. La inercia térmica THEMIS sí marca esas zonas, así que la capa propuesta de "suelo blando" también sería una aproximación al polvo, pero no al perclorato.

## 3. Cloruros: la única sal con mapa usable

### Índice de cloruros THEMIS (JMARS)

Es la capa `global_clindex_*` del servicio WMS de JMARS, con tres sensibilidades y ~100 m. Cuenta cuántas imágenes THEMIS detectaron cloruro en cada punto. **La capa cruda tiene mucho ruido.** En Gale, la tasa de detección sube con la pendiente:

| Pendiente (DEM 200 m) | Celdas con detección | Celdas con 3 o más detecciones |
| --------------------- | -------------------- | ------------------------------ |
| 0–2°                  | 1.5 %                | 0.07 %                         |
| 2–5°                  | 3.4 %                | 0.23 %                         |
| 5–10°                 | 6.5 %                | 0.80 %                         |
| 10–15°                | 12.6 %               | 2.59 %                         |
| 15–20°                | 18.3 %               | 5.53 %                         |
| más de 20°            | 27.6 %               | 9.11 %                         |

Los mismos autores advierten falsos positivos en pendientes y con el sol bajo (LPSC 2019). En todo Marte, la capa cruda sale repartida casi igual entre el norte y el sur. Los depósitos revisados, en cambio, están casi todos en el sur (ver abajo). **No usar la capa cruda.**

### Catálogo revisado de Hill y Christensen (2026)

Zenodo 18473804, licencia CC-BY-4.0. Archivo `hill_christensen_chloride_survey_shapefile.zip` (1.1 MB) con un shapefile y un CSV de polígonos. Verificado al abrir el archivo:

- **1 605 depósitos**, 11 974 km² en total. Mediana de 2.65 km², el 90 % mide menos de 17.4 km² y el mayor 194.5 km².
- **96 % en el hemisferio sur:** solo 59 están al norte del ecuador. La mayoría entre 50°S y 20°S.
- **Gale:** ninguno dentro de la ventana. El más cercano está a ~351 km (Terra Cimmeria, 6.42°S 131.94°E, 85 km²). Hay 9 a menos de 500 km.
- **Ventanas de 166 km** (2.8°) entre 60°S y 60°N: el **9 %** tiene al menos un depósito. Las más cargadas tienen 19 a 33.
- **Relieve donde están**, según el catálogo: más bajos que su entorno 472, a nivel 441, en ladera 437, más altos 187.

### Candidatos de CaSSIS (Bickel et al. 2024)

965 recuadros de ~0.3 a 3 km a ~4 m/píxel. CaSSIS cubre solo ~7 % de Marte. Según la comparación que publican Hill y Christensen, **solo 88 de los 965 (9 %) coinciden o están cerca** de un depósito del catálogo THEMIS. El más cercano a Gale está a ~527 km.

### Cómo entraría al motor

Igual que las dunas: polígonos que se pasan a la rejilla. `rasterDunes` en `dem.js` ya hace eso. Sería un factor opcional de "depósito salino" para rutas en las tierras altas del sur. **El peso es decisión del equipo:** no hay medición de cuánto daña cruzar un depósito de cloruro.

## 4. Sulfatos

- **Daño comprobado en operación:** Spirit rompió una costra delgada rica en sulfatos y se hundió en la arena de abajo, una mezcla de sulfato y basalto. Fue en Troy, en 2009, y no volvió a salir (Arvidson et al. 2010). Es el único caso documentado de una sal que afectó la movilidad de un rover.
- **Toxicidad:** el yeso aparece entre los componentes del polvo de Marte con posible efecto en la salud (revisión GeoHealth 2025).
- **Mapas:**
  - TES Sulfate (Bandfield 2002), vía JMARS, ~15 km: en Gale da 0–6 %, dentro del fondo global (mediana 2.3 %, p95 6 %). No distingue nada.
  - MOCAAS (Carter et al. 2023, OMEGA y CRISM, 100–500 m, ±70°): sulfatos mono y polihidratados, con un mapa de **Gale a 10 m**. **Las descargas del sitio devuelven "410 Gone"** (verificado el 2026-11-14). El sitio dice que se puede ver en JMARS, pero no aparece en el servicio WMS. Habría que pedirlo al autor.
  - En JMARS existe `omega_hydrated_mineral_map` (OMEGA, hidratados en general). No se probó.

## 5. Qué significa para el proyecto

1. **El perclorato no puede ser una capa de costo.** No hay dato por zona y está en todas partes. Va como aviso de operación y de salud (manejo del polvo), con las fuentes de arriba.
2. **Los depósitos de cloruro de Hill y Christensen sí pueden entrar**, como capa opcional con el mismo código de las dunas. Solo afectan rutas en las tierras altas del sur; en Gale no cambian nada.
3. **Los sulfatos son el riesgo de tracción mejor documentado** (Spirit), pero hoy no hay un mapa descargable con resolución útil. Si MOCAAS vuelve a estar disponible, es la siguiente capa a probar.
4. **No usar la capa cruda del índice de cloruros:** sus detecciones siguen la pendiente.
5. **Cruzar con humedad y temperatura** (idea del chat con Gemini) no es viable: no hay mapas de humedad a escala de ruta, y la temperatura cambia con la hora y la estación (ver `investigacion_datasets.md`).

## Fuentes

- Davila et al. 2013, _Perchlorate on Mars: a chemical hazard and a resource for humans_, Int. J. Astrobiology 12(4) 321–325: [Cambridge](https://cambridge.org/core/journals/international-journal-of-astrobiology/article/perchlorate-on-mars-a-chemical-hazard-and-a-resource-for-humans/E4906FAD7F45A9AE8212B9198C6FD4AB)
- Hecht et al. 2009, Science 325, 64–67 (Phoenix): [resumen](https://experts.arizona.edu/en/publications/detection-of-perchlorate-and-the-soluble-chemistry-of-martian-soi/)
- Sutter et al. 2017, JGR Planets (SAM, Gale): [Caltech](https://authors.library.caltech.edu/81049) · Archer et al. 2018: [NTRS](https://ntrs.nasa.gov/api/citations/20180008469/downloads/20180008469.pdf)
- Leask et al. 2018, GRL 45, 12 180–12 189: [Caltech](https://resolver.caltech.edu/CaltechAUTHORS:20181121-071639184)
- NASA 2026, límite de exposición al polvo de Marte: [nasa.gov](https://www.nasa.gov/general/establishing-crew-exposure-limits-of-martian-dust/)
- Revisión GeoHealth 2025, salud y polvo de Marte: [DOAJ](https://doaj.org/article/29d54689d73a4272bcadc8bb65c020a6)
- Salmueras: [PSJ 2023](https://iopscience.iop.org/article/10.3847/PSJ/acbd98) · [REMS recalibrado, Gale](https://web3.arxiv.org/pdf/1811.00862) · [mapa de estabilidad](https://pmc.ncbi.nlm.nih.gov/articles/PMC7745847)
- Hill y Christensen 2026, JGR Planets (índice PC de cloruros): [Zenodo 18473804](https://zenodo.org/records/18473804) · [LPSC 2019, falsos positivos](https://www.hou.usra.edu/meetings/lpsc2019/pdf/3213.pdf)
- Bickel et al. 2024, Scientific Data 11:845 (CaSSIS): [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11298006) · datos: doi 10.48620/352
- Osterloo et al. 2010, JGR: [Wiley](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2010JE003613)
- Arvidson et al. 2010, JGR (Spirit en Troy), doi 10.1029/2010JE003633: [USGS](https://www.usgs.gov/publications/spirit-mars-rover-mission-overview-and-selected-results-northern-home-plate-winter)
- Carter et al. 2023, Icarus 389, 115164 (MOCAAS): [sitio](https://www.ias.universite-paris-saclay.fr/moccas/)
- Bandfield 2002, JGR 107 (sulfatos TES), vía el servicio WMS de JMARS
