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
import { smooth } from '../geo'
import { EDMONTON, HARDISTY, LANES, type LaneId } from '../lanes'
import { ticker } from '../operators'

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
  /** Proposed new-build pipelines, drawn as dashed ghost lines when `showProposed` */
  proposed: { id: string; name: string; route: [number, number][] }[]
  showProposed: boolean
  /** Shade US PADD regions */
  showPadds: boolean
  /** Largest refineries per PADD */
  refineries: { name: string; operator: string; crudeKbd: number; cokeKbd: number; coord: [number, number] }[]
  showRefineries: boolean
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
        geometry: { type: 'LineString' as const, coordinates: smooth(s.coords) },
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

export default function MapView({ theme, best, active, showAsia, offline, proposed, showProposed, showPadds, refineries, showRefineries, padding, onHover, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const handlers = useRef({ onHover, onSelect })
  handlers.current = { onHover, onSelect }
  const latest = useRef({ theme, best, active, offline, proposed, showProposed, showPadds, refineries, showRefineries })
  latest.current = { theme, best, active, offline, proposed, showProposed, showPadds, refineries, showRefineries }

  /** Push current best/active/offline/theme into layer paint + filters. */
  const restyle = () => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const { theme, best, active, offline, showProposed, showPadds, showRefineries } = latest.current
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
    map.setFilter('points-circle', ['any', show, ['==', ['get', 'kind'], 'dest']])
    map.setPaintProperty('points-circle', 'circle-opacity', active ? ['case', ['any', ['==', ['get', 'kind'], 'origin'], isLane(active)], 1, 0.35] : ['case', off, 0.2, 1])
    map.setPaintProperty('points-circle', 'circle-stroke-opacity', active ? ['case', ['any', ['==', ['get', 'kind'], 'origin'], isLane(active)], 1, 0.35] : ['case', off, 0.2, 1])
    map.setPaintProperty('origin-ring', 'circle-stroke-color', p.origin)
    map.setPaintProperty('points-circle', 'circle-color', ['case', ['==', ['get', 'kind'], 'origin'], p.origin, color])
    map.setPaintProperty('points-circle', 'circle-stroke-color', p.halo)
    map.setPaintProperty('points-label', 'text-color', p.label)
    map.setPaintProperty('points-label', 'text-halo-color', p.halo)
    const vis = showProposed ? 'visible' : 'none'
    for (const id of ['proposed-line', 'proposed-label']) map.setLayoutProperty(id, 'visibility', vis)
    for (const id of ['padd-fill', 'padd-label']) map.setLayoutProperty(id, 'visibility', showPadds ? 'visible' : 'none')
    for (const id of ['refinery-circle', 'refinery-label']) map.setLayoutProperty(id, 'visibility', showRefineries ? 'visible' : 'none')
    map.setPaintProperty('padd-fill', 'fill-color', p.origin)
    map.setPaintProperty('padd-label', 'text-color', p.label)
    map.setPaintProperty('padd-label', 'text-halo-color', p.halo)
    map.setPaintProperty('refinery-circle', 'circle-color', p.origin)
    map.setPaintProperty('refinery-circle', 'circle-stroke-color', ['case', ['>', ['get', 'coke'], 0], theme === 'dark' ? '#ffa028' : '#b45f00', p.halo])
    map.setPaintProperty('refinery-label', 'text-color', p.label)
    map.setPaintProperty('refinery-label', 'text-halo-color', p.halo)
    map.setPaintProperty('proposed-line', 'line-color', p.origin)
    map.setPaintProperty('proposed-label', 'text-color', p.label)
    map.setPaintProperty('proposed-label', 'text-halo-color', p.halo)
  }

  /** (Re)install sources and layers — runs on first load and after every theme switch. */
  const install = (map: MapLibreMap) => {
    map.addSource('lanes', { type: 'geojson', data: laneFeatures() })
    map.addSource('points', { type: 'geojson', data: pointFeatures() })
    // US PADD regions (beneath everything we draw)
    map.addSource('padds', { type: 'geojson', data: `${import.meta.env.BASE_URL}padds.geojson` })
    map.addLayer({
      id: 'padd-fill',
      type: 'fill',
      source: 'padds',
      layout: { visibility: 'none' },
      paint: {
        'fill-opacity': ['match', ['get', 'padd'], 2, 0.1, 3, 0.16, 4, 0.06, 5, 0.12, 0.03],
        'fill-outline-color': 'rgba(0,0,0,0)',
      },
    })
    map.addSource('padd-labels', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: (
          [
            ['PADD 1\nEast Coast', [-76.6, 41.2]],
            ['PADD 2\nMidwest', [-98.5, 45.6]],
            ['PADD 3\nGulf Coast', [-98.5, 31.8]],
            ['PADD 4\nRockies', [-109.5, 43.6]],
            ['PADD 5\nWest Coast', [-117.3, 40.2]],
          ] as const
        ).map(([label, c]) => ({
          type: 'Feature' as const,
          properties: { label },
          geometry: { type: 'Point' as const, coordinates: [...c] },
        })),
      },
    })
    map.addLayer({
      id: 'padd-label',
      type: 'symbol',
      source: 'padd-labels',
      layout: { visibility: 'none', 'text-field': ['get', 'label'], 'text-font': ['literal', FONT_BOLD], 'text-size': 12, 'text-allow-overlap': true, 'text-line-height': 1.15, 'text-letter-spacing': 0.04 },
      paint: { 'text-halo-width': 1.5, 'text-opacity': 0.8 },
    })

    map.addSource('proposed', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: latest.current.proposed.map((pr) => ({
          type: 'Feature' as const,
          properties: { id: pr.id, label: `${pr.name} (proposed)` },
          geometry: { type: 'LineString' as const, coordinates: smooth(pr.route) },
        })),
      },
    })
    // Ghost lines for proposed new builds: under the live lanes, dashed and translucent
    map.addLayer({
      id: 'proposed-line',
      type: 'line',
      source: 'proposed',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-width': 2.4, 'line-opacity': 0.55, 'line-dasharray': [2, 2], 'line-offset': 7 },
    })
    // Label each proposed route at its far end (line-placed text drops out at low zoom)
    map.addSource('proposed-ends', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: latest.current.proposed.map((pr) => ({
          type: 'Feature' as const,
          properties: { label: `${pr.name}\n(proposed)` },
          geometry: { type: 'Point' as const, coordinates: pr.route[pr.route.length - 1] },
        })),
      },
    })
    map.addLayer({
      id: 'proposed-label',
      type: 'symbol',
      source: 'proposed-ends',
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['literal', FONT],
        'text-size': 11,
        'text-variable-anchor': ['right', 'left', 'top', 'bottom'],
        'text-radial-offset': 0.8,
        'text-justify': 'auto',
        'text-line-height': 1.2,
      },
      paint: { 'text-halo-width': 1.5, 'text-opacity': 0.85 },
    })
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
      paint: { 'circle-radius': ['match', ['get', 'kind'], 'origin', 4.5, 3.2], 'circle-stroke-width': 1.5 },
    })
    // Ring around Hardisty: the origin of every lane
    map.addLayer({
      id: 'origin-ring',
      type: 'circle',
      source: 'points',
      filter: ['==', ['get', 'lane'], '*'],
      paint: { 'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.55 },
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
    // Largest refineries per PADD: size by crude capacity, amber ring = has a coker (runs heavy crude)
    map.addSource('refineries', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: latest.current.refineries.map((r) => ({
          type: 'Feature' as const,
          properties: { label: `${r.name.replace(/ \(.*\)/, '').replace(/,.*$/, '')} ${r.crudeKbd}k\n${ticker(r.operator)}`, crude: r.crudeKbd, coke: r.cokeKbd },
          geometry: { type: 'Point' as const, coordinates: r.coord },
        })),
      },
    })
    map.addLayer({
      id: 'refinery-circle',
      type: 'circle',
      source: 'refineries',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'crude'], 60, 3, 650, 8.5],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
      },
    })
    map.addLayer({
      id: 'refinery-label',
      type: 'symbol',
      source: 'refineries',
      layout: {
        visibility: 'none',
        'text-field': ['get', 'label'],
        'text-font': ['literal', FONT],
        'text-size': 10.5,
        'text-line-height': 1.15,
        'text-max-width': 16,
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 1,
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
  useEffect(restyle, [best, active, offline.join(','), theme, showProposed, showPadds, showRefineries])

  // MapLibre's CSS forces position:relative on the container, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
