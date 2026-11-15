import { useId, type ReactNode } from 'react'
import { formatAsOf, isStale, type Sourced } from '../data'

/** "as of Oct 2026" with source link; amber dot + "stale" when out of date. */
export function SourceTag({ s, className = '' }: { s: Sourced; className?: string }) {
  const stale = isStale(s)
  const title = [s.label, s.source, s.error && `Last refresh failed: ${s.error}`, s.updatedLocally && 'Refreshed manually']
    .filter(Boolean)
    .join('\n')
  const body = (
    <>
      {stale && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
      <span>
        {s.asOf ? `as of ${formatAsOf(s.asOf)}` : 'assumption'}
        {stale && <span className="text-amber-400"> · stale</span>}
      </span>
    </>
  )
  const cls = `inline-flex items-center gap-1 text-[11px] leading-none text-zinc-500 ${className}`
  return s.sourceUrl ? (
    <a href={s.sourceUrl} target="_blank" rel="noreferrer" title={title} className={`${cls} hover:text-zinc-300 hover:underline`}>
      {body}
    </a>
  ) : (
    <span title={title} className={cls}>
      {body}
    </span>
  )
}

export interface Marker {
  value: number
  label: string
  color: string
}

interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  format: (n: number) => string
  onChange: (n: number) => void
  defaultValue?: number
  source?: Sourced
  markers?: Marker[]
  accent?: string
}

export function Slider({ label, value, min, max, step, format, onChange, defaultValue, source, markers = [], accent = '#fbbf24' }: SliderProps) {
  const id = useId()
  const pct = (n: number) => `${((Math.min(max, Math.max(min, n)) - min) / (max - min)) * 100}%`
  const changed = defaultValue != null && Math.abs(value - defaultValue) > step / 2
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-zinc-300">
          {label}
        </label>
        <span className="font-mono text-sm tabular-nums text-zinc-100">{format(value)}</span>
      </div>
      <div className="relative mt-1.5 h-5">
        {/* track fill */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ width: pct(value), backgroundColor: accent }}
        />
        {markers.map((m) => (
          <div
            key={m.label}
            className="pointer-events-none absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: pct(m.value), backgroundColor: m.color }}
            title={`${m.label}: ${format(m.value)}`}
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
          style={{ ['--thumb' as string]: accent }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        {source ? <SourceTag s={source} /> : <span />}
        {changed && (
          <button type="button" onClick={() => onChange(defaultValue!)} className="text-[11px] text-zinc-500 hover:text-zinc-200">
            Reset to {format(defaultValue!)}
          </button>
        )}
      </div>
    </div>
  )
}

export const glass =
  'rounded-2xl border border-white/10 bg-zinc-900/65 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150'
