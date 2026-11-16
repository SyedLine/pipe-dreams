import type { Data } from './data'
import type { LaneId } from './lanes'
import { breakevens, computeAll, defaultInputs, type Inputs } from './netback'

export type PresetId = 'today' | 'pipes-full-2023' | 'tmx-outage' | 'wide-diff'

export interface Preset {
  id: PresetId
  label: string
  blurb: string
  apply: (d: Data) => Inputs
}

const TMX: LaneId[] = ['tmx-uswc', 'tmx-asia']

/**
 * Scenario presets. Each returns a full set of slider values; "Today" is the
 * latest data. Historical values are 2023 annual averages:
 * WTI US$77.58, Brent US$82.49 (EIA RWTC/RBRTE annual), WTI–WCS US$18.66
 * (Government of Alberta monthly average; widest month US$28.18).
 */
export const PRESETS: Preset[] = [
  {
    id: 'today',
    label: 'Today',
    blurb: 'Latest published prices, tolls and differential.',
    apply: (d) => defaultInputs(d),
  },
  {
    id: 'pipes-full-2023',
    label: 'Pipes full (2023)',
    blurb: '2023 averages, before the TMX expansion entered service in May 2024: WTI $77.58, Brent +$4.91, diff $18.66.',
    apply: (d) => ({ ...defaultInputs(d), wti: 77.58, brentSpread: 4.91, wcsDiff: 18.66, offline: TMX }),
  },
  {
    id: 'tmx-outage',
    label: 'TMX outage',
    blurb: 'TMX offline: its barrels look for room on the other pipes or on rail, so the diff widens to the rail breakeven.',
    apply: (d) => {
      const base = { ...defaultInputs(d), offline: TMX }
      const { railParity } = breakevens(computeAll(d, base), base)
      return { ...base, wcsDiff: Math.round(railParity * 4) / 4 }
    },
  },
  {
    id: 'wide-diff',
    label: 'Wide diff',
    blurb: 'Today’s prices with the differential at $28.18, the widest month of 2023.',
    apply: (d) => ({ ...defaultInputs(d), wcsDiff: 28.18 }),
  },
]

/** The preset whose values match the current inputs, if any. */
export function matchPreset(d: Data, inp: Inputs): PresetId | null {
  for (const p of PRESETS) {
    const v = p.apply(d)
    const same =
      (['wti', 'wcsDiff', 'brentSpread', 'tankerRate', 'railCost', 'transferCost'] as const).every(
        (k) => Math.abs(v[k] - inp[k]) < 0.005,
      ) &&
      Object.keys(inp.freight).length === 0 &&
      Object.keys(inp.qualityAdj).length === 0 &&
      v.offline.length === inp.offline.length &&
      v.offline.every((l) => inp.offline.includes(l))
    if (same) return p.id
  }
  return null
}
