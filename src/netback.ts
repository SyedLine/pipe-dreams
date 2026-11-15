import type { Benchmark, Data, Sourced } from './data'
import { LANES, type Destination, type Lane, type LaneId } from './lanes'

/**
 * Netback to Hardisty, US$/bbl:
 *   netback = destination price − pipeline toll − freight
 *   destination price = benchmark + quality adjustment (heavy-sour discount)
 * Brent and ANS move with the WTI slider via their same-month spread to WTI.
 */

export interface Inputs {
  wti: number
  wcsDiff: number
  /** Tanker rate, US$/bbl per 1,000 nm */
  tankerRate: number
  railCost: number
  /** Per-destination freight overrides (tanker destinations), US$/bbl */
  freight: Record<string, number>
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
  freight: number
  freightKind: 'none' | 'tanker' | 'rail'
  netback: number
  /** netback − Hardisty WCS (WTI − diff); positive = beats selling at Hardisty */
  uplift: number
}

export interface LaneResult {
  lane: Lane
  /** Toll of the best destination (tolls can differ by destination, e.g. Keystone) */
  toll: number
  tollSource: Sourced
  tollNote: string
  tollVaries: boolean
  dests: DestResult[]
  best: DestResult
}

export function defaultInputs(d: Data): Inputs {
  return {
    wti: d.prices.wti.value,
    wcsDiff: d.wcsDiff.value,
    tankerRate: d.assumptions.tanker.usdPer1000nm,
    railCost: d.assumptions.railAllInUsd.value,
    freight: {},
  }
}

export function defaultTankerFreight(d: Data, nm: number, rate: number): number {
  return d.assumptions.tanker.fixedUsd + (rate * nm) / 1000
}

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
    case 'mainline-chicago': {
      const toll = t.mainlineChicago.usdPerBbl! + t.mainlineChicago.cadPerBbl! / fx
      return {
        toll,
        source: t.mainlineChicago,
        note: `US$${t.mainlineChicago.usdPerBbl!.toFixed(2)} + C$${t.mainlineChicago.cadPerBbl!.toFixed(2)} at ${fx.toFixed(4)} C$/US$`,
      }
    }
    case 'mainline-usgc':
      return { toll: t.mainlineUsgc.usdPerBbl!, source: t.mainlineUsgc, note: 'Uncommitted joint rate, heavy' }
    case 'tmx-uswc':
    case 'tmx-asia': {
      const feeder = d.assumptions.hardistyToEdmontonUsd.value
      const toll = t.tmxWestridge.cadPerBbl! / fx + feeder
      return {
        toll,
        source: t.tmxWestridge,
        note: `C$${t.tmxWestridge.cadPerBbl!.toFixed(2)} Edmonton→Westridge + US$${feeder.toFixed(2)} Hardisty→Edmonton (assumed)`,
      }
    }
    case 'rail-usgc':
      return {
        toll: inp.railCost,
        source: { asOf: '', label: d.assumptions.railAllInUsd.label, source: 'Author assumption (editable)', sourceUrl: '' },
        note: 'All-in rail cost (loading, rail, unloading)',
      }
  }
}

export function computeLane(d: Data, lane: Lane, inp: Inputs): LaneResult {
  const hardistyWcs = inp.wti - inp.wcsDiff
  const bench: Record<Benchmark, number> = {
    wti: inp.wti,
    brent: inp.wti + (d.prices.brent.spreadToWti ?? d.prices.brent.value - d.prices.wti.value),
    ans: inp.wti + (d.prices.ans.spreadToWti ?? d.prices.ans.value - d.prices.wti.value),
  }
  const isRail = lane.id === 'rail-usgc'
  const dests = lane.destinations.map((dest): DestResult => {
    const { toll, source, note } = destToll(d, lane, dest, inp)
    const q = d.assumptions.qualityAdjUsd[dest.id] as { value: number; benchmark: Benchmark }
    const delivered = bench[q.benchmark] + q.value
    const freightKind = dest.seaNm != null ? 'tanker' : isRail ? 'rail' : 'none'
    const freight =
      freightKind === 'tanker'
        ? (inp.freight[dest.id] ?? defaultTankerFreight(d, dest.seaNm!, inp.tankerRate))
        : 0 // rail cost is carried as the lane "toll"; pipelines deliver for the toll
    const netback = delivered - toll - freight
    return {
      dest,
      benchmark: q.benchmark,
      benchmarkPrice: bench[q.benchmark],
      qualityAdj: q.value,
      delivered,
      toll,
      tollSource: source,
      tollNote: note,
      freight,
      freightKind,
      netback,
      uplift: netback - hardistyWcs,
    }
  })
  const best = dests.reduce((a, b) => (b.netback > a.netback ? b : a))
  return {
    lane,
    toll: best.toll,
    tollSource: best.tollSource,
    tollNote: best.tollNote,
    tollVaries: new Set(dests.map((x) => x.toll)).size > 1,
    dests,
    best,
  }
}

export function computeAll(d: Data, inp: Inputs): Record<LaneId, LaneResult> {
  return Object.fromEntries(LANES.map((l) => [l.id, computeLane(d, l, inp)])) as Record<LaneId, LaneResult>
}

export function bestLane(results: Record<LaneId, LaneResult>): LaneId {
  return (Object.values(results) as LaneResult[]).reduce((a, b) => (b.best.netback > a.best.netback ? b : a)).lane.id
}

/**
 * Egress breakevens for the WTI–WCS differential.
 * - pipeParity: diff at which Hardisty WCS equals the best *pipeline* netback
 *   (pipes have room → the market only needs to pay the pipe).
 * - railParity: diff at which Hardisty WCS equals the rail netback
 *   (pipes full → the marginal barrel moves by rail, so the diff widens toward this).
 */
export function breakevens(results: Record<LaneId, LaneResult>, inp: Inputs) {
  const pipeBest = Math.max(
    ...(Object.values(results) as LaneResult[]).filter((r) => r.lane.id !== 'rail-usgc').map((r) => r.best.netback),
  )
  const rail = results['rail-usgc'].best.netback
  return { pipeParity: inp.wti - pipeBest, railParity: inp.wti - rail }
}
