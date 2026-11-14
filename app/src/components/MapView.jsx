import { useEffect, useRef } from 'react'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'
import { get as getProjection } from 'ol/proj'
import Map from 'ol/Map'
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

function maskCanvas(dem, filter) {
  const { size } = dem
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    if (isBlocked(dem, i, filter)) {
      img.data[i * 4] = 255
      img.data[i * 4 + 1] = 40
      img.data[i * 4 + 2] = 40
      img.data[i * 4 + 3] = 140
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

const pt = (color) =>
  new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 2 }) }) })

export default function MapView({ dem, filter, route, start, end, onPick }) {
  const el = useRef(null)
  const ref = useRef({})
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    const route = new VectorSource()
    const maskLayer = new ImageLayer({ opacity: 1 })
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
        maskLayer,
        new VectorLayer({
          source: route,
          style: (f) =>
            f.get('kind') === 'line'
              ? new Style({ stroke: new Stroke({ color: '#22d3ee', width: 4 }) })
              : pt(f.get('kind') === 'start' ? '#22c55e' : '#f59e0b'),
        }),
      ],
      view: new View({ projection: MARS, center: [137.75, -5.25], resolution: 0.0035 }),
    })
    map.on('click', (e) => pickRef.current(e.coordinate))
    ref.current = { map, route, maskLayer }
    return () => map.setTarget(undefined)
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

  // ruta + marcadores
  useEffect(() => {
    if (!dem) return
    const src = ref.current.route
    src.clear()
    if (route) {
      const coords = route.cells.map(([x, y]) => dem.lonLat(x, y))
      src.addFeature(new Feature({ geometry: new LineString(coords), kind: 'line' }))
    }
    if (start) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...start)), kind: 'start' }))
    if (end) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...end)), kind: 'end' }))
  }, [dem, route, start, end])

  return <div ref={el} className="h-full w-full" />
}
