import { greatCircle, pathNm, unwrapTo, type LngLat } from './geo'

/**
 * Static geography for the five egress lanes. Routes are hand-drawn sketches
 * through real waypoints (pump stations, terminals, straits) — good enough to
 * read on a continental map, not survey-grade alignments.
 */

export type LaneId = 'mainline-chicago' | 'mainline-usgc' | 'tmx-uswc' | 'tmx-asia' | 'rail-usgc'
export type Mode = 'pipe' | 'tanker' | 'rail'

export interface Destination {
  id: string
  name: string
  /** Port / refinery hub shown on the map */
  place: string
  coord: LngLat
  /** Tanker distance from Westridge in nautical miles (marine lanes only) */
  seaNm?: number
}

export interface Lane {
  id: LaneId
  name: string
  short: string
  route: string
  color: string
  /** Pixel offset so lanes that share a pipe corridor sit side by side */
  offset: number
  segments: { mode: Mode; coords: LngLat[] }[]
  destinations: Destination[]
}

export const HARDISTY: LngLat = [-111.3, 52.67]
export const WESTRIDGE: LngLat = [-122.95, 49.29]

// ── Shared corridors ────────────────────────────────────────────────────────
const MAINLINE_TO_SUPERIOR: LngLat[] = [
  HARDISTY,
  [-109.0, 52.15], // Kerrobert
  [-104.6, 50.45], // Regina
  [-101.0, 49.85], // Cromer
  [-97.56, 49.0], // Gretna (border)
  [-95.4, 47.7], // Clearbrook
  [-92.1, 46.7], // Superior
]
const SUPERIOR_TO_FLANAGAN: LngLat[] = [
  [-92.1, 46.7],
  [-89.6, 44.6],
  [-88.9, 42.5],
  [-88.6, 40.9], // Flanagan / Pontiac, IL
]

const TMX: LngLat[] = [
  HARDISTY,
  [-113.5, 53.55], // Edmonton terminal
  [-117.58, 53.4], // Hinton
  [-118.08, 52.88], // Jasper
  [-119.27, 52.83], // Valemount
  [-119.29, 52.1], // Blue River
  [-120.33, 50.68], // Kamloops
  [-120.79, 50.11], // Merritt
  [-121.44, 49.38], // Hope
  [-122.3, 49.08], // Sumas
  WESTRIDGE,
]

// Westridge → Burrard Inlet → Haro Strait → mouth of Juan de Fuca
const TO_JUAN_DE_FUCA: LngLat[] = [
  WESTRIDGE,
  [-123.27, 49.3],
  [-123.2, 48.9],
  [-123.2, 48.45],
  [-123.9, 48.3],
  [-124.75, 48.48],
]
const JDF_MOUTH = TO_JUAN_DE_FUCA[TO_JUAN_DE_FUCA.length - 1]

// ── US West Coast tanker legs ───────────────────────────────────────────────
const USWC_LEGS: { dest: Destination; path: LngLat[] }[] = [
  {
    dest: { id: 'puget', name: 'Puget Sound', place: 'Anacortes, WA', coord: [-122.6, 48.5] },
    path: [WESTRIDGE, [-123.27, 49.3], [-123.15, 48.9], [-122.85, 48.6], [-122.6, 48.5]],
  },
  {
    dest: { id: 'sf', name: 'San Francisco Bay', place: 'Martinez, CA', coord: [-122.13, 38.03] },
    path: [
      ...TO_JUAN_DE_FUCA,
      [-125.4, 46.5],
      [-124.9, 42.0],
      [-123.6, 38.6],
      [-122.6, 37.8], // Golden Gate
      [-122.13, 38.03],
    ],
  },
  {
    dest: { id: 'la', name: 'Los Angeles', place: 'Long Beach, CA', coord: [-118.2, 33.75] },
    path: [
      ...TO_JUAN_DE_FUCA,
      [-125.4, 46.5],
      [-124.9, 42.0],
      [-123.8, 37.5],
      [-120.9, 34.3], // Point Conception
      [-118.2, 33.75],
    ],
  },
]

// ── Asia tanker legs (great circle across the North Pacific, then coastal approach) ──
function pacificLeg(approach: LngLat[], port: LngLat): LngLat[] {
  const ref = JDF_MOUTH[0]
  const first: LngLat = [unwrapTo(approach[0][0], ref - 180), approach[0][1]]
  const ocean = greatCircle(JDF_MOUTH, first, 96)
  const coastal = [...approach.slice(1), port].map(
    ([lon, lat]): LngLat => [unwrapTo(lon, first[0]), lat],
  )
  return [...TO_JUAN_DE_FUCA, ...ocean.slice(1), ...coastal]
}

const ASIA_LEGS: { dest: Omit<Destination, 'seaNm'>; path: LngLat[] }[] = [
  {
    dest: { id: 'japan', name: 'Japan', place: 'Chiba (Tokyo Bay)', coord: [140.05, 35.55] },
    path: pacificLeg([[140.2, 34.75], [139.75, 35.2]], [140.05, 35.55]),
  },
  {
    dest: { id: 'korea', name: 'South Korea', place: 'Ulsan', coord: [129.38, 35.5] },
    path: pacificLeg(
      [[142.0, 41.6], [140.4, 41.45], [138.5, 40.0], [131.0, 37.0]], // via Tsugaru Strait
      [129.38, 35.5],
    ),
  },
  {
    dest: { id: 'china', name: 'China', place: 'Ningbo-Zhoushan', coord: [122.1, 29.9] },
    path: pacificLeg([[140.8, 34.4], [135.0, 33.0], [131.2, 30.6], [125.0, 30.0]], [122.1, 29.9]),
  },
  {
    dest: { id: 'taiwan', name: 'Taiwan', place: 'Kaohsiung', coord: [120.28, 22.6] },
    path: pacificLeg(
      [[140.8, 34.4], [135.0, 33.0], [129.0, 28.5], [123.5, 24.0], [121.2, 21.7]],
      [120.28, 22.6],
    ),
  },
]

export const LANES: Lane[] = [
  {
    id: 'mainline-chicago',
    name: 'Mainline → Chicago',
    short: 'Chicago',
    route: 'Enbridge Mainline via Superior to the Chicago refining hub',
    color: '#38bdf8',
    offset: -2.5,
    segments: [{ mode: 'pipe', coords: [...MAINLINE_TO_SUPERIOR, ...SUPERIOR_TO_FLANAGAN.slice(1, 3), [-87.8, 41.6]] }],
    destinations: [{ id: 'chicago', name: 'Chicago', place: 'Joliet / Whiting', coord: [-87.8, 41.6] }],
  },
  {
    id: 'mainline-usgc',
    name: 'Mainline → US Gulf Coast',
    short: 'Gulf Coast (pipe)',
    route: 'Enbridge Mainline → Flanagan South → Seaway to Houston',
    color: '#a78bfa',
    offset: 2.5,
    segments: [
      {
        mode: 'pipe',
        coords: [
          ...MAINLINE_TO_SUPERIOR,
          ...SUPERIOR_TO_FLANAGAN.slice(1),
          [-91.5, 39.6],
          [-94.0, 38.6],
          [-95.8, 37.3],
          [-96.77, 35.98], // Cushing
          [-96.2, 32.6],
          [-95.2, 29.65], // Houston / Freeport
        ],
      },
    ],
    destinations: [{ id: 'houston', name: 'Houston', place: 'Houston, TX', coord: [-95.2, 29.65] }],
  },
  {
    id: 'tmx-uswc',
    name: 'TMX → US West Coast',
    short: 'US West Coast',
    route: 'Trans Mountain to Westridge, then Aframax tanker down the coast',
    color: '#34d399',
    offset: -2.5,
    segments: [
      { mode: 'pipe', coords: TMX },
      ...USWC_LEGS.map((l) => ({ mode: 'tanker' as const, coords: l.path })),
    ],
    destinations: USWC_LEGS.map((l) => ({ ...l.dest, seaNm: Math.round(pathNm(l.path)) })),
  },
  {
    id: 'tmx-asia',
    name: 'TMX → Asia',
    short: 'Asia',
    route: 'Trans Mountain to Westridge, then tanker across the North Pacific',
    color: '#fbbf24',
    offset: 2.5,
    segments: [
      { mode: 'pipe', coords: TMX },
      ...ASIA_LEGS.map((l) => ({ mode: 'tanker' as const, coords: l.path })),
    ],
    destinations: ASIA_LEGS.map((l) => ({
      ...l.dest,
      coord: [unwrapTo(l.dest.coord[0], -300), l.dest.coord[1]] as LngLat,
      seaNm: Math.round(pathNm(l.path)),
    })),
  },
  {
    id: 'rail-usgc',
    name: 'Rail → US Gulf Coast',
    short: 'Gulf Coast (rail)',
    route: 'Unit train from Hardisty-area terminals to Port Arthur',
    color: '#fb7185',
    offset: 0,
    segments: [
      {
        mode: 'rail',
        coords: [
          HARDISTY,
          [-111.8, 51.2],
          [-111.9, 49.7], // Lethbridge area
          [-111.96, 49.0], // Coutts / Sweetgrass
          [-111.3, 47.5], // Great Falls
          [-108.5, 45.78], // Billings
          [-106.3, 42.85], // Casper
          [-104.99, 39.74], // Denver
          [-101.83, 35.22], // Amarillo
          [-97.33, 32.75], // Fort Worth
          [-93.94, 29.87], // Port Arthur
        ],
      },
    ],
    destinations: [{ id: 'port-arthur', name: 'Port Arthur', place: 'Port Arthur, TX', coord: [-93.94, 29.87] }],
  },
]

export const laneById = Object.fromEntries(LANES.map((l) => [l.id, l])) as Record<LaneId, Lane>
