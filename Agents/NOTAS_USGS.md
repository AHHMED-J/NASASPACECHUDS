# Notas: herramientas y datos del USGS Astrogeology

Revisadas, **sin implementar**. Contexto general del proyecto en `CONTEXTO.md`.

La página "Explore Tools" del [Hub del USGS](https://astrogeology-usgs.hub.arcgis.com/pages/explore-tools) es una lista de utilidades de GIS de escritorio (ArcGIS Pro, ArcMap, GDAL, enlaces). No nos sirve directo; solo **GDAL** podría ayudar a convertir o recortar mapas. Del catálogo de datos (solo se revisaron las fichas, no los archivos):

- **Inercia térmica THEMIS** ([Astropedia](https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic)): 100 m, de imágenes infrarrojas de noche, precisión ~20 %. Versión [cuantitativa de 32 bits](https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_00n000e_100mpp) en recuadros de ~2.5 GB (falta confirmar el que cubre Gale). Baja = arena o polvo, alta = roca. **Es la candidata para "suelo blando".** Primero hacer una prueba: bajar solo Gale y ver si las dunas Bagnold salen con valores bajos; si no, descartar.
- **Gazetteer de nombres planetarios** ([descargas](https://planetarynames.wr.usgs.gov/GIS_Downloads)): Shapefile y KML con nombres oficiales. Útil para etiquetas y para los destinos de Curiosity. Revisar la fecha: los archivos viejos no incluyen nombres aprobados después de nov. 2010.
- **Mapa geológico global** ([SIM 3292](https://pubs.usgs.gov/publication/sim3292)): ~790 MB, proyección Robinson, hecho para ArcGIS. Da el tipo de roca, no si se puede caminar. **No recomendado.**

Orden sugerido: 1) prueba de inercia térmica, 2) Gazetteer, 3) dejar el mapa geológico.
