# Bitácora de cambios — Mars Route (Gale)

Resumen simple de cada cambio. Hora del Pacífico (PST). Lo más nuevo va arriba.

---

## 2026-11-14 14:20 — Prueba: ¿THEMIS de noche sirve para detectar arena? → No (sin cambios en la página)

**Qué probamos:** el mosaico THEMIS-IR de noche (USGS, 100 m) en todo Gale, comparado con las dunas Bagnold que ya conocemos.

**Idea:** de noche la arena suelta se enfría más rápido que la roca → debería verse más **oscura**.

**Resultado:** pasa lo **contrario**. Las dunas Bagnold se ven **más tibias (claras)** que el terreno de alrededor:
- En dunas: valor medio **177** (escala 0–255).
- Fuera de dunas: valor medio **148**.
- Los rangos se mezclan mucho (dunas 122–240, resto 103–184).

**Por qué:** la arena de Bagnold es **gruesa y sin polvo**, y guarda bastante calor. El llano de alrededor está cubierto de **polvo fino**, que se enfría más. Además, USGS aclara que este mosaico es **solo visual** (valores estirados y mezclados), no temperatura real.

**Conclusión:** con THEMIS de noche no se puede decir "frío = arena". No lo agregamos.

---

## 2026-11-14 14:12 — ¿Por qué la ruta ahora se va por el otro lado?

**Qué se ve:** en la comparación con Curiosity, nuestra ruta (cian) ahora se va por el **lado este** de la línea recta, y Curiosity (rosa) por el **oeste**. Antes nuestra ruta también se iba por el oeste, cerca de Curiosity.

**Causa:** en el cambio de las 13:33 quitamos la **"ladera de lado"** (era un supuesto nuestro).

| | Antes (13:13) | Ahora (13:33) |
|---|---|---|
| Subidas (esfuerzo) | ✅ | ✅ |
| Ladera de lado | ✅ (supuesto nuestro) | ❌ quitada |
| Pendiente > 20° bloquea | ✅ | ✅ |
| Arena (si se activa) | ✅ | ✅ |

**Por qué cambia el lado:**
- En "solo relieve" el piso del cráter es casi plano, así que **los dos lados cuestan casi lo mismo**.
- Antes, la ladera de lado castigaba un poco el lado este (el terreno ahí está inclinado de lado) → la ruta prefería el oeste.
- Sin ese castigo, solo cuenta **cuánto se sube**: por el este se suben ~24 m menos → la ruta se va al este. Eso dice el marcador ①.
- Es una diferencia **muy pequeña** (24 m de subida en ~9 km): cualquier ajuste mínimo cambia el lado.

**Comprobado** (DEM 200 m, sin arena, Curiosity hasta el sol 1700):
- Antes: se desviaba al **oeste** (motivo: ladera de lado).
- Ahora: se desvía al **este** (motivo: "ir derecho sube 24 m más").
- Con el DEM de **50 m** sin arena pasa lo mismo: se va al **este** (por ahí se suben ~30 m menos).
- Con **"Evitar arena"** activado vuelve al **oeste**, cerca de Curiosity (a 200 m se desvía ~1 km para no cruzar ~1.1 km de dunas). **La arena es lo que empuja hacia el lado de Curiosity**, igual que en la realidad.

**Conclusión:** no es un error. Con solo relieve, el terreno no da una razón fuerte para ir por un lado u otro (unos 24–30 m de subida de diferencia). Para comparar con Curiosity conviene activar **"Evitar arena"**.

---

## 2026-11-14 13:33 — Limpieza de código (`e6113f2`)
- Quitada la **ortofoto** de la página.
- Quitada la **ladera de lado** (era un supuesto).
- La **sombra** ya no cuenta en la ruta; solo es una capa visual y se calcula solo si la miras.
- Borrado código que no se usaba.

## 2026-11-14 13:13 — Explicación de los giros (`ef3df2b`)
- Ahora es **clic en inicio + clic en destino** (antes: arrastrar).
- Cada giro tiene un **número** y una **frase** que dice por qué (pendiente, subida, arena…).
- Al tocar un número se ve en rojo el **camino recto que se descartó**.

## 2026-11-14 12:56 — Mejoras a la comparación con Curiosity (`3acafd5`)
- **Corte por sol:** comparar solo hasta cierto día de la misión.
- **DEM de 50 m** en la zona de Curiosity (más detalle).
- **Mapa de arena** estimado con la foto HiRISE (solo zona de Curiosity).

## 2026-11-14 12:33 — Comparación con Curiosity (`fa1fcec`)
- Casilla para ver el **recorrido real de Curiosity** (datos NASA/JPL).
- En ese modo nuestra ruta usa **solo el relieve**.
- Métricas: qué tan lejos queda nuestra ruta de la de Curiosity.

## 2026-11-14 12:22 — Opciones al final (`97bfc85`)
- Estación y actividad solar movidas a un desplegable **"Opciones"** al final.

## 2026-11-14 12:20 — Mapa parejo (`94d88de`)
- El mapa base por defecto es el **relieve** (la ortofoto solo cubría una parte).

## 2026-11-14 12:17 — Cráter completo (`b18da8e`)
- El mapa ahora cubre **todo el cráter Gale** (DEM de 200 m).
- La línea de vista con la base ya considera la **curvatura de Marte**.

## 2026-11-14 12:09 — Barra lateral más limpia (`8e9f071`)
- Letra más legible, secciones agrupadas, mapa y curva de temperatura plegables.

## 2026-11-14 12:00 — Interfaz más simple (`a438e22`)
- Pesos de la ruta **fijos** (sin sliders).
- Distancia, tiempo y elevación en una tarjeta **arriba a la derecha** del mapa.
- Etiqueta **"BASE"** en el triángulo.
