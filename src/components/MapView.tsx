import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from 'maplibre-gl'
// MapLibre 6 loads its tile worker from a separate module; let Vite bundle it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { FeatureCollection, LineString, Point } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HARDISTY, LANES, WESTRIDGE, type LaneId } from '../lanes'

setWorkerUrl(workerUrl)

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const FONT = ['Montserrat Medium', 'Open Sans Regular', 'Noto Sans Regular']
const FONT_BOLD = ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular']

interface Props {
  best: LaneId
  hovered: LaneId | null
  onHover: (id: LaneId | null) => void
  onSelect: (id: LaneId) => void
}

const formatNm = (nm: number) => `≈ ${nm.toLocaleString('en-US')} nm`

function laneFeatures(): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: LANES.flatMap((lane) =>
      lane.segments.map((s) => ({
        type: 'Feature' as const,
        properties: { lane: lane.id, mode: s.mode, color: lane.color, offset: lane.offset },
        geometry: { type: 'LineString' as const, coordinates: s.coords },
      })),
    ),
  }
}

function pointFeatures(): FeatureCollection<Point> {
  const dests = LANES.flatMap((lane) =>
    lane.destinations.map((d) => ({
      type: 'Feature' as const,
      properties: {
        lane: lane.id,
        color: lane.color,
        kind: 'dest',
        label: d.seaNm ? `${d.name}\n${formatNm(d.seaNm)}` : d.name,
      },
      geometry: { type: 'Point' as const, coordinates: d.coord },
    })),
  )
  const hubs = [
    { label: 'Westridge', coord: WESTRIDGE, kind: 'hub' },
    { label: 'Hardisty', coord: HARDISTY, kind: 'origin' },
  ].map((h) => ({
    type: 'Feature' as const,
    properties: { lane: '', color: '#fafafa', kind: h.kind, label: h.label },
    geometry: { type: 'Point' as const, coordinates: h.coord },
  }))
  return { type: 'FeatureCollection', features: [...dests, ...hubs] }
}

/** Zoom that keeps Hardisty centred while fitting every lane on screen. */
function fitZoom(el: HTMLElement): number {
  const coords = LANES.flatMap((l) => l.segments.flatMap((s) => s.coords))
  const mercY = (lat: number) =>
    (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2
  const cy = mercY(HARDISTY[1])
  let dx = 0
  let dy = 0
  for (const [lon, lat] of coords) {
    dx = Math.max(dx, Math.abs(lon - HARDISTY[0]) / 360)
    dy = Math.max(dy, Math.abs(mercY(lat) - cy))
  }
  const pad = 48
  const zx = Math.log2((el.clientWidth / 2 - pad) / (dx * 512))
  const zy = Math.log2((el.clientHeight / 2 - pad) / (dy * 512))
  return Math.max(0, Math.min(zx, zy, 4))
}

const laneFilter = (id: string | null): ExpressionSpecification => ['==', ['get', 'lane'], id ?? '__none__']

export default function MapView({ best, hovered, onHover, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const handlers = useRef({ onHover, onSelect })
  handlers.current = { onHover, onSelect }
  const latest = useRef({ best, hovered })
  latest.current = { best, hovered }

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const map = new MapLibreMap({
      container: el,
      style: STYLE_URL,
      center: HARDISTY,
      zoom: fitZoom(el),
      minZoom: 0,
      maxZoom: 9,
      renderWorldCopies: true,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    map.on('load', () => {
      map.addSource('lanes', { type: 'geojson', data: laneFeatures() })
      map.addSource('points', { type: 'geojson', data: pointFeatures() })

      const color: ExpressionSpecification = ['get', 'color']
      const offset: ExpressionSpecification = ['get', 'offset']
      const width: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3.5]

      // Glow under the best lane
      map.addLayer({
        id: 'lanes-glow',
        type: 'line',
        source: 'lanes',
        filter: laneFilter(latest.current.best),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': 16, 'line-blur': 12, 'line-opacity': 0.6, 'line-offset': offset },
      })
      // Hover halo
      map.addLayer({
        id: 'lanes-hover',
        type: 'line',
        source: 'lanes',
        filter: laneFilter(latest.current.hovered),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': 9, 'line-blur': 4, 'line-opacity': 0.45, 'line-offset': offset },
      })
      const modes = [
        { mode: 'pipe', dash: undefined },
        { mode: 'tanker', dash: [0.6, 1.8] },
        { mode: 'rail', dash: [2.5, 1.5] },
      ] as const
      for (const { mode, dash } of modes) {
        map.addLayer({
          id: `lanes-${mode}`,
          type: 'line',
          source: 'lanes',
          filter: ['==', ['get', 'mode'], mode],
          layout: { 'line-cap': dash ? 'butt' : 'round', 'line-join': 'round' },
          paint: {
            'line-color': color,
            'line-width': width,
            'line-offset': offset,
            'line-opacity': 0.95,
            ...(dash ? { 'line-dasharray': [...dash] } : {}),
          },
        })
      }
      // Fat invisible line for easy hovering / tapping
      map.addLayer({
        id: 'lanes-hit',
        type: 'line',
        source: 'lanes',
        paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0, 'line-offset': offset },
      })

      map.addLayer({
        id: 'points-circle',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-color': color,
          'circle-radius': ['match', ['get', 'kind'], 'origin', 6, 'hub', 3.5, 4],
          'circle-stroke-color': '#09090b',
          'circle-stroke-width': 1.5,
        },
      })
      map.addLayer({
        id: 'points-label',
        type: 'symbol',
        source: 'points',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['match', ['get', 'kind'], 'origin', ['literal', FONT_BOLD], ['literal', FONT]],
          'text-size': ['match', ['get', 'kind'], 'origin', 14, 11],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'bottom-left', 'top-right'],
          'text-radial-offset': ['match', ['get', 'kind'], 'origin', 0.9, 0.7],
          'text-justify': 'auto',
          'text-line-height': 1.25,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['match', ['get', 'kind'], 'dest', '#d4d4d8', '#fafafa'],
          'text-halo-color': '#09090b',
          'text-halo-width': 1.4,
        },
      })

      map.on('mousemove', 'lanes-hit', (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.lane as LaneId | undefined
        if (id) handlers.current.onHover(id)
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'lanes-hit', () => {
        handlers.current.onHover(null)
        map.getCanvas().style.cursor = ''
      })
      map.on('click', (e: MapMouseEvent) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['lanes-hit'] })[0]
        const id = hit?.properties?.lane as LaneId | undefined
        if (id) handlers.current.onSelect(id)
        else handlers.current.onHover(null)
      })

      if (!reduceMotion) {
        const tick = (t: number) => {
          const o = 0.45 + 0.3 * (0.5 + 0.5 * Math.sin(t / 650))
          map.setPaintProperty('lanes-glow', 'line-opacity', o)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      }
      readyRef.current = true
    })

    return () => {
      cancelAnimationFrame(raf)
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) map.setFilter('lanes-glow', laneFilter(best))
  }, [best])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) map.setFilter('lanes-hover', laneFilter(hovered))
  }, [hovered])

  // MapLibre's CSS forces position:relative on the container, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
