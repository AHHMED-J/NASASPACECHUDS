import { useEffect, useRef } from 'react'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'
import { get as getProjection } from 'ol/proj'
import Map from 'ol/Map'
import DragPan from 'ol/interaction/DragPan'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import { shiftKeyOnly } from 'ol/events/condition'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import ImageStatic from 'ol/source/ImageStatic'
import VectorSource from 'ol/source/Vector'
import TileGrid from 'ol/tilegrid/TileGrid'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style'
import { isBlocked } from '../lib/route'
import 'ol/ol.css'

// Marte 2000 geográfico (el CRS que usa Trek: EPSG:104905)
proj4.defs('EPSG:104905', '+proj=longlat +a=3396190 +b=3376200 +no_defs')
register(proj4)
const MARS = getProjection('EPSG:104905')
MARS.setExtent([-180, -90, 180, 90])

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm'
const tileGrid = new TileGrid({
  origin: [-180, 90],
  resolutions: Array.from({ length: 8 }, (_, z) => 360 / 512 / 2 ** z),
  tileSize: 256,
})

const canvasFor = (dem) => {
  const c = document.createElement('canvas')
  c.width = dem.w
  c.height = dem.h
  const ctx = c.getContext('2d')
  return { c, ctx, img: ctx.createImageData(dem.w, dem.h) }
}

function heatUrl(dem) {
  const { c, ctx, img } = canvasFor(dem)
  for (let i = 0; i < dem.n; i++) {
    const t = dem.radRisk[i] // 0 bajo riesgo (azul) -> 1 alto (rojo)
    if (Number.isNaN(t)) continue
    img.data[i * 4] = 255 * t
    img.data[i * 4 + 1] = 80 * (1 - Math.abs(t - 0.5) * 2)
    img.data[i * 4 + 2] = 255 * (1 - t)
    img.data[i * 4 + 3] = 170
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

// Rojo = bloqueada por el filtro; gris = sin dato (fuera de la cobertura del DEM)
function maskCanvas(dem, filter) {
  const { c, ctx, img } = canvasFor(dem)
  for (let i = 0; i < dem.n; i++) {
    if (Number.isNaN(dem.elev[i])) {
      img.data.set([70, 70, 80, 200], i * 4)
    } else if (isBlocked(dem, i, filter)) {
      img.data.set([255, 40, 40, 140], i * 4)
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

// Relieve sombreado del propio DEM (luz desde el NO) teñido por altura
const RAMP = [[0, [45, 70, 120]], [0.35, [60, 130, 110]], [0.65, [190, 170, 90]], [1, [235, 225, 210]]]
function ramp(t) {
  for (let k = 1; k < RAMP.length; k++)
    if (t <= RAMP[k][0]) {
      const [t0, a] = RAMP[k - 1], [t1, b] = RAMP[k], f = (t - t0) / (t1 - t0)
      return a.map((v, q) => v + (b[q] - v) * f)
    }
  return RAMP[RAMP.length - 1][1]
}
function reliefUrl(dem) {
  const { c, ctx, img } = canvasFor(dem)
  const { w, h, elev, cellM, elevMin, elevMax } = dem
  const at = (x, y) => elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  const az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180, vex = 2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (Number.isNaN(elev[i])) continue
      const dzdx = (vex * (at(x + 1, y) - at(x - 1, y))) / (2 * cellM)
      const dzdy = (vex * (at(x, y + 1) - at(x, y - 1))) / (2 * cellM)
      const sl = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx)
      const shade = Math.max(0, Math.sin(alt) * Math.cos(sl) + Math.cos(alt) * Math.sin(sl) * Math.cos(az - asp))
      const col = ramp((elev[i] - elevMin) / (elevMax - elevMin))
      const k = 0.35 + 0.9 * shade
      img.data.set([col[0] * k, col[1] * k, col[2] * k, 255], i * 4)
    }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

const pt = (color) =>
  new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 2 }) }) })

export default function MapView({ dem, layer, basemap, filter, route, start, end, onPick }) {
  const el = useRef(null)
  const ref = useRef({})
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    const route = new VectorSource()
    const maskLayer = new ImageLayer({ opacity: 1 })
    const heatLayer = new ImageLayer({ opacity: 1 })
    const reliefLayer = new ImageLayer({ opacity: 1 })
    const map = new Map({
      target: el.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            projection: MARS,
            tileGrid,
            wrapX: false,
            crossOrigin: 'anonymous',
            tileUrlFunction: ([z, x, y]) => `${TREK}/${z}/${y}/${x}.jpg`,
            attributions: 'NASA Trek · MOLA',
          }),
        }),
        reliefLayer,
        heatLayer,
        maskLayer,
        new VectorLayer({
          source: route,
          style: (f) => {
            const k = f.get('kind')
            if (k === 'line') return new Style({ stroke: new Stroke({ color: '#22d3ee', width: 4 }) })
            if (k === 'straight') return new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,.7)', width: 2, lineDash: [6, 6] }) })
            return pt(k === 'start' ? '#22c55e' : '#f59e0b')
          },
        }),
      ],
      view: new View({ projection: MARS, center: [137.4, -4.6], resolution: 0.0012 }),
      // el arrastre normal traza la ruta; Shift+arrastrar mueve el mapa
      interactions: defaultInteractions({ dragPan: false, shiftDragZoom: false }).extend([new DragPan({ condition: shiftKeyOnly })]),
    })
    let dragging = false
    const vp = map.getViewport()
    const coord = (ev) => map.getEventCoordinate(ev)
    const down = (ev) => {
      if (ev.button !== 0 || ev.shiftKey) return
      dragging = true
      vp.setPointerCapture?.(ev.pointerId)
      pickRef.current('down', coord(ev))
    }
    const move = (ev) => dragging && pickRef.current('move', coord(ev))
    const up = (ev) => {
      if (!dragging) return
      dragging = false
      pickRef.current('up', coord(ev))
    }
    vp.addEventListener('pointerdown', down)
    vp.addEventListener('pointermove', move)
    vp.addEventListener('pointerup', up)
    ref.current = { map, route, maskLayer, heatLayer, reliefLayer }
    return () => {
      vp.removeEventListener('pointerdown', down)
      vp.removeEventListener('pointermove', move)
      vp.removeEventListener('pointerup', up)
      map.setTarget(undefined)
    }
  }, [])

  // máscara de filtro
  useEffect(() => {
    if (!dem) return
    ref.current.maskLayer.setSource(
      new ImageStatic({
        url: maskCanvas(dem, filter),
        projection: MARS,
        imageExtent: [dem.lonMin, dem.latMin, dem.lonMax, dem.latMax],
        interpolate: false,
      }),
    )
  }, [dem, filter])

  // relieve del DEM (solo se recalcula si cambia la malla base, no la radiación) + encuadre inicial
  const fitted = useRef(false)
  useEffect(() => {
    if (!dem) return
    const { reliefLayer, map } = ref.current
    reliefLayer.setSource(
      new ImageStatic({ url: reliefUrl(dem), projection: MARS, imageExtent: [dem.lonMin, dem.latMin, dem.lonMax, dem.latMax], interpolate: true }),
    )
    if (!fitted.current) {
      fitted.current = true
      map.getView().fit([dem.lonMin, dem.latMin, dem.lonMax, dem.latMax], { padding: [20, 20, 20, 20] })
    }
  }, [dem?.elev]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ref.current.reliefLayer?.setVisible(basemap === 'relief') }, [basemap])

  // capa de radiación
  useEffect(() => {
    if (!dem) return
    const { heatLayer } = ref.current
    if (layer === 'none') return heatLayer.setSource(null)
    heatLayer.setSource(
      new ImageStatic({
        url: heatUrl(dem),
        projection: MARS,
        imageExtent: [dem.lonMin, dem.latMin, dem.lonMax, dem.latMax],
        interpolate: true,
      }),
    )
  }, [dem, layer])

  // ruta + marcadores
  useEffect(() => {
    if (!dem) return
    const src = ref.current.route
    src.clear()
    if (start && end)
      src.addFeature(new Feature({ geometry: new LineString([dem.lonLat(...start), dem.lonLat(...end)]), kind: 'straight' }))
    if (route) {
      const coords = route.cells.map(([x, y]) => dem.lonLat(x, y))
      src.addFeature(new Feature({ geometry: new LineString(coords), kind: 'line' }))
    }
    if (start) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...start)), kind: 'start' }))
    if (end) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...end)), kind: 'end' }))
  }, [dem, route, start, end])

  return <div ref={el} className="h-full w-full" />
}
