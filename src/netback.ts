import type { Benchmark, Data, Sourced } from './data'
import { LANES, type Destination, type Lane, type LaneId } from './lanes'

/**
 * Netback to Hardisty, US$/bbl:
 *   netback = benchmark + quality adj − pipeline toll − transfer − freight
 * Brent and ANS are WTI + a spread, so the WTI slider moves every benchmark.
 * TMX starts at Edmonton, so TMX barrels also pay a Hardisty → Edmonton transfer.
 */

export interface Inputs {
  wti: number
  wcsDiff: number
  /** Brent − WTI, US$/bbl (defaults to the latest same-month spread) */
  brentSpread: number
  /** Tanker rate, US$/bbl per 1,000 nm */
  tankerRate: number
  railCost: number
  /** Hardisty → Edmonton transfer to reach TMX (assumption) */
  transferCost: number
  /** Per-destination freight overrides (tanker destinations), US$/bbl */
  freight: Record<string, number>
  /** Quality-adjustment overrides by destination id, US$/bbl (defaults in data.json) */
  qualityAdj: Record<string, number>
  /** Lanes unavailable in this scenario (e.g. TMX outage) */
  offline: LaneId[]
}

export const ASSUMPTION: Sourced = { asOf: '', label: 'Author assumption (editable)', source: 'Assumption', sourceUrl: '' }

export interface Step {
  label: string
  value: number
  /** Where the number comes from — shown on hover */
  source: Sourced
  note?: string
}

export interface DestResult {
  dest: Destination
  benchmark: Benchmark
  benchmarkPrice: number
  qualityAdj: number
  delivered: number
  toll: number
  tollSource: Sourced
  tollNote: string
  transfer: number
  freight: number
  freightKind: 'none' | 'tanker' | 'rail'
  netback: number
  /** netback − Hardisty WCS (WTI − diff); positive = beats selling at Hardisty */
  uplift: number
  /** Benchmark → netback, in order (for waterfalls and tooltips) */
  steps: Step[]
}

export interface LaneResult {
  lane: Lane
  offline: boolean
  /** Toll of the best destination (tolls can differ by destination, e.g. Keystone) */
  toll: number
  tollSource: Sourced
  tollNote: string
  tollVaries: boolean
  dests: DestResult[]
  best: DestResult
}

export type Results = Record<LaneId, LaneResult>

export function defaultInputs(d: Data): Inputs {
  return {
    wti: d.prices.wti.value,
    wcsDiff: d.wcsDiff.value,
    brentSpread: d.prices.brent.spreadToWti ?? d.prices.brent.value - d.prices.wti.value,
    tankerRate: d.assumptions.tanker.usdPer1000nm,
    railCost: d.assumptions.railAllInUsd.value,
    transferCost: d.assumptions.hardistyToEdmontonUsd.value,
    freight: {},
    qualityAdj: {},
    offline: [],
  }
}

export function defaultTankerFreight(d: Data, nm: number, rate: number): number {
  return d.assumptions.tanker.fixedUsd + (rate * nm) / 1000
}

const assumption = (label: string): Sourced => ({ ...ASSUMPTION, label })

function destToll(d: Data, lane: Lane, dest: Destination, inp: Inputs): { toll: number; source: Sourced; note: string } {
  const fx = d.fx.value
  const t = d.tolls
  switch (lane.id) {
    case 'keystone':
      return dest.id === 'cushing'
        ? { toll: t.keystoneCushing.usdPerBbl!, source: t.keystoneCushing, note: 'Uncommitted joint rate, heavy, Hardisty → Cushing' }
        : { toll: t.keystoneUsgc.usdPerBbl!, source: t.keystoneUsgc, note: 'Uncommitted joint rate, heavy, Hardisty → Houston' }
    case 'express':
      return {
        toll: t.expressWoodRiver.usdPerBbl!,
        source: t.expressWoodRiver,
        note: `Joint term rate (10–14 yr), heavy: US$${t.expressWoodRiver.usdPerM3!.toFixed(2)}/m³`,
      }
    case 'mainline-chicago':
      return {
        toll: t.mainlineChicago.usdPerBbl! + t.mainlineChicago.cadPerBbl! / fx,
        source: t.mainlineChicago,
        note: `US$${t.mainlineChicago.usdPerBbl!.toFixed(2)} + C$${t.mainlineChicago.cadPerBbl!.toFixed(2)} at ${fx.toFixed(4)} C$/US$`,
      }
    case 'mainline-usgc':
      return { toll: t.mainlineUsgc.usdPerBbl!, source: t.mainlineUsgc, note: 'Uncommitted joint rate, heavy' }
    case 'tmx-uswc':
    case 'tmx-asia':
      return {
        toll: t.tmxWestridge.cadPerBbl! / fx,
        source: t.tmxWestridge,
        note: `C$${t.tmxWestridge.cadPerBbl!.toFixed(2)} Edmonton → Westridge at ${fx.toFixed(4)} C$/US$`,
      }
    case 'rail-usgc':
      return {
        toll: inp.railCost,
        source: assumption(d.assumptions.railAllInUsd.label),
        note: 'All-in rail cost (loading, rail, unloading)',
      }
  }
}

const BENCH_NAME: Record<Benchmark, string> = { wti: 'WTI', brent: 'Brent', ans: 'ANS' }

export function computeLane(d: Data, lane: Lane, inp: Inputs): LaneResult {
  const hardistyWcs = inp.wti - inp.wcsDiff
  const bench: Record<Benchmark, number> = {
    wti: inp.wti,
    brent: inp.wti + inp.brentSpread,
    ans: inp.wti + (d.prices.ans.spreadToWti ?? d.prices.ans.value - d.prices.wti.value),
  }
  const isRail = lane.id === 'rail-usgc'
  const isTmx = lane.id === 'tmx-uswc' || lane.id === 'tmx-asia'
  const dests = lane.destinations.map((dest): DestResult => {
    const { toll, source, note } = destToll(d, lane, dest, inp)
    const q0 = d.assumptions.qualityAdjUsd[dest.id] as { value: number; benchmark: Benchmark }
    const q = { ...q0, value: inp.qualityAdj[dest.id] ?? q0.value }
    const delivered = bench[q.benchmark] + q.value
    const freightKind = dest.seaNm != null ? 'tanker' : isRail ? 'rail' : 'none'
    const freight =
      freightKind === 'tanker' ? (inp.freight[dest.id] ?? defaultTankerFreight(d, dest.seaNm!, inp.tankerRate)) : 0
    const transfer = isTmx ? inp.transferCost : 0
    const netback = delivered - toll - transfer - freight

    const benchSource: Sourced = q.benchmark === 'wti' ? d.prices.wti : d.prices[q.benchmark]
    const steps: Step[] = [
      {
        label: `${BENCH_NAME[q.benchmark]} benchmark`,
        value: bench[q.benchmark],
        source: benchSource,
        note: q.benchmark === 'wti' ? undefined : `WTI ${inp.brentSpread >= 0 && q.benchmark === 'brent' ? '+' : ''}${(bench[q.benchmark] - inp.wti).toFixed(2)}`,
      },
      { label: 'Quality adj.', value: q.value, source: assumption(d.assumptions.qualityAdjUsd.label as string) },
      { label: isRail ? 'Rail all-in' : 'Pipeline toll', value: -toll, source, note },
    ]
    if (isTmx) steps.push({ label: 'Edmonton transfer', value: -transfer, source: assumption(d.assumptions.hardistyToEdmontonUsd.label) })
    if (freightKind === 'tanker')
      steps.push({
        label: 'Tanker freight',
        value: -freight,
        source: assumption(d.assumptions.tanker.label),
        note: `≈${dest.seaNm!.toLocaleString()} nm from Westridge`,
      })

    return {
      dest,
      benchmark: q.benchmark,
      benchmarkPrice: bench[q.benchmark],
      qualityAdj: q.value,
      delivered,
      toll,
      tollSource: source,
      tollNote: note,
      transfer,
      freight,
      freightKind,
      netback,
      uplift: netback - hardistyWcs,
      steps,
    }
  })
  const best = dests.reduce((a, b) => (b.netback > a.netback ? b : a))
  return {
    lane,
    offline: inp.offline.includes(lane.id),
    toll: best.toll,
    tollSource: best.tollSource,
    tollNote: best.tollNote,
    tollVaries: new Set(dests.map((x) => x.toll)).size > 1,
    dests,
    best,
  }
}

export function computeAll(d: Data, inp: Inputs): Results {
  return Object.fromEntries(LANES.map((l) => [l.id, computeLane(d, l, inp)])) as Results
}

/** Online lanes, best netback first. */
export function ranked(results: Results): LaneResult[] {
  return (Object.values(results) as LaneResult[]).filter((r) => !r.offline).sort((a, b) => b.best.netback - a.best.netback)
}

export function bestLane(results: Results): LaneId {
  return ranked(results)[0].lane.id
}

/**
 * Egress breakevens for the WTI–WCS differential.
 * - pipeParity: diff at which Hardisty WCS equals the best online *pipeline* netback.
 * - railParity: diff at which Hardisty WCS equals the rail netback
 *   (pipes full → the marginal barrel moves by rail, so the diff widens toward this).
 */
export function breakevens(results: Results, inp: Inputs) {
  const pipes = ranked(results).filter((r) => r.lane.id !== 'rail-usgc')
  const pipeBest = pipes.length ? pipes[0].best.netback : results['rail-usgc'].best.netback
  const rail = results['rail-usgc'].best.netback
  return { pipeParity: inp.wti - pipeBest, railParity: inp.wti - rail }
}
