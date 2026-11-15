import { useId, type ReactNode } from 'react'
import { formatAsOf, isStale, usd, type Sourced } from '../data'
import { useTween } from '../hooks'

/** Hover text for any number: what it is, where it comes from, how fresh. */
export function tipFor(s: Sourced, extra?: string): string {
  const head = s.source === 'Assumption' ? `Assumption: ${s.label}` : `${s.label}\nSource: ${s.source}`
  const when = s.asOf ? `As of ${formatAsOf(s.asOf)}${isStale(s) ? ' (stale)' : ''}` : ''
  return [head, extra, when, s.error && `Last refresh failed: ${s.error}`].filter(Boolean).join('\n')
}

/** A dollar figure that ticks to new values and explains itself on hover. */
export function Money({
  value,
  source,
  extra,
  dp = 2,
  signed = false,
  className = '',
  tipPos,
}: {
  value: number
  source?: Sourced
  extra?: string
  dp?: number
  signed?: boolean
  className?: string
  tipPos?: 'below' | 'left'
}) {
  const v = useTween(value)
  const text = signed ? `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(dp)}` : usd(v, dp)
  return (
    <span
      className={`num whitespace-nowrap ${className}`}
      data-tip={source ? tipFor(source, extra) : extra}
      data-tip-pos={tipPos}
      tabIndex={source || extra ? 0 : undefined}
    >
      {text}
    </span>
  )
}

/**
 * A gain/loss: green ▲ for gains, red ▼ for losses, grey for ~zero.
 * Arrow + sign mean it never relies on colour alone.
 */
export function Delta({
  value,
  extra,
  source,
  dp = 2,
  className = '',
  tipPos,
}: {
  value: number
  extra?: string
  source?: Sourced
  dp?: number
  className?: string
  tipPos?: 'below' | 'left'
}) {
  const v = useTween(value)
  const flat = Math.abs(v) < 0.005
  const up = v > 0
  return (
    <span
      className={`num inline-flex items-baseline gap-0.5 whitespace-nowrap ${flat ? 'text-subtle' : up ? 'text-up' : 'text-down'} ${className}`}
      data-tip={source ? tipFor(source, extra) : extra}
      data-tip-pos={tipPos}
      tabIndex={source || extra ? 0 : undefined}
    >
      {!flat && (
        <span aria-hidden className="text-[0.8em]">
          {up ? '▲' : '▼'}
        </span>
      )}
      {flat ? `$${(0).toFixed(dp)}` : `${up ? '+' : '−'}$${Math.abs(v).toFixed(dp)}`}
    </span>
  )
}

/** "as of Oct 2026" with link; amber dot + "stale" when out of date. */
export function SourceTag({ s, className = '' }: { s: Sourced; className?: string }) {
  const stale = isStale(s)
  const body = (
    <>
      {stale && <span aria-hidden>⚠</span>}
      <span>
        {s.asOf ? `as of ${formatAsOf(s.asOf)}` : 'assumption'}
        {stale && <span className="text-stale"> · stale</span>}
      </span>
    </>
  )
  const cls = `inline-flex items-center gap-1 text-[11px] leading-none text-subtle ${className}`
  return s.sourceUrl ? (
    <a href={s.sourceUrl} target="_blank" rel="noreferrer" data-tip={tipFor(s)} className={`${cls} hover:text-fg`}>
      {body}
    </a>
  ) : (
    <span data-tip={tipFor(s)} tabIndex={0} className={cls}>
      {body}
    </span>
  )
}

export interface Marker {
  value: number
  label: string
  /** CSS colour; defaults to the muted foreground */
  color?: string
}

interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  format?: (n: number) => string
  onChange: (n: number) => void
  defaultValue?: number
  source?: Sourced
  markers?: Marker[]
}

export function Slider({ label, value, min, max, step, format = (n) => usd(n), onChange, defaultValue, source, markers = [] }: SliderProps) {
  const id = useId()
  const pct = (n: number) => `${((Math.min(max, Math.max(min, n)) - min) / (max - min)) * 100}%`
  const changed = defaultValue != null && Math.abs(value - defaultValue) > step / 2
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] text-fg">
          {label}
        </label>
        <span className="num text-[13px] font-medium text-fg" data-tip={source ? tipFor(source) : undefined} data-tip-pos="left">
          {format(value)}
        </span>
      </div>
      <div className="relative mt-2 h-5">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line-strong" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent" style={{ width: pct(value) }} />
        {markers.map((m) => (
          <div
            key={m.label}
            className="pointer-events-none absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted"
            style={{ left: pct(m.value), backgroundColor: m.color }}
          />
        ))}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range absolute inset-0 w-full"
        />
      </div>
      <div className="mt-1.5 flex min-h-3 items-center justify-between gap-2">
        {source ? <SourceTag s={source} /> : <span />}
        {changed && (
          <button type="button" onClick={() => onChange(defaultValue!)} className="text-[11px] text-subtle hover:text-fg">
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

/** Card surface used across tabs and overlays */
export const card = 'rounded-md border border-line bg-surface'
/** Floating surface over the map (slightly translucent) */
export const floating =
  'rounded-md border border-line-strong bg-surface/90 shadow-[0_8px_32px_rgb(0_0_0/0.18)] backdrop-blur-xl backdrop-saturate-150'
/** Amber section header, terminal style */
export const header = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-accent'
