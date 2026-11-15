import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from 'maplibre-gl'
// MapLibre 6 loads its tile worker from a separate module; let Vite bundle it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { FeatureCollection, LineString, Point } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Theme } from '../hooks'
import { EDMONTON, HARDISTY, LANES, type LaneId } from '../lanes'

setWorkerUrl(workerUrl)

const STYLE: Record<Theme, string> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
}
const FONT = ['Montserrat Medium', 'Open Sans Regular', 'Noto Sans Regular']
const FONT_BOLD = ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular']

const PAL: Record<Theme, { origin: string; halo: string; label: string }> = {
  dark: { origin: '#ececee', halo: '#050506', label: '#ececee' },
  light: { origin: '#111113', halo: '#ffffff', label: '#111113' },
}

/** Default frame: the North American network. Asia only when TMX → Asia is selected. */
const NORTH_AMERICA: LngLatBoundsLike = [
  [-127.5, 27.5],
  [-86.5, 56],
]
const WITH_ASIA: LngLatBoundsLike = [
  [-242, 19],
  [-86.5, 58],
]

export interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

interface Props {
  theme: Theme
  best: LaneId
  /** Hovered or selected lane: drawn thicker with its city labels */
  active: LaneId | null
  /** Frame the Pacific crossing (TMX → Asia selected) */
  showAsia: boolean
  offline: LaneId[]
  /** Screen space covered by overlays */
  padding: Padding
  /** Pointer position is in viewport (client) coordinates. */
  onHover: (id: LaneId | null, at?: { x: number; y: number }) => void
  onSelect: (id: LaneId | null, at?: { x: number; y: number }) => void
}

function laneFeatures(): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: LANES.flatMap((lane) =>
      lane.segments.map((s) => ({
        type: 'Feature' as const,
        properties: { lane: lane.id, mode: s.mode, offset: lane.offset, cd: lane.color.dark, cl: lane.color.light },
        geometry: { type: 'LineString' as const, coordinates: s.coords },
      })),
    ),
  }
}

function pointFeatures(): FeatureCollection<Point> {
  const dests = LANES.flatMap((lane) =>
    lane.destinations.map((d) => ({
      type: 'Feature' as const,
      properties: { lane: lane.id, kind: 'dest', label: d.name, cd: lane.color.dark, cl: lane.color.light },
      geometry: { type: 'Point' as const, coordinates: d.coord },
    })),
  )
  const origins = [
    { label: 'Hardisty', coord: HARDISTY, lane: '*' },
    { label: 'Edmonton', coord: EDMONTON, lane: 'tmx' },
  ].map((h) => ({
    type: 'Feature' as const,
    properties: { lane: h.lane, kind: 'origin', label: h.label, cd: '', cl: '' },
    geometry: { type: 'Point' as const, coordinates: h.coord },
  }))
  return { type: 'FeatureCollection', features: [...dests, ...origins] }
}

const isLane = (id: string | null): ExpressionSpecification => ['==', ['get', 'lane'], id ?? '__none__']

export default function MapView({ theme, best, active, showAsia, offline, padding, onHover, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const handlers = useRef({ onHover, onSelect })
  handlers.current = { onHover, onSelect }
  const latest = useRef({ theme, best, active, offline })
  latest.current = { theme, best, active, offline }

  /** Push current best/active/offline/theme into layer paint + filters. */
  const restyle = () => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const { theme, best, active, offline } = latest.current
    const p = PAL[theme]
    const color: ExpressionSpecification = ['get', theme === 'dark' ? 'cd' : 'cl']
    const off: ExpressionSpecification = ['in', ['get', 'lane'], ['literal', offline]]
    const width: ExpressionSpecification = ['case', isLane(active), 3.6, isLane(best), 2.8, 2]
    // Every lane keeps its colour; when one is in focus the rest step back a little.
    const opacity: ExpressionSpecification = active
      ? ['case', off, 0.15, isLane(active), 1, 0.4]
      : ['case', off, 0.15, 0.95]
    for (const id of ['lanes-pipe', 'lanes-tanker', 'lanes-rail', 'lanes-transfer']) {
      map.setPaintProperty(id, 'line-color', color)
      map.setPaintProperty(id, 'line-width', width)
      map.setPaintProperty(id, 'line-opacity', opacity)
    }
    map.setPaintProperty('lanes-glow', 'line-color', color)
    map.setFilter('lanes-glow', ['all', isLane(best), ['!', off]])
    // Hardisty always; Edmonton when a TMX lane is active; destinations only for the active lane.
    const tmxActive = active === 'tmx-uswc' || active === 'tmx-asia'
    const show: ExpressionSpecification = [
      'any',
      ['==', ['get', 'lane'], '*'],
      ['all', ['==', ['get', 'lane'], 'tmx'], ['literal', tmxActive]],
      isLane(active),
    ]
    map.setFilter('points-label', show)
    map.setFilter('points-circle', show)
    map.setPaintProperty('points-circle', 'circle-color', ['case', ['==', ['get', 'kind'], 'origin'], p.origin, color])
    map.setPaintProperty('points-circle', 'circle-stroke-color', p.halo)
    map.setPaintProperty('points-label', 'text-color', p.label)
    map.setPaintProperty('points-label', 'text-halo-color', p.halo)
  }

  /** (Re)install sources and layers — runs on first load and after every theme switch. */
  const install = (map: MapLibreMap) => {
    map.addSource('lanes', { type: 'geojson', data: laneFeatures() })
    map.addSource('points', { type: 'geojson', data: pointFeatures() })
    const offset: ExpressionSpecification = ['get', 'offset']
    map.addLayer({
      id: 'lanes-glow',
      type: 'line',
      source: 'lanes',
      filter: isLane(null),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.35, 'line-offset': offset },
    })
    const modes = [
      { mode: 'pipe', dash: undefined },
      { mode: 'tanker', dash: [0.6, 1.8] },
      { mode: 'rail', dash: [2.5, 1.5] },
      { mode: 'transfer', dash: [0.4, 1.2] },
    ] as const
    for (const { mode, dash } of modes) {
      map.addLayer({
        id: `lanes-${mode}`,
        type: 'line',
        source: 'lanes',
        filter: ['==', ['get', 'mode'], mode],
        layout: { 'line-cap': dash ? 'butt' : 'round', 'line-join': 'round' },
        paint: { 'line-offset': offset, ...(dash ? { 'line-dasharray': [...dash] } : {}) },
      })
    }
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
      paint: { 'circle-radius': ['match', ['get', 'kind'], 'origin', 4.5, 4], 'circle-stroke-width': 1.5 },
    })
    map.addLayer({
      id: 'points-label',
      type: 'symbol',
      source: 'points',
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['match', ['get', 'kind'], 'origin', ['literal', FONT_BOLD], ['literal', FONT]],
        'text-size': ['match', ['get', 'kind'], 'origin', 13, 12],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.8,
        'text-justify': 'auto',
      },
      paint: { 'text-halo-width': 1.5 },
    })
    readyRef.current = true
    restyle()
  }

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const map = new MapLibreMap({
      container: el,
      style: STYLE[latest.current.theme],
      bounds: showAsia ? WITH_ASIA : NORTH_AMERICA,
      fitBoundsOptions: { padding },
      minZoom: 0,
      maxZoom: 9,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map

    map.on('style.load', () => install(map))
    map.on('mousemove', 'lanes-hit', (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.lane as LaneId | undefined
      const ev = e.originalEvent as MouseEvent
      if (id) handlers.current.onHover(id, { x: ev.clientX, y: ev.clientY })
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'lanes-hit', () => {
      handlers.current.onHover(null)
      map.getCanvas().style.cursor = ''
    })
    map.on('click', (e: MapMouseEvent) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ['lanes-hit'] })[0]
      const id = hit?.properties?.lane as LaneId | undefined
      const ev = e.originalEvent as MouseEvent
      handlers.current.onSelect(id ?? null, { x: ev.clientX, y: ev.clientY })
    })
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme switch: swap the basemap; `style.load` re-installs our layers.
  const firstTheme = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (firstTheme.current) {
      firstTheme.current = false
      return
    }
    readyRef.current = false
    map.setStyle(STYLE[theme])
  }, [theme])

  // Reframe when Asia comes in/out of view or the uncovered area changes.
  const frameKey = `${showAsia}|${padding.top},${padding.right},${padding.bottom},${padding.left}`
  const firstFrame = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (firstFrame.current) {
      firstFrame.current = false
      return
    }
    map.fitBounds(showAsia ? WITH_ASIA : NORTH_AMERICA, { padding, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(restyle, [best, active, offline.join(','), theme])

  // MapLibre's CSS forces position:relative on the container, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
