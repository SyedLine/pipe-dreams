import type { Data } from '../data'
import { signedUsd, usd } from '../data'
import { LANES } from '../lanes'
import { ASSUMPTION, type Inputs } from '../netback'
import { PRESETS, type PresetId } from '../presets'
import { header, Slider, SourceTag } from './ui'

interface Props {
  data: Data
  inputs: Inputs
  defaults: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
  preset: PresetId | null
  applyPreset: (id: PresetId) => void
  pipeParity: number
  railParity: number
}

const assume = (label: string) => ({ ...ASSUMPTION, label })

export default function DrawerContent({ data, inputs, defaults, setInputs, preset, applyPreset, pipeParity, railParity }: Props) {
  const set = (k: 'wti' | 'wcsDiff' | 'brentSpread' | 'railCost' | 'transferCost') => (v: number) => setInputs((i) => ({ ...i, [k]: v }))
  const active = PRESETS.find((p) => p.id === preset)
  const span = railParity - pipeParity
  const tight = span > 0 ? Math.min(1, Math.max(0, (inputs.wcsDiff - pipeParity) / span)) : 0

  return (
    <div className="space-y-6">
      {/* Scenario presets */}
      <section aria-labelledby="scenarios">
        <div className="flex items-center justify-between">
          <h2 id="scenarios" className={header}>
            Scenario
          </h2>
          <button
            type="button"
            onClick={() => applyPreset('today')}
            disabled={preset === 'today'}
            className="text-[12px] text-accent disabled:text-subtle"
          >
            Reset
          </button>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => applyPreset(p.id)}
              className={`rounded-md border px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${
                preset === p.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-fg hover:bg-sunken'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 min-h-8 text-[12px] leading-snug text-muted">{active ? active.blurb : 'Custom: you’ve moved a slider.'}</p>
      </section>

      {/* Prices */}
      <section className="space-y-5">
        <Slider label="WTI (Cushing)" value={inputs.wti} min={40} max={150} step={0.25} onChange={set('wti')} defaultValue={defaults.wti} source={data.prices.wti} />
        <div>
          <Slider
            label="WTI–WCS differential"
            value={inputs.wcsDiff}
            min={0}
            max={40}
            step={0.25}
            onChange={set('wcsDiff')}
            defaultValue={defaults.wcsDiff}
            source={data.wcsDiff}
            markers={[
              { value: pipeParity, label: 'Pipe parity' },
              { value: railParity, label: 'Rail breakeven', color: 'var(--accent)' },
            ]}
          />
          <p className="mt-1 text-[12px] leading-snug text-muted">
            Rail breakeven <span className="num font-medium text-fg">{usd(railParity)}</span>. When pipes are full the diff tends to
            widen toward it; today it&rsquo;s <span className="num font-medium text-fg">{Math.round(tight * 100)}%</span> of the way
            from pipe parity (<span className="num">{usd(pipeParity)}</span>).
          </p>
        </div>
        <Slider
          label="Brent − WTI spread"
          value={inputs.brentSpread}
          min={-5}
          max={30}
          step={0.25}
          format={(n) => signedUsd(n)}
          onChange={set('brentSpread')}
          defaultValue={defaults.brentSpread}
          source={data.spreads?.brentWti ?? data.prices.brent}
        />
      </section>

      {/* Costs */}
      <section className="space-y-5">
        <h2 className={header}>Costs</h2>
        <Slider
          label={
            <>
              Tanker freight <span className="text-subtle">/ 1,000 nm</span>
            </>
          }
          value={inputs.tankerRate}
          min={0.4}
          max={3}
          step={0.05}
          onChange={(v) => setInputs((i) => ({ ...i, tankerRate: v, freight: {} }))}
          defaultValue={defaults.tankerRate}
          source={assume(data.assumptions.tanker.label)}
        />
        <Slider
          label="Rail all-in to Gulf Coast"
          value={inputs.railCost}
          min={10}
          max={25}
          step={0.25}
          onChange={set('railCost')}
          defaultValue={defaults.railCost}
          source={assume(data.assumptions.railAllInUsd.label)}
        />
        <Slider
          label="Hardisty → Edmonton transfer"
          value={inputs.transferCost}
          min={0}
          max={3}
          step={0.05}
          onChange={set('transferCost')}
          defaultValue={defaults.transferCost}
          source={assume(data.assumptions.hardistyToEdmontonUsd.label)}
        />
      </section>

      {/* Lane availability */}
      <section>
        <h2 className={header}>Lanes</h2>
        <ul className="mt-2 divide-y divide-line">
          {LANES.map((l) => {
            const on = !inputs.offline.includes(l.id)
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className={`text-[13px] ${on ? 'text-fg' : 'text-subtle line-through'}`}>{l.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${l.name} available`}
                  onClick={() =>
                    setInputs((i) => ({ ...i, offline: on ? [...i.offline, l.id] : i.offline.filter((x) => x !== l.id) }))
                  }
                  className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line-strong'}`}
                >
                  <span
                    className={`absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-[12px] leading-snug text-muted">
        WCS quality: {data.quality.apiGravity}° API, {data.quality.densityKgM3} kg/m³, {data.quality.sulphurPct}% S{' '}
        <span className="text-subtle">
          (5-yr {data.quality.apiGravity5y}°, {data.quality.densityKgM35y} kg/m³, {data.quality.sulphurPct5y}%)
        </span>{' '}
        <SourceTag s={data.quality} />
      </p>
    </div>
  )
}
