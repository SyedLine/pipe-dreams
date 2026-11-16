/** Shape of public/data.json (written by scripts/refresh-data.mjs + hand-edited tolls/assumptions). */

export interface Sourced {
  asOf: string
  label: string
  source: string
  sourceUrl: string
  fetchedAt?: string
  stale?: boolean
  error?: string
  updatedLocally?: boolean
}

export interface PriceSeries extends Sourced {
  value: number
  unit: string
  history: { month: string; value: number }[]
  spreadToWti?: number
  spreadMonth?: string
}

export interface Toll extends Sourced {
  usdPerBbl?: number
  usdPerM3?: number
  cadPerBbl?: number
  cadPerM3?: number
  manual: true
}

export interface Throughput extends Sourced {
  history: { month: string; throughputKbd: number; capacityKbd: number }[]
}

export type Benchmark = 'wti' | 'brent' | 'ans'

export type Stage = 'proposed' | 'commercial' | 'regulatory' | 'sanctioned' | 'construction' | 'in-service' | 'postponed'

/** A proposed egress project (hand-curated in data.json → projects). */
export interface Project {
  id: string
  name: string
  operator: string
  kind: 'expansion' | 'new'
  /** Existing lane an expansion sits on */
  onLane?: string
  capacityKbd: number
  stage: Stage
  target: string
  targetYear: number | null
  summary: string
  milestones: { date: string; text: string }[]
  source: string
  asOf: string
  keywords: string[]
  match: string
  /** Schematic route for new builds (drawn as a ghost line) */
  route?: [number, number][]
  routeNote?: string
}

export interface NewsItem {
  projectId: string
  title: string
  outlet: string
  date: string
}

export interface Data {
  generatedAt: string
  prices: {
    wti: PriceSeries
    brent: PriceSeries
    ans: PriceSeries
    imports?: Sourced & { padds: Record<string, { canadaKbd: number; totalKbd: number }> }
  }
  wcsDiff: Sourced & { value: number; wcsHardisty: number; unit: string }
  fx: Sourced & { value: number; unit: string }
  quality: Sourced & {
    apiGravity: number
    apiGravity5y: number
    sulphurPct: number
    sulphurPct5y: number
    densityKgM3: number | null
    densityKgM35y: number | null
  }
  throughput: { mainline: Throughput; tmx: Throughput }
  projects: { asOf: string; note: string; items: Project[] }
  markets: {
    refining: Sourced & {
      manual: true
      note: string
      padds: {
        padd: string
        name: string
        lanes: string[]
        refineries: number
        crudeKbd: number
        cokingKbd: number
        cokerSites: number
        top: { site: string; operator: string; crudeKbd: number; cokeKbd: number; coord: [number, number] }[]
      }[]
    }
  }
  news?: Sourced & { items: NewsItem[] }
  /** Recent daily Brent − WTI (preferred over the monthly spread) */
  spreads?: { brentWti?: Sourced & { value: number; from: string; to: string; days: number } }
  tolls: {
    mainlineChicago: Toll
    mainlineUsgc: Toll
    tmxWestridge: Toll
    keystoneCushing: Toll
    keystoneUsgc: Toll
    expressWoodRiver: Toll
  }
  assumptions: {
    note: string
    hardistyToEdmontonUsd: { value: number; label: string }
    qualityAdjUsd: { label: string } & Record<string, { value: number; benchmark: Benchmark } | string>
    tanker: { fixedUsd: number; usdPer1000nm: number; label: string }
    railAllInUsd: { value: number; min: number; max: number; label: string }
  }
}

export async function loadData(): Promise<Data> {
  const res = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`)
  return res.json()
}

const TOLL_STALE_DAYS = 183 // "more than 6 months old"

/** Tolls are hand-entered: stale once their effective date is over 6 months old. */
export function tollIsStale(t: Toll, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(`${t.asOf}T00:00:00Z`).getTime()) / 86_400_000
  return ageDays > TOLL_STALE_DAYS
}

export function isStale(s: Sourced): boolean {
  return 'manual' in s ? tollIsStale(s as Toll) : Boolean(s.stale)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10" → "Oct 2026", "2026-10-01" → "1 Oct 2026" */
export function formatAsOf(asOf: string): string {
  const [y, m, d] = asOf.split('-').map(Number)
  if (!y || !m) return asOf
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`
}

export const usd = (n: number, dp = 2) =>
  `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

export const signedUsd = (n: number, dp = 2) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(dp)}`
