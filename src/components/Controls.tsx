import type { Data } from '../data'
import { usd } from '../data'
import type { Inputs } from '../netback'
import { Slider } from './ui'

interface Props {
  data: Data
  inputs: Inputs
  defaults: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
  pipeParity: number
  railParity: number
}

const RAIL = '#fb7185'
const PIPE = '#38bdf8'

export default function Controls({ data, inputs, defaults, setInputs, pipeParity, railParity }: Props) {
  const set = (k: keyof Omit<Inputs, 'freight'>) => (v: number) => setInputs((i) => ({ ...i, [k]: v }))
  const hardisty = inputs.wti - inputs.wcsDiff
  // Where the current diff sits between "pipes have room" and "rail sets the price"
  const span = railParity - pipeParity
  const tight = span > 0 ? Math.min(1, Math.max(0, (inputs.wcsDiff - pipeParity) / span)) : 0

  return (
    <div className="space-y-4">
      <Slider
        label="WTI (Cushing)"
        value={inputs.wti}
        min={40}
        max={150}
        step={0.25}
        format={(n) => usd(n)}
        onChange={set('wti')}
        defaultValue={defaults.wti}
        source={data.prices.wti}
      />
      <div>
        <Slider
          label="WTI–WCS differential at Hardisty"
          value={inputs.wcsDiff}
          min={0}
          max={40}
          step={0.25}
          format={(n) => usd(n)}
          onChange={set('wcsDiff')}
          defaultValue={defaults.wcsDiff}
          source={data.wcsDiff}
          markers={[
            { value: pipeParity, label: 'Pipe parity', color: PIPE },
            { value: railParity, label: 'Rail breakeven', color: RAIL },
          ]}
        />
        {/* Breakeven explainer */}
        <div className="mt-2 rounded-xl border border-white/5 bg-black/20 p-2.5 text-[11px] leading-snug text-zinc-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-0.5 rounded-full" style={{ backgroundColor: PIPE }} />
              Pipe parity <span className="font-mono text-zinc-200">{usd(pipeParity)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-0.5 rounded-full" style={{ backgroundColor: RAIL }} />
              Rail breakeven <span className="font-mono text-zinc-200">{usd(railParity)}</span>
            </span>
          </div>
          <p className="mt-1.5">
            When pipes are full, the last barrel out moves by rail, so the differential tends to widen toward the rail
            breakeven. Today&rsquo;s diff is{' '}
            <span className="font-medium text-zinc-200">{Math.round(tight * 100)}% of the way</span> from pipe parity to
            rail.
          </p>
        </div>
      </div>
      <Slider
        label={
          <>
            Tanker freight <span className="font-normal text-zinc-500">per 1,000 nm</span>
          </>
        }
        value={inputs.tankerRate}
        min={0.4}
        max={3}
        step={0.05}
        format={(n) => usd(n)}
        onChange={(v) => setInputs((i) => ({ ...i, tankerRate: v, freight: {} }))}
        defaultValue={defaults.tankerRate}
        source={{ asOf: '', label: data.assumptions.tanker.label, source: 'Author assumption (editable)', sourceUrl: '' }}
        accent="#34d399"
      />
      <Slider
        label="Rail all-in cost to US Gulf Coast"
        value={inputs.railCost}
        min={10}
        max={25}
        step={0.25}
        format={(n) => usd(n)}
        onChange={set('railCost')}
        defaultValue={defaults.railCost}
        source={{ asOf: '', label: data.assumptions.railAllInUsd.label, source: 'Author assumption (editable)', sourceUrl: '' }}
        accent={RAIL}
      />
      <p className="text-[11px] text-zinc-500">
        WCS at Hardisty = WTI − diff = <span className="font-mono text-zinc-300">{usd(hardisty)}</span>
      </p>
    </div>
  )
}
